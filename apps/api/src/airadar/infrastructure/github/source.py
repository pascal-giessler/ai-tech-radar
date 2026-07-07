"""GitHub Search API adapter approximating "trending" via recent momentum queries."""

import logging
from datetime import UTC, datetime, timedelta

import httpx

from airadar.application.dto import DiscoveredTool

logger = logging.getLogger(__name__)

TOPICS = ["llm", "ai-agents", "developer-tools", "mcp", "rag", "llmops"]
PER_PAGE = 30


def _build_queries(now: datetime) -> list[str]:
    recent = (now - timedelta(days=21)).date().isoformat()
    pushed = (now - timedelta(days=7)).date().isoformat()
    queries = [f"created:>{recent} stars:>50"]
    queries += [f"topic:{topic} pushed:>{pushed} stars:>100" for topic in TOPICS]
    return queries


class GithubToolSource:
    def __init__(self, token: str | None = None, client: httpx.Client | None = None) -> None:
        headers = {"Accept": "application/vnd.github+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._client = client or httpx.Client(
            base_url="https://api.github.com", headers=headers, timeout=20.0
        )
        # When a preconfigured client is injected (tests), still apply auth headers.
        if client is not None:
            self._client.headers.update(headers)

    def fetch_trending(self) -> list[DiscoveredTool]:
        seen: dict[str, DiscoveredTool] = {}
        for query in _build_queries(datetime.now(UTC)):
            try:
                response = self._client.get(
                    "/search/repositories",
                    params={"q": query, "sort": "stars", "order": "desc", "per_page": PER_PAGE},
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                logger.warning("github query failed (%s): %s", query, exc)
                continue
            for item in response.json().get("items", []):
                tool = self._parse(item)
                if tool is not None:
                    seen.setdefault(f"{tool.owner}/{tool.name}", tool)
        return list(seen.values())

    @staticmethod
    def _parse(item: dict) -> DiscoveredTool | None:
        try:
            return DiscoveredTool(
                owner=item["owner"]["login"],
                name=item["name"],
                description=item.get("description") or "",
                topics=list(item.get("topics") or []),
                language=item.get("language"),
                stars=item.get("stargazers_count", 0),
                url=item["html_url"],
                repo_created_at=datetime.fromisoformat(
                    item["created_at"].replace("Z", "+00:00")
                ),
            )
        except (KeyError, ValueError) as exc:
            logger.warning("skipping malformed repo item: %s", exc)
            return None
