import math

import numpy as np
import pytest

from airadar.infrastructure.ml.clusterer import HdbscanClusterer
from airadar.infrastructure.ml.labeler import CTfidfLabeler
from airadar.infrastructure.ml.projector import UmapProjector


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    return dot / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(x * x for x in b)))


@pytest.mark.slow
def test_embedder_returns_384_dim_semantic_vectors() -> None:
    from airadar.infrastructure.ml.embedder import FastembedModel

    model = FastembedModel()
    vectors = model.embed(
        [
            "Minimize LLM token usage in CLI tools",
            "Reduce token consumption for language model calls",
            "A 3D game engine written in C++",
        ]
    )
    assert all(len(v) == 384 for v in vectors)
    assert cosine(vectors[0], vectors[1]) > cosine(vectors[0], vectors[2])


def two_blobs(n_per: int = 12, dim: int = 16) -> list[list[float]]:
    rng = np.random.default_rng(7)
    a = rng.normal(loc=0.0, scale=0.05, size=(n_per, dim))
    b = rng.normal(loc=1.0, scale=0.05, size=(n_per, dim))
    return np.vstack([a, b]).tolist()


def test_projector_returns_deterministic_3d_positions() -> None:
    embeddings = two_blobs()
    first = UmapProjector().project(embeddings)
    second = UmapProjector().project(embeddings)

    assert len(first) == len(embeddings)
    assert first == second  # seeded → deterministic
    radius = max(max(abs(p.x), abs(p.y), abs(p.z)) for p in first)
    assert 0 < radius <= 12.0


def test_projector_handles_tiny_input() -> None:
    positions = UmapProjector().project([[0.1] * 8, [0.9] * 8])
    assert len(positions) == 2


def test_clusterer_separates_obvious_blobs() -> None:
    labels = HdbscanClusterer().assign(two_blobs())
    non_noise = {label for label in labels if label != -1}
    assert len(non_noise) == 2
    first_half, second_half = labels[:12], labels[12:]
    # majority of each blob shares one label, and blobs differ
    assert max(first_half.count(x) for x in set(first_half)) >= 10
    assert max(second_half.count(x) for x in set(second_half)) >= 10


def test_labeler_picks_distinguishing_terms() -> None:
    docs_by_cluster = {
        0: [
            "Minimize token usage for LLM calls",
            "Token compression proxy to cut costs",
            "Reduce token consumption in prompts",
        ],
        1: [
            "Unified proxy gateway for many AI providers",
            "Route requests through one gateway",
            "Gateway with fallbacks for providers",
        ],
    }
    labels = CTfidfLabeler().label(docs_by_cluster)

    assert "token" in labels[0].lower()
    assert "gateway" in labels[1].lower()
    assert labels[0] != labels[1]
