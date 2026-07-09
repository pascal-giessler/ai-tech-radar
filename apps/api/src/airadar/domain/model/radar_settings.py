from dataclasses import dataclass

DEFAULT_AREA_PRESET = "ai"


@dataclass(frozen=True)
class RadarSettings:
    """Persisted, tunable radar configuration (single row).

    `min_cluster_size` / `min_tools` are nullable: ``None`` means "fall back to the
    env/const default" so the row stays backward compatible.
    """

    area_preset: str = DEFAULT_AREA_PRESET
    min_cluster_size: int | None = None
    min_tools: int | None = None
