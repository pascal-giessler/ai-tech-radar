import hashlib
from dataclasses import dataclass, field
from datetime import datetime

from airadar.domain.model.position import Position3D
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
    position: Position3D | None = None
    cluster_id: int | None = None
    embedding: list[float] | None = None
    embedded_fingerprint: str | None = field(default=None)

    @property
    def slug(self) -> str:
        return self.ref.slug

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
