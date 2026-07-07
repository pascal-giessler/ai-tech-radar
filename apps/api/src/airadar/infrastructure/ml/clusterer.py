import numpy as np
from sklearn.cluster import HDBSCAN

# HDBSCAN treats most points as noise in raw embedding space (384d); reducing to a
# handful of dimensions first (BERTopic-style) gives it density it can work with.
REDUCE_TO = 5
REDUCE_THRESHOLD_DIM = 50
MIN_SAMPLES_FOR_REDUCTION = 15


class HdbscanClusterer:
    def __init__(self, min_cluster_size: int = 4, random_state: int = 42) -> None:
        self._min_cluster_size = min_cluster_size
        self._random_state = random_state

    def assign(self, embeddings: list[list[float]]) -> list[int]:
        data = np.asarray(embeddings, dtype=np.float32)
        if data.shape[1] > REDUCE_THRESHOLD_DIM and data.shape[0] >= MIN_SAMPLES_FOR_REDUCTION:
            import umap  # heavy import deferred to first use

            data = umap.UMAP(
                n_components=REDUCE_TO,
                n_neighbors=min(15, data.shape[0] - 1),
                min_dist=0.0,
                metric="cosine",
                random_state=self._random_state,
            ).fit_transform(data)

        model = HDBSCAN(min_cluster_size=self._min_cluster_size, copy=True)
        return [int(label) for label in model.fit_predict(np.asarray(data))]
