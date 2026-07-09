"""Area presets: point the radar at a domain by picking a preset (slug → topics + seed).

Presets are bundled as package data (``presets.json``). The default is ``ai``, whose
topics match the historical hardcoded set so default behaviour is unchanged. Add a
preset to fork the radar onto any domain.
"""

import json
import logging
from dataclasses import dataclass, field
from importlib import resources

logger = logging.getLogger(__name__)

DEFAULT_PRESET_SLUG = "ai"

# Fallback used when the bundled JSON is unreadable — keeps `ai` (default) working.
_FALLBACK: list[dict] = [
    {
        "slug": "ai",
        "title": "AI & Dev Tools",
        "topics": ["llm", "ai-agents", "developer-tools", "mcp", "rag", "llmops"],
        "seed_file": "seed_tools.json",
    }
]


@dataclass(frozen=True)
class Preset:
    slug: str
    title: str
    topics: list[str] = field(default_factory=list)
    # Curated seed file for this domain, or None when there's no curated list.
    # Scoped per preset so one area's seed never leaks into another.
    seed_file: str | None = None


def _load_raw() -> list[dict]:
    try:
        raw = resources.files("airadar.infrastructure.sources").joinpath("presets.json")
        return json.loads(raw.read_text(encoding="utf-8"))
    except (FileNotFoundError, ModuleNotFoundError, json.JSONDecodeError) as exc:
        logger.warning("no bundled presets (%s); using fallback", exc)
        return _FALLBACK


def load_presets() -> list[Preset]:
    return [
        Preset(
            slug=entry["slug"],
            title=entry["title"],
            topics=list(entry.get("topics", [])),
            seed_file=entry.get("seed_file"),
        )
        for entry in _load_raw()
    ]


def get_preset(slug: str) -> Preset:
    presets = load_presets()
    for preset in presets:
        if preset.slug == slug:
            return preset
    raise KeyError(slug)


def is_known_preset(slug: str) -> bool:
    return any(p.slug == slug for p in load_presets())
