from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.auth import get_current_user
from app.core.config import settings
from app.database.database import get_db
from app.database.models import User
from app.database.schemas import (
    LLMHealthResponse,
    LLMSettingsResponse,
    LLMSettingsUpdate,
)
from app.llm.azure_provider import AzureOpenAIProvider
from app.llm.factory import LLMProviderFactory
from app.llm.openai_provider import OpenAIProvider

router = APIRouter(prefix="/api/settings", tags=["Application Settings"])


@router.get("/llm", response_model=LLMSettingsResponse)
def get_llm_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve current LLM provider configuration status (without leaking secrets)."""
    openai_p = OpenAIProvider()
    azure_p = AzureOpenAIProvider()
    active = LLMProviderFactory.get_active_provider_name(db)

    return LLMSettingsResponse(
        active_provider=active,
        openai_configured=openai_p.is_configured(),
        openai_model=openai_p.get_model_name(),
        azure_configured=azure_p.is_configured(),
        azure_model=azure_p.get_model_name(),
        azure_endpoint_configured=bool(settings.AZURE_OPENAI_ENDPOINT),
        app_version="1.0.0",
    )


@router.put("/llm", response_model=LLMSettingsResponse)
def update_llm_settings(
    update_data: LLMSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Switch active LLM provider (OpenAI vs Azure OpenAI)."""
    try:
        new_provider = LLMProviderFactory.set_active_provider(update_data.provider.lower(), db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return get_llm_settings(current_user=current_user, db=db)


@router.post("/llm/health", response_model=LLMHealthResponse)
async def check_llm_health(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Perform live health verification of the active LLM provider."""
    provider = LLMProviderFactory.get_provider(db=db)
    result = await provider.health_check()

    return LLMHealthResponse(
        provider=result["provider"],
        status=result["status"],
        model=result["model"],
        latency_ms=result.get("latency_ms"),
        message=result["message"],
    )
