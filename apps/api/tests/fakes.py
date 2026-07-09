"""In-memory fakes implementing the domain ports, for fast unit tests."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime

from airadar.application.dto import DiscoveredTool
from airadar.domain.model.cluster import Cluster
from airadar.domain.model.position import Position3D
from airadar.domain.model.radar_settings import RadarSettings
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

    def prune_area(self, keep: str) -> int:
        stale = [slug for slug, t in self._by_slug.items() if t.area != keep]
        for slug in stale:
            del self._by_slug[slug]
        return len(stale)


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
    """Assigns item i to cluster i % n; item 0 becomes noise when noise=True.

    Records the last `min_cluster_size` it was called with, so tests can assert the
    configured value is threaded through from settings.
    """

    def __init__(self, n: int = 2, noise: bool = False) -> None:
        self.n = n
        self.noise = noise
        self.last_min_cluster_size: int | None = None

    def assign(
        self, embeddings: list[list[float]], min_cluster_size: int | None = None
    ) -> list[int]:
        self.last_min_cluster_size = min_cluster_size
        labels = [i % self.n for i in range(len(embeddings))]
        if self.noise and labels:
            labels[0] = -1
        return labels


class KeywordLabeler:
    def label(self, docs_by_cluster: dict[int, list[str]]) -> dict[int, str]:
        return {cid: label for cid, (label, _kw) in self.profile(docs_by_cluster).items()}

    def profile(
        self, docs_by_cluster: dict[int, list[str]]
    ) -> dict[int, tuple[str, list[str]]]:
        return {
            cid: (f"Cluster {cid}", [f"kw{cid}a", f"kw{cid}b", f"kw{cid}c"])
            for cid in docs_by_cluster
        }


class InMemorySettingsRepository:
    def __init__(self, settings: RadarSettings | None = None) -> None:
        self._settings = settings or RadarSettings()

    def get(self) -> RadarSettings:
        return self._settings

    def update(self, **fields) -> RadarSettings:
        allowed = {"area_preset", "min_cluster_size", "min_tools"}
        current = {
            "area_preset": self._settings.area_preset,
            "min_cluster_size": self._settings.min_cluster_size,
            "min_tools": self._settings.min_tools,
        }
        current.update({k: v for k, v in fields.items() if k in allowed})
        self._settings = RadarSettings(**current)
        return self._settings


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
    open_issues: int = 0,
    commit_activity: list[int] | None = None,
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
        open_issues=open_issues,
        commit_activity=commit_activity if commit_activity is not None else [],
    )
