from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.trips import router as trips_router
from app.api.activities import router as activities_router
from app.api.expenses import router as expenses_router
from app.api.reports import router as reports_router
from app.api.owner import router as owner_router
from app.core.auth_service_client import close_http_client
from app.core.config import settings
from app.core.observability import (
    ObservabilityMiddleware,
    configure_logging,
    metrics_response,
    setup_tracing,
)

# Configure structured JSON logging
configure_logging(
    service_name=settings.service_name,
    log_level=settings.log_level,
    log_format=settings.log_format,
)

# Initialize OpenTelemetry distributed tracing
setup_tracing(
    service_name=settings.service_name,
    otlp_endpoint=settings.otlp_endpoint,
    enabled=settings.tracing_enabled,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage shared resources across the application lifetime."""
    yield  # startup is lazy (client created on first use)
    await close_http_client()  # graceful shutdown


app = FastAPI(
    title="Trip Service",
    description="Trip management microservice for TripMind",
    version="1.0.0",
    lifespan=lifespan,
)

# Attach Observability Middleware
app.add_middleware(ObservabilityMiddleware, service_name=settings.service_name)

app.include_router(trips_router, prefix="/api/v1")
app.include_router(activities_router, prefix="/api/v1")
app.include_router(expenses_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(owner_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "Trip Service"
    }


@app.get("/metrics", tags=["Observability"], include_in_schema=False)
def get_metrics():
    """Prometheus metrics endpoint."""
    return metrics_response()

