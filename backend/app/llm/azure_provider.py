import time
from typing import Any, Dict, List, Optional, Type
from langchain_core.messages import BaseMessage, HumanMessage
from langchain_openai import AzureChatOpenAI
from pydantic import BaseModel
from app.core.config import settings
from app.llm.base import BaseLLMProvider, LLMExecutionResult


class AzureOpenAIProvider(BaseLLMProvider):
    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        api_version: Optional[str] = None,
        deployment_name: Optional[str] = None,
        timeout: int = 45,
    ):
        self.api_key = api_key or settings.AZURE_OPENAI_API_KEY
        self.endpoint = endpoint or settings.AZURE_OPENAI_ENDPOINT
        self.api_version = api_version or settings.AZURE_OPENAI_API_VERSION or "2024-02-15-preview"
        self.deployment_name = deployment_name or settings.AZURE_OPENAI_DEPLOYMENT_NAME or "gpt-4o-mini"
        self.timeout = timeout or settings.LLM_TIMEOUT_SECONDS

    def get_provider_name(self) -> str:
        return "azure_openai"

    def get_model_name(self) -> str:
        return self.deployment_name

    def is_configured(self) -> bool:
        return bool(
            self.api_key
            and self.api_key.strip()
            and self.endpoint
            and self.endpoint.strip()
            and self.deployment_name
            and self.deployment_name.strip()
        )

    def get_chat_model(self, temperature: float = 0.0, tools: Optional[List[Any]] = None) -> Any:
        if not self.is_configured():
            raise ValueError("Azure OpenAI configuration is incomplete (api_key, endpoint, or deployment_name missing).")

        is_reasoning_or_terra = any(
            x in (self.deployment_name or "").lower() for x in ["terra", "o1", "o3", "o4", "gpt-5", "gpt-6"]
        )

        kwargs: Dict[str, Any] = {
            "api_key": self.api_key,
            "azure_endpoint": self.endpoint,
            "api_version": self.api_version,
            "azure_deployment": self.deployment_name,
            "timeout": self.timeout,
        }
        if is_reasoning_or_terra:
            kwargs["temperature"] = None
            kwargs["reasoning_effort"] = "none"
        else:
            kwargs["temperature"] = temperature

        model_instance = AzureChatOpenAI(**kwargs)
        if tools:
            return model_instance.bind_tools(tools)
        return model_instance

    async def invoke_structured(
        self,
        messages: List[Any],
        schema: Type[BaseModel],
        temperature: float = 0.0,
    ) -> LLMExecutionResult:
        if not self.is_configured():
            return LLMExecutionResult(
                provider=self.get_provider_name(),
                model=self.deployment_name,
                success=False,
                error_message="Azure OpenAI credentials or endpoint are missing or invalid.",
            )

        start_time = time.time()
        try:
            model = self.get_chat_model(temperature=temperature)
            structured_model = model.with_structured_output(schema, include_raw=True)
            response = await structured_model.ainvoke(messages)
            latency_ms = int((time.time() - start_time) * 1000)

            if isinstance(response, dict):
                parsed = response.get("parsed")
                raw = response.get("raw")
                usage = getattr(raw, "usage_metadata", None) or getattr(raw, "response_metadata", {}).get("token_usage", {})
                prompt_tokens = usage.get("input_tokens", 0) if isinstance(usage, dict) else getattr(usage, "input_tokens", 0)
                completion_tokens = usage.get("output_tokens", 0) if isinstance(usage, dict) else getattr(usage, "output_tokens", 0)
                total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens) if isinstance(usage, dict) else getattr(usage, "total_tokens", prompt_tokens + completion_tokens)

                return LLMExecutionResult(
                    structured_data=parsed,
                    prompt_tokens=prompt_tokens or 0,
                    completion_tokens=completion_tokens or 0,
                    total_tokens=total_tokens or 0,
                    latency_ms=latency_ms,
                    provider=self.get_provider_name(),
                    model=self.deployment_name,
                    success=True,
                )
            else:
                return LLMExecutionResult(
                    structured_data=response,
                    latency_ms=latency_ms,
                    provider=self.get_provider_name(),
                    model=self.deployment_name,
                    success=True,
                )

        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            return LLMExecutionResult(
                provider=self.get_provider_name(),
                model=self.deployment_name,
                latency_ms=latency_ms,
                success=False,
                error_message=str(e),
            )

    async def invoke_chat(
        self,
        messages: List[Any],
        temperature: float = 0.0,
        tools: Optional[List[Any]] = None,
    ) -> LLMExecutionResult:
        if not self.is_configured():
            return LLMExecutionResult(
                provider=self.get_provider_name(),
                model=self.deployment_name,
                success=False,
                error_message="Azure OpenAI credentials or endpoint are missing or invalid.",
            )

        start_time = time.time()
        try:
            model = self.get_chat_model(temperature=temperature, tools=tools)
            response = await model.ainvoke(messages)
            latency_ms = int((time.time() - start_time) * 1000)

            usage = getattr(response, "usage_metadata", None) or getattr(response, "response_metadata", {}).get("token_usage", {})
            prompt_tokens = usage.get("input_tokens", 0) if isinstance(usage, dict) else getattr(usage, "input_tokens", 0)
            completion_tokens = usage.get("output_tokens", 0) if isinstance(usage, dict) else getattr(usage, "output_tokens", 0)
            total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens) if isinstance(usage, dict) else getattr(usage, "total_tokens", prompt_tokens + completion_tokens)

            tool_calls = getattr(response, "tool_calls", []) or []

            return LLMExecutionResult(
                content=str(response.content) if response.content else "",
                tool_calls=tool_calls,
                prompt_tokens=prompt_tokens or 0,
                completion_tokens=completion_tokens or 0,
                total_tokens=total_tokens or 0,
                latency_ms=latency_ms,
                provider=self.get_provider_name(),
                model=self.deployment_name,
                success=True,
            )
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            return LLMExecutionResult(
                provider=self.get_provider_name(),
                model=self.deployment_name,
                latency_ms=latency_ms,
                success=False,
                error_message=str(e),
            )

    async def health_check(self) -> Dict[str, Any]:
        if not self.is_configured():
            return {
                "provider": self.get_provider_name(),
                "status": "error",
                "model": self.deployment_name,
                "latency_ms": 0,
                "message": "Azure OpenAI credentials or endpoint not configured.",
            }
        start_time = time.time()
        try:
            model = self.get_chat_model(temperature=0.0)
            resp = await model.ainvoke([HumanMessage(content="ping")])
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "provider": self.get_provider_name(),
                "status": "healthy",
                "model": self.deployment_name,
                "latency_ms": latency_ms,
                "message": "Azure OpenAI provider is operational.",
            }
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "provider": self.get_provider_name(),
                "status": "error",
                "model": self.deployment_name,
                "latency_ms": latency_ms,
                "message": f"Azure OpenAI health check failed: {str(e)}",
            }
