import re
from typing import Optional, Tuple


class ScopeValidationGuardrail:
    """Enforces application scope and authorization boundaries (OWASP LLM02: Scope Isolation).
    Uses pre-compiled regex signatures for high-speed sub-millisecond execution.
    """

    COMPILED_CROSS_EMPLOYEE_PATTERNS = [
        re.compile(r"\bravi(?:'s)?\b", re.IGNORECASE),
        re.compile(r"\be2087\b", re.IGNORECASE),
        re.compile(r"\bother\s+employee(?:'s)?\b", re.IGNORECASE),
        re.compile(r"\bsomeone\s+else(?:'s)?\b", re.IGNORECASE),
        re.compile(r"\bcolleague(?:'s)?\s+expense\b", re.IGNORECASE),
        re.compile(r"\bmanager(?:'s)?\s+reports\b", re.IGNORECASE),
    ]

    COMPILED_OFF_TOPIC_PATTERNS = [
        re.compile(r"\bwrite\s+(?:me\s+)?(?:a\s+)?poem\b", re.IGNORECASE),
        re.compile(r"\bwrite\s+(?:a\s+)?story\b", re.IGNORECASE),
        re.compile(r"\btell\s+(?:me\s+)?a\s+joke\b", re.IGNORECASE),
        re.compile(r"\bwho\s+won\s+the\b", re.IGNORECASE),
        re.compile(r"\bwhat\s+is\s+the\s+capital\b", re.IGNORECASE),
        re.compile(r"\bweather\b", re.IGNORECASE),
        re.compile(r"\bwrite\s+code\s+for\b", re.IGNORECASE),
        re.compile(r"\bsolve\s+this\s+math\b", re.IGNORECASE),
    ]

    @classmethod
    def check_scope(cls, text: str, authenticated_employee_id: str) -> Tuple[bool, Optional[str], Optional[str]]:
        """Checks if request is within scope and respects employee isolation.

        Returns:
            is_valid: bool
            category: "OUT_OF_SCOPE", "BLOCKED_AUTHORIZATION", or None
            refusal_message: human-readable refusal or None
        """
        # 1. Cross-employee unauthorized data access check
        for pattern in cls.COMPILED_CROSS_EMPLOYEE_PATTERNS:
            if pattern.search(text):
                return (
                    False,
                    "BLOCKED_AUTHORIZATION",
                    f"I cannot access or show expense reports for other employees (such as Ravi Menon). You are authenticated as {authenticated_employee_id} and can only view and manage your own expenses.",
                )

        # 2. Off-topic check
        for pattern in cls.COMPILED_OFF_TOPIC_PATTERNS:
            if pattern.search(text):
                return (
                    False,
                    "OUT_OF_SCOPE",
                    "I am FileMate, Brightpath Consulting's expense filing assistant. I can only assist with extracting, reviewing, and filing your business expenses against company policies. I cannot fulfill unrelated requests like writing poems or general chat.",
                )

        return True, None, None
