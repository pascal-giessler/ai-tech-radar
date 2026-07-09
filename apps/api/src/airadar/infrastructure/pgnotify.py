"""Cross-process event bus over Postgres LISTEN/NOTIFY.

The worker publishes landscape events with `PgNotifyPublisher` (implements the
`UpdateBroadcaster` port). Every API replica runs a `PgNotifyListener` that LISTENs
and re-publishes into its in-process `AsyncFanoutBroadcaster`, so SSE clients on any
pod receive every event — no extra message broker needed.
"""

import asyncio
import json
import logging
from collections.abc import Callable

import psycopg

from airadar.infrastructure.broadcast import AsyncFanoutBroadcaster

logger = logging.getLogger(__name__)

DEFAULT_CHANNEL = "airadar_events"
CONFIG_CHANNEL = "radar_config_changed"


def to_libpq_dsn(database_url: str) -> str:
    """SQLAlchemy URL (postgresql+psycopg://…) → libpq DSN (postgresql://…)."""
    return database_url.replace("postgresql+psycopg://", "postgresql://").replace(
        "postgresql+psycopg2://", "postgresql://"
    )


class PgNotifyPublisher:
    """Publishes events as Postgres NOTIFY payloads. Reconnects on failure."""

    def __init__(self, database_url: str, channel: str = DEFAULT_CHANNEL) -> None:
        self._dsn = to_libpq_dsn(database_url)
        self._channel = channel
        self._conn: psycopg.Connection | None = None

    def _connection(self) -> psycopg.Connection:
        if self._conn is None or self._conn.closed:
            self._conn = psycopg.connect(self._dsn, autocommit=True)
        return self._conn

    def publish(self, event: dict) -> None:
        payload = json.dumps(event)
        try:
            self._connection().execute("SELECT pg_notify(%s, %s)", (self._channel, payload))
        except psycopg.Error as exc:
            logger.warning("pg NOTIFY failed (%s); dropping event", exc)
            self._conn = None  # force reconnect next time


class PgNotifyListener:
    """Bridges Postgres NOTIFY → the local in-process broadcaster. Auto-reconnects."""

    def __init__(
        self,
        database_url: str,
        broadcaster: AsyncFanoutBroadcaster,
        channel: str = DEFAULT_CHANNEL,
        reconnect_delay: float = 2.0,
        on_event: Callable[[dict], None] | None = None,
    ) -> None:
        self._dsn = to_libpq_dsn(database_url)
        self._broadcaster = broadcaster
        self._channel = channel
        self._reconnect_delay = reconnect_delay
        self._on_event = on_event
        self._stopped = False

    async def run(self) -> None:
        while not self._stopped:
            try:
                await self._listen_loop()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                logger.warning("pg LISTEN dropped (%s); reconnecting in %.0fs", exc, self._reconnect_delay)
                await asyncio.sleep(self._reconnect_delay)

    async def _listen_loop(self) -> None:
        aconn = await psycopg.AsyncConnection.connect(self._dsn, autocommit=True)
        try:
            await aconn.execute(f'LISTEN "{self._channel}"')
            logger.info("listening for landscape events on %s", self._channel)
            async for notify in aconn.notifies():
                if self._stopped:
                    break
                try:
                    event = json.loads(notify.payload)
                except json.JSONDecodeError:
                    logger.warning("ignoring malformed NOTIFY payload")
                    continue
                self._broadcaster.publish(event)
                if self._on_event is not None:
                    self._on_event(event)
        finally:
            await aconn.close()

    def stop(self) -> None:
        self._stopped = True
