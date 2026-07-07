from datetime import UTC, datetime

from airadar.application.ingest_trending import IngestTrendingTools
from airadar.domain.services.trend_scorer import TrendScorer

from tests.fakes import FakeToolSource, FixedClock, InMemoryToolRepository, discovered

NOW = datetime(2026, 7, 7, 12, 0, tzinfo=UTC)


def ingest(items, repo):
    IngestTrendingTools(FakeToolSource(items), repo, TrendScorer(), FixedClock(NOW)).execute()


def test_first_scan_ranks_fast_growing_new_repo_above_old_giant() -> None:
    """Without a previous signal, momentum is estimated from lifetime star rate."""
    repo = InMemoryToolRepository()
    ingest(
        [
            # 3000 stars in 10 days — clearly viral
            discovered(name="rocket", stars=3000, repo_created_at=datetime(2026, 6, 27, tzinfo=UTC)),
            # 80k stars over 8 years — a monument, not a trend
            discovered(name="monument", stars=80_000, repo_created_at=datetime(2018, 7, 7, tzinfo=UTC)),
        ],
        repo,
    )

    rocket = repo.get_by_slug("acme-rocket")
    monument = repo.get_by_slug("acme-monument")
    assert rocket.trend_score > monument.trend_score


def test_score_is_cadence_independent_when_no_recent_growth() -> None:
    """A flat inter-scan window is noise, not a signal: momentum holds at the
    tool's lifetime trend rather than collapsing to zero."""
    repo = InMemoryToolRepository()
    ingest([discovered(name="tool", stars=8000, repo_created_at=datetime(2026, 4, 1, tzinfo=UTC))], repo)
    first_score = repo.get_by_slug("acme-tool").trend_score

    ingest([discovered(name="tool", stars=8000, repo_created_at=datetime(2026, 4, 1, tzinfo=UTC))], repo)
    second_score = repo.get_by_slug("acme-tool").trend_score

    assert second_score == first_score
    assert second_score > 20  # healthy lifetime trend keeps it out of "Hold"


def test_real_recent_surge_boosts_above_lifetime_floor() -> None:
    repo = InMemoryToolRepository()
    ingest([discovered(name="tool", stars=5000, repo_created_at=datetime(2024, 1, 1, tzinfo=UTC))], repo)
    baseline = repo.get_by_slug("acme-tool").trend_score

    ingest([discovered(name="tool", stars=9000, repo_created_at=datetime(2024, 1, 1, tzinfo=UTC))], repo)
    surged = repo.get_by_slug("acme-tool").trend_score

    assert surged > baseline  # a real +4000 delta outweighs the lifetime estimate
