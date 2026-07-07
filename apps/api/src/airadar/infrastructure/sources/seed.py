"""Curated seed source: tools that belong on the radar regardless of this week's
trending list — the stack we're already using. Composes with live sources."""

import json
import logging
from datetime import UTC, datetime
from importlib import resources

from airadar.application.dto import DiscoveredTool

logger = logging.getLogger(__name__)


class SeedToolSource:
    def __init__(self, entries: list[dict] | None = None) -> None:
        self._entries = entries if entries is not None else _load_bundled()

    def fetch_trending(self) -> list[DiscoveredTool]:
        tools: list[DiscoveredTool] = []
        for entry in self._entries:
            try:
                tools.append(
                    DiscoveredTool(
                        owner=entry["owner"],
                        name=entry["name"],
                        description=entry.get("description", ""),
                        topics=list(entry.get("topics", [])),
                        language=entry.get("language"),
                        stars=int(entry.get("stars", 0)),
                        url=entry["url"],
                        repo_created_at=datetime.fromisoformat(
                            entry.get("created_at", "2020-01-01T00:00:00+00:00").replace(
                                "Z", "+00:00"
                            )
                        ),
                    )
                )
            except (KeyError, ValueError) as exc:
                logger.warning("skipping malformed seed entry %s: %s", entry, exc)
        return tools


def _load_bundled() -> list[dict]:
    try:
        raw = resources.files("airadar.infrastructure.sources").joinpath("seed_tools.json")
        return json.loads(raw.read_text(encoding="utf-8"))
    except (FileNotFoundError, ModuleNotFoundError, json.JSONDecodeError) as exc:
        logger.warning("no bundled seed list (%s); starting from live sources only", exc)
        return []


# Fallback timestamp helper kept for reference; entries carry their own dates.
_DEFAULT_CREATED = datetime(2020, 1, 1, tzinfo=UTC).isoformat()
