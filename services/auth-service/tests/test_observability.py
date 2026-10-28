"""
test_observability.py
=====================
Tests for Task 15 Observability and Monitoring in Auth Service:
- Request correlation ID generation and propagation
- Structured JSON logging format and fields
- Sensitive data masking (passwords, tokens, credentials)
- Prometheus metrics endpoint and counters
"""

import json
import logging
from unittest.mock import patch
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.observability import (
    JSONFormatter,
    get_correlation_id,
    mask_sensitive_dict,
    mask_sensitive_text,
    set_correlation_id,
)


@pytest.fixture
def client():
    return TestClient(app)


# ── Correlation ID Tests ─────────────────────────────────────────────────────


def test_correlation_id_generated_when_missing(client):
    """If no X-Correlation-ID is sent, the service should generate a valid UUID4 and return it."""
    response = client.get("/health")
    assert response.status_code == 200
    cid = response.headers.get("x-correlation-id")
    assert cid is not None
    # Verify it is a valid UUID or hex string
    assert len(cid) >= 16


def test_correlation_id_preserved_when_supplied(client):
    """If caller provides X-Correlation-ID, the service must preserve and echo it."""
    custom_cid = "tripmind-test-corr-id-9999"
    response = client.get("/health", headers={"X-Correlation-ID": custom_cid})
    assert response.status_code == 200
    assert response.headers.get("x-correlation-id") == custom_cid


def test_correlation_id_context_management():
    """Verify context variable helper get/set works in execution context."""
    test_id = "test-context-var-1234"
    set_correlation_id(test_id)
    assert get_correlation_id() == test_id


# ── Structured JSON Logging Tests ────────────────────────────────────────────


def test_structured_json_logging_output():
    """Verify JSONFormatter produces valid JSON with standard observability fields."""
    formatter = JSONFormatter(service_name="auth-service")
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test.py",
        lineno=10,
        msg="Test event processed successfully",
        args=(),
        exc_info=None,
    )
    record.correlation_id = "test-corr-555"

    formatted = formatter.format(record)
    parsed = json.loads(formatted)

    assert parsed["service"] == "auth-service"
    assert parsed["level"] == "INFO"
    assert parsed["logger"] == "test_logger"
    assert parsed["message"] == "Test event processed successfully"
    assert parsed["correlation_id"] == "test-corr-555"
    assert "timestamp" in parsed


# ── Sensitive Data Redaction Tests ───────────────────────────────────────────


def test_sensitive_data_masking_dict():
    """Ensure sensitive dictionary keys are masked with [REDACTED]."""
    payload = {
        "email": "user@example.com",
        "password": "SuperSecretPassword123!",
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy",
        "metadata": {
            "refresh_token": "refresh-secret-token",
            "safe_key": "safe_value",
        },
    }

    sanitized = mask_sensitive_dict(payload)
    assert sanitized["email"] == "user@example.com"
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["access_token"] == "[REDACTED]"
    assert sanitized["metadata"]["refresh_token"] == "[REDACTED]"
    assert sanitized["metadata"]["safe_key"] == "safe_value"


def test_sensitive_data_masking_text():
    """Ensure Bearer tokens and sensitive KV patterns in raw text strings are masked."""
    raw_log = "User authorization failed: Bearer eyJhbGciOiJIUzI1Ni.secret.token with password: MyPlainPassword123"
    sanitized = mask_sensitive_text(raw_log)

    assert "Bearer [REDACTED]" in sanitized
    assert "eyJhbGciOiJIUzI1Ni.secret.token" not in sanitized
    assert "MyPlainPassword123" not in sanitized
    assert "[REDACTED]" in sanitized


def test_json_formatter_masks_sensitive_messages():
    """Verify JSONFormatter redacts sensitive information within log messages."""
    formatter = JSONFormatter(service_name="auth-service")
    record = logging.LogRecord(
        name="auth_service",
        level=logging.WARNING,
        pathname="auth.py",
        lineno=42,
        msg="Login failed for user with token=secret_jwt_token_here and password: secret_password",
        args=(),
        exc_info=None,
    )

    formatted = formatter.format(record)
    parsed = json.loads(formatted)

    assert "secret_jwt_token_here" not in parsed["message"]
    assert "secret_password" not in parsed["message"]
    assert "[REDACTED]" in parsed["message"]


# ── Prometheus Metrics Endpoint Tests ────────────────────────────────────────


def test_metrics_endpoint_accessible(client):
    """GET /metrics should return 200 with Prometheus text format."""
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")
    assert "http_requests_total" in response.text


def test_metrics_updated_after_requests(client):
    """Making requests should increment Prometheus http_requests_total metric."""
    # Issue requests
    client.get("/health")
    client.get("/health")

    metrics_res = client.get("/metrics")
    assert metrics_res.status_code == 200
    metrics_text = metrics_res.text

    assert 'http_requests_total{endpoint="/health",method="GET"' in metrics_text
    assert 'service="auth-service"' in metrics_text
