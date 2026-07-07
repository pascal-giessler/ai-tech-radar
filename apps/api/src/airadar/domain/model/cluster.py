from dataclasses import dataclass

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
