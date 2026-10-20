from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/tripmind_trips"
    
    # Shared JWT secret key and algorithm for token validation
    jwt_secret_key: str = "tripmind-super-secret-jwt-key-change-in-production-2026"
    jwt_algorithm: str = "HS256"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
