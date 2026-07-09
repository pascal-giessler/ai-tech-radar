from airadar.application.ingest_trending import IngestTrendingTools
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


def ingest(repo, n: int) -> None:
    items = [discovered(name=f"tool-{i}", description=f"desc {i}") for i in range(n)]
    IngestTrendingTools(FakeToolSource(items), repo, TrendScorer(), FixedClock()).execute()


def make_use_case(tool_repo, cluster_repo=None, embedder=None, clusterer=None, broadcaster=None):
    return RecomputeLandscape(
        tools=tool_repo,
        clusters=cluster_repo or InMemoryClusterRepository(),
        embedder=embedder or FakeEmbedder(),
        projector=GridProjector(),
        clusterer=clusterer or ModuloClusterer(n=2),
        labeler=KeywordLabeler(),
        broadcaster=broadcaster or RecordingBroadcaster(),
        min_tools=12,
    )


def test_every_tool_gets_a_position() -> None:
    repo = InMemoryToolRepository()
    ingest(repo, 3)
    make_use_case(repo).execute()

    assert all(t.position is not None for t in repo.list_all())


def test_below_threshold_all_tools_land_in_uncharted() -> None:
    repo = InMemoryToolRepository()
    clusters = InMemoryClusterRepository()
    ingest(repo, 3)
    make_use_case(repo, cluster_repo=clusters).execute()

    stored = clusters.list_all()
    assert len(stored) == 1
    assert stored[0].label == "Uncharted"
    assert stored[0].id == 0
    assert all(t.cluster_id == 0 for t in repo.list_all())


def test_above_threshold_uses_clusterer_and_labeler() -> None:
    repo = InMemoryToolRepository()
    clusters = InMemoryClusterRepository()
    ingest(repo, 14)
    make_use_case(repo, cluster_repo=clusters, clusterer=ModuloClusterer(n=2)).execute()

    labels = {c.label for c in clusters.list_all()}
    assert "Cluster 0" in labels and "Cluster 1" in labels
    assert {t.cluster_id for t in repo.list_all()} == {1, 2}  # remapped, 0 reserved


def test_noise_tools_fall_into_uncharted() -> None:
    repo = InMemoryToolRepository()
    clusters = InMemoryClusterRepository()
    ingest(repo, 14)
    make_use_case(
        repo, cluster_repo=clusters, clusterer=ModuloClusterer(n=2, noise=True)
    ).execute()

    uncharted = clusters.get_by_slug("uncharted")
    assert uncharted is not None
    assert uncharted.size == 1


def test_unchanged_tools_are_not_reembedded() -> None:
    repo = InMemoryToolRepository()
    embedder = FakeEmbedder()
    ingest(repo, 3)
    use_case = make_use_case(repo, embedder=embedder)
    use_case.execute()
    first_count = embedder.embedded_count
    use_case.execute()

    assert embedder.embedded_count == first_count


def test_broadcaster_receives_landscape_updated_event() -> None:
    repo = InMemoryToolRepository()
    broadcaster = RecordingBroadcaster()
    ingest(repo, 2)
    make_use_case(repo, broadcaster=broadcaster).execute()

    assert broadcaster.events[-1]["type"] == "landscape_updated"
    assert broadcaster.events[-1]["tool_count"] == 2


def test_report_counts() -> None:
    repo = InMemoryToolRepository()
    ingest(repo, 5)
    report = make_use_case(repo).execute()

    assert report.tool_count == 5
    assert report.cluster_count == 1


def test_execute_time_min_cluster_size_is_threaded_into_clusterer() -> None:
    repo = InMemoryToolRepository()
    clusterer = ModuloClusterer(n=2)
    ingest(repo, 14)
    make_use_case(repo, clusterer=clusterer).execute(min_cluster_size=7)

    assert clusterer.last_min_cluster_size == 7


def test_execute_time_min_tools_overrides_instance_default() -> None:
    repo = InMemoryToolRepository()
    clusters = InMemoryClusterRepository()
    clusterer = ModuloClusterer(n=2)
    ingest(repo, 5)
    # instance default min_tools=12 would force Uncharted; override drops it to 3.
    make_use_case(repo, cluster_repo=clusters, clusterer=clusterer).execute(min_tools=3)

    assert clusterer.last_min_cluster_size is not None  # clusterer was actually called
    assert {c.label for c in clusters.list_all()} != {"Uncharted"}


def test_real_clusters_get_keywords_and_description() -> None:
    repo = InMemoryToolRepository()
    clusters = InMemoryClusterRepository()
    ingest(repo, 14)
    make_use_case(repo, cluster_repo=clusters, clusterer=ModuloClusterer(n=2)).execute()

    real = [c for c in clusters.list_all() if c.label != "Uncharted"]
    assert real
    for cluster in real:
        assert cluster.keywords  # top c-TF-IDF terms from the fake labeler
        assert "grouped by semantic similarity" in cluster.description
        assert "strongest signals" in cluster.description
