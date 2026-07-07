import math


class TrendScorer:
    """Pure momentum score in [0, 100] from star velocity, recency and mass."""

    def score(self, stars: int, stars_gained: int, age_days: float) -> float:
        gain = max(stars_gained, 0)
        velocity = 100.0 * (1.0 - math.exp(-gain / 150.0))
        recency_boost = 1.0 + 0.5 * max(0.0, 30.0 - age_days) / 30.0
        mass = 10.0 * (1.0 - math.exp(-stars / 5000.0))
        return min(100.0, velocity * recency_boost + mass)
