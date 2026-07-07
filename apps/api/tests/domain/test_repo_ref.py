from airadar.domain.model.repo_ref import RepoRef


def test_full_name_joins_owner_and_name() -> None:
    ref = RepoRef(owner="BerriAI", name="litellm")
    assert ref.full_name == "BerriAI/litellm"


def test_slug_is_url_safe() -> None:
    ref = RepoRef(owner="vercel", name="next.js")
    assert ref.slug == "vercel-next-js"


def test_repo_ref_is_value_object() -> None:
    assert RepoRef("a", "b") == RepoRef("a", "b")
    assert len({RepoRef("a", "b"), RepoRef("a", "b")}) == 1
