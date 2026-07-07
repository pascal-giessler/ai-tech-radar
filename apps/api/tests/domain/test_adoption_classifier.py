from airadar.domain.model.adoption import AdoptionRing
from airadar.domain.services.adoption_classifier import AdoptionClassifier

classify = AdoptionClassifier().classify


def test_mature_and_thriving_repo_is_adopt() -> None:
    # e.g. huggingface/transformers: huge and still moving
    assert classify(stars=120_000, stars_gained=800, trend_score=35, age_days=2000) == AdoptionRing.ADOPT


def test_established_and_hot_repo_is_trial() -> None:
    # solid adoption, growing fast — pilot it
    assert classify(stars=5_000, stars_gained=900, trend_score=60, age_days=200) == AdoptionRing.TRIAL


def test_young_and_hot_repo_is_assess() -> None:
    # viral newcomer, not yet proven
    assert classify(stars=300, stars_gained=250, trend_score=70, age_days=15) == AdoptionRing.ASSESS


def test_mature_but_cold_repo_is_hold() -> None:
    # big but stalled — don't chase it
    assert classify(stars=60_000, stars_gained=5, trend_score=6, age_days=3000) == AdoptionRing.HOLD


def test_small_and_cold_repo_is_hold() -> None:
    assert classify(stars=200, stars_gained=0, trend_score=4, age_days=900) == AdoptionRing.HOLD


def test_established_and_warm_repo_is_trial() -> None:
    # real adoption, moderate momentum
    assert classify(stars=3_000, stars_gained=120, trend_score=25, age_days=300) == AdoptionRing.TRIAL


def test_small_and_warm_repo_is_assess() -> None:
    assert classify(stars=400, stars_gained=60, trend_score=25, age_days=120) == AdoptionRing.ASSESS


def test_every_ring_is_reachable_across_the_signal_space() -> None:
    rings = {
        classify(stars=s, stars_gained=g, trend_score=t, age_days=a)
        for s, g, t, a in [
            (150_000, 500, 30, 2500),  # adopt
            (4_000, 800, 55, 180),     # trial
            (250, 200, 65, 10),        # assess
            (500, 1, 5, 800),          # hold
        ]
    }
    assert rings == set(AdoptionRing)


def test_ring_metadata_is_stable_and_ordered_inward() -> None:
    # Adopt is the innermost ring (order 0), Hold the outermost (order 3).
    assert [r.order for r in AdoptionRing.ordered()] == [0, 1, 2, 3]
    assert AdoptionRing.ADOPT.slug == "adopt"
    assert AdoptionRing.ADOPT.label == "Adopt"
    assert AdoptionRing.from_slug("trial") == AdoptionRing.TRIAL
