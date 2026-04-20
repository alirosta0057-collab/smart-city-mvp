"""In-process WebSocket hub for ticket-scoped chat.

One asyncio structure keeps the list of connections per ticket. For a single-
instance MVP this is enough. For multi-instance, swap this for Redis pub/sub.
"""
from __future__ import annotations

import asyncio
import json
from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class ChatHub:
    def __init__(self) -> None:
        self._rooms: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, ticket_id: int, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._rooms[ticket_id].add(ws)

    async def disconnect(self, ticket_id: int, ws: WebSocket) -> None:
        async with self._lock:
            self._rooms[ticket_id].discard(ws)
            if not self._rooms[ticket_id]:
                self._rooms.pop(ticket_id, None)

    async def broadcast(self, ticket_id: int, payload: dict[str, Any]) -> None:
        raw = json.dumps(payload, default=str)
        dead: list[WebSocket] = []
        async with self._lock:
            targets = list(self._rooms.get(ticket_id, set()))
        for ws in targets:
            try:
                await ws.send_text(raw)
            except Exception:  # noqa: BLE001 - drop broken sockets
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._rooms[ticket_id].discard(ws)


hub = ChatHub()
