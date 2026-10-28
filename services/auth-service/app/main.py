from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.auth import router as auth_router
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
    yield


app = FastAPI(
    title="Auth Service",
    description="Authentication and authorization microservice for TripMind",
    version="1.0.0",
    lifespan=lifespan,
)

# Attach Observability Middleware
app.add_middleware(ObservabilityMiddleware, service_name=settings.service_name)

app.include_router(auth_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "Auth Service"
    }


@app.get("/metrics", tags=["Observability"], include_in_schema=False)
def get_metrics():
    """Prometheus metrics endpoint."""
    return metrics_response()

