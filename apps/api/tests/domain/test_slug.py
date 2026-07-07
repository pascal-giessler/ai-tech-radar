from airadar.domain.model.slug import slugify


def test_slugify_lowercases_and_replaces_non_alnum() -> None:
    assert slugify("LiteLLM/lite llm!") == "litellm-lite-llm"


def test_slugify_collapses_consecutive_separators() -> None:
    assert slugify("a -- b__c") == "a-b-c"


def test_slugify_strips_leading_trailing_dashes() -> None:
    assert slugify("--hello--") == "hello"
