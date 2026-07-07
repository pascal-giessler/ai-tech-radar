"""Composition root: wires real adapters, schedules ingestion, exposes the ASGI app."""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from airadar.application.ingest_trending import IngestTrendingTools
from airadar.application.queries import GetLandscape, GetTool, ListClusters, ListTools
from airadar.application.recompute_landscape import RecomputeLandscape
from airadar.config import Settings
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
from airadar.interface.container import Container
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

    ingest = IngestTrendingTools(
        source=GithubToolSource(token=settings.github_token),
        tools=tools,
        scorer=TrendScorer(),
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
    )
    return container, RefreshJob(engine=engine, ingest=ingest, recompute=recompute)


class RefreshJob:
    def __init__(self, engine, ingest: IngestTrendingTools, recompute: RecomputeLandscape):
        self.engine = engine
        self._ingest = ingest
        self._recompute = recompute

    def run_sync(self) -> None:
        """Blocking pipeline: ingest then recompute. Never raises (logs instead)."""
        try:
            report = self._ingest.execute()
            logger.info("ingest: %s new, %s updated", report.new, report.updated)
            landscape = self._recompute.execute()
            logger.info(
                "landscape: %s tools in %s clusters",
                landscape.tool_count,
                landscape.cluster_count,
            )
        except Exception:
            logger.exception("refresh failed; serving last known landscape")

    async def run(self) -> None:
        await asyncio.to_thread(self.run_sync)


def make_lifespan(settings: Settings, job: RefreshJob):
    @asynccontextmanager
    async def lifespan(app):
        init_db(job.engine)
        scheduler = AsyncIOScheduler()
        scheduler.add_job(job.run, "interval", minutes=settings.ingest_interval_minutes)
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
