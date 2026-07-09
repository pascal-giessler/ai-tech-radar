"""Curated seed source: tools that belong on the radar regardless of this week's
trending list — the stack we're already using. Composes with live sources."""

import json
import logging
from datetime import UTC, datetime
from importlib import resources

from airadar.application.dto import DiscoveredTool

logger = logging.getLogger(__name__)


class SeedToolSource:
    """Curated seed for the active area. `entries` pins a fixed list (tests); left
    unset, entries are loaded from the current preset's seed file, which
    `set_seed_file` swaps on an area change. A ``None`` file means no seed (the
    domain has no curated list), so another area's seed never leaks in."""

    DEFAULT_SEED_FILE = "seed_tools.json"

    def __init__(
        self, entries: list[dict] | None = None, seed_file: str | None = DEFAULT_SEED_FILE
    ) -> None:
        self._explicit = entries
        self._seed_file = seed_file

    def set_seed_file(self, name: str | None) -> None:
        self._seed_file = name

    def _resolve_entries(self) -> list[dict]:
        if self._explicit is not None:
            return self._explicit
        if not self._seed_file:
            return []
        return _load_bundled(self._seed_file)

    def fetch_trending(self) -> list[DiscoveredTool]:
        tools: list[DiscoveredTool] = []
        for entry in self._resolve_entries():
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


def _load_bundled(filename: str) -> list[dict]:
    try:
        raw = resources.files("airadar.infrastructure.sources").joinpath(filename)
        return json.loads(raw.read_text(encoding="utf-8"))
    except (FileNotFoundError, ModuleNotFoundError, json.JSONDecodeError) as exc:
        logger.warning("no bundled seed list %r (%s); live sources only", filename, exc)
        return []


# Fallback timestamp helper kept for reference; entries carry their own dates.
_DEFAULT_CREATED = datetime(2020, 1, 1, tzinfo=UTC).isoformat()
