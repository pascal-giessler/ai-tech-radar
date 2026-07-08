"""Shared composition for the write-side runtimes (worker, migrate)."""

import logging
import time
from datetime import UTC, datetime

from sqlalchemy.exc import OperationalError

from airadar.application.ingest_trending import IngestTrendingTools
from airadar.application.recompute_landscape import RecomputeLandscape
from airadar.config import Settings
from airadar.domain.services.adoption_classifier import AdoptionClassifier
from airadar.domain.services.trend_scorer import TrendScorer
from airadar.infrastructure.github.source import GithubToolSource
from airadar.infrastructure.ml.clusterer import HdbscanClusterer
from airadar.infrastructure.ml.embedder import FastembedModel
from airadar.infrastructure.ml.labeler import CTfidfLabeler
from airadar.infrastructure.ml.projector import UmapProjector
from airadar.infrastructure.persistence.database import init_db, make_engine
from airadar.infrastructure.persistence.repositories import (
    SqlClusterRepository,
    SqlToolRepository,
)
from airadar.infrastructure.pgnotify import PgNotifyPublisher
from airadar.infrastructure.sources.composite import CompositeToolSource
from airadar.infrastructure.sources.seed import SeedToolSource

logger = logging.getLogger("airadar")


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s"
    )


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


def init_db_with_retry(engine, attempts: int = 30, base_delay: float = 1.0) -> None:
    """The DB may refuse connections briefly at boot; back off and retry."""
    for attempt in range(1, attempts + 1):
        try:
            init_db(engine)
            return
        except OperationalError as exc:
            if attempt >= attempts:
                raise
            delay = min(base_delay * attempt, 10.0)
            logger.warning(
                "db not ready (attempt %s/%s): %s; retrying in %.0fs", attempt, attempts, exc, delay
            )
            time.sleep(delay)


class RefreshJob:
    """The write pipeline: ingest → recompute → publish. Never raises."""

    def __init__(self, engine, ingest, recompute, clock: SystemClock):
        self.engine = engine
        self._ingest = ingest
        self._recompute = recompute
        self._clock = clock

    def run_sync(self) -> None:
        try:
            report = self._ingest.execute()
            logger.info("ingest: %s new, %s updated", report.new, report.updated)
            landscape = self._recompute.execute()
            logger.info(
                "landscape: %s tools in %s clusters", landscape.tool_count, landscape.cluster_count
            )
        except Exception:
            logger.exception("refresh failed; serving last known landscape")


def build_refresh_job(settings: Settings) -> RefreshJob:
    """Wire the worker's write pipeline with a Postgres-NOTIFY broadcaster."""
    engine = make_engine(settings.database_url)
    tools = SqlToolRepository(engine)
    clusters = SqlClusterRepository(engine)

    source = CompositeToolSource(
        [SeedToolSource(), GithubToolSource(token=settings.github_token)]
    )
    ingest = IngestTrendingTools(
        source=source,
        tools=tools,
        scorer=TrendScorer(),
        classifier=AdoptionClassifier(),
        clock=SystemClock(),
    )
    recompute = RecomputeLandscape(
        tools=tools,
        clusters=clusters,
        embedder=FastembedModel(),
        projector=UmapProjector(),
        clusterer=HdbscanClusterer(),
        labeler=CTfidfLabeler(),
        broadcaster=PgNotifyPublisher(settings.database_url),
        min_tools=settings.min_tools_for_clustering,
    )
    return RefreshJob(engine=engine, ingest=ingest, recompute=recompute, clock=SystemClock())
