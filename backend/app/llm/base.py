from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Type
from pydantic import BaseModel


class LLMExecutionResult(BaseModel):
    content: Optional[str] = None
    structured_data: Optional[Any] = None
    tool_calls: List[Dict[str, Any]] = []
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: int = 0
    provider: str
    model: str
    success: bool = True
    error_message: Optional[str] = None


class BaseLLMProvider(ABC):
    """Abstract interface for LLM Providers in FileMate."""

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the unique provider name: 'openai' or 'azure_openai'."""
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        """Return the active model/deployment name."""
        pass

    @abstractmethod
    def is_configured(self) -> bool:
        """Check if required API credentials and endpoints are present."""
        pass

    @abstractmethod
    def get_chat_model(self, temperature: float = 0.0, tools: Optional[List[Any]] = None) -> Any:
        """Return the underlying LangChain Chat model instance, optionally bound with tools."""
        pass

    @abstractmethod
    async def invoke_structured(
        self,
        messages: List[Any],
        schema: Type[BaseModel],
        temperature: float = 0.0,
    ) -> LLMExecutionResult:
        """Invoke LLM and return structured output adhering to the given Pydantic schema."""
        pass

    @abstractmethod
    async def invoke_chat(
        self,
        messages: List[Any],
        temperature: float = 0.0,
        tools: Optional[List[Any]] = None,
    ) -> LLMExecutionResult:
        """Invoke LLM with messages and optional tool bindings."""
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Perform a quick health verification of the provider."""
        pass
