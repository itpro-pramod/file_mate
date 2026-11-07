import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# Dynamically resolve path to backend and root directories
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
ROOT_DIR = BACKEND_DIR.parent
DB_DIR = ROOT_DIR / "db"
DB_DIR.mkdir(parents=True, exist_ok=True)
BACKEND_ENV_FILE = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    APP_NAME: str = "FileMate"
    APP_ENV: str = "development"
    DEBUG: bool = True

    DATABASE_URL: str = f"sqlite:///{ROOT_DIR / 'db' / 'filemate.db'}"

    SECRET_KEY: str = "dev_secret_key_change_in_production_894318723491823749"
    JWT_SECRET_KEY: str = "dev_jwt_secret_key_change_in_production_9123891283"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # LLM Settings
    LLM_PROVIDER: str = "azure_openai"  # "azure_openai" or "openai"

    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4.1-mini"
    OPENAI_BASE_URL: Optional[str] = None

    AZURE_OPENAI_API_KEY: Optional[str] = None
    AZURE_OPENAI_ENDPOINT: Optional[str] = None
    AZURE_OPENAI_API_VERSION: str = "2024-12-01-preview"
    AZURE_OPENAI_DEPLOYMENT_NAME: str = "gpt-4.1-mini"

    LLM_TIMEOUT_SECONDS: int = 45
    MAX_INPUT_LENGTH: int = 2000

    PENDING_ACTION_EXPIRY_MINUTES: int = 10

    LOG_LEVEL: str = "INFO"

    FRONTEND_URL: str = "http://localhost:5173"
    BACKEND_URL: str = "http://localhost:8000"

    model_config = SettingsConfigDict(
        env_file=(str(BACKEND_ENV_FILE), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
