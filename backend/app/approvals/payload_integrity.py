import hashlib
import json
from typing import Any, Dict


def compute_payload_hash(payload: Dict[str, Any]) -> str:
    """Calculates canonical SHA-256 hash of payload dictionary to detect tampering."""
    canonical_json = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def verify_payload_hash(payload: Dict[str, Any], expected_hash: str) -> bool:
    """Verifies that the given payload matches the expected SHA-256 hash."""
    actual_hash = compute_payload_hash(payload)
    return actual_hash == expected_hash
