from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AgentState(BaseModel):
    trace_id: str
    employee_id: str
    request_text: str
    messages: List[Dict[str, Any]] = Field(default_factory=list)

    # Guardrail tracking
    is_injection_detected: bool = False
    injection_warning: Optional[str] = None
    intent: str = "expense_filing"  # expense_filing, inquiry, out_of_scope, blocked

    # Extracted data
    extracted_expense: Optional[Dict[str, Any]] = None

    # Context data
    project_info: Optional[Dict[str, Any]] = None
    policy_info: Optional[List[Dict[str, Any]]] = None
    duplicate_warning: Optional[str] = None

    # Validation
    is_valid: bool = True
    validation_error: Optional[str] = None
    is_policy_compliant: bool = True
    is_exception: bool = False
    policy_message: Optional[str] = None
    policy_violation_details: Optional[str] = None

    # Pending action
    pending_action_id: Optional[str] = None
    pending_action_payload: Optional[Dict[str, Any]] = None

    # Output & Telemetry
    final_agent_response: str = ""
    status: str = "Pending"  # Approved, Pending, Rejected, Failed, Blocked, Out of Scope, Guardrail
    timeline_steps: List[Dict[str, Any]] = Field(default_factory=list)
    total_tokens: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0
