from pathlib import Path
from typing import Literal, Optional
from urllib.parse import urlparse

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    ENVIRONMENT: Literal["development", "test", "production"] = "development"
    APP_NAME: str = "Aisle Backend"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./aisle.db"

    # JWT Settings
    SECRET_KEY: str = "development-only-secret-do-not-use-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Azure OpenAI (primary LLM backend)
    AZURE_OPENAI_ENDPOINT: Optional[str] = None
    AZURE_OPENAI_API_KEY: Optional[str] = None
    AZURE_OPENAI_DEPLOYMENT: Optional[str] = None
    AZURE_OPENAI_API_VERSION: str = "2024-12-01-preview"

    # Vertex AI uses Application Default Credentials, never an API key.
    GOOGLE_GENAI_USE_VERTEXAI: bool = False
    GOOGLE_CLOUD_PROJECT: Optional[str] = None
    GOOGLE_CLOUD_LOCATION: str = "global"

    # Google AI Studio (optional local compatibility)
    GOOGLE_API_KEY: Optional[str] = None
    GOOGLE_MODEL: str = "gemini-3.8-flash"

    # Groq API (legacy fallback)
    GROQ_API_KEY: Optional[str] = None
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # Explicitly opt-in credentials used only by the one-time demo merchant seed.
    DEMO_MERCHANT_EMAIL: Optional[str] = None
    DEMO_MERCHANT_PASSWORD: Optional[str] = None

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]

    @property
    def has_ai_provider(self) -> bool:
        azure_configured = all(
            value and value.strip()
            for value in (
                self.AZURE_OPENAI_ENDPOINT,
                self.AZURE_OPENAI_API_KEY,
                self.AZURE_OPENAI_DEPLOYMENT,
            )
        )
        return self.GOOGLE_GENAI_USE_VERTEXAI or azure_configured or bool(
            (self.GROQ_API_KEY and self.GROQ_API_KEY.strip())
            or (self.GOOGLE_API_KEY and self.GOOGLE_API_KEY.strip())
        )

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.ENVIRONMENT.lower() == "production":
            if (
                len(self.SECRET_KEY) < 32
                or self.SECRET_KEY.startswith(("development-only-", "replace-with-"))
            ):
                raise ValueError("Production requires a unique, randomly generated SECRET_KEY of at least 32 characters.")
            if not self.DATABASE_URL.startswith(
                ("postgres://", "postgresql://", "postgresql+asyncpg://")
            ):
                raise ValueError("Production requires a persistent PostgreSQL DATABASE_URL.")
            if self.DEBUG:
                raise ValueError("DEBUG must be false in production.")
            if not self.CORS_ORIGINS or any(
                parsed.scheme != "https"
                or not parsed.netloc
                or "*" in parsed.netloc
                or parsed.path not in ("", "/")
                or parsed.query
                or parsed.fragment
                for parsed in (urlparse(origin) for origin in self.CORS_ORIGINS)
            ):
                raise ValueError("Production CORS_ORIGINS must contain only your HTTPS frontend origins.")
        return self

settings = Settings()

# Create model client for AutoGen 0.4+.
# Prefers Azure OpenAI, then Groq, then Google AI Studio.
def get_model_client():
    from autogen_core.models import ModelFamily

    if settings.GOOGLE_GENAI_USE_VERTEXAI:
        return get_google_model_client()

    if all(
        value and value.strip()
        for value in (
            settings.AZURE_OPENAI_ENDPOINT,
            settings.AZURE_OPENAI_API_KEY,
            settings.AZURE_OPENAI_DEPLOYMENT,
        )
    ):
        from autogen_ext.models.openai import AzureOpenAIChatCompletionClient
        return AzureOpenAIChatCompletionClient(
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            azure_deployment=settings.AZURE_OPENAI_DEPLOYMENT,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            api_key=settings.AZURE_OPENAI_API_KEY,
            model=settings.AZURE_OPENAI_DEPLOYMENT,
            model_info={
                "vision": False,
                "function_calling": True,
                "json_output": True,
                "structured_output": True,
                "family": ModelFamily.UNKNOWN,
            },
        )

    if settings.GROQ_API_KEY and settings.GROQ_API_KEY.strip():
        from autogen_ext.models.openai import OpenAIChatCompletionClient
        return OpenAIChatCompletionClient(
            model=settings.GROQ_MODEL,
            api_key=settings.GROQ_API_KEY,
            base_url=settings.GROQ_BASE_URL,
            model_info={
                "vision": False,
                "function_calling": True,
                "json_output": True,
                "structured_output": True,
                "family": ModelFamily.UNKNOWN,
            },
        )

    if settings.GOOGLE_API_KEY and settings.GOOGLE_API_KEY.strip():
        from autogen_ext.models.openai import OpenAIChatCompletionClient
        return OpenAIChatCompletionClient(
            model=settings.GOOGLE_MODEL,
            api_key=settings.GOOGLE_API_KEY,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            model_info={
                "vision": False,
                "function_calling": True,
                "json_output": True,
                "structured_output": True,
                "family": ModelFamily.UNKNOWN,
            },
        )

    raise RuntimeError(
        "No AI provider is configured. Set GROQ_API_KEY, GOOGLE_API_KEY, "
        "or all Azure OpenAI settings in the backend environment."
    )


def get_google_model_client():
    """Create a Gemini client for features that explicitly require Google AI."""
    if settings.GOOGLE_GENAI_USE_VERTEXAI:
        from vertex_client import create_vertex_client
        return create_vertex_client(settings)

    if not settings.GOOGLE_API_KEY or not settings.GOOGLE_API_KEY.strip():
        raise RuntimeError(
            "Gemini is not configured. Set a non-empty GOOGLE_API_KEY in backend/.env "
            "and restart the backend."
        )

    from autogen_core.models import ModelFamily
    from autogen_ext.models.openai import OpenAIChatCompletionClient

    return OpenAIChatCompletionClient(
        model=settings.GOOGLE_MODEL,
        api_key=settings.GOOGLE_API_KEY,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        model_info={
            "vision": False,
            "function_calling": True,
            "json_output": True,
            "structured_output": True,
            "family": ModelFamily.UNKNOWN,
        },
    )
