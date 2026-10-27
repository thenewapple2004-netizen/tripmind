from unittest.mock import MagicMock, patch
import redis
from app.core import cache
from app.core.config import settings


def test_cache_initialization():
    client = cache.get_redis()
    assert isinstance(client, redis.Redis)
    assert cache.redis_client is client
    # Verify timeout configuration on connection pool kwargs
    kwargs = client.connection_pool.connection_kwargs
    assert kwargs.get("socket_connect_timeout") == settings.redis_connect_timeout
    assert kwargs.get("socket_timeout") == settings.redis_socket_timeout
    assert kwargs.get("decode_responses") is True


def test_check_cache_connection_success():
    with patch.object(cache.redis_client, "ping", return_value=True):
        assert cache.check_cache_connection() is True


def test_check_cache_connection_failure():
    with patch.object(cache.redis_client, "ping", side_effect=redis.ConnectionError("Connection refused")):
        assert cache.check_cache_connection() is False


def test_get_cache_success():
    with patch.object(cache.redis_client, "get", return_value='{"key": "value"}'):
        result = cache.get_cache("test:key")
        assert result == '{"key": "value"}'


def test_get_cache_miss():
    with patch.object(cache.redis_client, "get", return_value=None):
        result = cache.get_cache("test:nonexistent")
        assert result is None


def test_get_cache_connection_error_graceful_fallback():
    with patch.object(cache.redis_client, "get", side_effect=redis.ConnectionError("Redis down")):
        # Must return None instead of raising an uncaught exception
        result = cache.get_cache("test:key")
        assert result is None


def test_get_cache_timeout_error_graceful_fallback():
    with patch.object(cache.redis_client, "get", side_effect=redis.TimeoutError("Command timed out")):
        result = cache.get_cache("test:key")
        assert result is None


def test_set_cache_success():
    with patch.object(cache.redis_client, "set", return_value=True) as mock_set:
        success = cache.set_cache("test:key", '{"data": 1}', ttl=120)
        assert success is True
        mock_set.assert_called_once_with("test:key", '{"data": 1}', ex=120)


def test_set_cache_default_ttl():
    with patch.object(cache.redis_client, "set", return_value=True) as mock_set:
        success = cache.set_cache("test:key", '{"data": 1}')
        assert success is True
        mock_set.assert_called_once_with("test:key", '{"data": 1}', ex=settings.redis_cache_ttl)


def test_set_cache_failure_graceful():
    with patch.object(cache.redis_client, "set", side_effect=redis.ConnectionError("Redis down")):
        success = cache.set_cache("test:key", '{"data": 1}')
        assert success is False


def test_delete_cache_success():
    with patch.object(cache.redis_client, "delete", return_value=1) as mock_del:
        success = cache.delete_cache("test:key")
        assert success is True
        mock_del.assert_called_once_with("test:key")


def test_delete_cache_failure_graceful():
    with patch.object(cache.redis_client, "delete", side_effect=redis.ConnectionError("Redis down")):
        success = cache.delete_cache("test:key")
        assert success is False


def test_delete_cache_pattern_success():
    with patch.object(cache.redis_client, "scan_iter", return_value=["key:1", "key:2"]), \
         patch.object(cache.redis_client, "delete", return_value=2) as mock_del:
        deleted = cache.delete_cache_pattern("key:*")
        assert deleted == 2
        mock_del.assert_called_once_with("key:1", "key:2")


def test_delete_cache_pattern_failure_graceful():
    with patch.object(cache.redis_client, "scan_iter", side_effect=redis.ConnectionError("Redis down")):
        deleted = cache.delete_cache_pattern("key:*")
        assert deleted == 0
