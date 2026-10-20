from fastapi import FastAPI
from app.api.auth import router as auth_router

app = FastAPI(
    title="Auth Service",
    description="Authentication and authorization microservice for TripMind",
    version="1.0.0"
)

app.include_router(auth_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": "Auth Service"
    }
