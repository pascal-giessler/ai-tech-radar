import numpy as np

from airadar.domain.model.position import Position3D

TARGET_RADIUS = 10.0
MIN_SAMPLES_FOR_UMAP = 4


class UmapProjector:
    def __init__(self, random_state: int = 42) -> None:
        self._random_state = random_state

    def project(self, embeddings: list[list[float]]) -> list[Position3D]:
        n = len(embeddings)
        if n == 0:
            return []
        if n < MIN_SAMPLES_FOR_UMAP:
            return self._grid_fallback(n)

        import umap  # heavy import deferred to first use

        reducer = umap.UMAP(
            n_components=3,
            n_neighbors=min(15, n - 1),
            random_state=self._random_state,
            metric="cosine",
        )
        coords = reducer.fit_transform(np.asarray(embeddings, dtype=np.float32))
        coords = coords - coords.mean(axis=0)
        max_abs = float(np.abs(coords).max()) or 1.0
        coords = coords * (TARGET_RADIUS / max_abs)
        return [Position3D(float(x), float(y), float(z)) for x, y, z in coords]

    @staticmethod
    def _grid_fallback(n: int) -> list[Position3D]:
        return [Position3D(float(i * 2 - n + 1), 0.0, 0.0) for i in range(n)]
