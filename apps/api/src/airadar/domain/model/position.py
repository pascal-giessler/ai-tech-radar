from dataclasses import dataclass


@dataclass(frozen=True)
class Position3D:
    x: float
    y: float
    z: float
