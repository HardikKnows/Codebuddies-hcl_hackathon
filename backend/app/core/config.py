from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://localhost:5432/retailpulse"
    jwt_secret: str = ""
    jwt_expires_minutes: int = 480
    cors_origins: str = "http://localhost:5173"

    # AI provider. Model IDs are never defaulted: they must match models available to the API key.
    openai_api_key: str = ""
    openai_model: str = ""
    openai_embedding_model: str = ""
    openai_reasoning_effort: str = ""  # optional, only for reasoning models: low | medium | high
    embedding_dim: int = 1536  # must match the embedding model output; fixed in the database schema

    rag_top_k: int = 6
    rag_min_similarity: float = 0.30
    rag_high_similarity: float = 0.50

    action_ttl_minutes: int = 10

    @property
    def ai_configured(self) -> bool:
        return bool(self.openai_api_key and self.openai_model)

    @property
    def embeddings_configured(self) -> bool:
        return bool(self.openai_api_key and self.openai_embedding_model)


@lru_cache
def get_settings() -> Settings:
    return Settings()
