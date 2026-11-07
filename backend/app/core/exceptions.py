from typing import Any, Dict, Optional
from fastapi import HTTPException, status


class FileMateException(HTTPException):
    def __init__(
        self,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        detail: str = "An error occurred",
        code: str = "ERROR",
        extra: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(status_code=status_code, detail=detail)
        self.code = code
        self.extra = extra or {}


class GuardrailException(FileMateException):
    def __init__(self, detail: str, guardrail_type: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(
            status_code=status_code,
            detail=detail,
            code=f"GUARDRAIL_{guardrail_type.upper()}",
            extra={"guardrail": guardrail_type},
        )


class PolicyViolationException(FileMateException):
    def __init__(self, detail: str, category: str, limit: Optional[float] = None):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            code="POLICY_VIOLATION",
            extra={"category": category, "limit": limit},
        )


class UnauthorizedAccessException(FileMateException):
    def __init__(self, detail: str = "Unauthorized access"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail, code="FORBIDDEN")


class ActionNotFoundException(FileMateException):
    def __init__(self, action_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pending action {action_id} not found",
            code="ACTION_NOT_FOUND",
        )


class ActionExpiredException(FileMateException):
    def __init__(self, action_id: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pending action {action_id} has expired",
            code="ACTION_EXPIRED",
        )


class ActionAlreadyProcessedException(FileMateException):
    def __init__(self, action_id: str, status_name: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pending action {action_id} is already in {status_name} state",
            code="ACTION_ALREADY_PROCESSED",
        )


class PayloadTamperedException(FileMateException):
    def __init__(self, action_id: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payload hash verification failed for action {action_id}. Payload integrity compromised.",
            code="PAYLOAD_TAMPERED",
        )
