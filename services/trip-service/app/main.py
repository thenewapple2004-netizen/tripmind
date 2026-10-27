from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.trips import router as trips_router
from app.api.activities import router as activities_router
from app.api.expenses import router as expenses_router
from app.api.reports import router as reports_router
from app.core.auth_service_client import close_http_client


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

app.include_router(trips_router, prefix="/api/v1")
app.include_router(activities_router, prefix="/api/v1")
app.include_router(expenses_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "Trip Service"
    }
