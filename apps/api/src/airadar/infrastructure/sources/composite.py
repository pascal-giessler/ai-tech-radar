"""Combines several tool sources, isolating each one's failures so a single
upstream outage never blanks the radar."""

import logging

from airadar.application.dto import DiscoveredTool
from airadar.domain.ports import ToolSource

logger = logging.getLogger(__name__)


class CompositeToolSource:
    def __init__(self, sources: list[ToolSource]) -> None:
        self._sources = sources

    def fetch_trending(self) -> list[DiscoveredTool]:
        seen: dict[str, DiscoveredTool] = {}
        for source in self._sources:
            try:
                items = source.fetch_trending()
            except Exception:  # a broken source must not take down the scan
                logger.exception("source %s failed; continuing", type(source).__name__)
                continue
            for item in items:
                seen.setdefault(f"{item.owner}/{item.name}", item)
        return list(seen.values())
