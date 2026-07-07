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


def test_second_scan_uses_real_delta_not_estimate() -> None:
    repo = InMemoryToolRepository()
    ingest([discovered(name="tool", stars=1000)], repo)
    first_score = repo.get_by_slug("acme-tool").trend_score

    ingest([discovered(name="tool", stars=1000)], repo)  # no growth between scans
    second_score = repo.get_by_slug("acme-tool").trend_score

    assert second_score < first_score  # real zero-velocity beats the optimistic estimate
