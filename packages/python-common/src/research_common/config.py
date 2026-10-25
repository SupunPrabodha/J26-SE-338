from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: str = "development"
    service_name: str = "orchestrator"
    database_url: SecretStr = SecretStr("sqlite:///./.local/dev.db")
    redis_url: SecretStr = SecretStr("redis://localhost:6379/0")
    jwt_secret: SecretStr = SecretStr("")
    preprocessing_secret: SecretStr = SecretStr("")
    nlp_secret: SecretStr = SecretStr("")
    xai_secret: SecretStr = SecretStr("")
    preprocessing_url: str = "http://preprocessing:8000"
    nlp_url: str = "http://nlp:8000"
    xai_url: str = "http://xai:8000"
    allowed_origins: str = "http://localhost:3000,http://localhost:3001"
    cookie_secure: bool = False
    access_seconds: int = 300
    refresh_seconds: int = 3600
    remembered_session_seconds: int = 604800
    retention_hours: int = 24
    dev_counsellor_username: str = ""
    assignment_policy: Literal["DESIGNATED_DEVELOPMENT", "MANUAL"] = "DESIGNATED_DEVELOPMENT"
    service_timeout_seconds: float = 5.0

    @field_validator("remembered_session_seconds")
    @classmethod
    def bounded_remembered_session(cls, value):
        if not 3600 <= value <= 2592000:
            raise ValueError("Remembered sessions must be between one hour and 30 days")
        return value

    @field_validator("environment")
    @classmethod
    def development_only(cls, value):
        if value != "development":
            raise ValueError("Bootstrap is development-only")
        return value

    @model_validator(mode="after")
    def secret_length(self):
        required = (
            [self.service_name + "_secret"]
            if self.service_name in {"preprocessing", "nlp", "xai"}
            else ["jwt_secret", "preprocessing_secret", "nlp_secret", "xai_secret"]
        )
        for field in required:
            value = getattr(self, field).get_secret_value()
            if len(value) < 43 or "GENERATE" in value:
                raise ValueError("Generate local secrets with the bootstrap script")
        return self


@lru_cache
def settings():
    return Settings()
