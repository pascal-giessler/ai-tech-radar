"""Ports (interfaces) the application layer depends on; implemented in infrastructure."""

from datetime import datetime
from typing import TYPE_CHECKING, Protocol

from airadar.domain.model.cluster import Cluster
from airadar.domain.model.position import Position3D
from airadar.domain.model.radar_settings import RadarSettings
from airadar.domain.model.repo_ref import RepoRef
from airadar.domain.model.tool import Tool

if TYPE_CHECKING:
    from airadar.application.dto import DiscoveredTool


class ToolRepository(Protocol):
    def get_by_ref(self, ref: RepoRef) -> Tool | None: ...
    def get_by_slug(self, slug: str) -> Tool | None: ...
    def upsert(self, tool: Tool) -> Tool: ...
    def list_all(self) -> list[Tool]: ...
    def list_ranked(self, limit: int = 200) -> list[Tool]: ...
    def prune_area(self, keep: str) -> int: ...


class ClusterRepository(Protocol):
    def replace_all(self, clusters: list[Cluster]) -> None: ...
    def list_all(self) -> list[Cluster]: ...
    def get_by_slug(self, slug: str) -> Cluster | None: ...


class ToolSource(Protocol):
    def fetch_trending(self) -> "list[DiscoveredTool]": ...


class EmbeddingModel(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class Projector(Protocol):
    def project(self, embeddings: list[list[float]]) -> list[Position3D]: ...


class Clusterer(Protocol):
    def assign(
        self, embeddings: list[list[float]], min_cluster_size: int | None = None
    ) -> list[int]: ...


class ClusterLabeler(Protocol):
    def label(self, docs_by_cluster: dict[int, list[str]]) -> dict[int, str]: ...

    def profile(
        self, docs_by_cluster: dict[int, list[str]]
    ) -> "dict[int, tuple[str, list[str]]]":
        """Return per-cluster (label, keywords) — keywords are the top c-TF-IDF terms."""
        ...


class SettingsRepository(Protocol):
    def get(self) -> RadarSettings: ...
    def update(self, **fields) -> RadarSettings: ...


class PresetRepository(Protocol):
    """User-added radar areas (bundled presets stay in code)."""

    def list_all(self) -> list: ...
    def add(self, slug: str, title: str, topics: list[str], seed_file: str | None = None) -> None: ...


class UpdateBroadcaster(Protocol):
    def publish(self, event: dict) -> None: ...


class Clock(Protocol):
    def now(self) -> datetime: ...
