import json
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from langchain_core.tools import StructuredTool, tool
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.approvals.pending_action_service import PendingActionService
from app.database.models import ToolCall
from app.expense_api.mock_expense_api import MockExpenseAPI
from app.guardrails.argument_validation import ArgumentValidationGuardrail
from app.guardrails.policy_validation import PolicyValidationGuardrail
from app.tools.policy_tools import get_expense_policy_impl
from app.tools.project_tools import get_project_details_impl
from app.tools.report_tools import get_employee_reports_impl


# Tool Input Schemas
class ProjectDetailsInput(BaseModel):
    project_code: str = Field(description="Project code, e.g., ATLAS or ORION")


class ExpensePolicyInput(BaseModel):
    pass


class EmployeeReportsInput(BaseModel):
    employee_id: str = Field(description="Employee ID to query, e.g., E1042")


class CreateExpenseReportInput(BaseModel):
    title: Optional[str] = Field(default="Expense Report", description="Title for the expense report")


class AddExpenseLineInput(BaseModel):
    date: str = Field(description="Date of expense in YYYY-MM-DD or readable format (e.g. 28 Oct 2026)")
    merchant: str = Field(description="Merchant or vendor name")
    category: str = Field(description="Expense category: Meals, Local Travel, Hotel, Client Entertainment")
    amount: float = Field(description="Amount in INR (must be positive number)")
    currency: str = Field(default="INR", description="Currency code, e.g. INR")
    project_code: str = Field(description="Project code, e.g. ATLAS")
    notes: Optional[str] = Field(default="", description="Description or notes")
    justification: Optional[str] = Field(default=None, description="Justification for policy exception if applicable")


class SubmitExpenseReportInput(BaseModel):
    report_id: str = Field(description="Report ID or report number to submit to Finance")


class ToolRegistry:
    """Creates LangChain tools bound to session, trace_id, and authenticated employee context."""

    def __init__(self, db: Session, trace_id: str, employee_id: str):
        self.db = db
        self.trace_id = trace_id
        self.employee_id = employee_id

    def _log_tool_call(
        self,
        tool_name: str,
        args: Dict[str, Any],
        output: Any,
        status: str,
        latency_ms: int,
    ):
        """Record structured tool call event to database for audit and timeline."""
        masked_args = args.copy()
        # Mask sensitive fields if present
        if "password" in masked_args:
            masked_args["password"] = "***"

        tc = ToolCall(
            trace_id=self.trace_id,
            tool_name=tool_name,
            input_arguments=json.dumps(masked_args),
            output_result=json.dumps(output) if isinstance(output, (dict, list)) else str(output),
            status=status,
            latency_ms=latency_ms,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(tc)
        self.db.commit()

    # 1. get_project_details
    def get_project_details(self, project_code: str) -> Dict[str, Any]:
        """Retrieve project status and budget remaining for a given project code."""
        start = time.time()
        try:
            res = get_project_details_impl(project_code, self.db)
            latency_ms = int((time.time() - start) * 1000)
            self._log_tool_call("get_project_details", {"project_code": project_code}, res, "SUCCESS", latency_ms)
            return res
        except Exception as e:
            latency_ms = int((time.time() - start) * 1000)
            err_dict = {"error": str(e), "project_code": project_code}
            self._log_tool_call("get_project_details", {"project_code": project_code}, err_dict, "FAILED", latency_ms)
            return err_dict

    # 2. get_expense_policy
    def get_expense_policy(self) -> List[Dict[str, Any]]:
        """Retrieve expense policy limits and rules."""
        start = time.time()
        try:
            res = get_expense_policy_impl(self.db)
            latency_ms = int((time.time() - start) * 1000)
            self._log_tool_call("get_expense_policy", {}, res, "SUCCESS", latency_ms)
            return res
        except Exception as e:
            latency_ms = int((time.time() - start) * 1000)
            err_dict = {"error": str(e)}
            self._log_tool_call("get_expense_policy", {}, err_dict, "FAILED", latency_ms)
            return [err_dict]

    # 3. get_employee_reports
    def get_employee_reports(self, employee_id: str) -> List[Dict[str, Any]]:
        """Retrieve submitted reports and lines for the employee to detect duplicates."""
        start = time.time()
        # Security Guardrail: Scope check — employee can only query their own reports
        if employee_id != self.employee_id:
            latency_ms = int((time.time() - start) * 1000)
            err = {"error": f"Unauthorized: You cannot access reports for employee {employee_id}."}
            self._log_tool_call("get_employee_reports", {"employee_id": employee_id}, err, "BLOCKED", latency_ms)
            return [err]

        try:
            res = get_employee_reports_impl(self.employee_id, self.db)
            latency_ms = int((time.time() - start) * 1000)
            self._log_tool_call("get_employee_reports", {"employee_id": self.employee_id}, res, "SUCCESS", latency_ms)
            return res
        except Exception as e:
            latency_ms = int((time.time() - start) * 1000)
            err_dict = {"error": str(e)}
            self._log_tool_call("get_employee_reports", {"employee_id": self.employee_id}, err_dict, "FAILED", latency_ms)
            return [err_dict]

    # 4. create_expense_report (WRITE TOOL -> HITL GATE)
    def create_expense_report(self, title: Optional[str] = "Expense Report") -> Dict[str, Any]:
        """Propose creating a new draft expense report (creates pending action, does NOT execute directly)."""
        start = time.time()
        payload = {"employee_id": self.employee_id, "title": title}

        action = PendingActionService.create_pending_action(
            db=self.db,
            trace_id=self.trace_id,
            employee_id=self.employee_id,
            action_type="create_report",
            tool_name="create_expense_report",
            exact_payload=payload,
            exception_flag=False,
        )
        res = {
            "status": "PENDING_APPROVAL",
            "pending_action_id": action.id,
            "message": "Draft report creation prepared. Requires employee confirmation to execute.",
            "payload": payload,
        }
        latency_ms = int((time.time() - start) * 1000)
        self._log_tool_call("create_expense_report", payload, res, "PENDING", latency_ms)
        return res

    # 5. add_expense_line (WRITE TOOL -> HITL GATE)
    def add_expense_line(
        self,
        date: str,
        merchant: str,
        category: str,
        amount: float,
        currency: str = "INR",
        project_code: str = "ATLAS",
        notes: Optional[str] = "",
        justification: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Propose adding an expense line (creates pending action, does NOT execute directly)."""
        start = time.time()
        payload = {
            "date": date,
            "merchant": merchant,
            "category": category,
            "amount": amount,
            "currency": currency,
            "project_code": project_code,
            "notes": notes or "",
            "justification": justification,
        }

        # Step A: Tool Argument Validation Guardrail
        is_valid, arg_err = ArgumentValidationGuardrail.validate_expense_line(payload, self.db)
        if not is_valid:
            latency_ms = int((time.time() - start) * 1000)
            err_res = {
                "status": "VALIDATION_FAILED",
                "error": arg_err,
                "message": f"Validation failed: {arg_err}",
            }
            self._log_tool_call("add_expense_line", payload, err_res, "FAILED", latency_ms)
            return err_res

        # Step B: Policy Validation Guardrail
        is_policy_compliant, is_exception, policy_msg, exception_details = PolicyValidationGuardrail.evaluate_policy(
            payload, self.db
        )

        # Step C: Duplicate Detection Guardrail
        duplicate_warning = PolicyValidationGuardrail.check_duplicates(payload, self.employee_id, self.db)

        # Step D: Create Pending Action (HITL Gate in code!)
        action = PendingActionService.create_pending_action(
            db=self.db,
            trace_id=self.trace_id,
            employee_id=self.employee_id,
            action_type="add_line",
            tool_name="add_expense_line",
            exact_payload=payload,
            exception_flag=is_exception,
            policy_violation_details=exception_details,
            justification=justification,
        )

        res = {
            "status": "PENDING_APPROVAL",
            "pending_action_id": action.id,
            "exact_payload": payload,
            "payload_hash": action.payload_hash,
            "policy_compliant": is_policy_compliant,
            "is_exception": is_exception,
            "policy_message": policy_msg,
            "duplicate_warning": duplicate_warning,
            "message": "Expense details validated. Created pending action awaiting human approval.",
        }
        latency_ms = int((time.time() - start) * 1000)
        self._log_tool_call("add_expense_line", payload, res, "PENDING", latency_ms)
        return res

    # 6. submit_expense_report (WRITE TOOL -> HITL GATE)
    def submit_expense_report(self, report_id: str) -> Dict[str, Any]:
        """Propose submitting an expense report to Finance (creates pending action, does NOT execute directly)."""
        start = time.time()
        payload = {"report_id": report_id}

        action = PendingActionService.create_pending_action(
            db=self.db,
            trace_id=self.trace_id,
            employee_id=self.employee_id,
            action_type="submit_report",
            tool_name="submit_expense_report",
            exact_payload=payload,
            exception_flag=False,
        )
        res = {
            "status": "PENDING_APPROVAL",
            "pending_action_id": action.id,
            "message": f"Submission of report {report_id} prepared. Awaiting employee confirmation.",
            "payload": payload,
        }
        latency_ms = int((time.time() - start) * 1000)
        self._log_tool_call("submit_expense_report", payload, res, "PENDING", latency_ms)
        return res

    def get_langchain_tools(self) -> List[StructuredTool]:
        """Convert methods into LangChain StructuredTools for LLM tool binding."""
        return [
            StructuredTool.from_function(
                func=self.get_project_details,
                name="get_project_details",
                description="Look up project status (Active vs Closed) and remaining budget by code (e.g., ATLAS, ORION). Expenses can only be filed against Active projects.",
                args_schema=ProjectDetailsInput,
            ),
            StructuredTool.from_function(
                func=self.get_expense_policy,
                name="get_expense_policy",
                description="Retrieve Brightpath reimbursement policy rules and limits (Meals ₹1,500/day, Local Travel ₹3,000/trip, Hotel ₹7,000/night, Client Entertainment pre-approval requirements).",
            ),
            StructuredTool.from_function(
                func=self.get_employee_reports,
                name="get_employee_reports",
                description="Retrieve previously submitted and draft expense reports for the authenticated employee (e.g., E1042) to detect duplicate expense submissions.",
                args_schema=EmployeeReportsInput,
            ),
            StructuredTool.from_function(
                func=self.create_expense_report,
                name="create_expense_report",
                description="Code-enforced Human-in-the-Loop write tool: prepares a draft expense report container. Creates a PendingAction with SHA-256 hash requiring explicit user confirmation.",
                args_schema=CreateExpenseReportInput,
            ),
            StructuredTool.from_function(
                func=self.add_expense_line,
                name="add_expense_line",
                description="Code-enforced Human-in-the-Loop write tool: prepares adding an expense line to draft. Validates against policy and generates a PendingAction awaiting human approval.",
                args_schema=AddExpenseLineInput,
            ),
            StructuredTool.from_function(
                func=self.submit_expense_report,
                name="submit_expense_report",
                description="Code-enforced Human-in-the-Loop write tool: prepares final submission of an expense report to Finance. Creates a PendingAction awaiting human confirmation.",
                args_schema=SubmitExpenseReportInput,
            ),
        ]
