from datetime import UTC, datetime

from airadar.domain.model.repo_ref import RepoRef
from airadar.domain.model.tool import Tool

NOW = datetime(2026, 7, 7, 12, 0, tzinfo=UTC)


def make_tool(**overrides) -> Tool:
    defaults = dict(
        ref=RepoRef("acme", "rtk"),
        description="Token-optimized CLI proxy",
        topics=["cli", "tokens"],
        language="Rust",
        url="https://github.com/acme/rtk",
        stars=500,
        stars_prev=None,
        repo_created_at=NOW,
        first_seen_at=NOW,
        last_updated_at=NOW,
    )
    defaults.update(overrides)
    return Tool(**defaults)


def test_stars_gained_is_zero_without_previous_signal() -> None:
    assert make_tool().stars_gained == 0


def test_record_signal_shifts_current_stars_to_prev() -> None:
    tool = make_tool(stars=500)
    later = datetime(2026, 7, 8, 12, 0, tzinfo=UTC)

    tool.record_signal(stars=650, at=later)

    assert tool.stars == 650
    assert tool.stars_prev == 500
    assert tool.stars_gained == 150
    assert tool.last_updated_at == later


def test_slug_delegates_to_ref() -> None:
    assert make_tool().slug == "acme-rtk"


def test_fingerprint_stable_for_same_content() -> None:
    assert make_tool().content_fingerprint() == make_tool().content_fingerprint()


def test_fingerprint_changes_when_description_changes() -> None:
    a = make_tool()
    b = make_tool(description="Something else entirely")
    assert a.content_fingerprint() != b.content_fingerprint()


def test_fingerprint_ignores_star_count() -> None:
    assert make_tool(stars=1).content_fingerprint() == make_tool(stars=99999).content_fingerprint()


def test_activity_signals_default_to_empty() -> None:
    tool = make_tool()
    assert tool.open_issues == 0
    assert tool.commit_activity == []
    assert tool.commits_recent == 0


def test_commits_recent_sums_the_activity_window() -> None:
    tool = make_tool(commit_activity=[1.0, 2.0, 3.0, 4.0])
    assert tool.commits_recent == 10
