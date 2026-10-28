"""
test_observability.py
=====================
Tests for Task 15 Observability and Monitoring in Trip Service:
- Correlation ID generation and echo via middleware
- Inter-service propagation of Correlation ID and traceparent in auth_service_client
- Prometheus metrics endpoint and counters (HTTP, Redis, Celery)
- Redis operations metrics recording (get, set, delete, hit, miss)
- Celery task correlation propagation and metrics recording
- Structured JSON logging and sensitive data masking
"""

import json
import logging
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth_service_client import _fetch_with_retry, get_owner_profile
from app.core.cache import delete_cache, get_cache, set_cache
from app.core.observability import (
    CELERY_TASKS_TOTAL,
    HTTP_REQUESTS_TOTAL,
    JSONFormatter,
    REDIS_OPERATIONS_TOTAL,
    extract_trace_context,
    get_correlation_id,
    inject_trace_context,
    mask_sensitive_dict,
    mask_sensitive_text,
    record_celery_task_event,
    record_redis_operation,
    set_correlation_id,
)


@pytest.fixture
def client():
    return TestClient(app)


# ── Correlation ID & Middleware Tests ─────────────────────────────────────────


def test_correlation_id_generated_when_missing(client):
    """When client does not send X-Correlation-ID, server generates one and returns it."""
    response = client.get("/health")
    assert response.status_code == 200
    cid = response.headers.get("x-correlation-id")
    assert cid is not None
    assert len(cid) >= 16


def test_correlation_id_echoed_when_supplied(client):
    """When client sends X-Correlation-ID, server propagates and echoes it."""
    custom_cid = "trip-corr-id-xyz-789"
    response = client.get("/health", headers={"X-Correlation-ID": custom_cid})
    assert response.status_code == 200
    assert response.headers.get("x-correlation-id") == custom_cid


# ── Inter-Service HTTP Correlation & Trace Context Propagation ────────────────


@pytest.mark.anyio
async def test_auth_client_propagates_correlation_id_and_traceparent():
    """
    Trip Service calling Auth Service must forward:
    1. X-Correlation-ID header
    2. W3C traceparent header for distributed tracing continuity
    """
    test_cid = "distributed-trace-corr-12345"
    set_correlation_id(test_cid)

    captured_headers = {}

    async def mock_request(method, url, headers=None, **kwargs):
        nonlocal captured_headers
        captured_headers = dict(headers or {})
        return httpx.Response(
            200,
            json={"id": "user-uuid-1", "email": "test@example.com", "created_at": "2026-01-01"},
            request=httpx.Request(method, url),
        )

    mock_client = MagicMock()
    mock_client.request = AsyncMock(side_effect=mock_request)
    mock_client.is_closed = False

    with patch("app.core.auth_service_client.get_http_client", return_value=mock_client):
        result = await get_owner_profile("dummy-token-abc-123")
        assert result["email"] == "test@example.com"

        # Verify X-Correlation-ID was propagated
        assert captured_headers.get("X-Correlation-ID") == test_cid

        # Verify traceparent W3C header was injected
        assert "traceparent" in captured_headers
        assert captured_headers["traceparent"].startswith("00-")


# ── Redis Operations Metrics & Tracing ───────────────────────────────────────


def test_redis_operations_recorded_in_metrics():
    """Verify Redis get, set, delete operations update REDIS_OPERATIONS_TOTAL counter."""
    mock_redis = MagicMock()
    mock_redis.get.return_value = '{"cached": "data"}'
    mock_redis.set.return_value = True
    mock_redis.delete.return_value = 1

    with patch("app.core.cache.redis_client", mock_redis):
        # 1. Test set_cache
        res_set = set_cache("test_trip_key", '{"budget": 1000}', ttl=30)
        assert res_set is True

        # 2. Test get_cache (hit)
        res_get = get_cache("test_trip_key")
        assert res_get == '{"cached": "data"}'

        # 3. Test get_cache (miss)
        mock_redis.get.return_value = None
        res_miss = get_cache("missing_key")
        assert res_miss is None

        # 4. Test delete_cache
        res_del = delete_cache("test_trip_key")
        assert res_del is True

    # Check metric samples exist
    samples = {s.name: s.value for s in REDIS_OPERATIONS_TOTAL.collect()[0].samples}
    assert any("redis_operations_total" in k for k in samples)


# ── Celery Background Task Metrics & Trace Context ───────────────────────────


def test_celery_task_metrics_recording():
    """Verify Celery task start, success, and failure record metric events."""
    task_name = "tasks.generate_trip_report"

    # Record task lifecycle events
    record_celery_task_event(task_name, "started")
    record_celery_task_event(task_name, "succeeded", duration_s=0.25)
    record_celery_task_event(task_name, "failed", duration_s=0.10)

    # Collect samples
    samples = {
        (s.labels.get("task_name"), s.labels.get("status")): s.value
        for s in CELERY_TASKS_TOTAL.collect()[0].samples
        if s.name == "celery_tasks_total"
    }

    assert samples.get((task_name, "started"), 0) >= 1
    assert samples.get((task_name, "succeeded"), 0) >= 1
    assert samples.get((task_name, "failed"), 0) >= 1


def test_celery_trace_context_propagation():
    """Verify trace context carrier inject and extract for Celery message headers."""
    carrier = {}
    inject_trace_context(carrier)
    assert "traceparent" in carrier

    extracted_ctx = extract_trace_context(carrier)
    assert extracted_ctx is not None


# ── Prometheus Metrics Endpoint Tests ────────────────────────────────────────


def test_metrics_endpoint_exports_expected_metrics(client):
    """Verify GET /metrics includes API, Redis, and Celery metric families."""
    client.get("/health")

    response = client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")

    text = response.text
    assert "http_requests_total" in text
    assert "http_request_duration_seconds" in text
    assert "redis_operations_total" in text
    assert "celery_tasks_total" in text


# ── Structured JSON Logging & Sensitive Data Redaction ───────────────────────


def test_structured_json_logging_format():
    """Verify JSONFormatter outputs valid JSON with correlation_id and service."""
    formatter = JSONFormatter(service_name="trip-service")
    record = logging.LogRecord(
        name="trip.tasks",
        level=logging.INFO,
        pathname="report_tasks.py",
        lineno=50,
        msg="Generated report for trip=123",
        args=(),
        exc_info=None,
    )
    record.correlation_id = "test-corr-abc"

    output = formatter.format(record)
    parsed = json.loads(output)

    assert parsed["service"] == "trip-service"
    assert parsed["level"] == "INFO"
    assert parsed["logger"] == "trip.tasks"
    assert parsed["correlation_id"] == "test-corr-abc"
    assert "timestamp" in parsed


def test_sensitive_data_masking():
    """Verify passwords, Bearer tokens, and secrets are sanitized."""
    raw = "Failed request: Authorization: Bearer eyJhbGciOiJIUzI1Ni.jwt_token_payload with password: super_secret"
    sanitized = mask_sensitive_text(raw)

    assert "Bearer [REDACTED]" in sanitized
    assert "eyJhbGciOiJIUzI1Ni" not in sanitized
    assert "super_secret" not in sanitized
    assert "[REDACTED]" in sanitized

    sensitive_dict = {
        "user_id": "123",
        "jwt_secret_key": "do-not-log-secret",
        "authorization": "Bearer token",
    }
    cleaned = mask_sensitive_dict(sensitive_dict)
    assert cleaned["user_id"] == "123"
    assert cleaned["jwt_secret_key"] == "[REDACTED]"
    assert cleaned["authorization"] == "[REDACTED]"
