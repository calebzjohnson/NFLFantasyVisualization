from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    model_config = {"env_prefix": "APP_"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
