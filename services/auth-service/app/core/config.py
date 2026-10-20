from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "postgresql+psycopg2://postgres:postgres@postgres:5432/tripmind_auth"
    
    # JWT & Security Configuration
    jwt_secret_key: str = "tripmind-super-secret-jwt-key-change-in-production-2026"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 14

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
