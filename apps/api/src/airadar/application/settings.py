"""Read/update the tunable radar settings and expose the pipeline description.

Kept pure (no ML/DB imports) so it runs in the fast unit-test layer. The pipeline
block is static metadata describing the fixed ingest→embed→reduce→cluster→label chain.
"""

from typing import Any

from airadar.domain.ports import SettingsRepository, UpdateBroadcaster

# Validation ranges (frozen API contract).
MIN_CLUSTER_SIZE_RANGE = (2, 20)
MIN_TOOLS_RANGE = (2, 100)

# Static description of the (fixed) clustering pipeline.
PIPELINE = {
    "embedding_model": "BAAI/bge-small-en-v1.5",
    "embedding_dim": 384,
    "reduce_to": 5,
    "algorithm": "HDBSCAN",
    "labeler": "c-TF-IDF",
}

CONFIG_CHANGED_EVENT = "radar_config_changed"


class SettingsValidationError(ValueError):
    """Raised for out-of-range knobs or unknown preset slugs (→ HTTP 422)."""


def _preset_slugs(presets: list[Any]) -> list[str]:
    return [p.slug for p in presets]


class GetSettings:
    def __init__(
        self,
        settings: SettingsRepository,
        presets: list[Any],
        default_min_cluster_size: int,
        default_min_tools: int,
    ) -> None:
        self._settings = settings
        self._presets = presets
        self._default_min_cluster_size = default_min_cluster_size
        self._default_min_tools = default_min_tools

    def execute(self) -> dict:
        row = self._settings.get()
        min_cluster_size = (
            row.min_cluster_size
            if row.min_cluster_size is not None
            else self._default_min_cluster_size
        )
        min_tools = row.min_tools if row.min_tools is not None else self._default_min_tools
        return {
            "area_preset": row.area_preset,
            "min_cluster_size": min_cluster_size,
            "min_tools": min_tools,
            "presets": [{"slug": p.slug, "title": p.title} for p in self._presets],
            "pipeline": dict(PIPELINE),
        }


class UpdateSettings:
    def __init__(
        self,
        settings: SettingsRepository,
        presets: list[Any],
        get_settings: GetSettings,
        broadcaster: UpdateBroadcaster | None = None,
    ) -> None:
        self._settings = settings
        self._presets = presets
        self._get_settings = get_settings
        self._broadcaster = broadcaster

    def execute(self, patch: dict) -> dict:
        fields = self._validate(patch)
        self._settings.update(**fields)
        if self._broadcaster is not None:
            # Cross-process signal to the worker to re-read settings + recompute.
            self._broadcaster.publish({"type": CONFIG_CHANGED_EVENT})
        return self._get_settings.execute()

    def _validate(self, patch: dict) -> dict:
        fields: dict = {}
        if "area_preset" in patch and patch["area_preset"] is not None:
            slug = patch["area_preset"]
            if slug not in _preset_slugs(self._presets):
                raise SettingsValidationError(f"unknown area preset: {slug!r}")
            fields["area_preset"] = slug
        if "min_cluster_size" in patch and patch["min_cluster_size"] is not None:
            fields["min_cluster_size"] = self._check_range(
                "min_cluster_size", patch["min_cluster_size"], MIN_CLUSTER_SIZE_RANGE
            )
        if "min_tools" in patch and patch["min_tools"] is not None:
            fields["min_tools"] = self._check_range(
                "min_tools", patch["min_tools"], MIN_TOOLS_RANGE
            )
        return fields

    @staticmethod
    def _check_range(name: str, value: Any, bounds: tuple[int, int]) -> int:
        low, high = bounds
        if not isinstance(value, int) or isinstance(value, bool) or not (low <= value <= high):
            raise SettingsValidationError(f"{name} must be an integer in [{low}, {high}]")
        return value
