"""Shared composition for the write-side runtimes (worker, migrate)."""

import logging
import threading
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
    SqlSettingsRepository,
    SqlToolRepository,
)
from airadar.infrastructure.pgnotify import PgNotifyPublisher
from airadar.infrastructure.sources.composite import CompositeToolSource
from airadar.infrastructure.sources.presets import get_preset
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
    """The write pipeline: read settings → ingest → recompute → publish. Never raises.

    Reads `radar_settings` at the start of every run, so a config change (scheduled
    tick or `radar_config_changed` NOTIFY) takes effect immediately. A non-blocking
    lock enforces `max_instances=1` semantics across the scheduler and the LISTEN
    trigger — an overlapping trigger is skipped rather than run concurrently.
    """

    def __init__(
        self,
        engine,
        ingest,
        recompute,
        clock: SystemClock,
        settings_repo,
        github_source: GithubToolSource,
        default_min_cluster_size: int,
        default_min_tools: int,
    ):
        self.engine = engine
        self._ingest = ingest
        self._recompute = recompute
        self._clock = clock
        self._settings_repo = settings_repo
        self._github_source = github_source
        self._default_min_cluster_size = default_min_cluster_size
        self._default_min_tools = default_min_tools
        self._lock = threading.Lock()

    def run_sync(self) -> None:
        if not self._lock.acquire(blocking=False):
            logger.info("refresh already running; skipping overlapping trigger")
            return
        try:
            self._apply_settings()
        except Exception:
            logger.exception("refresh failed; serving last known landscape")
        finally:
            self._lock.release()

    def _apply_settings(self) -> None:
        row = self._settings_repo.get()
        min_cluster_size = (
            row.min_cluster_size
            if row.min_cluster_size is not None
            else self._default_min_cluster_size
        )
        min_tools = row.min_tools if row.min_tools is not None else self._default_min_tools
        try:
            preset = get_preset(row.area_preset)
            self._github_source.set_topics(preset.topics)
            logger.info("active area preset: %s (%s topics)", preset.slug, len(preset.topics))
        except KeyError:
            logger.warning("unknown area preset %r; keeping current topics", row.area_preset)

        report = self._ingest.execute()
        logger.info("ingest: %s new, %s updated", report.new, report.updated)
        landscape = self._recompute.execute(
            min_cluster_size=min_cluster_size, min_tools=min_tools
        )
        logger.info(
            "landscape: %s tools in %s clusters (min_cluster_size=%s, min_tools=%s)",
            landscape.tool_count,
            landscape.cluster_count,
            min_cluster_size,
            min_tools,
        )


def build_refresh_job(settings: Settings) -> RefreshJob:
    """Wire the worker's write pipeline with a Postgres-NOTIFY broadcaster."""
    engine = make_engine(settings.database_url)
    tools = SqlToolRepository(engine)
    clusters = SqlClusterRepository(engine)
    settings_repo = SqlSettingsRepository(engine)

    github_source = GithubToolSource(token=settings.github_token)
    source = CompositeToolSource([SeedToolSource(), github_source])
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
        min_cluster_size=settings.min_cluster_size,
    )
    return RefreshJob(
        engine=engine,
        ingest=ingest,
        recompute=recompute,
        clock=SystemClock(),
        settings_repo=settings_repo,
        github_source=github_source,
        default_min_cluster_size=settings.min_cluster_size,
        default_min_tools=settings.min_tools_for_clustering,
    )
