import numpy as np
from sklearn.cluster import HDBSCAN


class HdbscanClusterer:
    def __init__(self, min_cluster_size: int = 4) -> None:
        self._min_cluster_size = min_cluster_size

    def assign(self, embeddings: list[list[float]]) -> list[int]:
        data = np.asarray(embeddings, dtype=np.float32)
        model = HDBSCAN(min_cluster_size=self._min_cluster_size)
        return [int(label) for label in model.fit_predict(data)]
