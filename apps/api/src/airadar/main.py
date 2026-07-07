"""Composition root: wires real adapters, schedules ingestion, exposes the ASGI app."""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.exc import OperationalError

from airadar.application.ingest_trending import IngestTrendingTools
from airadar.application.queries import GetLandscape, GetTool, ListClusters, ListTools
from airadar.application.recompute_landscape import RecomputeLandscape
from airadar.config import Settings
from airadar.domain.services.adoption_classifier import AdoptionClassifier
from airadar.domain.services.trend_scorer import TrendScorer
from airadar.infrastructure.broadcast import AsyncFanoutBroadcaster
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
from airadar.infrastructure.sources.composite import CompositeToolSource
from airadar.infrastructure.sources.seed import SeedToolSource
from airadar.interface.container import Container, RadarStatus
from airadar.interface.http import create_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("airadar")


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


def build_container(settings: Settings) -> tuple[Container, "RefreshJob"]:
    engine = make_engine(settings.database_url)
    tools = SqlToolRepository(engine)
    clusters = SqlClusterRepository(engine)
    broadcaster = AsyncFanoutBroadcaster()
    status = RadarStatus()

    # Curated stack always on the radar, plus live GitHub trending — either can fail
    # without blanking the other.
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
        broadcaster=broadcaster,
        min_tools=settings.min_tools_for_clustering,
    )

    container = Container(
        get_landscape=GetLandscape(tools, clusters),
        get_tool=GetTool(tools),
        list_tools=ListTools(tools),
        list_clusters=ListClusters(clusters),
        tools=tools,
        clusters=clusters,
        broadcaster=broadcaster,
        status=status,
    )
    return container, RefreshJob(
        engine=engine, ingest=ingest, recompute=recompute, status=status, clock=SystemClock()
    )


class RefreshJob:
    def __init__(self, engine, ingest, recompute, status: RadarStatus, clock: SystemClock):
        self.engine = engine
        self._ingest = ingest
        self._recompute = recompute
        self._status = status
        self._clock = clock

    def run_sync(self) -> None:
        """Blocking pipeline: ingest then recompute. Never raises (logs + records instead)."""
        try:
            report = self._ingest.execute()
            logger.info("ingest: %s new, %s updated", report.new, report.updated)
            landscape = self._recompute.execute()
            logger.info(
                "landscape: %s tools in %s clusters",
                landscape.tool_count,
                landscape.cluster_count,
            )
            self._status.record_success(self._clock.now(), landscape.tool_count)
        except Exception as exc:
            logger.exception("refresh failed; serving last known landscape")
            self._status.record_failure(str(exc))

    async def run(self) -> None:
        await asyncio.to_thread(self.run_sync)


def init_db_with_retry(engine, attempts: int = 10, base_delay: float = 1.0) -> None:
    """The DB may refuse connections briefly even behind a healthcheck; back off."""
    for attempt in range(1, attempts + 1):
        try:
            init_db(engine)
            return
        except OperationalError as exc:
            if attempt >= attempts:
                raise
            delay = min(base_delay * attempt, 10.0)
            logger.warning("db not ready (attempt %s/%s): %s; retrying in %.0fs",
                           attempt, attempts, exc, delay)
            time.sleep(delay)


def make_lifespan(settings: Settings, job: RefreshJob):
    @asynccontextmanager
    async def lifespan(app):
        init_db_with_retry(job.engine)
        scheduler = AsyncIOScheduler()
        # coalesce + single instance: a slow scan never stacks or overlaps itself.
        scheduler.add_job(
            job.run,
            "interval",
            minutes=settings.ingest_interval_minutes,
            max_instances=1,
            coalesce=True,
        )
        scheduler.start()
        first_run = asyncio.create_task(job.run())  # seed immediately, don't block startup
        yield
        first_run.cancel()
        scheduler.shutdown(wait=False)

    return lifespan


def build_app():
    settings = Settings()
    container, job = build_container(settings)
    return create_app(container, lifespan=make_lifespan(settings, job))


app = build_app()
