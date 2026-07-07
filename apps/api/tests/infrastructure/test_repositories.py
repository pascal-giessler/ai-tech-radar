import os
from datetime import UTC, datetime

import pytest

from airadar.domain.model.adoption import AdoptionRing
from airadar.domain.model.cluster import Cluster
from airadar.domain.model.position import Position3D
from airadar.domain.model.repo_ref import RepoRef
from airadar.domain.model.tool import Tool

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not TEST_DATABASE_URL, reason="TEST_DATABASE_URL not set"),
]

NOW = datetime(2026, 7, 7, 12, 0, tzinfo=UTC)


@pytest.fixture()
def repos():
    from airadar.infrastructure.persistence.database import init_db, make_engine
    from airadar.infrastructure.persistence.orm import metadata
    from airadar.infrastructure.persistence.repositories import (
        SqlClusterRepository,
        SqlToolRepository,
    )

    engine = make_engine(TEST_DATABASE_URL)
    metadata.drop_all(engine)
    init_db(engine)
    yield SqlToolRepository(engine), SqlClusterRepository(engine)
    engine.dispose()


def make_tool(name: str = "rtk", score: float = 5.0, with_extras: bool = True) -> Tool:
    tool = Tool(
        ref=RepoRef("acme", name),
        description="Token-optimized CLI proxy",
        topics=["cli", "tokens"],
        language="Rust",
        url=f"https://github.com/acme/{name}",
        stars=500,
        stars_prev=400,
        repo_created_at=NOW,
        first_seen_at=NOW,
        last_updated_at=NOW,
        trend_score=score,
    )
    if with_extras:
        tool.ring = AdoptionRing.TRIAL
        tool.position = Position3D(1.0, 2.0, 3.0)
        tool.cluster_id = 1
        tool.embedding = [0.5] * 384
        tool.embedded_fingerprint = tool.content_fingerprint()
    return tool


def test_upsert_and_get_round_trips_full_tool(repos) -> None:
    tools, _ = repos
    tools.upsert(make_tool())

    loaded = tools.get_by_ref(RepoRef("acme", "rtk"))
    assert loaded is not None
    assert loaded.slug == "acme-rtk"
    assert loaded.stars == 500 and loaded.stars_prev == 400
    assert loaded.ring == AdoptionRing.TRIAL
    assert loaded.position == Position3D(1.0, 2.0, 3.0)
    assert loaded.cluster_id == 1
    assert loaded.embedding is not None and len(loaded.embedding) == 384
    assert loaded.embedded_fingerprint == make_tool().content_fingerprint()
    assert loaded.topics == ["cli", "tokens"]
    assert loaded.first_seen_at == NOW


def test_upsert_same_ref_updates_not_duplicates(repos) -> None:
    tools, _ = repos
    tools.upsert(make_tool())
    updated = make_tool()
    updated.record_signal(stars=700, at=NOW)
    tools.upsert(updated)

    assert len(tools.list_all()) == 1
    assert tools.get_by_slug("acme-rtk").stars == 700


def test_list_ranked_orders_by_trend_score(repos) -> None:
    tools, _ = repos
    tools.upsert(make_tool(name="low", score=1.0))
    tools.upsert(make_tool(name="high", score=90.0))
    tools.upsert(make_tool(name="mid", score=50.0))

    names = [t.ref.name for t in tools.list_ranked(limit=2)]
    assert names == ["high", "mid"]


def test_replace_all_swaps_cluster_set(repos) -> None:
    _, clusters = repos
    clusters.replace_all([Cluster(0, "Uncharted", "uncharted", 3, Position3D(0, 0, 0))])
    clusters.replace_all(
        [
            Cluster(1, "Token Usage", "token-usage", 2, Position3D(1, 1, 1)),
            Cluster(2, "Ai Proxy", "ai-proxy", 4, Position3D(2, 2, 2)),
        ]
    )

    assert {c.slug for c in clusters.list_all()} == {"token-usage", "ai-proxy"}
    found = clusters.get_by_slug("token-usage")
    assert found is not None and found.size == 2
