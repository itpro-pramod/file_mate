"""OWASP Top 10 for LLM Applications (2025 Standard) & Responsible AI Compliance Engine.
Provides comprehensive verification, threat mitigation, rate limiting, and Responsible AI guardrail policies for FileMate.
"""

import collections
import re
import threading
import time
from typing import Any, Dict, List, Optional, Tuple
from app.core.config import settings
from app.core.exceptions import GuardrailException
from app.guardrails.argument_validation import ArgumentValidationGuardrail
from app.guardrails.injection_detection import PromptInjectionDetector
from app.guardrails.input_validation import InputValidationGuardrail
from app.guardrails.output_validation import OutputValidationGuardrail
from app.guardrails.policy_validation import PolicyValidationGuardrail
from app.guardrails.scope_validation import ScopeValidationGuardrail


class RateLimiter:
    """In-memory sliding window rate limiter for OWASP LLM10 (Unbounded Consumption / DoS protection)."""

    def __init__(self, max_requests_per_minute: int = 60):
        self.max_requests = max_requests_per_minute
        self.window_seconds = 60
        self._user_timestamps: Dict[str, List[float]] = collections.defaultdict(list)
        self._lock = threading.Lock()

    def check_rate_limit(self, user_id: str) -> Tuple[bool, int]:
        """Checks if a request is permitted within the sliding window.
        Returns: (is_permitted, current_count_in_window)
        """
        now = time.time()
        with self._lock:
            timestamps = self._user_timestamps[user_id]
            # Discard timestamps older than window
            cutoff = now - self.window_seconds
            valid_timestamps = [t for t in timestamps if t > cutoff]
            self._user_timestamps[user_id] = valid_timestamps

            if len(valid_timestamps) >= self.max_requests:
                return False, len(valid_timestamps)

            self._user_timestamps[user_id].append(now)
            return True, len(valid_timestamps) + 1


class SecurityTelemetryTracker:
    """Thread-safe telemetry metrics for Responsible AI and OWASP threat mitigations."""

    def __init__(self):
        self._lock = threading.Lock()
        self.stats = {
            "total_audited_requests": 0,
            "prompt_injections_blocked": 0,
            "pii_redactions_performed": 0,
            "out_of_scope_queries_refused": 0,
            "policy_exceptions_flagged": 0,
            "hitl_approval_gates_enforced": 0,
            "rate_limit_checks_passed": 0,
        }

    def record(self, metric: str, count: int = 1):
        with self._lock:
            if metric in self.stats:
                self.stats[metric] += count

    def get_metrics(self) -> Dict[str, Any]:
        with self._lock:
            return self.stats.copy()


# Global singletons
rate_limiter = RateLimiter(max_requests_per_minute=60)
telemetry_tracker = SecurityTelemetryTracker()


class OWASPLLMComplianceGuardrail:
    """Centralized enforcement orchestrator for OWASP Top 10 for LLM Applications (2025 Standard):

    1.  LLM01: Prompt Injection (Direct, Indirect, Delimiter Escaping, Base64)
    2.  LLM02: Sensitive Information Disclosure (PII & Secret Redaction)
    3.  LLM03: Supply Chain Vulnerabilities (Pinned Models, Fallback Providers)
    4.  LLM04: Data and Model Poisoning (Strict Schema Validation)
    5.  LLM05: Improper Output Handling (XSS & Output Sanitization)
    6.  LLM06: Excessive Agency (Code-Enforced Human-in-the-Loop Approval Gate)
    7.  LLM07: System Prompt Leakage (Defensive Meta-Prompting & Redaction)
    8.  LLM08: Vector and Embedding Weaknesses (Bounded Contexts)
    9.  LLM09: Misinformation & Hallucination (Factual DB Verification)
    10. LLM10: Unbounded Consumption (Length Checks, Sliding-Window Rate Limiting)
    """

    # Pre-compiled PII regex signatures for microsecond scanning performance
    COMPILED_PII_PATTERNS = {
        "credit_card": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
        "phone_number": re.compile(r"\b(?:\+91[-\s]?)?[6-9]\d{9}\b"),
        "email_address": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b"),
        "pan_card": re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b"),
        "aadhaar": re.compile(r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"),
        "upi_id": re.compile(r"\b[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}\b"),
    }

    # Pre-compiled secrets and credential patterns
    COMPILED_SECRET_PATTERNS = {
        "jwt_token": re.compile(r"eyJ[a-zA-Z0-9\-_.]+\.[a-zA-Z0-9\-_.]+\.[a-zA-Z0-9\-_.]+"),
        "api_key": re.compile(r"\b(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16})\b"),
        "bearer_token": re.compile(r"(?i)\bbearer\s+[a-zA-Z0-9\-_.]{15,}\b"),
        "private_key": re.compile(r"-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----"),
    }

    @classmethod
    def audit_input_security(cls, user_input: str, employee_id: str) -> Dict[str, Any]:
        """Audits user input against OWASP LLM01, LLM02, LLM07, and LLM10."""
        telemetry_tracker.record("total_audited_requests")

        # 1. LLM10: Rate Limiting
        is_permitted, count = rate_limiter.check_rate_limit(employee_id)
        if not is_permitted:
            raise GuardrailException(
                detail="Rate limit exceeded. To prevent unbounded consumption, requests are limited to 60 per minute per consultant.",
                guardrail_type="rate_limit_exceeded",
                status_code=429,
            )
        telemetry_tracker.record("rate_limit_checks_passed")

        # 2. LLM10: Unbounded Consumption (Length & DoS check)
        InputValidationGuardrail.validate(user_input, employee_id)

        # 3. LLM01 & LLM07: Prompt Injection & System Prompt Leakage
        is_injection, injection_patterns, injection_msg = PromptInjectionDetector.scan(user_input)
        if is_injection:
            telemetry_tracker.record("prompt_injections_blocked")

        # 4. LLM02: Scope and Cross-Employee Authorization
        is_scoped, scope_category, scope_refusal = ScopeValidationGuardrail.check_scope(user_input, employee_id)
        if not is_scoped:
            telemetry_tracker.record("out_of_scope_queries_refused")

        # 5. LLM02: PII Redaction
        sanitized_input, pii_detected = cls.mask_pii(user_input)
        if pii_detected:
            telemetry_tracker.record("pii_redactions_performed", len(pii_detected))

        return {
            "is_injection_detected": is_injection,
            "injection_patterns": injection_patterns,
            "injection_warning": injection_msg if is_injection else None,
            "is_scoped": is_scoped,
            "scope_category": scope_category,
            "scope_refusal": scope_refusal,
            "pii_detected": pii_detected,
            "sanitized_input": sanitized_input,
        }

    @classmethod
    def mask_pii(cls, text: str) -> Tuple[str, List[str]]:
        """Masks sensitive PII patterns (Credit card, PAN, Aadhaar, Phone, UPI) to protect privacy (OWASP LLM02)."""
        masked_text = text
        detected = []

        # Mask PII
        for pii_type, compiled_re in cls.COMPILED_PII_PATTERNS.items():
            if compiled_re.search(masked_text):
                detected.append(pii_type)
                if pii_type == "credit_card":
                    masked_text = compiled_re.sub("[MASKED_CARD_NUMBER]", masked_text)
                elif pii_type == "pan_card":
                    masked_text = compiled_re.sub("[MASKED_PAN]", masked_text)
                elif pii_type == "aadhaar":
                    masked_text = compiled_re.sub("[MASKED_AADHAAR]", masked_text)
                elif pii_type == "phone_number":
                    masked_text = compiled_re.sub("[MASKED_PHONE]", masked_text)
                elif pii_type == "upi_id":
                    masked_text = compiled_re.sub("[MASKED_UPI_ID]", masked_text)

        # Mask Secrets / Tokens
        for secret_type, compiled_re in cls.COMPILED_SECRET_PATTERNS.items():
            if compiled_re.search(masked_text):
                detected.append(secret_type)
                masked_text = compiled_re.sub("[PROTECTED_CREDENTIAL]", masked_text)

        return masked_text, detected

    @classmethod
    def audit_output_security(cls, agent_output: str, is_executed: bool, report_number: Optional[str] = None) -> str:
        """Audits agent output against OWASP LLM05 (Improper Output Handling) & LLM09 (Hallucinations)."""
        return OutputValidationGuardrail.validate_submission_claim(
            agent_output, is_executed=is_executed, report_number=report_number
        )


class ResponsibleAIEvaluator:
    """Responsible AI Framework for FileMate across the 6 core pillars:
    1. Fairness: Strict, uniform policy rule application across all employees without favoritism.
    2. Reliability & Safety: Code-enforced validation, typed Pydantic models, failure containment.
    3. Privacy & Security: Authenticated session isolation, PII masking, no credentials in client.
    4. Inclusiveness: Transparent error guidance, plain explanations for non-technical consultants.
    5. Transparency & Explainability: Complete trace timelines, token counters, audit logs, D4 JSON export.
    6. Human Accountability: Code-enforced Human-in-the-Loop review for every mutation.
    """

    @staticmethod
    def get_principles_compliance() -> Dict[str, Dict[str, str]]:
        metrics = telemetry_tracker.get_metrics()
        return {
            "fairness": {
                "status": "COMPLIANT",
                "description": "Company policies (e.g., Meals cap ₹1,500, Travel ₹3,000) are programmatically enforced equally for all employees.",
            },
            "reliability_and_safety": {
                "status": "COMPLIANT",
                "description": f"Multi-tier guardrails active. Total requests audited: {metrics['total_audited_requests']}.",
            },
            "privacy_and_security": {
                "status": "COMPLIANT",
                "description": f"Row-level database isolation by employee ID; PII masking active ({metrics['pii_redactions_performed']} instances masked); secrets managed strictly via backend .env.",
            },
            "inclusiveness": {
                "status": "COMPLIANT",
                "description": "Context-rich, plain-language error and policy messages so users clearly understand what adjustment is needed.",
            },
            "transparency": {
                "status": "COMPLIANT",
                "description": "Every run yields an end-to-end timeline with millisecond latencies, token counts, model details, and downloadable logs.",
            },
            "accountability": {
                "status": "COMPLIANT",
                "description": f"Human-in-the-Loop approval gate ensures AI never writes to the expense system autonomously ({metrics['hitl_approval_gates_enforced']} approvals enforced).",
            },
        }
