"""Ingestion worker: `python -m airadar.worker`.

The single writer. Runs the scheduled ingest → recompute pipeline and publishes
landscape events over Postgres NOTIFY. Deploy with replicas=1.
"""

import asyncio
import pathlib
import signal
import time

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from airadar.config import Settings
from airadar.infrastructure.broadcast import AsyncFanoutBroadcaster
from airadar.infrastructure.pgnotify import CONFIG_CHANNEL, PgNotifyListener
from airadar.runtime import build_refresh_job, configure_logging, init_db_with_retry, logger

HEARTBEAT_FILE = pathlib.Path("/tmp/worker-alive")  # noqa: S108 — ephemeral liveness marker


async def _heartbeat(interval: float = 30.0) -> None:
    """Touch a file the k8s liveness probe checks, so a hung event loop is detected
    without coupling worker liveness to database availability."""
    while True:
        HEARTBEAT_FILE.write_text(str(time.time()))
        await asyncio.sleep(interval)


async def run() -> None:
    configure_logging()
    settings = Settings()
    job = build_refresh_job(settings)

    heartbeat = asyncio.create_task(_heartbeat())

    # Tables are created by the migrate Job; wait until they're reachable, then work.
    await asyncio.to_thread(init_db_with_retry, job.engine)

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        lambda: asyncio.create_task(asyncio.to_thread(job.run_sync)),
        "interval",
        minutes=settings.ingest_interval_minutes,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    logger.info("worker started; ingesting every %s min", settings.ingest_interval_minutes)

    # LISTEN for config changes: a PATCH /api/settings on any api pod emits a NOTIFY
    # on CONFIG_CHANNEL; on receipt we run an immediate ingest+recompute that re-reads
    # the settings row. RefreshJob's lock skips overlapping runs (max_instances=1).
    def on_config_changed(_event: dict) -> None:
        logger.info("config changed; triggering immediate refresh")
        asyncio.create_task(asyncio.to_thread(job.run_sync))

    config_listener = PgNotifyListener(
        settings.database_url,
        AsyncFanoutBroadcaster(),
        channel=CONFIG_CHANNEL,
        on_event=on_config_changed,
    )
    config_task = asyncio.create_task(config_listener.run())

    await asyncio.to_thread(job.run_sync)  # seed immediately

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, stop.set)
    await stop.wait()

    logger.info("worker shutting down")
    heartbeat.cancel()
    config_listener.stop()
    config_task.cancel()
    scheduler.shutdown(wait=False)


if __name__ == "__main__":
    asyncio.run(run())
