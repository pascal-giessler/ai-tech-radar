"""GitHub Search API adapter approximating "trending" via recent momentum queries."""

import dataclasses
import logging
import re
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import httpx

from airadar.application.dto import DiscoveredTool

logger = logging.getLogger(__name__)

# Default topic scope = the `ai` preset (unchanged from the original hardcoded set).
TOPICS = ["llm", "ai-agents", "developer-tools", "mcp", "rag", "llmops"]
PER_PAGE = 30
MAX_ATTEMPTS = 3
BACKOFF_BASE_SECONDS = 1.0
COMMIT_ACTIVITY_WEEKS = 12
RETRYABLE_STATUS = {403, 429, 500, 502, 503, 504}  # rate-limit + transient server errors

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]+")


def _clean_text(text: str) -> str:
    return _CONTROL_CHARS.sub(" ", text).strip()


def _build_queries(now: datetime, topics: list[str]) -> list[str]:
    recent = (now - timedelta(days=21)).date().isoformat()
    pushed = (now - timedelta(days=7)).date().isoformat()
    # Keyword-scope the general query: an unscoped "new + popular" search drags
    # unrelated repos onto a radar that is about dev/AI tooling.
    queries = [f"ai OR llm OR agent OR mcp OR cli created:>{recent} stars:>50"]
    queries += [f"topic:{topic} pushed:>{pushed} stars:>100" for topic in topics]
    return queries


class GithubToolSource:
    def __init__(
        self,
        token: str | None = None,
        client: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
        max_attempts: int = MAX_ATTEMPTS,
        topics: list[str] | None = None,
    ) -> None:
        headers = {"Accept": "application/vnd.github+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._client = client or httpx.Client(
            base_url="https://api.github.com", headers=headers, timeout=20.0
        )
        # When a preconfigured client is injected (tests), still apply auth headers.
        if client is not None:
            self._client.headers.update(headers)
        self._sleep = sleep
        self._max_attempts = max_attempts
        self._token = token
        self._topics = list(topics) if topics is not None else list(TOPICS)

    def set_topics(self, topics: list[str]) -> None:
        """Swap the active topic scope (e.g. when the area preset changes)."""
        self._topics = list(topics)

    def fetch_trending(self) -> list[DiscoveredTool]:
        seen: dict[str, DiscoveredTool] = {}
        for query in _build_queries(datetime.now(UTC), self._topics):
            response = self._get_with_retry(query)
            if response is None:
                continue  # one query gave up — the others still contribute
            for item in response.json().get("items", []):
                tool = self._parse(item)
                if tool is not None:
                    seen.setdefault(f"{tool.owner}/{tool.name}", tool)
        # Best-effort commit-activity enrichment. Gated behind a token to avoid the
        # extra per-repo call blowing the unauthenticated rate limit; degrades to [].
        if self._token:
            for key, tool in list(seen.items()):
                activity = self._fetch_commit_activity(tool.owner, tool.name)
                if activity:
                    seen[key] = dataclasses.replace(tool, commit_activity=activity)
        return list(seen.values())

    def _fetch_commit_activity(self, owner: str, name: str) -> list[int]:
        """Last ~12 weekly commit totals; [] on 202/empty/error (never raises)."""
        try:
            response = self._client.get(f"/repos/{owner}/{name}/stats/commit_activity")
            if response.status_code != 200:
                return []  # 202 = stats still computing; anything else = give up
            payload = response.json()
            if not isinstance(payload, list):
                return []
            totals = [int(week.get("total", 0)) for week in payload if isinstance(week, dict)]
            return totals[-COMMIT_ACTIVITY_WEEKS:]
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            logger.info("commit activity unavailable for %s/%s: %s", owner, name, exc)
            return []

    def _get_with_retry(self, query: str) -> httpx.Response | None:
        """Fetch one query, retrying transient failures with exponential backoff."""
        for attempt in range(1, self._max_attempts + 1):
            try:
                response = self._client.get(
                    "/search/repositories",
                    params={"q": query, "sort": "stars", "order": "desc", "per_page": PER_PAGE},
                )
            except httpx.TransportError as exc:  # timeouts, connection resets
                if not self._backoff(attempt, query, str(exc)):
                    return None
                continue

            if response.status_code in RETRYABLE_STATUS:
                if not self._backoff(attempt, query, f"HTTP {response.status_code}"):
                    return None
                continue
            if response.is_error:
                logger.warning("github query failed (%s): HTTP %s", query, response.status_code)
                return None
            return response
        return None

    def _backoff(self, attempt: int, query: str, reason: str) -> bool:
        """Sleep before the next attempt. Returns False when attempts are exhausted."""
        if attempt >= self._max_attempts:
            logger.warning("github query gave up after %s attempts (%s): %s", attempt, query, reason)
            return False
        delay = BACKOFF_BASE_SECONDS * (2 ** (attempt - 1))
        logger.info("github query retry %s/%s in %.1fs (%s)", attempt, self._max_attempts, delay, reason)
        self._sleep(delay)
        return True

    @staticmethod
    def _parse(item: dict) -> DiscoveredTool | None:
        try:
            return DiscoveredTool(
                owner=item["owner"]["login"],
                name=item["name"],
                description=_clean_text(item.get("description") or ""),
                topics=list(item.get("topics") or []),
                language=item.get("language"),
                stars=item.get("stargazers_count", 0),
                url=item["html_url"],
                repo_created_at=datetime.fromisoformat(
                    item["created_at"].replace("Z", "+00:00")
                ),
                open_issues=int(item.get("open_issues_count", 0) or 0),
            )
        except (KeyError, ValueError) as exc:
            logger.warning("skipping malformed repo item: %s", exc)
            return None
