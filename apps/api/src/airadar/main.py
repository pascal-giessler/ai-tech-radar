"""API composition root: read-only HTTP + SSE. No scheduler, no ML model.

Ingestion runs in a separate `airadar.worker` process; this app LISTENs for its
landscape events over Postgres NOTIFY and fans them out to SSE clients. Schema is
created by the `airadar.migrate` Job — never here (replicas must not race).
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from airadar.application.queries import GetLandscape, GetTool, ListClusters, ListTools
from airadar.application.settings import AddCustomArea, GetSettings, UpdateSettings
from airadar.config import Settings
from airadar.infrastructure.broadcast import AsyncFanoutBroadcaster
from airadar.infrastructure.persistence.database import DatabasePing, make_engine
from airadar.infrastructure.persistence.repositories import (
    SqlClusterRepository,
    SqlPresetRepository,
    SqlSettingsRepository,
    SqlToolRepository,
)
from airadar.infrastructure.pgnotify import CONFIG_CHANNEL, PgNotifyListener, PgNotifyPublisher
from airadar.infrastructure.sources.presets import merge_presets
from airadar.interface.container import Container, RadarStatus
from airadar.interface.http import create_app
from airadar.runtime import configure_logging, logger


def build_container(settings: Settings) -> tuple[Container, PgNotifyListener]:
    engine = make_engine(settings.database_url)
    tools = SqlToolRepository(engine)
    clusters = SqlClusterRepository(engine)
    settings_repo = SqlSettingsRepository(engine)
    broadcaster = AsyncFanoutBroadcaster()
    status = RadarStatus()

    preset_repo = SqlPresetRepository(engine)
    # Live provider: bundled presets + any the user added from the UI.
    presets_provider = lambda: merge_presets(preset_repo.list_all())  # noqa: E731
    get_settings = GetSettings(
        settings_repo,
        presets_provider,
        default_min_cluster_size=settings.min_cluster_size,
        default_min_tools=settings.min_tools_for_clustering,
    )
    # The api doesn't recompute; it just signals the worker via a NOTIFY on the
    # config channel (the worker LISTENs and does the ingest+recompute).
    config_publisher = PgNotifyPublisher(settings.database_url, channel=CONFIG_CHANNEL)
    update_settings = UpdateSettings(
        settings_repo, presets_provider, get_settings, config_publisher
    )
    add_custom_area = AddCustomArea(presets_provider, preset_repo, get_settings)

    container = Container(
        get_landscape=GetLandscape(tools, clusters),
        get_tool=GetTool(tools),
        list_tools=ListTools(tools),
        list_clusters=ListClusters(clusters),
        tools=tools,
        clusters=clusters,
        broadcaster=broadcaster,
        settings=settings_repo,
        get_settings=get_settings,
        update_settings=update_settings,
        add_custom_area=add_custom_area,
        status=status,
        db_ping=DatabasePing(engine),
    )

    def on_event(event: dict) -> None:
        # Keep readiness/freshness current from the worker's published scans.
        status.record_success(datetime.now(UTC), int(event.get("tool_count", 0)))

    listener = PgNotifyListener(settings.database_url, broadcaster, on_event=on_event)
    return container, listener


def make_lifespan(listener: PgNotifyListener):
    @asynccontextmanager
    async def lifespan(app):
        configure_logging()
        task = asyncio.create_task(listener.run())
        logger.info("api ready; listening for landscape events")
        yield
        listener.stop()
        task.cancel()

    return lifespan


def build_app():
    settings = Settings()
    container, listener = build_container(settings)
    return create_app(container, lifespan=make_lifespan(listener))


app = build_app()
