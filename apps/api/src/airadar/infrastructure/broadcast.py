"""In-process fan-out broadcaster bridging sync publishers to async SSE subscribers."""

import asyncio
from collections.abc import AsyncIterator


class AsyncFanoutBroadcaster:
    def __init__(self, max_queue: int = 32) -> None:
        self._max_queue = max_queue
        self._subscribers: set[asyncio.Queue] = set()
        self._loop: asyncio.AbstractEventLoop | None = None

    async def subscribe(self) -> AsyncIterator[dict]:
        self._loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue(maxsize=self._max_queue)
        self._subscribers.add(queue)
        try:
            while True:
                yield await queue.get()
        finally:
            self._subscribers.discard(queue)

    def publish(self, event: dict) -> None:
        """Safe to call from any thread (scheduler jobs run in executors)."""
        loop = self._loop
        if loop is None or not self._subscribers:
            return

        def fan_out() -> None:
            for queue in list(self._subscribers):
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    pass  # drop event for slow clients; they refetch on next one

        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None

        if running is loop:
            fan_out()
        else:
            loop.call_soon_threadsafe(fan_out)
