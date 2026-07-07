from dataclasses import dataclass, field
from typing import Any

from airadar.application.queries import GetLandscape, GetTool, ListClusters, ListTools
from airadar.domain.ports import ClusterRepository, ToolRepository
from airadar.infrastructure.broadcast import AsyncFanoutBroadcaster


@dataclass
class Container:
    """Wired use cases and shared services handed to the HTTP layer."""

    get_landscape: GetLandscape
    get_tool: GetTool
    list_tools: ListTools
    list_clusters: ListClusters
    tools: ToolRepository
    clusters: ClusterRepository
    broadcaster: AsyncFanoutBroadcaster
    lifespan_tasks: list[Any] = field(default_factory=list)
