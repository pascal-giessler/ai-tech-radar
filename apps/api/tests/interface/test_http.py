import anyio
import pytest
from fastapi.testclient import TestClient

from airadar.application.ingest_trending import IngestTrendingTools
from airadar.application.queries import GetLandscape, GetTool, ListClusters, ListTools
from airadar.application.recompute_landscape import RecomputeLandscape
from airadar.domain.services.trend_scorer import TrendScorer
from airadar.infrastructure.broadcast import AsyncFanoutBroadcaster
from airadar.interface.container import Container
from airadar.interface.http import create_app

from tests.fakes import (
    FakeEmbedder,
    FakeToolSource,
    FixedClock,
    GridProjector,
    InMemoryClusterRepository,
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


def test_health_reports_degraded_before_first_scan(client) -> None:
    body = client.get("/health").json()
    assert body["status"] == "degraded"
    assert body["degraded"] is True
    assert body["last_successful_scan"] is None


def test_health_reports_ok_after_a_successful_scan(world) -> None:
    from datetime import UTC, datetime

    world.status.record_success(at=datetime.now(UTC), tools_tracked=3)
    body = TestClient(create_app(world)).get("/health").json()
    assert body["status"] == "ok"
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
