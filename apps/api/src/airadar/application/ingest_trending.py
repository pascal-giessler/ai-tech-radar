from airadar.application.dto import IngestReport
from airadar.domain.model.radar_settings import DEFAULT_AREA_PRESET
from airadar.domain.model.repo_ref import RepoRef
from airadar.domain.model.tool import Tool
from airadar.domain.ports import Clock, ToolRepository, ToolSource
from airadar.domain.services.adoption_classifier import AdoptionClassifier
from airadar.domain.services.trend_scorer import TrendScorer

SECONDS_PER_DAY = 86_400


class IngestTrendingTools:
    def __init__(
        self,
        source: ToolSource,
        tools: ToolRepository,
        scorer: TrendScorer,
        clock: Clock,
        classifier: AdoptionClassifier | None = None,
    ) -> None:
        self._source = source
        self._tools = tools
        self._scorer = scorer
        self._clock = clock
        self._classifier = classifier or AdoptionClassifier()

    def execute(self, area: str = DEFAULT_AREA_PRESET) -> IngestReport:
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
                    open_issues=item.open_issues,
                    commit_activity=list(item.commit_activity),
                    area=area,
                )
                new += 1
            else:
                tool.record_signal(stars=item.stars, at=now)
                tool.description = item.description
                tool.topics = item.topics
                tool.language = item.language
                tool.open_issues = item.open_issues
                tool.commit_activity = list(item.commit_activity)
                # Re-tag to the active area so a tool that resurfaces under a new
                # domain moves with it (and survives that area's prune).
                tool.area = area
                updated += 1

            age_days = (now - tool.repo_created_at).total_seconds() / SECONDS_PER_DAY
            # Momentum must not depend on scan cadence: a 30-min window shows ~0 real
            # growth for almost every repo, which would collapse everything to "Hold".
            # Use a lifetime weekly star rate as a floor, and let a genuine recent
            # surge (real delta) rise above it.
            lifetime_week = round(tool.stars / max(age_days, 1.0) * 7)
            gained = max(tool.stars_gained, lifetime_week)
            tool.trend_score = self._scorer.score(
                stars=tool.stars, stars_gained=gained, age_days=age_days
            )
            tool.ring = self._classifier.classify(
                stars=tool.stars,
                stars_gained=gained,
                trend_score=tool.trend_score,
                age_days=age_days,
            )
            self._tools.upsert(tool)

        return IngestReport(new=new, updated=updated)
