from dataclasses import dataclass, field
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
    open_issues: int = 0
    commit_activity: list[int] = field(default_factory=list)

    def __post_init__(self) -> None:
        object.__setattr__(self, "topics", list(self.topics))
        object.__setattr__(self, "commit_activity", list(self.commit_activity))


@dataclass(frozen=True)
class IngestReport:
    new: int
    updated: int


@dataclass(frozen=True)
class LandscapeReport:
    tool_count: int
    cluster_count: int
