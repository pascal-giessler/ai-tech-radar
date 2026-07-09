from dataclasses import dataclass, field

from airadar.domain.model.position import Position3D

UNCHARTED_ID = 0
UNCHARTED_LABEL = "Uncharted"


@dataclass(frozen=True)
class Cluster:
    id: int
    label: str
    slug: str
    size: int
    centroid: Position3D
    keywords: list[str] = field(default_factory=list)
    description: str = ""
