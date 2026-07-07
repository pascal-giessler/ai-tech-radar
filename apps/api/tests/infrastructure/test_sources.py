from datetime import UTC, datetime

from airadar.application.dto import DiscoveredTool
from airadar.infrastructure.sources.composite import CompositeToolSource
from airadar.infrastructure.sources.seed import SeedToolSource


class BoomSource:
    def fetch_trending(self):
        raise RuntimeError("upstream down")


class StaticSource:
    def __init__(self, items):
        self.items = items

    def fetch_trending(self):
        return list(self.items)


def discovered(owner="acme", name="x"):
    return DiscoveredTool(
        owner=owner,
        name=name,
        description="d",
        topics=[],
        language=None,
        stars=1,
        url=f"https://github.com/{owner}/{name}",
        repo_created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )


def test_composite_isolates_a_failing_source() -> None:
    good = StaticSource([discovered(name="ok")])
    composite = CompositeToolSource([BoomSource(), good])

    items = composite.fetch_trending()

    assert [i.name for i in items] == ["ok"]  # boom source didn't abort the scan


def test_composite_dedups_across_sources_first_wins() -> None:
    a = StaticSource([discovered(owner="acme", name="dup")])
    b = StaticSource([discovered(owner="acme", name="dup"), discovered(name="unique")])
    composite = CompositeToolSource([a, b])

    names = sorted(f"{i.owner}/{i.name}" for i in composite.fetch_trending())

    assert names == ["acme/dup", "acme/unique"]


def test_composite_returns_empty_when_all_sources_fail() -> None:
    composite = CompositeToolSource([BoomSource(), BoomSource()])
    assert composite.fetch_trending() == []


def test_seed_source_loads_curated_stack() -> None:
    items = SeedToolSource().fetch_trending()
    names = {f"{i.owner}/{i.name}".lower() for i in items}

    # the tools from the original brief must always be on the radar
    assert any("litellm" in n for n in names)
    assert any("rtk" in n or "headroom" in n for n in names)
    assert all(isinstance(i, DiscoveredTool) and i.url.startswith("http") for i in items)


def test_seed_source_accepts_custom_entries() -> None:
    entries = [
        {
            "owner": "me",
            "name": "mytool",
            "description": "custom",
            "topics": ["x"],
            "language": "Python",
            "stars": 10,
            "url": "https://github.com/me/mytool",
            "created_at": "2026-01-01T00:00:00Z",
        }
    ]
    items = SeedToolSource(entries=entries).fetch_trending()
    assert items[0].owner == "me" and items[0].stars == 10
