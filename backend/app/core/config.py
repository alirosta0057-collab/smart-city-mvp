from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://smartcity:smartcity@localhost:5432/smartcity"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 1 week

    cors_origins: str = "http://localhost:3000"

    # LLM (optional)
    llm_provider: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    llm_model: str = ""

    # GeoIP
    geoip_provider: str = "ip-api"
    geoip_api_key: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
