"""In-memory fakes implementing the domain ports, for fast unit tests."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime

from airadar.application.dto import DiscoveredTool
from airadar.domain.model.cluster import Cluster
from airadar.domain.model.position import Position3D
from airadar.domain.model.repo_ref import RepoRef
from airadar.domain.model.tool import Tool


class InMemoryToolRepository:
    def __init__(self) -> None:
        self._by_slug: dict[str, Tool] = {}

    def get_by_ref(self, ref: RepoRef) -> Tool | None:
        return self._by_slug.get(ref.slug)

    def get_by_slug(self, slug: str) -> Tool | None:
        return self._by_slug.get(slug)

    def upsert(self, tool: Tool) -> Tool:
        self._by_slug[tool.slug] = tool
        return tool

    def list_all(self) -> list[Tool]:
        return list(self._by_slug.values())

    def list_ranked(self, limit: int = 200) -> list[Tool]:
        ranked = sorted(self._by_slug.values(), key=lambda t: t.trend_score, reverse=True)
        return ranked[:limit]


class InMemoryClusterRepository:
    def __init__(self) -> None:
        self._clusters: list[Cluster] = []

    def replace_all(self, clusters: list[Cluster]) -> None:
        self._clusters = list(clusters)

    def list_all(self) -> list[Cluster]:
        return list(self._clusters)

    def get_by_slug(self, slug: str) -> Cluster | None:
        return next((c for c in self._clusters if c.slug == slug), None)


class FakeToolSource:
    def __init__(self, items: list[DiscoveredTool]) -> None:
        self.items = items

    def fetch_trending(self) -> list[DiscoveredTool]:
        return list(self.items)


class FakeEmbedder:
    """Deterministic 8-dim embedding derived from the text hash; counts calls."""

    def __init__(self) -> None:
        self.calls: list[list[str]] = []

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(list(texts))
        out = []
        for text in texts:
            digest = hashlib.sha256(text.encode()).digest()
            out.append([b / 255.0 for b in digest[:8]])
        return out

    @property
    def embedded_count(self) -> int:
        return sum(len(c) for c in self.calls)


class GridProjector:
    """Places item i at (i, i, i) — deterministic and order-preserving."""

    def project(self, embeddings: list[list[float]]) -> list[Position3D]:
        return [Position3D(float(i), float(i), float(i)) for i in range(len(embeddings))]


class ModuloClusterer:
    """Assigns item i to cluster i % n; item 0 becomes noise when noise=True."""

    def __init__(self, n: int = 2, noise: bool = False) -> None:
        self.n = n
        self.noise = noise

    def assign(self, embeddings: list[list[float]]) -> list[int]:
        labels = [i % self.n for i in range(len(embeddings))]
        if self.noise and labels:
            labels[0] = -1
        return labels


class KeywordLabeler:
    def label(self, docs_by_cluster: dict[int, list[str]]) -> dict[int, str]:
        return {cid: f"Cluster {cid}" for cid in docs_by_cluster}


class RecordingBroadcaster:
    def __init__(self) -> None:
        self.events: list[dict] = []

    def publish(self, event: dict) -> None:
        self.events.append(event)


class FixedClock:
    def __init__(self, at: datetime | None = None) -> None:
        self.at = at or datetime(2026, 7, 7, 12, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self.at


def discovered(
    owner: str = "acme",
    name: str = "rtk",
    description: str = "Token-optimized CLI proxy",
    topics: list[str] | None = None,
    language: str | None = "Rust",
    stars: int = 500,
    url: str | None = None,
    repo_created_at: datetime | None = None,
) -> DiscoveredTool:
    return DiscoveredTool(
        owner=owner,
        name=name,
        description=description,
        topics=topics if topics is not None else ["cli"],
        language=language,
        stars=stars,
        url=url or f"https://github.com/{owner}/{name}",
        repo_created_at=repo_created_at or datetime(2026, 6, 1, tzinfo=UTC),
    )
