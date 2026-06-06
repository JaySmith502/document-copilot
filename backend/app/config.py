"""Application settings — the single source of truth for environment config.

Import ``settings`` from this module wherever config is needed. Never read
``os.environ`` directly or call ``load_dotenv`` elsewhere. Instantiating
``Settings()`` at import time fails fast when a required variable is missing.
"""

from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# .env lives in backend/, one level up from backend/app/config.py.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Supabase (Auth + API)
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    # Postgres (Alembic + direct DB access)
    database_url: str

    # OpenAI
    openai_api_key: str
    openai_embedding_model: str = "text-embedding-3-small"
    openai_embedding_dimensions: int = 1536

    # Server: comma-separated browser origins allowed to call the API (CORS).
    # NoDecode disables pydantic-settings' JSON parsing so we can split on commas.
    allowed_origins: Annotated[list[str], NoDecode]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


settings = Settings()
