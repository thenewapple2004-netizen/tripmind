from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/tripmind_trips"
    redis_url: str = "redis://redis:6379/0"
    redis_connect_timeout: float = 2.0
    redis_socket_timeout: float = 2.0
    redis_cache_ttl: int = 60

    # Celery configuration
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"
    reports_dir: str = "/app/reports" if Path("/app").is_dir() else str(Path(__file__).resolve().parents[2] / "reports")
    
    # Shared JWT secret key and algorithm for token validation
    jwt_secret_key: str = "tripmind-super-secret-jwt-key-change-in-production-2026"
    jwt_algorithm: str = "HS256"

    # Auth Service inter-service communication settings
    auth_service_url: str = "http://auth-service:8000"
    auth_http_timeout: float = 5.0      # seconds per request
    auth_http_max_retries: int = 3      # max retry attempts on transient errors
    auth_http_backoff_factor: float = 0.5  # seconds × (2 ** attempt) backoff

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
