from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


# User Schemas
class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    employee_id: str
    role: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Project Schemas
class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    status: str
    budget_remaining: float


class ProjectCreateRequest(BaseModel):
    code: str
    name: str
    status: Optional[str] = "Active"
    initial_budget: float
    client: Optional[str] = "Internal / Client Engagement"
    billing_guidelines: Optional[str] = "Standard company expense policy applies."
    description: Optional[str] = ""


# Expense Policy Schemas
class ExpensePolicyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    category: str
    limit_amount: Optional[float]
    limit_type: str
    rule_description: str
    currency: str


# Expense Extraction Schema (Required typed schema)
class ExpenseExtraction(BaseModel):
    date: str = Field(description="Expense date in YYYY-MM-DD or readable format")
    merchant: str = Field(description="Merchant or vendor name")
    category: str = Field(description="Expense category: Meals, Local Travel, Hotel, Client Entertainment, etc.")
    amount: float = Field(description="Exact expense amount extracted from receipt, preserving negative sign if negative")
    currency: str = Field(default="INR", description="Currency code, e.g. INR")
    project_code: str = Field(description="Project code, e.g. ATLAS, ORION")
    notes: Optional[str] = Field(default="", description="Description or purpose of expense")
    justification: Optional[str] = Field(default=None, description="Justification if expense exceeds limit")
    receipt_path: Optional[str] = Field(default=None, description="Path or filename of uploaded receipt")


# Expense Report & Line Schemas
class ExpenseLineCreate(BaseModel):
    date: str
    merchant: str
    category: str
    amount: float
    currency: str = "INR"
    project_code: str
    notes: Optional[str] = ""
    exception_flag: bool = False
    justification: Optional[str] = None


class ExpenseLineResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    report_id: str
    date: str
    merchant: str
    category: str
    amount: float
    currency: str
    project_code: str
    notes: Optional[str]
    exception_flag: bool
    justification: Optional[str]
    receipt_path: Optional[str] = None
    created_at: datetime


class ExpenseReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    report_number: str
    employee_id: str
    status: str
    total_amount: float
    currency: str
    created_at: datetime
    submitted_at: Optional[datetime] = None
    lines: List[ExpenseLineResponse] = []


# Pending Action Schemas
class PendingActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    trace_id: str
    employee_id: str
    action_type: str
    tool_name: str
    exact_payload: Dict[str, Any]
    payload_hash: str
    status: str
    exception_flag: bool
    policy_violation_details: Optional[str] = None
    justification: Optional[str] = None
    rejection_reason: Optional[str] = None
    execution_result: Optional[Dict[str, Any]] = None
    created_at: datetime
    expires_at: datetime
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None


class ActionApprovalRequest(BaseModel):
    justification: Optional[str] = None


class ActionEditRequest(BaseModel):
    date: Optional[str] = None
    merchant: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    project_code: Optional[str] = None
    notes: Optional[str] = None
    justification: Optional[str] = None


class ActionRejectRequest(BaseModel):
    rejection_reason: Optional[str] = "Rejected by user"


# Chat Schemas
class ChatRequest(BaseModel):
    message: str
    trace_id: Optional[str] = None


class ConfirmScannedReceiptRequest(BaseModel):
    receipt_filename: str
    project_code: str
    merchant: str
    category: str
    amount: float
    currency: str = "INR"
    date: str
    notes: Optional[str] = None


class ChatResponse(BaseModel):
    trace_id: str
    agent_message: str
    extracted_expense: Optional[ExpenseExtraction] = None
    extracted_data: Optional[Dict[str, Any]] = None
    pending_action: Optional[PendingActionResponse] = None
    policy_status: str  # "compliant", "exception", "violation", "none"
    policy_message: Optional[str] = None
    duplicate_warning: Optional[str] = None
    status: str  # "Pending", "Approved", "Rejected", "Failed", "Blocked", "Out of Scope", "Guardrail", "AwaitingProject"
    thought_time_seconds: Optional[float] = None
    report_id: Optional[str] = None
    receipt_filename: Optional[str] = None
    receipt_path: Optional[str] = None
    needs_project_selection: Optional[bool] = False
    available_projects: Optional[List[Dict[str, Any]]] = None


# Observability Schemas
class TimelineStep(BaseModel):
    step_number: int
    title: str
    description: str
    timestamp: str
    status: str  # "success", "failed", "pending", "info"
    latency_ms: Optional[int] = None


class ToolCallResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tool_name: str
    input_arguments: Optional[Any] = None
    output_result: Optional[Any] = None
    status: str
    latency_ms: int
    created_at: datetime


class LLMCallResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: int
    success: bool
    error_message: Optional[str] = None
    created_at: datetime


class AgentRunSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    trace_id: str
    request_text: str
    status: str
    created_at: datetime
    latency_ms: Optional[int]
    total_tokens: int
    employee_id: str
    report_id: Optional[str] = None
    module: Optional[str] = "EXPENSE_ASSISTANT"
    intent: Optional[str] = None


class AgentRunDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    trace_id: str
    employee_id: str
    request_text: str
    status: str
    created_at: datetime
    start_time: datetime
    end_time: Optional[datetime] = None
    latency_ms: Optional[int]
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    outcome_summary: Optional[str] = None
    report_id: Optional[str] = None
    extracted_data: Optional[Dict[str, Any]] = None
    module: Optional[str] = "EXPENSE_ASSISTANT"
    intent: Optional[str] = None
    timeline: List[TimelineStep] = []
    tool_calls: List[ToolCallResponse] = []
    llm_calls: List[LLMCallResponse] = []
    pending_actions: List[PendingActionResponse] = []


# Settings Schemas
class LLMSettingsResponse(BaseModel):
    active_provider: str
    openai_configured: bool
    openai_model: str
    azure_configured: bool
    azure_model: str
    azure_endpoint_configured: bool
    app_version: str = "1.0.0"


class LLMSettingsUpdate(BaseModel):
    provider: str  # "openai" or "azure_openai"
    openai_model: Optional[str] = None
    azure_deployment_name: Optional[str] = None


class LLMHealthResponse(BaseModel):
    provider: str
    status: str  # "healthy" or "error"
    model: str
    latency_ms: Optional[int] = None
    message: str


# Expense Report Detailed Schemas
class ExpenseReportListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    report_number: str
    employee_id: str
    employee_name: Optional[str] = None
    status: str
    total_amount: float
    currency: str
    created_at: datetime
    submitted_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    finance_notes: Optional[str] = None
    lines_count: int = 0
    project_codes: List[str] = []
    has_exception: bool = False
    trace_id: Optional[str] = None


class ExpenseReportDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    report_number: str
    employee_id: str
    employee_name: Optional[str] = None
    employee_email: Optional[str] = None
    status: str
    total_amount: float
    currency: str
    created_at: datetime
    submitted_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    finance_notes: Optional[str] = None
    lines: List[ExpenseLineResponse] = []
    trace_id: Optional[str] = None
    project_details: Optional[Dict[str, Any]] = None


# Finance Persona Schemas
class FinanceDecisionRequest(BaseModel):
    decision: str  # "approved" or "rejected"
    notes: Optional[str] = None


class FinanceQueueItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    report_number: str
    employee_id: str
    employee_name: Optional[str] = None
    employee_email: Optional[str] = None
    status: str
    total_amount: float
    currency: str
    submitted_at: Optional[datetime] = None
    created_at: datetime
    lines_count: int = 0
    project_codes: List[str] = []
    has_exception: bool = False
    is_high_value: bool = False  # > 10,000 INR
    trace_id: Optional[str] = None


class FinanceAnalyticsResponse(BaseModel):
    total_pending_liability: float
    pending_count: int
    total_approved_spend: float
    approved_count: int
    total_rejected_spend: float
    rejected_count: int
    exception_count: int
    high_value_count: int
    spend_by_category: Dict[str, float]
    spend_by_project: Dict[str, float]



# Project Portal Schemas (Option A)
class ProjectExpenseLine(BaseModel):
    id: str
    report_id: str
    report_number: str
    employee_id: str
    employee_name: Optional[str] = None
    date: str
    merchant: str
    category: str
    amount: float
    currency: str
    notes: Optional[str] = None
    exception_flag: bool = False
    justification: Optional[str] = None
    status: str


class ProjectPortalItem(BaseModel):
    code: str
    name: str
    status: str
    initial_budget: float
    budget_remaining: float
    total_billed: float
    burn_percentage: float
    expense_count: int
    client: str
    billing_guidelines: str
    description: str
    expenses: List[ProjectExpenseLine] = []

