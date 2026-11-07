import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from app.database.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    employee_id = Column(String(50), unique=True, nullable=False, index=True)
    role = Column(String(50), nullable=False, default="Consultant")  # "Consultant" or "Finance Controller"
    created_at = Column(DateTime, default=utcnow, nullable=False)

    reports = relationship("ExpenseReport", back_populates="employee")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(50), unique=True, nullable=False, index=True)  # e.g., ATLAS, ORION
    name = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="Active")  # "Active" or "Closed"
    budget_remaining = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class ExpensePolicy(Base):
    __tablename__ = "expense_policies"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    category = Column(String(100), unique=True, nullable=False, index=True)
    limit_amount = Column(Float, nullable=True)  # None for no fixed limit
    limit_type = Column(String(50), nullable=False, default="per_day")  # per_day, per_trip, per_night, none
    rule_description = Column(Text, nullable=False)
    currency = Column(String(10), nullable=False, default="INR")
    created_at = Column(DateTime, default=utcnow, nullable=False)


class ExpenseReport(Base):
    __tablename__ = "expense_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_number = Column(String(50), unique=True, nullable=False, index=True)  # e.g. RPT-10023
    employee_id = Column(String(50), ForeignKey("users.employee_id"), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="draft")  # draft, submitted, approved, rejected
    total_amount = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), nullable=False, default="INR")
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    submitted_at = Column(DateTime, nullable=True)
    approved_by = Column(String(50), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    finance_notes = Column(Text, nullable=True)

    employee = relationship("User", back_populates="reports")
    lines = relationship("ExpenseLine", back_populates="report", cascade="all, delete-orphan")


class ExpenseLine(Base):
    __tablename__ = "expense_lines"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    report_id = Column(String(36), ForeignKey("expense_reports.id"), nullable=False, index=True)
    date = Column(String(20), nullable=False)  # ISO or YYYY-MM-DD
    merchant = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False, default="INR")
    project_code = Column(String(50), nullable=False, index=True)
    notes = Column(Text, nullable=True)
    exception_flag = Column(Boolean, default=False, nullable=False)
    justification = Column(Text, nullable=True)
    receipt_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    report = relationship("ExpenseReport", back_populates="lines")


class PendingAction(Base):
    __tablename__ = "pending_actions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trace_id = Column(String(64), nullable=False, index=True)
    employee_id = Column(String(50), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)  # create_report, add_line, submit_report
    tool_name = Column(String(100), nullable=False)
    exact_payload = Column(Text, nullable=False)  # JSON string
    payload_hash = Column(String(64), nullable=False)  # SHA-256 hash of canonical JSON
    status = Column(
        String(50),
        nullable=False,
        default="PENDING",
        index=True
    )  # PENDING, APPROVED, REJECTED, EXECUTED, EXPIRED, INVALIDATED, FAILED
    exception_flag = Column(Boolean, default=False, nullable=False)
    policy_violation_details = Column(Text, nullable=True)
    justification = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)
    execution_result = Column(Text, nullable=True)  # JSON string of execution response

    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    approved_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    executed_at = Column(DateTime, nullable=True)

    approvals = relationship("Approval", back_populates="pending_action")


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    pending_action_id = Column(String(36), ForeignKey("pending_actions.id"), nullable=False, index=True)
    trace_id = Column(String(64), nullable=False, index=True)
    approver_employee_id = Column(String(50), nullable=False)
    decision = Column(String(50), nullable=False)  # APPROVED, REJECTED
    payload_hash_verified = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    pending_action = relationship("PendingAction", back_populates="approvals")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    trace_id = Column(String(64), primary_key=True)
    employee_id = Column(String(50), nullable=False, index=True)
    request_text = Column(Text, nullable=False)
    status = Column(
        String(50),
        nullable=False,
        default="Pending",
        index=True
    )  # Approved, Pending, Rejected, Failed, Blocked, Out of Scope, Guardrail
    start_time = Column(DateTime, default=utcnow, nullable=False)
    end_time = Column(DateTime, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    total_tokens = Column(Integer, default=0, nullable=False)
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    outcome_summary = Column(Text, nullable=True)
    report_id = Column(String(50), nullable=True)
    extracted_data = Column(Text, nullable=True)  # JSON string
    module = Column(String(50), nullable=False, default="EXPENSE_ASSISTANT", index=True)  # EXPENSE_ASSISTANT or EXPENSE_INTELLIGENCE
    intent = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)


class ToolCall(Base):
    __tablename__ = "tool_calls"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trace_id = Column(String(64), nullable=False, index=True)
    tool_name = Column(String(100), nullable=False)
    input_arguments = Column(Text, nullable=True)  # JSON with sensitive data masked
    output_result = Column(Text, nullable=True)  # JSON string
    status = Column(String(50), nullable=False, default="SUCCESS")  # SUCCESS, FAILED, BLOCKED
    latency_ms = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class LLMCall(Base):
    __tablename__ = "llm_calls"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trace_id = Column(String(64), nullable=False, index=True)
    provider = Column(String(50), nullable=False)  # openai, azure_openai
    model = Column(String(100), nullable=False)
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    latency_ms = Column(Integer, default=0, nullable=False)
    success = Column(Boolean, default=True, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    trace_id = Column(String(64), nullable=False, index=True)
    employee_id = Column(String(50), nullable=False, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    details = Column(Text, nullable=False)  # JSON or text description
    timestamp = Column(DateTime, default=utcnow, nullable=False, index=True)


class ApplicationSetting(Base):
    __tablename__ = "application_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class IntelligenceConversation(Base):
    __tablename__ = "intelligence_conversations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    employee_id = Column(String(50), nullable=False, index=True)
    persona = Column(String(50), nullable=False)  # "Consultant" or "Finance Controller"
    title = Column(String(255), nullable=False, default="New Conversation")
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    messages = relationship("IntelligenceMessage", back_populates="conversation", cascade="all, delete-orphan")


class IntelligenceMessage(Base):
    __tablename__ = "intelligence_messages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String(36), ForeignKey("intelligence_conversations.id"), nullable=False, index=True)
    sender = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    response_type = Column(String(50), nullable=True)  # text, expense_summary, category_analysis, etc.
    blocks_json = Column(Text, nullable=True)  # JSON string of structured blocks
    trace_id = Column(String(64), nullable=True, index=True)
    follow_ups_json = Column(Text, nullable=True)  # JSON array of strings
    execution_summary_json = Column(Text, nullable=True)  # JSON object
    created_at = Column(DateTime, default=utcnow, nullable=False)

    conversation = relationship("IntelligenceConversation", back_populates="messages")


class IntelligenceFeedback(Base):
    __tablename__ = "intelligence_feedback"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = Column(String(36), nullable=False, index=True)
    trace_id = Column(String(64), nullable=False, index=True)
    employee_id = Column(String(50), nullable=False)
    rating = Column(String(20), nullable=False)  # "thumbs_up" or "thumbs_down"
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)


# Index composite queries
Index("idx_runs_emp_created", AgentRun.employee_id, AgentRun.created_at.desc())
Index("idx_actions_emp_status", PendingAction.employee_id, PendingAction.status)
Index("idx_audit_trace_time", AuditLog.trace_id, AuditLog.timestamp.desc())
