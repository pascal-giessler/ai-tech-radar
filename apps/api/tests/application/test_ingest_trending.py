from airadar.application.ingest_trending import IngestTrendingTools
from airadar.domain.model.adoption import AdoptionRing
from airadar.domain.services.adoption_classifier import AdoptionClassifier
from airadar.domain.services.trend_scorer import TrendScorer

from tests.fakes import FakeToolSource, FixedClock, InMemoryToolRepository, discovered


def make_use_case(items, repo=None, clock=None):
    return IngestTrendingTools(
        source=FakeToolSource(items),
        tools=repo or InMemoryToolRepository(),
        scorer=TrendScorer(),
        classifier=AdoptionClassifier(),
        clock=clock or FixedClock(),
    )


def test_new_tool_is_created_with_score_and_ring() -> None:
    repo = InMemoryToolRepository()
    report = make_use_case([discovered(stars=800)], repo=repo).execute()

    assert report.new == 1
    assert report.updated == 0
    tool = repo.get_by_slug("acme-rtk")
    assert tool is not None
    assert tool.stars == 800
    assert tool.trend_score > 0
    assert tool.ring in set(AdoptionRing)


def test_ring_reflects_maturity_and_momentum() -> None:
    repo = InMemoryToolRepository()
    make_use_case(
        [discovered(name="giant", stars=90_000, repo_created_at=None)], repo=repo
    ).execute()
    # huge repo, first-scan momentum estimate keeps it warm -> Adopt
    assert repo.get_by_slug("acme-giant").ring == AdoptionRing.ADOPT


def test_reingesting_same_ref_updates_instead_of_duplicating() -> None:
    repo = InMemoryToolRepository()
    make_use_case([discovered(stars=500)], repo=repo).execute()
    report = make_use_case([discovered(stars=650)], repo=repo).execute()

    assert report.new == 0
    assert report.updated == 1
    assert len(repo.list_all()) == 1
    tool = repo.get_by_slug("acme-rtk")
    assert tool.stars == 650
    assert tool.stars_gained == 150


def test_update_refreshes_description_and_topics() -> None:
    repo = InMemoryToolRepository()
    make_use_case([discovered()], repo=repo).execute()
    make_use_case(
        [discovered(description="New description", topics=["ai"])], repo=repo
    ).execute()

    tool = repo.get_by_slug("acme-rtk")
    assert tool.description == "New description"
    assert tool.topics == ["ai"]


def test_report_counts_mixed_batch() -> None:
    repo = InMemoryToolRepository()
    make_use_case([discovered(name="one")], repo=repo).execute()
    report = make_use_case(
        [discovered(name="one", stars=600), discovered(name="two")], repo=repo
    ).execute()

    assert report.new == 1
    assert report.updated == 1


def test_execute_defaults_area_to_ai() -> None:
    repo = InMemoryToolRepository()
    make_use_case([discovered()], repo=repo).execute()
    assert repo.get_by_slug("acme-rtk").area == "ai"


def test_execute_tags_tools_with_active_area() -> None:
    repo = InMemoryToolRepository()
    make_use_case([discovered()], repo=repo).execute(area="rust")
    assert repo.get_by_slug("acme-rtk").area == "rust"


def test_resurfacing_tool_moves_to_new_area() -> None:
    repo = InMemoryToolRepository()
    make_use_case([discovered()], repo=repo).execute(area="ai")
    make_use_case([discovered(stars=700)], repo=repo).execute(area="rust")
    assert repo.get_by_slug("acme-rtk").area == "rust"


def test_area_switch_prunes_previous_area() -> None:
    """Ingest AI, then ingest a disjoint Rust batch and prune: only Rust remains."""
    repo = InMemoryToolRepository()
    make_use_case([discovered(name="ai-tool")], repo=repo).execute(area="ai")
    make_use_case([discovered(name="rust-tool")], repo=repo).execute(area="rust")

    removed = repo.prune_area("rust")

    assert removed == 1
    slugs = {t.slug for t in repo.list_all()}
    assert slugs == {"acme-rust-tool"}
