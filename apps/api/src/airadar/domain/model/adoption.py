from __future__ import annotations

from enum import Enum


class AdoptionRing(Enum):
    """The recommendation axis — the Thoughtworks radar rings, ordered inward.

    Adopt is the innermost ring (proven, safe default); Hold the outermost
    (cooling or stalled, don't chase). `order` drives radial placement in the
    2D radar view.
    """

    ADOPT = ("adopt", "Adopt", 0)
    TRIAL = ("trial", "Trial", 1)
    ASSESS = ("assess", "Assess", 2)
    HOLD = ("hold", "Hold", 3)

    def __init__(self, slug: str, label: str, order: int) -> None:
        self.slug = slug
        self.label = label
        self.order = order

    @classmethod
    def ordered(cls) -> list[AdoptionRing]:
        return sorted(cls, key=lambda r: r.order)

    @classmethod
    def from_slug(cls, slug: str) -> AdoptionRing:
        for ring in cls:
            if ring.slug == slug:
                return ring
        raise ValueError(f"unknown adoption ring: {slug!r}")
