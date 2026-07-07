
import httpx

from airadar.infrastructure.github.source import GithubToolSource


def repo_item(full_name: str, stars: int = 500, description: str | None = "A tool") -> dict:
    owner, name = full_name.split("/")
    return {
        "full_name": full_name,
        "owner": {"login": owner},
        "name": name,
        "description": description,
        "topics": ["ai", "cli"],
        "language": "Python",
        "stargazers_count": stars,
        "html_url": f"https://github.com/{full_name}",
        "created_at": "2026-06-15T10:00:00Z",
    }


def make_source(handler, token: str | None = None) -> GithubToolSource:
    client = httpx.Client(
        transport=httpx.MockTransport(handler), base_url="https://api.github.com"
    )
    return GithubToolSource(token=token, client=client)


def test_parses_search_results_into_discovered_tools() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"items": [repo_item("acme/rtk")]})

    items = make_source(handler).fetch_trending()

    assert items, "expected at least one discovered tool"
    first = items[0]
    assert first.owner == "acme" and first.name == "rtk"
    assert first.stars == 500
    assert first.topics == ["ai", "cli"]
    assert first.repo_created_at.year == 2026


def test_dedups_repos_across_queries() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"items": [repo_item("acme/rtk")]})

    items = make_source(handler).fetch_trending()
    full_names = [f"{i.owner}/{i.name}" for i in items]
    assert len(full_names) == len(set(full_names)) == 1


def test_survives_partial_query_failure() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(403, json={"message": "rate limited"})
        return httpx.Response(200, json={"items": [repo_item("acme/ok")]})

    items = make_source(handler).fetch_trending()
    assert any(i.name == "ok" for i in items)


def test_control_characters_in_description_are_stripped() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"items": [repo_item("acme/messy", description="line1\x00\x08\nline2\t!")]}
        )

    desc = make_source(handler).fetch_trending()[0].description
    assert desc == "line1 line2 !"


def test_missing_description_becomes_empty_string() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"items": [repo_item("acme/bare", description=None)]})

    assert make_source(handler).fetch_trending()[0].description == ""


def test_general_query_is_keyword_scoped_to_dev_ai_tooling() -> None:
    queries: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        queries.append(request.url.params["q"])
        return httpx.Response(200, json={"items": []})

    make_source(handler).fetch_trending()
    general = [q for q in queries if "topic:" not in q]
    assert general, "expected a general discovery query"
    assert all("llm OR" in q or "ai OR" in q for q in general)


def test_token_sets_authorization_header() -> None:
    seen: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers.get("authorization"))
        return httpx.Response(200, json={"items": []})

    make_source(handler, token="ghp_secret").fetch_trending()
    assert all(h == "Bearer ghp_secret" for h in seen)


def test_no_token_no_auth_header() -> None:
    seen: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.headers.get("authorization"))
        return httpx.Response(200, json={"items": []})

    make_source(handler).fetch_trending()
    assert all(h is None for h in seen)
