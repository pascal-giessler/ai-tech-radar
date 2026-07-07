from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://airadar:airadar@db:5432/airadar"
    github_token: str | None = None
    ingest_interval_minutes: int = 30
    min_tools_for_clustering: int = 12
