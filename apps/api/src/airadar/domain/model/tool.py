import hashlib
from dataclasses import dataclass, field
from datetime import datetime

from airadar.domain.model.adoption import AdoptionRing
from airadar.domain.model.position import Position3D
from airadar.domain.model.radar_settings import DEFAULT_AREA_PRESET
from airadar.domain.model.repo_ref import RepoRef


@dataclass
class Tool:
    """Aggregate root: a repo/product on the radar."""

    ref: RepoRef
    description: str
    topics: list[str]
    language: str | None
    url: str
    stars: int
    stars_prev: int | None
    repo_created_at: datetime
    first_seen_at: datetime
    last_updated_at: datetime
    trend_score: float = 0.0
    ring: AdoptionRing | None = None
    position: Position3D | None = None
    cluster_id: int | None = None
    embedding: list[float] | None = None
    embedded_fingerprint: str | None = field(default=None)
    open_issues: int = 0
    # Weekly commit counts, most-recent-last, up to ~12 entries. Empty when the
    # GitHub stats endpoint is unavailable (202/rate-limit/no token) — never blocks.
    commit_activity: list[float] = field(default_factory=list)
    # The radar area (preset slug) this tool was last ingested under. Lets an area
    # switch cleanly swap the landscape: tools tagged with a different area are pruned.
    area: str = DEFAULT_AREA_PRESET

    @property
    def slug(self) -> str:
        return self.ref.slug

    @property
    def commits_recent(self) -> int:
        return int(sum(self.commit_activity))

    @property
    def stars_gained(self) -> int:
        return self.stars - self.stars_prev if self.stars_prev is not None else 0

    def record_signal(self, stars: int, at: datetime) -> None:
        self.stars_prev = self.stars
        self.stars = stars
        self.last_updated_at = at

    def content_fingerprint(self) -> str:
        payload = "\x1f".join([self.ref.full_name, self.description, *sorted(self.topics)])
        return hashlib.sha256(payload.encode()).hexdigest()

    def embedding_text(self) -> str:
        parts = [f"{self.ref.name}. {self.description}."]
        if self.topics:
            parts.append(f"topics: {', '.join(self.topics)}")
        return " ".join(parts)

    def needs_embedding(self) -> bool:
        return self.embedding is None or self.embedded_fingerprint != self.content_fingerprint()
