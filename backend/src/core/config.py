from __future__ import annotations

import os
from functools import lru_cache
from typing import ClassVar

from dotenv import dotenv_values
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config: ClassVar[SettingsConfigDict] = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Talkie"
    app_version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"
    debug: bool = False
    log_level: str = "INFO"
    allow_startup_without_infra: bool = Field(default=False, alias="ALLOW_STARTUP_WITHOUT_INFRA")

    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")

    minio_endpoint: str = Field(alias="MINIO_ENDPOINT")
    minio_access_key: str = Field(alias="MINIO_ACCESS_KEY")
    minio_secret_key: str = Field(alias="MINIO_SECRET_KEY")
    minio_bucket_name: str = Field(alias="MINIO_BUCKET_NAME")
    minio_secure: bool = Field(default=False, alias="MINIO_SECURE")

    jwt_secret: str = Field(alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_access_expire_minutes: int = Field(default=60, alias="JWT_ACCESS_EXPIRE_MINUTES")
    jwt_refresh_expire_days: int = Field(default=7, alias="JWT_REFRESH_EXPIRE_DAYS")

    worker_timeout_seconds: int = Field(default=30, alias="WORKER_TIMEOUT_SECONDS")
    worker_max_retries: int = Field(default=3, alias="WORKER_MAX_RETRIES")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")

    google_translate_api_key: str | None = Field(default=None, alias="GOOGLE_TRANSLATE_API_KEY")
    google_translate_project_id: str | None = Field(
        default=None,
        alias="GOOGLE_TRANSLATE_PROJECT_ID",
    )

    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    env_path = os.path.join(os.getcwd(), ".env")
    loaded_values = dict(dotenv_values(env_path)) if os.path.exists(env_path) else {}
    merged_values = {**loaded_values, **os.environ}
    return Settings.model_validate(merged_values)


settings = get_settings()
