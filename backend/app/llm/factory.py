from typing import Optional
from sqlalchemy.orm import Session
from app.core.config import settings
from app.database.database import SessionLocal
from app.database.models import ApplicationSetting
from app.llm.azure_provider import AzureOpenAIProvider
from app.llm.base import BaseLLMProvider
from app.llm.openai_provider import OpenAIProvider


class LLMProviderFactory:
    """Factory to retrieve and switch between OpenAI and Azure OpenAI providers."""

    @staticmethod
    def get_active_provider_name(db: Optional[Session] = None) -> str:
        """Fetch active provider name from DB settings, falling back to config."""
        should_close = False
        if db is None:
            db = SessionLocal()
            should_close = True
        try:
            setting = db.query(ApplicationSetting).filter(ApplicationSetting.key == "active_llm_provider").first()
            if setting and setting.value in ["openai", "azure_openai"]:
                return setting.value
            return settings.LLM_PROVIDER.lower()
        finally:
            if should_close:
                db.close()

    @classmethod
    def get_provider(cls, provider_name: Optional[str] = None, db: Optional[Session] = None) -> BaseLLMProvider:
        """Instantiate the requested or currently active provider."""
        active_name = provider_name or cls.get_active_provider_name(db)
        if active_name == "azure_openai":
            return AzureOpenAIProvider()
        return OpenAIProvider()

    @staticmethod
    def set_active_provider(provider_name: str, db: Session) -> str:
        """Switch active provider in the database."""
        if provider_name not in ["openai", "azure_openai"]:
            raise ValueError(f"Unsupported provider: {provider_name}. Must be 'openai' or 'azure_openai'.")

        setting = db.query(ApplicationSetting).filter(ApplicationSetting.key == "active_llm_provider").first()
        if not setting:
            setting = ApplicationSetting(key="active_llm_provider", value=provider_name)
            db.add(setting)
        else:
            setting.value = provider_name
        db.commit()
        return provider_name
