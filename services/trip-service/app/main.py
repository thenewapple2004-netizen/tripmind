from fastapi import FastAPI
from app.api.trips import router as trips_router
from app.api.activities import router as activities_router

app = FastAPI(
    title="Trip Service",
    description="Trip management microservice for TripMind",
    version="1.0.0"
)

app.include_router(trips_router, prefix="/api/v1")
app.include_router(activities_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "Trip Service"
    }
