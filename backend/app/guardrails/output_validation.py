import html
import re
from typing import Optional


class OutputValidationGuardrail:
    """Enforces OWASP LLM05 (Improper Output Handling), LLM02 (Sensitive Information Disclosure),
    and LLM09 (Misinformation/Hallucination) protections on all agent outputs.
    Uses pre-compiled regex signatures for maximum throughput and zero latency overhead.
    """

    # Secret / credential patterns to prevent inadvertent disclosure (LLM02)
    COMPILED_SECRET_PATTERNS = [
        re.compile(r"bearer\s+[a-zA-Z0-9\-_.]+", re.IGNORECASE),
        re.compile(r"eyJ[a-zA-Z0-9\-_.]+\.[a-zA-Z0-9\-_.]+\.[a-zA-Z0-9\-_.]+"),  # JWT pattern
        re.compile(r"sqlite:///[^\s]+", re.IGNORECASE),
        re.compile(r"(?:api[_-]?key|secret[_-]?key|password)\s*[:=]\s*['\"]?[a-zA-Z0-9!@#$%^&*()_+=-]{6,}['\"]?", re.IGNORECASE),
    ]

    # Pre-compiled XSS and script stripping patterns (LLM05)
    SCRIPT_TAG_RE = re.compile(r"<\s*script[^>]*>.*?<\s*/\s*script\s*>", re.DOTALL | re.IGNORECASE)
    EMBED_TAG_RE = re.compile(r"<\s*(?:iframe|object|embed|applet)[^>]*>.*?<\s*/\s*(?:iframe|object|embed|applet)\s*>", re.DOTALL | re.IGNORECASE)
    EVENT_HANDLER_RE = re.compile(r"on\w+\s*=\s*['\"][^'\"]*['\"]", re.IGNORECASE)

    CLAIM_KEYWORDS = [
        "has been filed",
        "successfully submitted",
        "filed your expense",
        "expense is submitted",
        "report is filed",
    ]

    @classmethod
    def sanitize_output(cls, text: str) -> str:
        """Sanitizes text output to prevent XSS (LLM05) and credential leakage (LLM02)."""
        if not text:
            return ""

        sanitized = text
        # 1. Strip potentially harmful HTML/script tags (LLM05: XSS mitigation)
        sanitized = cls.SCRIPT_TAG_RE.sub("", sanitized)
        sanitized = cls.EMBED_TAG_RE.sub("", sanitized)
        sanitized = cls.EVENT_HANDLER_RE.sub("", sanitized)

        # 2. Mask sensitive tokens or credentials (LLM02: Sensitive Information Disclosure)
        for pattern in cls.COMPILED_SECRET_PATTERNS:
            sanitized = pattern.sub("[PROTECTED_CREDENTIAL]", sanitized)

        return sanitized

    @classmethod
    def validate_submission_claim(
        cls,
        agent_message: str,
        is_executed: bool,
        report_number: Optional[str] = None,
    ) -> str:
        """Ensures agent responses never falsely claim report submissions or approvals without real backend confirmation (LLM09)."""
        message = cls.sanitize_output(agent_message)

        has_claim = any(kw in message.lower() for kw in cls.CLAIM_KEYWORDS)
        if has_claim and not is_executed:
            return (
                "Expense extracted and validated against Brightpath policies. "
                "A pending action has been created. Please review the details below and click 'Approve & File' to submit."
            )

        if is_executed and report_number and report_number not in message:
            return f"{message}\n\nConfirmed: Expense report {report_number} has been submitted to Finance."

        return message
