# TripMind — Microservices Architecture & Observability

TripMind is an intelligent trip planning platform built on a distributed microservices architecture featuring authentication, trip management, budgeting & expenses, asynchronous reporting, and an observability stack.

---

## Observability & Monitoring (Task 15)

Task 15 implements production-grade observability across all backend services:
- **Auth Service** (FastAPI)
- **Trip Service** (FastAPI)
- **Celery Worker** (Asynchronous Report Generation)

### 1. Three Pillars of Observability

1. **Metrics (Prometheus & Grafana)**:
   - **HTTP API Metrics**:
     - `http_requests_total`: Total count partitioned by `service`, `method`, `endpoint` (normalized with `{id}` tokens to prevent label cardinality explosion), and `status_code`.
     - `http_request_duration_seconds`: Histogram measuring response time percentiles (p50, p90, p95, p99).
     - `http_requests_in_progress`: Real-time gauge of in-flight active requests.
   - **Redis Cache Metrics**:
     - `redis_operations_total`: Total operations partitioned by `service`, `operation` (`get`, `set`, `delete`, `scan_delete`), and `status` (`hit`, `miss`, `success`, `error`).
     - `redis_operation_duration_seconds`: High-precision latency histogram for Redis cache operations.
   - **Celery Background Worker Metrics**:
     - `celery_tasks_total`: Counter tracking tasks by `task_name` and `status` (`started`, `succeeded`, `failed`, `retried`).
     - `celery_task_duration_seconds`: Duration histogram for report generation and other background tasks.
   - **Grafana Pre-configured Dashboard**:
     - Provisioned automatically from `observability/grafana/dashboards/tripmind-overview.json`.
     - Displays KPI cards (Request Rate, p95 Latency, 5xx Error Rate %, Active In-Flight Requests), latency percentiles, status code breakdown, Redis hit/miss rates, and Celery worker metrics.

2. **Distributed Tracing (OpenTelemetry & Jaeger)**:
   - **W3C Trace Context Propagation**:
     - Outgoing HTTP calls from Trip Service to Auth Service (`auth_service_client.py`) inject standard W3C `traceparent` and `tracestate` headers so spans across services form a single unified distributed trace.
     - Celery task dispatch injects trace context into task headers via Celery's `before_task_publish` signal, allowing Celery worker execution to continue the trace asynchronously.
   - **OTLP Exporter**:
     - Spans are exported to Jaeger via OTLP HTTP (`http://jaeger:4318/v1/traces`).
     - Jaeger UI is available at `http://localhost:16686` for searching traces by trace ID, service, operation name, or tags.

3. **Structured JSON Logging & Correlation IDs**:
   - **Correlation IDs (`X-Correlation-ID`)**:
     - Handled via `ObservabilityMiddleware` in both services using Python `contextvars.ContextVar`.
     - If client supplies `X-Correlation-ID` or `X-Request-ID`, it is preserved; otherwise, a unique UUID is generated.
     - Automatically returned in the `X-Correlation-ID` response header.
     - Propagated across inter-service HTTP calls and into Celery task messages.
   - **Structured JSON Formatter**:
     - Formats every log entry into single-line JSON with standard fields: `timestamp` (ISO 8601 UTC), `level`, `service`, `logger`, `message`, `correlation_id`, `trace_id`, `span_id`, `method`, `path`, `status_code`, and `duration_ms`.
   - **Sensitive Data Masking**:
     - Recursive dictionary and regex-based redaction strictly replaces passwords, bearer tokens, JWT secrets, credentials, and API keys with `[REDACTED]`. Sensitive data is never written to log streams or spans.

---

## Observability Services & Ports

| Service | Port | Description |
|---|---|---|
| **Client UI** | `5173` | React / Vite Frontend |
| **Trip Service** | `8001` (internal `8000`) | Trip & Expense API (`/metrics` for Prometheus) |
| **Auth Service** | `8002` (internal `8000`) | Authentication API (`/metrics` for Prometheus) |
| **Prometheus** | `9090` | Metrics Scraper & Time-Series Database |
| **Grafana** | `3000` | Dashboards UI (`admin`/`admin`, anonymous access enabled) |
| **Jaeger UI** | `16686` | Distributed Tracing Web UI |
| **Jaeger OTLP** | `4317` (gRPC), `4318` (HTTP) | OpenTelemetry Trace Ingestion |
| **Redis** | `6379` | Cache & Celery Broker |
| **PostgreSQL** | `5433` (internal `5432`) | Primary Database |

---

## Running Locally with Docker Compose

To start the entire application stack including all observability services:

```bash
docker compose up --build -d
```

Check service status:
```bash
docker compose ps
```

Access Grafana at [http://localhost:3000](http://localhost:3000) and Jaeger at [http://localhost:16686](http://localhost:16686).

---

## Running Tests

Run test suites across both services:

```bash
# Auth Service tests (16 passed)
./services/auth-service/.venv/bin/pytest services/auth-service/tests

# Trip Service tests (81 passed)
./services/trip-service/.venv/bin/pytest services/trip-service/tests
```
