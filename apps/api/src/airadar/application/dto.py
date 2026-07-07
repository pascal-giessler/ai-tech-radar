from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class DiscoveredTool:
    owner: str
    name: str
    description: str
    topics: list[str]
    language: str | None
    stars: int
    url: str
    repo_created_at: datetime

    def __post_init__(self) -> None:
        object.__setattr__(self, "topics", list(self.topics))


@dataclass(frozen=True)
class IngestReport:
    new: int
    updated: int


@dataclass(frozen=True)
class LandscapeReport:
    tool_count: int
    cluster_count: int
