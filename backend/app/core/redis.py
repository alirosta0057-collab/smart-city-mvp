from __future__ import annotations

import redis.asyncio as aioredis

from app.core.config import settings

_redis: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis | None:
    """Return a Redis client, or None if Redis is not configured.

    All current features work without Redis (chat hub is in-process). Redis
    is reserved for future multi-instance pub/sub; an empty REDIS_URL turns
    it off.
    """
    global _redis
    if not settings.redis_url:
        return None
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis
