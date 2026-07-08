import asyncio
import os

import pytest

from airadar.infrastructure.broadcast import AsyncFanoutBroadcaster
from airadar.infrastructure.pgnotify import PgNotifyListener, PgNotifyPublisher, to_libpq_dsn


def test_to_libpq_dsn_strips_sqlalchemy_driver() -> None:
    assert to_libpq_dsn("postgresql+psycopg://u:p@h:5432/db") == "postgresql://u:p@h:5432/db"
    assert to_libpq_dsn("postgresql+psycopg2://u:p@h/db") == "postgresql://u:p@h/db"
    assert to_libpq_dsn("postgresql://u:p@h/db") == "postgresql://u:p@h/db"


TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.mark.integration
@pytest.mark.skipif(not TEST_DATABASE_URL, reason="TEST_DATABASE_URL not set")
async def test_notify_reaches_a_listening_subscriber() -> None:
    """An event published on one connection reaches a LISTENer on another — the
    mechanism that lets the worker notify SSE clients on separate API pods."""
    broadcaster = AsyncFanoutBroadcaster()
    listener = PgNotifyListener(TEST_DATABASE_URL, broadcaster, reconnect_delay=0.2)
    received: list[dict] = []

    async def consume():
        async for event in broadcaster.subscribe():
            received.append(event)
            return

    listen_task = asyncio.create_task(listener.run())
    consume_task = asyncio.create_task(consume())
    await asyncio.sleep(0.6)  # let LISTEN establish

    PgNotifyPublisher(TEST_DATABASE_URL).publish({"type": "landscape_updated", "tool_count": 7})

    await asyncio.wait_for(consume_task, timeout=5)
    listener.stop()
    listen_task.cancel()

    assert received == [{"type": "landscape_updated", "tool_count": 7}]
