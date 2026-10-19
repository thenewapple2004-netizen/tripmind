from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/tripmind_trips"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
