import re
from typing import Optional, Tuple
from app.core.config import settings
from app.core.exceptions import GuardrailException


class InputValidationGuardrail:
    """Validates user input before sending to LLM."""

    @staticmethod
    def validate(user_input: Optional[str], authenticated_employee_id: Optional[str]) -> Tuple[bool, Optional[str]]:
        # 1. Check session & authenticated employee ID
        if not authenticated_employee_id or not authenticated_employee_id.strip():
            raise GuardrailException(
                detail="Unauthorized: Valid employee session is required.",
                guardrail_type="authentication",
                status_code=401,
            )

        # 2. Check empty or whitespace
        if user_input is None or not isinstance(user_input, str) or not user_input.strip():
            raise GuardrailException(
                detail="Input cannot be empty. Please provide receipt text or expense details.",
                guardrail_type="empty_input",
                status_code=400,
            )

        # 3. Check maximum length (2,000 characters)
        if len(user_input) > settings.MAX_INPUT_LENGTH:
            raise GuardrailException(
                detail=f"Input length ({len(user_input)} chars) exceeds the maximum allowed limit of {settings.MAX_INPUT_LENGTH} characters. Please submit a shorter receipt summary.",
                guardrail_type="max_length_exceeded",
                status_code=400,
            )

        return True, None
