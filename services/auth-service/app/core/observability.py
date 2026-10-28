"""
observability.py
================
Observability module providing:
- Structured JSON logging with sensitive data masking
- Correlation ID propagation via contextvars and HTTP middleware
- OpenTelemetry distributed tracing configuration and helpers
- Prometheus metrics collection and /metrics exposition
"""

import json
import logging
import re
import time
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# Prometheus client
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

# OpenTelemetry
from opentelemetry import context, propagate, trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Status, StatusCode
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

logger = logging.getLogger("app.observability")

# ── Correlation ID Context ───────────────────────────────────────────────────

correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="")


def get_correlation_id() -> str:
    """Retrieve the current request's correlation ID."""
    return correlation_id_ctx.get()


def set_correlation_id(correlation_id: str) -> None:
    """Set the current request's correlation ID."""
    correlation_id_ctx.set(correlation_id)


# ── Sensitive Data Masking ───────────────────────────────────────────────────

SENSITIVE_KEYS = {
    "password",
    "hashed_password",
    "plain_password",
    "new_password",
    "current_password",
    "token",
    "access_token",
    "refresh_token",
    "bearer",
    "authorization",
    "secret",
    "jwt_secret_key",
    "credit_card",
    "card_number",
    "cvv",
    "api_key",
}

BEARER_PATTERN = re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*", re.IGNORECASE)
SENSITIVE_KV_PATTERN = re.compile(
    r'(?i)("?(?:password|token|secret|access_token|refresh_token)"?\s*[:=]\s*)"?([^"\',\s}]+)"?'
)


def mask_sensitive_value(key: str, value: Any) -> Any:
    """Mask sensitive fields by key name or pattern."""
    if not isinstance(key, str):
        return value
    lower_key = key.lower()
    if any(s in lower_key for s in SENSITIVE_KEYS):
        return "[REDACTED]"
    if isinstance(value, dict):
        return mask_sensitive_dict(value)
    if isinstance(value, list):
        return [mask_sensitive_value(key, v) for v in value]
    if isinstance(value, str):
        return mask_sensitive_text(value)
    return value


def mask_sensitive_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """Recursively redact sensitive key-values from a dictionary."""
    sanitized = {}
    for k, v in data.items():
        lower_k = k.lower()
        if any(s in lower_k for s in SENSITIVE_KEYS):
            sanitized[k] = "[REDACTED]"
        elif isinstance(v, dict):
            sanitized[k] = mask_sensitive_dict(v)
        elif isinstance(v, list):
            sanitized[k] = [
                mask_sensitive_dict(i) if isinstance(i, dict) else mask_sensitive_value(k, i)
                for i in v
            ]
        elif isinstance(v, str):
            sanitized[k] = mask_sensitive_text(v)
        else:
            sanitized[k] = v
    return sanitized


def mask_sensitive_text(text: str) -> str:
    """Mask Bearer tokens and sensitive key=value occurrences in raw text."""
    if not text:
        return text
    text = BEARER_PATTERN.sub("Bearer [REDACTED]", text)
    text = SENSITIVE_KV_PATTERN.sub(r'\1"[REDACTED]"', text)
    return text


# ── Structured JSON Logging Formatter ─────────────────────────────────────────


class JSONFormatter(logging.Formatter):
    """
    Standard library logging formatter that produces structured JSON.
    Automatically enriches logs with:
    - timestamp (ISO 8601 UTC)
    - correlation_id (from contextvar or record attribute)
    - trace_id & span_id (from active OpenTelemetry span)
    - service name
    - sanitized message with sensitive fields redacted
    """

    def __init__(self, service_name: str = "auth-service", *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        # Base log entry
        log_entry: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "logger": record.name,
            "message": mask_sensitive_text(record.getMessage()),
        }

        # Correlation ID
        cid = getattr(record, "correlation_id", None) or get_correlation_id()
        if cid:
            log_entry["correlation_id"] = cid

        # OpenTelemetry Trace and Span ID
        current_span = trace.get_current_span()
        if current_span and current_span.get_span_context().is_valid:
            span_ctx = current_span.get_span_context()
            log_entry["trace_id"] = format(span_ctx.trace_id, "032x")
            log_entry["span_id"] = format(span_ctx.span_id, "016x")

        # Custom structured attributes attached to record
        for key in ("method", "path", "status_code", "duration_ms", "client_ip", "user_id"):
            val = getattr(record, key, None)
            if val is not None:
                log_entry[key] = val

        # Exception formatting
        if record.exc_info:
            log_entry["exception"] = mask_sensitive_text(self.formatException(record.exc_info))

        return json.dumps(log_entry, default=str)


def configure_logging(
    service_name: str = "auth-service",
    log_level: str = "INFO",
    log_format: str = "json",
) -> None:
    """Configure root logger with structured JSON formatting."""
    root_logger = logging.getLogger()
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger.setLevel(numeric_level)

    # Remove existing handlers to avoid duplicates
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    handler = logging.StreamHandler()
    if log_format.lower() == "json":
        handler.setFormatter(JSONFormatter(service_name=service_name))
    else:
        handler.setFormatter(
            logging.Formatter(
                "[%(asctime)s] [%(levelname)s] [%(name)s] [corr=%(correlation_id)s] %(message)s",
                defaults={"correlation_id": ""},
            )
        )
    root_logger.addHandler(handler)

    # Quieten excessively verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


# ── OpenTelemetry Tracing ────────────────────────────────────────────────────

_tracer: Optional[trace.Tracer] = None


def setup_tracing(
    service_name: str,
    otlp_endpoint: Optional[str] = None,
    enabled: bool = True,
) -> trace.Tracer:
    """Initialize OpenTelemetry tracer with OTLP HTTP exporter."""
    global _tracer
    resource = Resource.create(
        attributes={
            SERVICE_NAME: service_name,
            "deployment.environment": "production",
        }
    )
    provider = TracerProvider(resource=resource)

    if enabled and otlp_endpoint:
        try:
            otlp_exporter = OTLPSpanExporter(endpoint=otlp_endpoint, timeout=3.0)
            span_processor = BatchSpanProcessor(otlp_exporter)
            provider.add_span_processor(span_processor)
        except Exception as exc:
            logger.warning("Failed to initialize OTLP exporter at %s: %s", otlp_endpoint, exc)

    trace.set_tracer_provider(provider)
    propagate.set_global_textmap(TraceContextTextMapPropagator())
    _tracer = trace.get_tracer(service_name)
    return _tracer


def get_tracer(service_name: str = "auth-service") -> trace.Tracer:
    """Get the active OpenTelemetry tracer."""
    global _tracer
    if _tracer is None:
        _tracer = trace.get_tracer(service_name)
    return _tracer


def inject_trace_context(carrier: Optional[Dict[str, str]] = None) -> Dict[str, str]:
    """Inject current trace context into an outbound carrier dict (e.g. HTTP headers)."""
    if carrier is None:
        carrier = {}
    current_span = trace.get_current_span()
    if not (current_span and current_span.get_span_context().is_valid):
        tracer = get_tracer()
        with tracer.start_as_current_span("context.propagation"):
            TraceContextTextMapPropagator().inject(carrier)
            return carrier
    TraceContextTextMapPropagator().inject(carrier)
    return carrier


def extract_trace_context(carrier: Dict[str, str]) -> context.Context:
    """Extract trace context from an inbound carrier dict (e.g. HTTP headers)."""
    return TraceContextTextMapPropagator().extract(carrier)


# ── Prometheus Metrics ───────────────────────────────────────────────────────

# Standard HTTP metrics
HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total count of HTTP requests handled by the service",
    ["service", "method", "endpoint", "status_code"],
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["service", "method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5, 5.0, 10.0),
)

HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "http_requests_in_progress",
    "Number of HTTP requests currently being handled",
    ["service", "method"],
)


def metrics_response() -> Response:
    """Generate Prometheus exposition format response."""
    data = generate_latest()
    return Response(content=data, media_type=CONTENT_TYPE_LATEST)


# ── Endpoint Normalization ───────────────────────────────────────────────────

UUID_PATTERN = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.IGNORECASE
)
INT_PATTERN = re.compile(r"/\d+(?=/|$)")


def normalize_endpoint(path: str) -> str:
    """
    Replace UUIDs and dynamic integer IDs with generic tokens to prevent
    high-cardinality explosion in Prometheus metric labels.
    """
    path = UUID_PATTERN.sub("{id}", path)
    path = INT_PATTERN.sub("/{id}", path)
    return path


# ── FastAPI Observability Middleware ─────────────────────────────────────────


class ObservabilityMiddleware(BaseHTTPMiddleware):
    """
    FastAPI middleware providing:
    1. Correlation ID management (extracts or creates X-Correlation-ID)
    2. OpenTelemetry distributed tracing context extraction & span generation
    3. Prometheus metrics collection (latency, counts, in-flight gauges)
    4. Structured JSON access logging
    5. Sensitive data redaction in headers and paths
    """

    def __init__(self, app: ASGIApp, service_name: str = "auth-service"):
        super().__init__(app)
        self.service_name = service_name

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()

        # 1. Manage Correlation ID
        incoming_cid = (
            request.headers.get("x-correlation-id")
            or request.headers.get("x-request-id")
            or uuid4().hex
        )
        set_correlation_id(incoming_cid)

        # 2. Extract Trace Context from inbound headers
        headers_dict = dict(request.headers)
        extracted_ctx = extract_trace_context(headers_dict)

        # 3. Normalize endpoint path for Prometheus metrics
        endpoint = normalize_endpoint(request.url.path)
        method = request.method

        # 4. In-flight requests gauge
        HTTP_REQUESTS_IN_PROGRESS.labels(service=self.service_name, method=method).inc()

        tracer = get_tracer(self.service_name)
        span_name = f"HTTP {method} {endpoint}"

        status_code = 500
        try:
            with tracer.start_as_current_span(
                span_name,
                context=extracted_ctx,
                kind=trace.SpanKind.SERVER,
            ) as span:
                span.set_attribute("http.method", method)
                span.set_attribute("http.url", str(request.url))
                span.set_attribute("http.target", request.url.path)
                span.set_attribute("http.route", endpoint)
                span.set_attribute("correlation_id", incoming_cid)

                # Process downstream request
                response: Response = await call_next(request)
                status_code = response.status_code

                span.set_attribute("http.status_code", status_code)
                if status_code >= 500:
                    span.set_status(Status(StatusCode.ERROR, f"HTTP {status_code}"))
                elif status_code < 400:
                    span.set_status(Status(StatusCode.OK))

                # Inject Correlation ID into response headers
                response.headers["X-Correlation-ID"] = incoming_cid
                return response

        except Exception as exc:
            status_code = 500
            current_span = trace.get_current_span()
            if current_span and current_span.is_recording():
                current_span.set_status(Status(StatusCode.ERROR, str(exc)))
                current_span.record_exception(exc)
            raise exc

        finally:
            duration_s = time.perf_counter() - start_time
            duration_ms = round(duration_s * 1000, 2)

            # Record Prometheus metrics
            HTTP_REQUESTS_IN_PROGRESS.labels(service=self.service_name, method=method).dec()
            HTTP_REQUESTS_TOTAL.labels(
                service=self.service_name,
                method=method,
                endpoint=endpoint,
                status_code=str(status_code),
            ).inc()
            HTTP_REQUEST_DURATION_SECONDS.labels(
                service=self.service_name,
                method=method,
                endpoint=endpoint,
            ).observe(duration_s)

            # Structured JSON Access Log
            client_host = request.client.host if request.client else "unknown"
            access_logger = logging.getLogger("app.access")
            access_logger.info(
                f"{method} {endpoint} -> {status_code} ({duration_ms}ms)",
                extra={
                    "correlation_id": incoming_cid,
                    "method": method,
                    "path": endpoint,
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                    "client_ip": client_host,
                },
            )
