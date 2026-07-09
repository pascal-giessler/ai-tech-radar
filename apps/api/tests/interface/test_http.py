import anyio
import pytest
from fastapi.testclient import TestClient

from airadar.application.ingest_trending import IngestTrendingTools
from airadar.application.queries import GetLandscape, GetTool, ListClusters, ListTools
from airadar.application.recompute_landscape import RecomputeLandscape
from airadar.application.settings import GetSettings, UpdateSettings
from airadar.domain.model.radar_settings import RadarSettings
from airadar.domain.services.trend_scorer import TrendScorer
from airadar.infrastructure.broadcast import AsyncFanoutBroadcaster
from airadar.infrastructure.sources.presets import load_presets
from airadar.interface.container import Container
from airadar.interface.http import create_app

from tests.fakes import (
    FakeEmbedder,
    FakeToolSource,
    FixedClock,
    GridProjector,
    InMemoryClusterRepository,
    InMemorySettingsRepository,
    InMemoryToolRepository,
    KeywordLabeler,
    ModuloClusterer,
    RecordingBroadcaster,
    discovered,
)


@pytest.fixture()
def world():
    tools = InMemoryToolRepository()
    clusters = InMemoryClusterRepository()
    items = [discovered(name=f"tool-{i}", description=f"desc {i}") for i in range(3)]
    IngestTrendingTools(FakeToolSource(items), tools, TrendScorer(), FixedClock()).execute()
    RecomputeLandscape(
        tools, clusters, FakeEmbedder(), GridProjector(), ModuloClusterer(),
        KeywordLabeler(), RecordingBroadcaster(), min_tools=12,
    ).execute()
    broadcaster = AsyncFanoutBroadcaster()
    container = Container(
        get_landscape=GetLandscape(tools, clusters),
        get_tool=GetTool(tools),
        list_tools=ListTools(tools),
        list_clusters=ListClusters(clusters),
        tools=tools,
        clusters=clusters,
        broadcaster=broadcaster,
    )
    return container


@pytest.fixture()
def client(world):
    return TestClient(create_app(world))


def test_liveness_is_always_ok(client) -> None:
    # Liveness must never fail on degraded/DB state, or k8s would kill healthy pods.
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "alive"}


def test_readiness_ok_when_db_reachable(world) -> None:
    world.db_ping = lambda: True
    res = TestClient(create_app(world)).get("/health/ready")
    assert res.status_code == 200
    body = res.json()
    assert body["ready"] is True
    assert "tools_tracked" in body


def test_readiness_503_when_db_unreachable(world) -> None:
    world.db_ping = lambda: False
    res = TestClient(create_app(world)).get("/health/ready")
    assert res.status_code == 503
    assert res.json()["ready"] is False


def test_readiness_reports_scan_freshness(world) -> None:
    from datetime import UTC, datetime

    world.db_ping = lambda: True
    world.status.record_success(at=datetime.now(UTC), tools_tracked=3)
    body = TestClient(create_app(world)).get("/health/ready").json()
    assert body["degraded"] is False
    assert body["tools_tracked"] == 3


def test_rings_endpoint_returns_ordered_metadata(client) -> None:
    rings = client.get("/api/rings").json()
    assert [r["slug"] for r in rings] == ["adopt", "trial", "assess", "hold"]
    assert all("count" in r and "label" in r for r in rings)


def test_landscape_endpoint(client) -> None:
    body = client.get("/api/landscape").json()
    assert len(body["tools"]) == 3
    assert body["clusters"][0]["label"] == "Uncharted"


def test_tool_detail_and_404(client) -> None:
    assert client.get("/api/tools/acme-tool-0").status_code == 200
    assert client.get("/api/tools/missing").status_code == 404


def test_tools_list_respects_limit(client) -> None:
    assert len(client.get("/api/tools", params={"limit": 2}).json()) == 2


def test_cluster_detail_includes_member_tools(client) -> None:
    body = client.get("/api/clusters/uncharted").json()
    assert body["cluster"]["label"] == "Uncharted"
    assert len(body["tools"]) == 3


def test_cluster_404(client) -> None:
    assert client.get("/api/clusters/nope").status_code == 404


@pytest.fixture()
def settings_env():
    """A container wired with the settings surface + a recording NOTIFY publisher."""
    repo = InMemorySettingsRepository(RadarSettings())
    broadcaster = RecordingBroadcaster()
    presets = load_presets()
    get_settings = GetSettings(repo, presets, default_min_cluster_size=4, default_min_tools=12)
    update_settings = UpdateSettings(repo, presets, get_settings, broadcaster)
    tools, clusters = InMemoryToolRepository(), InMemoryClusterRepository()
    container = Container(
        get_landscape=GetLandscape(tools, clusters),
        get_tool=GetTool(tools),
        list_tools=ListTools(tools),
        list_clusters=ListClusters(clusters),
        tools=tools,
        clusters=clusters,
        broadcaster=AsyncFanoutBroadcaster(),
        settings=repo,
        get_settings=get_settings,
        update_settings=update_settings,
    )
    return TestClient(create_app(container)), broadcaster


def test_get_settings_returns_effective_shape(settings_env) -> None:
    client, _ = settings_env
    body = client.get("/api/settings").json()
    assert body["area_preset"] == "ai"
    assert body["min_cluster_size"] == 4
    assert body["min_tools"] == 12
    assert {"slug", "title"} <= body["presets"][0].keys()
    assert body["pipeline"]["algorithm"] == "HDBSCAN"


def test_patch_settings_persists_and_emits_notify(settings_env) -> None:
    client, broadcaster = settings_env
    res = client.patch("/api/settings", json={"area_preset": "rust", "min_cluster_size": 8})
    assert res.status_code == 200
    body = res.json()
    assert body["area_preset"] == "rust"
    assert body["min_cluster_size"] == 8
    assert broadcaster.events == [{"type": "radar_config_changed"}]


def test_patch_settings_rejects_unknown_preset(settings_env) -> None:
    client, _ = settings_env
    assert client.patch("/api/settings", json={"area_preset": "nope"}).status_code == 422


def test_patch_settings_rejects_out_of_range(settings_env) -> None:
    client, _ = settings_env
    assert client.patch("/api/settings", json={"min_cluster_size": 99}).status_code == 422
    assert client.patch("/api/settings", json={"min_tools": 1}).status_code == 422


def test_cluster_detail_includes_profile(client) -> None:
    body = client.get("/api/clusters/uncharted").json()
    assert "keywords" in body["cluster"]
    assert "description" in body["cluster"]


async def test_fanout_broadcaster_delivers_to_subscribers() -> None:
    broadcaster = AsyncFanoutBroadcaster()
    received = []

    async def consume():
        async for event in broadcaster.subscribe():
            received.append(event)
            break

    async with anyio.create_task_group() as tg:
        tg.start_soon(consume)
        await anyio.sleep(0.05)
        broadcaster.publish({"type": "landscape_updated", "tool_count": 1})

    assert received == [{"type": "landscape_updated", "tool_count": 1}]
