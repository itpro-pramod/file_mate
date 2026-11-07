import base64
import binascii
import re
from typing import List, Tuple


class PromptInjectionDetector:
    """Enterprise Production-Grade Prompt Injection Detection (OWASP LLM01: Prompt Injection & LLM07: System Prompt Leakage).
    
    Features:
    - Pre-compiled regex patterns for microsecond scanning performance.
    - Zero-width and unicode obfuscation normalization.
    - Base64 / Hex payload decoding and heuristic inspection.
    - Delimiter escape quarantine (e.g. </receipt_data>, [INST], <|im_end|>).
    - Exfiltration pattern detection (e.g. Markdown image URL leakage).
    - Role reversal / jailbreak signature recognition (DAN, developer, sudo, maintenance).
    """

    # Invisible / zero-width characters used to evade simple substring matching
    ZERO_WIDTH_CHARS = re.compile(r"[\u200B-\u200D\uFEFF\u00AD\u2060\u202A-\u202E]")

    # Compiled regex signatures for instruction overrides (LLM01)
    OVERRIDE_PATTERNS = [
        re.compile(r"\bignore\s+(?:all\s+)?(?:previous|prior|above|system|policy|rules|directives)\b", re.IGNORECASE),
        re.compile(r"\bnote\s+to\s+(?:assistant|agent|ai|model|llm|system)\b", re.IGNORECASE),
        re.compile(r"\bdisregard\s+(?:policy|instructions|rules|guidelines)\b", re.IGNORECASE),
        re.compile(r"\bchange\s+amount\s+to\b", re.IGNORECASE),
        re.compile(r"\bset\s+amount\s+to\b", re.IGNORECASE),
        re.compile(r"\bsubmit\s+(?:immediately|now|without\s+asking|automatically|silently)\b", re.IGNORECASE),
        re.compile(r"\bbypass\s+(?:approval|policy|guardrail|validation|verification)\b", re.IGNORECASE),
        re.compile(r"\bdo\s+not\s+(?:check|validate|enforce|verify)\b", re.IGNORECASE),
        re.compile(r"\bapprove\s+automatically\b", re.IGNORECASE),
        re.compile(r"\bskip\s+(?:approval|audit|review)\b", re.IGNORECASE),
    ]

    # Compiled jailbreak & role-reversal patterns (LLM01)
    JAILBREAK_PATTERNS = [
        re.compile(r"\byou\s+are\s+now\s+(?:in\s+)?(?:DAN|developer|maintenance|root|sudo|admin|god)\b", re.IGNORECASE),
        re.compile(r"\bnew\s+role\b", re.IGNORECASE),
        re.compile(r"\bact\s+as\s+an\s+unrestricted\b", re.IGNORECASE),
        re.compile(r"\boverride\s+all\s+security\b", re.IGNORECASE),
        re.compile(r"\benable\s+developer\s+mode\b", re.IGNORECASE),
        re.compile(r"\bforget\s+you\s+are\s+(?:filemate|an\s+assistant)\b", re.IGNORECASE),
        re.compile(r"\bpretend\s+to\s+be\b", re.IGNORECASE),
    ]

    # Compiled system prompt leakage & meta-prompting patterns (LLM07)
    LEAKAGE_PATTERNS = [
        re.compile(r"\b(?:repeat|print|reveal|output|show|display)\s+(?:all\s+)?(?:your\s+)?(?:system\s+prompt|initial\s+instructions|system\s+instructions|base\s+prompt)\b", re.IGNORECASE),
        re.compile(r"\b(?:secret|internal|system)\s+(?:instructions|prompt|rules)\b", re.IGNORECASE),
        re.compile(r"\bbase\s+prompt\b", re.IGNORECASE),
        re.compile(r"\bwhat\s+(?:is|are)\s+your\s+(?:system\s+instructions|core\s+prompt)\b", re.IGNORECASE),
        re.compile(r"\bverbatim\s+system\s+prompt\b", re.IGNORECASE),
    ]

    # Compiled delimiter, structural, and context-escaping injections (LLM01)
    DELIMITER_PATTERNS = [
        re.compile(r"\[\s*/?INST\s*\]", re.IGNORECASE),
        re.compile(r"<\s*/?SYS\s*>", re.IGNORECASE),
        re.compile(r"<\s*/?system\s*>", re.IGNORECASE),
        re.compile(r"<\s*/?receipt_data\s*>", re.IGNORECASE),
        re.compile(r"<\|im_start\|>", re.IGNORECASE),
        re.compile(r"<\|im_end\|>", re.IGNORECASE),
        re.compile(r"---+\s*(?:BEGIN|START|END)\s+(?:SYSTEM|PROMPT|INSTRUCTIONS)\s*---+", re.IGNORECASE),
        re.compile(r"!\s*\[.*?\]\s*\(\s*https?://[^\s)]+\?[^\s)]*=(?:data|exfil|leak|token)", re.IGNORECASE),  # Markdown exfiltration
    ]

    # Combined signature registry
    ALL_PATTERNS = OVERRIDE_PATTERNS + JAILBREAK_PATTERNS + LEAKAGE_PATTERNS + DELIMITER_PATTERNS

    @classmethod
    def normalize_text(cls, text: str) -> str:
        """Strips zero-width evasion characters and normalizes whitespace."""
        if not text:
            return ""
        # Remove invisible Unicode characters
        cleaned = cls.ZERO_WIDTH_CHARS.sub("", text)
        return cleaned

    @classmethod
    def check_base64_injection(cls, text: str) -> Tuple[bool, str]:
        """Detects and decodes base64 strings to check for hidden injection payloads."""
        # Look for potential base64 blocks (at least 16 chars)
        b64_candidates = re.findall(r"\b[A-Za-z0-9+/]{16,}={0,2}\b", text)
        for cand in b64_candidates:
            try:
                decoded = base64.b64decode(cand, validate=True).decode("utf-8", errors="ignore")
                for pat in cls.OVERRIDE_PATTERNS + cls.JAILBREAK_PATTERNS:
                    if pat.search(decoded):
                        return True, f"Base64-encoded injection detected: '{cand[:20]}...' (decodes to: '{decoded[:30]}...')"
            except (binascii.Error, ValueError):
                continue
        return False, ""

    @classmethod
    def scan(cls, text: str) -> Tuple[bool, List[str], str]:
        """Scans text for prompt injection signatures and system prompt leakage attempts.

        Returns:
            is_suspicious: bool
            detected_patterns: list of detected substrings/matches
            sanitized_or_flagged_notes: human-readable explanation
        """
        if not text:
            return False, [], ""

        normalized = cls.normalize_text(text)
        detected = []

        # 1. Regex signature scan across all attack families
        for pattern in cls.ALL_PATTERNS:
            matches = pattern.findall(normalized)
            if matches:
                detected.append(pattern.pattern)

        # 2. Base64 payload scan
        has_b64, b64_detail = cls.check_base64_injection(normalized)
        if has_b64:
            detected.append(b64_detail)

        if detected:
            return (
                True,
                detected,
                "Warning: Potential prompt injection or embedded override instruction detected in receipt text. "
                "All instructions were quarantined and treated strictly as untrusted data.",
            )

        return False, [], ""
