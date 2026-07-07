from airadar.application.ingest_trending import IngestTrendingTools
from airadar.application.queries import GetLandscape, GetTool, ListClusters, ListTools
from airadar.application.recompute_landscape import RecomputeLandscape
from airadar.domain.services.trend_scorer import TrendScorer

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


def build_world(n: int = 3):
    tools = InMemoryToolRepository()
    clusters = InMemoryClusterRepository()
    items = [
        discovered(name=f"tool-{i}", description=f"desc {i}", stars=100 * (i + 1))
        for i in range(n)
    ]
    IngestTrendingTools(FakeToolSource(items), tools, TrendScorer(), FixedClock()).execute()
    RecomputeLandscape(
        tools=tools,
        clusters=clusters,
        embedder=FakeEmbedder(),
        projector=GridProjector(),
        clusterer=ModuloClusterer(),
        labeler=KeywordLabeler(),
        broadcaster=RecordingBroadcaster(),
        min_tools=12,
    ).execute()
    return tools, clusters


def test_landscape_payload_shape() -> None:
    tools, clusters = build_world()
    payload = GetLandscape(tools, clusters).execute()

    assert {"tools", "clusters", "generated_at"} <= payload.keys()
    tool = payload["tools"][0]
    assert {
        "slug", "name", "owner", "description", "language", "topics",
        "stars", "stars_gained", "trend_score", "url", "position", "cluster_id",
    } <= tool.keys()
    assert {"x", "y", "z"} == tool["position"].keys()
    cluster = payload["clusters"][0]
    assert {"id", "label", "slug", "size", "centroid"} <= cluster.keys()


def test_get_tool_returns_detail_or_none() -> None:
    tools, _ = build_world()
    detail = GetTool(tools).execute("acme-tool-0")
    assert detail is not None
    assert detail["name"] == "tool-0"
    assert "first_seen_at" in detail and "repo_created_at" in detail

    assert GetTool(tools).execute("nope") is None


def test_list_tools_ranked_by_trend_score() -> None:
    tools, _ = build_world(n=5)
    listed = ListTools(tools).execute(limit=3)
    assert len(listed) == 3
    scores = [t["trend_score"] for t in listed]
    assert scores == sorted(scores, reverse=True)


def test_list_clusters() -> None:
    _, clusters = build_world()
    listed = ListClusters(clusters).execute()
    assert listed and listed[0]["label"] == "Uncharted"
