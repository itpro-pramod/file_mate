from dataclasses import dataclass, field
from typing import List, Optional
from app.database.models import User


CONSULTANT_ALLOWED_TOOLS = [
    "get_expense_policy",
    "get_expense_by_id",
    "get_expenses_by_date_range",
    "get_expense_summary",
    "get_expenses_by_category",
    "get_project_details",
    "get_project_expenses",
    "get_submission_status",
    "get_pending_expenses",
    "get_rejected_expenses",
    # Consultant-specific
    "get_my_expenses",
    "get_my_expense_summary",
    "get_my_project_assignments",
    "get_my_project_budget",
    "get_my_policy_exceptions",
    "get_my_submission_history",
    "get_my_expense_trends",
]

FINANCE_ALLOWED_TOOLS = [
    # Common tools
    "get_expense_policy",
    "get_expense_by_id",
    "get_expenses_by_date_range",
    "get_expense_summary",
    "get_expenses_by_category",
    "get_project_details",
    "get_project_expenses",
    "get_submission_status",
    "get_pending_expenses",
    "get_rejected_expenses",
    # Consultant-specific (when running for own identity)
    "get_my_expenses",
    "get_my_expense_summary",
    "get_my_project_assignments",
    "get_my_project_budget",
    "get_my_policy_exceptions",
    "get_my_submission_history",
    "get_my_expense_trends",
    # Finance Controller tools
    "get_all_consultants",
    "get_consultant_details",
    "get_consultant_expenses",
    "get_all_expenses",
    "get_company_expense_summary",
    "get_project_wise_expenses",
    "get_consultant_wise_expenses",
    "get_policy_exceptions",
    "get_high_value_expenses",
    "get_duplicate_expenses",
    "get_budget_utilization",
    "compare_consultants",
    "compare_projects",
    "get_spending_trends",
    "get_top_spending_consultants",
    "get_expense_audit_history",
]


@dataclass
class AuthorizationContext:
    user_id: str
    employee_id: str
    employee_name: str
    role: str  # "Consultant" or "Finance Controller"
    trace_id: str
    allowed_data_scope: str = "EMPLOYEE_ONLY"  # "EMPLOYEE_ONLY" or "COMPANY_WIDE"
    allowed_tools: List[str] = field(default_factory=list)

    @classmethod
    def from_user(cls, user: User, trace_id: str) -> "AuthorizationContext":
        is_finance = user.role == "Finance Controller"
        scope = "COMPANY_WIDE" if is_finance else "EMPLOYEE_ONLY"
        tools = FINANCE_ALLOWED_TOOLS if is_finance else CONSULTANT_ALLOWED_TOOLS

        return cls(
            user_id=user.id,
            employee_id=user.employee_id,
            employee_name=user.full_name,
            role=user.role,
            trace_id=trace_id,
            allowed_data_scope=scope,
            allowed_tools=tools,
        )

    def can_access_employee(self, target_employee_id: Optional[str]) -> bool:
        """Determines if current user can view target employee's data."""
        if not target_employee_id:
            return True
        if self.role == "Finance Controller":
            return True
        return target_employee_id.strip().upper() == self.employee_id.strip().upper()

    def can_access_tool(self, tool_name: str) -> bool:
        """Validates that tool is on allowlist for user persona."""
        return tool_name in self.allowed_tools
