from airadar.domain.model.adoption import AdoptionRing

# Opinionated thresholds — the product's point of view on the maturity × momentum
# plane. Documented in the rings design addendum.
MATURE_STARS = 15_000
ESTABLISHED_STARS = 1_500
WARM_SCORE = 18.0


class AdoptionClassifier:
    """Maps a tool's live signals onto a Thoughtworks-style adoption ring.

    Two axes: maturity (absolute stars) and momentum (trend score).
      cold (not warm)        -> Hold    (cooling or stalled, don't chase)
      warm + mature          -> Adopt   (proven and thriving)
      warm + established     -> Trial   (real traction, worth piloting)
      warm + young           -> Assess  (emerging, unproven, worth watching)
    """

    def classify(
        self, stars: int, stars_gained: int, trend_score: float, age_days: float
    ) -> AdoptionRing:
        mature = stars >= MATURE_STARS
        established = stars >= ESTABLISHED_STARS
        warm = trend_score >= WARM_SCORE

        if not warm:
            return AdoptionRing.HOLD
        if mature:
            return AdoptionRing.ADOPT
        if established:
            return AdoptionRing.TRIAL
        # young (below established) but still warm/hot -> worth assessing
        return AdoptionRing.ASSESS
