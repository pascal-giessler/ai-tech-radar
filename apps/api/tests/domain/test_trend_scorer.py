from airadar.domain.services.trend_scorer import TrendScorer

scorer = TrendScorer()


def test_score_is_bounded() -> None:
    assert 0.0 <= scorer.score(stars=0, stars_gained=0, age_days=1000) <= 100.0
    assert 0.0 <= scorer.score(stars=500_000, stars_gained=50_000, age_days=0) <= 100.0


def test_more_gain_scores_strictly_higher() -> None:
    low = scorer.score(stars=1000, stars_gained=10, age_days=100)
    high = scorer.score(stars=1000, stars_gained=500, age_days=100)
    assert high > low


def test_younger_repo_with_same_gain_scores_higher() -> None:
    young = scorer.score(stars=1000, stars_gained=200, age_days=5)
    old = scorer.score(stars=1000, stars_gained=200, age_days=400)
    assert young > old


def test_stale_small_repo_scores_low() -> None:
    assert scorer.score(stars=50, stars_gained=0, age_days=900) < 15.0


def test_viral_repo_scores_high() -> None:
    assert scorer.score(stars=20_000, stars_gained=3000, age_days=10) > 60.0


def test_negative_gain_treated_as_zero() -> None:
    assert scorer.score(stars=100, stars_gained=-50, age_days=50) == scorer.score(
        stars=100, stars_gained=0, age_days=50
    )
