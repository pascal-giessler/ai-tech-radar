from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from airadar.application.queries import GetLandscape, GetTool, ListClusters, ListTools
from airadar.application.settings import GetSettings, UpdateSettings
from airadar.domain.ports import ClusterRepository, SettingsRepository, ToolRepository
from airadar.infrastructure.broadcast import AsyncFanoutBroadcaster

# A scan older than this (or none at all) flips the service to "degraded".
STALE_AFTER = timedelta(hours=2)


@dataclass
class RadarStatus:
    """Mutable health snapshot updated by the refresh job, read by /health."""

    last_successful_scan: datetime | None = None
    tools_tracked: int = 0
    last_error: str | None = None

    def record_success(self, at: datetime, tools_tracked: int) -> None:
        self.last_successful_scan = at
        self.tools_tracked = tools_tracked
        self.last_error = None

    def record_failure(self, message: str) -> None:
        self.last_error = message

    def is_degraded(self, now: datetime) -> bool:
        if self.last_successful_scan is None:
            return True
        return (now - self.last_successful_scan) > STALE_AFTER

    def as_dict(self, now: datetime) -> dict:
        degraded = self.is_degraded(now)
        return {
            "status": "degraded" if degraded else "ok",
            "degraded": degraded,
            "tools_tracked": self.tools_tracked,
            "last_successful_scan": (
                self.last_successful_scan.isoformat() if self.last_successful_scan else None
            ),
            "last_error": self.last_error,
        }


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
    # Settings surface (optional so fake-backed test containers stay terse).
    settings: SettingsRepository | None = None
    get_settings: GetSettings | None = None
    update_settings: UpdateSettings | None = None
    status: RadarStatus = field(default_factory=RadarStatus)
    # Readiness check — returns True when the database is reachable. Defaults to a
    # no-op "reachable" for fakes/tests; wired to a real SELECT 1 in production.
    db_ping: Callable[[], bool] = lambda: True
    lifespan_tasks: list[Any] = field(default_factory=list)
