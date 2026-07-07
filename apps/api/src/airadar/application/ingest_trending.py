from airadar.application.dto import IngestReport
from airadar.domain.model.repo_ref import RepoRef
from airadar.domain.model.tool import Tool
from airadar.domain.ports import Clock, ToolRepository, ToolSource
from airadar.domain.services.trend_scorer import TrendScorer

SECONDS_PER_DAY = 86_400


class IngestTrendingTools:
    def __init__(
        self, source: ToolSource, tools: ToolRepository, scorer: TrendScorer, clock: Clock
    ) -> None:
        self._source = source
        self._tools = tools
        self._scorer = scorer
        self._clock = clock

    def execute(self) -> IngestReport:
        now = self._clock.now()
        new = updated = 0

        for item in self._source.fetch_trending():
            ref = RepoRef(owner=item.owner, name=item.name)
            tool = self._tools.get_by_ref(ref)
            if tool is None:
                tool = Tool(
                    ref=ref,
                    description=item.description,
                    topics=item.topics,
                    language=item.language,
                    url=item.url,
                    stars=item.stars,
                    stars_prev=None,
                    repo_created_at=item.repo_created_at,
                    first_seen_at=now,
                    last_updated_at=now,
                )
                new += 1
            else:
                tool.record_signal(stars=item.stars, at=now)
                tool.description = item.description
                tool.topics = item.topics
                tool.language = item.language
                updated += 1

            age_days = (now - tool.repo_created_at).total_seconds() / SECONDS_PER_DAY
            tool.trend_score = self._scorer.score(
                stars=tool.stars, stars_gained=tool.stars_gained, age_days=age_days
            )
            self._tools.upsert(tool)

        return IngestReport(new=new, updated=updated)
