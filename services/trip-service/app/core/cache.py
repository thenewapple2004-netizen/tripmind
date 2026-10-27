import logging
from typing import Optional
import redis
from app.core.config import settings

logger = logging.getLogger(__name__)

# Redis client configured with connection URL, string decoding, and bounded timeouts
redis_client: redis.Redis = redis.from_url(
    settings.redis_url,
    decode_responses=True,
    socket_connect_timeout=settings.redis_connect_timeout,
    socket_timeout=settings.redis_socket_timeout,
    retry_on_timeout=False,
)


def get_budget_cache_key(user_id: object, trip_id: object) -> str:
    """Generate the standardized cache key for a trip's budget summary."""
    return f"tripmind:budget:v1:{user_id}:{trip_id}"


def get_redis() -> redis.Redis:
    """FastAPI dependency for obtaining the Redis client instance."""
    return redis_client


def check_cache_connection() -> bool:
    """Check if the Redis cache is reachable and responds to ping."""
    try:
        return bool(redis_client.ping())
    except (redis.RedisError, Exception) as exc:
        logger.warning(f"Redis cache connection check failed: {exc}")
        return False


def get_cache(key: str) -> Optional[str]:
    """
    Safely retrieve a cached string value by key.
    Returns None on cache miss or Redis connection failure.
    """
    try:
        return redis_client.get(key)
    except (redis.RedisError, Exception) as exc:
        logger.warning(f"Redis get failed for key '{key}': {exc}. Falling back.")
        return None


def set_cache(key: str, value: str, ttl: Optional[int] = None) -> bool:
    """
    Safely store a string value in Redis with an optional TTL (in seconds).
    Defaults to settings.redis_cache_ttl if ttl is not specified.
    Returns True if successfully written, False otherwise.
    """
    if ttl is None:
        ttl = settings.redis_cache_ttl
    try:
        redis_client.set(key, value, ex=ttl)
        return True
    except (redis.RedisError, Exception) as exc:
        logger.warning(f"Redis set failed for key '{key}': {exc}.")
        return False


def delete_cache(key: str) -> bool:
    """
    Safely invalidate/delete a single key from Redis.
    Returns True if successfully deleted (or attempted), False on Redis error.
    """
    try:
        redis_client.delete(key)
        return True
    except (redis.RedisError, Exception) as exc:
        logger.warning(f"Redis delete failed for key '{key}': {exc}.")
        return False


def delete_cache_pattern(pattern: str) -> int:
    """
    Safely invalidate keys matching a pattern using SCAN.
    Returns the count of deleted keys, or 0 on error.
    """
    try:
        keys_to_delete = []
        for key in redis_client.scan_iter(match=pattern):
            keys_to_delete.append(key)
        if keys_to_delete:
            return redis_client.delete(*keys_to_delete)
        return 0
    except (redis.RedisError, Exception) as exc:
        logger.warning(f"Redis delete pattern '{pattern}' failed: {exc}.")
        return 0


def close_cache() -> None:
    """Close the Redis connection pool."""
    try:
        redis_client.close()
    except Exception as exc:
        logger.warning(f"Error closing Redis connection: {exc}")
