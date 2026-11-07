import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database.models import (
    Approval,
    AuditLog,
    ExpenseLine,
    ExpensePolicy,
    ExpenseReport,
    Project,
    ToolCall,
    User,
)
from app.intelligence.auth_context import AuthorizationContext


class ExpenseIntelligenceToolSuite:
    """Enterprise read-only intelligence tool suite for FileMate.
    Enforces authorization context on every single tool execution.
    Logs every tool call directly to SQLite tool_calls table with latency.
    """

    def __init__(self, db: Session, auth_ctx: AuthorizationContext):
        self.db = db
        self.auth_ctx = auth_ctx
        self.trace_id = auth_ctx.trace_id

    def _log_tool(
        self,
        tool_name: str,
        args: Dict[str, Any],
        output: Any,
        status: str,
        latency_ms: int,
    ):
        masked_args = args.copy()
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

    def _check_permission(self, tool_name: str, target_emp_id: Optional[str] = None):
        """Enforces persona allowlist and cross-employee scoping."""
        if not self.auth_ctx.can_access_tool(tool_name):
            raise PermissionError(
                f"Unauthorized: Persona '{self.auth_ctx.role}' is not permitted to use '{tool_name}'."
            )
        if target_emp_id and not self.auth_ctx.can_access_employee(target_emp_id):
            raise PermissionError(
                f"Security Violation: Consultant '{self.auth_ctx.employee_id}' cannot access records for employee '{target_emp_id}'."
            )

    # -------------------------------------------------------------
    # 1. COMMON TOOLS (Persona-Scoped)
    # -------------------------------------------------------------

    def get_expense_policy(self) -> List[Dict[str, Any]]:
        """Retrieve category limits and rules from expense policy."""
        start = time.time()
        self._check_permission("get_expense_policy")
        policies = self.db.query(ExpensePolicy).all()
        res = [
            {
                "category": p.category,
                "limit_amount": p.limit_amount,
                "limit_type": p.limit_type,
                "rule_description": p.rule_description,
                "currency": p.currency,
            }
            for p in policies
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_expense_policy", {}, res, "SUCCESS", lat)
        return res

    def get_expense_by_id(self, expense_id: str) -> Dict[str, Any]:
        """Retrieve single expense line by ID or report number."""
        start = time.time()
        self._check_permission("get_expense_by_id")
        line = self.db.query(ExpenseLine).filter(ExpenseLine.id == expense_id).first()
        if not line:
            # Check if report number
            rpt = self.db.query(ExpenseReport).filter(ExpenseReport.report_number == expense_id).first()
            if rpt:
                self._check_permission("get_expense_by_id", rpt.employee_id)
                res = {
                    "type": "report",
                    "report_number": rpt.report_number,
                    "employee_id": rpt.employee_id,
                    "status": rpt.status,
                    "total_amount": rpt.total_amount,
                    "lines_count": len(rpt.lines),
                }
                lat = int((time.time() - start) * 1000)
                self._log_tool("get_expense_by_id", {"expense_id": expense_id}, res, "SUCCESS", lat)
                return res
            res = {"error": f"Expense '{expense_id}' not found."}
            lat = int((time.time() - start) * 1000)
            self._log_tool("get_expense_by_id", {"expense_id": expense_id}, res, "FAILED", lat)
            return res

        # Validate employee scope
        report = line.report
        self._check_permission("get_expense_by_id", report.employee_id)
        res = {
            "id": line.id,
            "report_number": report.report_number,
            "employee_id": report.employee_id,
            "date": line.date,
            "merchant": line.merchant,
            "category": line.category,
            "amount": line.amount,
            "project_code": line.project_code,
            "notes": line.notes,
            "exception_flag": line.exception_flag,
            "justification": line.justification,
        }
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_expense_by_id", {"expense_id": expense_id}, res, "SUCCESS", lat)
        return res

    def get_expenses_by_date_range(
        self, start_date: str, end_date: str, employee_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve expenses within date range (YYYY-MM-DD)."""
        start = time.time()
        target_emp = employee_id if self.auth_ctx.role == "Finance Controller" else self.auth_ctx.employee_id
        self._check_permission("get_expenses_by_date_range", target_emp)

        query = (
            self.db.query(ExpenseLine, ExpenseReport)
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(ExpenseLine.date >= start_date, ExpenseLine.date <= end_date)
        )
        if target_emp:
            query = query.filter(ExpenseReport.employee_id == target_emp)

        records = query.order_by(ExpenseLine.date.desc()).all()
        res = [
            {
                "id": line.id,
                "report_number": rpt.report_number,
                "employee_id": rpt.employee_id,
                "date": line.date,
                "merchant": line.merchant,
                "category": line.category,
                "amount": line.amount,
                "project_code": line.project_code,
                "exception_flag": line.exception_flag,
                "status": rpt.status,
            }
            for line, rpt in records
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool(
            "get_expenses_by_date_range",
            {"start_date": start_date, "end_date": end_date, "employee_id": target_emp},
            {"count": len(res)},
            "SUCCESS",
            lat,
        )
        return res

    def get_expense_summary(self, period: Optional[str] = "All Time") -> Dict[str, Any]:
        """Aggregate summary of expenses for the authorized scope."""
        start = time.time()
        self._check_permission("get_expense_summary")

        emp_filter = self.auth_ctx.employee_id if self.auth_ctx.role == "Consultant" else None
        rpt_query = self.db.query(ExpenseReport)
        if emp_filter:
            rpt_query = rpt_query.filter(ExpenseReport.employee_id == emp_filter)

        reports = rpt_query.all()
        submitted = [r for r in reports if r.status == "submitted"]
        approved = [r for r in reports if r.status == "approved"]
        pending = [r for r in reports if r.status in ["draft", "submitted"]]
        rejected = [r for r in reports if r.status == "rejected"]

        total_submitted_amount = sum(r.total_amount for r in submitted)
        total_approved_amount = sum(r.total_amount for r in approved)

        line_query = self.db.query(ExpenseLine).join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
        if emp_filter:
            line_query = line_query.filter(ExpenseReport.employee_id == emp_filter)
        lines = line_query.all()
        exceptions_cnt = sum(1 for l in lines if l.exception_flag)

        res = {
            "period": period,
            "scope": "Consultant" if emp_filter else "Company-Wide",
            "total_reports": len(reports),
            "submitted_count": len(submitted),
            "total_submitted_amount": round(total_submitted_amount, 2),
            "approved_count": len(approved),
            "total_approved_amount": round(total_approved_amount, 2),
            "pending_count": len(pending),
            "rejected_count": len(rejected),
            "policy_exceptions_count": exceptions_cnt,
            "total_expense_lines": len(lines),
        }
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_expense_summary", {"period": period}, res, "SUCCESS", lat)
        return res

    def get_expenses_by_category(self, period: Optional[str] = "All Time") -> List[Dict[str, Any]]:
        """Retrieve category-wise spending breakdown."""
        start = time.time()
        self._check_permission("get_expenses_by_category")

        emp_filter = self.auth_ctx.employee_id if self.auth_ctx.role == "Consultant" else None
        query = (
            self.db.query(
                ExpenseLine.category,
                func.sum(ExpenseLine.amount).label("total_amount"),
                func.count(ExpenseLine.id).label("line_count"),
            )
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .group_by(ExpenseLine.category)
        )
        if emp_filter:
            query = query.filter(ExpenseReport.employee_id == emp_filter)

        rows = query.all()
        grand_total = sum(r.total_amount for r in rows) if rows else 0.0

        res = [
            {
                "category": r.category,
                "amount": round(r.total_amount, 2),
                "count": r.line_count,
                "percentage": round((r.total_amount / grand_total) * 100, 1) if grand_total > 0 else 0.0,
            }
            for r in rows
        ]
        # Sort descending by amount
        res.sort(key=lambda x: x["amount"], reverse=True)
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_expenses_by_category", {"period": period}, res, "SUCCESS", lat)
        return res

    def get_project_details(self, project_code: str) -> Dict[str, Any]:
        """Retrieve project status and budget."""
        start = time.time()
        self._check_permission("get_project_details")
        code = project_code.upper().strip()
        proj = self.db.query(Project).filter(Project.code == code).first()
        if not proj:
            res = {"error": f"Project '{project_code}' not found."}
            lat = int((time.time() - start) * 1000)
            self._log_tool("get_project_details", {"project_code": code}, res, "FAILED", lat)
            return res

        total_billed = (
            self.db.query(func.sum(ExpenseLine.amount))
            .filter(ExpenseLine.project_code == code)
            .scalar()
            or 0.0
        )
        from app.api.projects import PROJECT_METADATA
        meta = PROJECT_METADATA.get(code, {})
        initial_budget = meta.get("initial_budget", proj.budget_remaining if proj.budget_remaining > 0 else (240000.0 if code == "ATLAS" else 0.0))
        rem = max(0.0, initial_budget - total_billed) if initial_budget > 0 else 0.0

        res = {
            "code": proj.code,
            "name": proj.name,
            "status": proj.status,
            "initial_budget": initial_budget,
            "budget_remaining": rem,
            "total_billed": round(total_billed, 2),
            "burn_percentage": round((total_billed / initial_budget) * 100, 1) if initial_budget > 0 else (100.0 if proj.status == "Closed" else 0.0),
        }
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_project_details", {"project_code": code}, res, "SUCCESS", lat)
        return res

    def get_project_expenses(
        self, project_code: str, period: Optional[str] = "All Time"
    ) -> List[Dict[str, Any]]:
        """Retrieve expenses billed to a specific project."""
        start = time.time()
        self._check_permission("get_project_expenses")
        code = project_code.upper().strip()

        emp_filter = self.auth_ctx.employee_id if self.auth_ctx.role == "Consultant" else None
        query = (
            self.db.query(ExpenseLine, ExpenseReport)
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(ExpenseLine.project_code == code)
        )
        if emp_filter:
            query = query.filter(ExpenseReport.employee_id == emp_filter)

        records = query.order_by(ExpenseLine.date.desc()).all()
        res = [
            {
                "id": line.id,
                "report_number": rpt.report_number,
                "employee_id": rpt.employee_id,
                "date": line.date,
                "merchant": line.merchant,
                "category": line.category,
                "amount": line.amount,
                "project_code": line.project_code,
                "notes": line.notes,
                "exception_flag": line.exception_flag,
                "justification": line.justification,
                "status": rpt.status,
            }
            for line, rpt in records
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool(
            "get_project_expenses",
            {"project_code": code, "period": period},
            {"count": len(res)},
            "SUCCESS",
            lat,
        )
        return res

    def get_submission_status(self, report_id: str) -> Dict[str, Any]:
        """Query submission status of a report."""
        start = time.time()
        self._check_permission("get_submission_status")
        rpt = (
            self.db.query(ExpenseReport)
            .filter((ExpenseReport.id == report_id) | (ExpenseReport.report_number == report_id))
            .first()
        )
        if not rpt:
            res = {"error": f"Report '{report_id}' not found."}
            lat = int((time.time() - start) * 1000)
            self._log_tool("get_submission_status", {"report_id": report_id}, res, "FAILED", lat)
            return res

        self._check_permission("get_submission_status", rpt.employee_id)
        res = {
            "report_number": rpt.report_number,
            "employee_id": rpt.employee_id,
            "status": rpt.status,
            "total_amount": rpt.total_amount,
            "submitted_at": rpt.submitted_at.isoformat() if rpt.submitted_at else None,
            "approved_by": rpt.approved_by,
            "finance_notes": rpt.finance_notes,
            "lines_count": len(rpt.lines),
        }
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_submission_status", {"report_id": report_id}, res, "SUCCESS", lat)
        return res

    def get_pending_expenses(self, period: Optional[str] = "All Time") -> List[Dict[str, Any]]:
        """Retrieve reports currently pending approval."""
        start = time.time()
        self._check_permission("get_pending_expenses")

        emp_filter = self.auth_ctx.employee_id if self.auth_ctx.role == "Consultant" else None
        query = self.db.query(ExpenseReport).filter(ExpenseReport.status.in_(["submitted", "draft"]))
        if emp_filter:
            query = query.filter(ExpenseReport.employee_id == emp_filter)

        reports = query.order_by(ExpenseReport.created_at.desc()).all()
        res = [
            {
                "report_number": r.report_number,
                "employee_id": r.employee_id,
                "status": r.status,
                "total_amount": r.total_amount,
                "created_at": r.created_at.isoformat(),
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
                "lines_count": len(r.lines),
                "has_exception": any(l.exception_flag for l in r.lines),
            }
            for r in reports
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_pending_expenses", {"period": period}, {"count": len(res)}, "SUCCESS", lat)
        return res

    def get_rejected_expenses(self, period: Optional[str] = "All Time") -> List[Dict[str, Any]]:
        """Retrieve reports that were rejected."""
        start = time.time()
        self._check_permission("get_rejected_expenses")

        emp_filter = self.auth_ctx.employee_id if self.auth_ctx.role == "Consultant" else None
        query = self.db.query(ExpenseReport).filter(ExpenseReport.status == "rejected")
        if emp_filter:
            query = query.filter(ExpenseReport.employee_id == emp_filter)

        reports = query.order_by(ExpenseReport.created_at.desc()).all()
        res = [
            {
                "report_number": r.report_number,
                "employee_id": r.employee_id,
                "status": r.status,
                "total_amount": r.total_amount,
                "finance_notes": r.finance_notes,
                "created_at": r.created_at.isoformat(),
            }
            for r in reports
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_rejected_expenses", {"period": period}, {"count": len(res)}, "SUCCESS", lat)
        return res

    # -------------------------------------------------------------
    # 2. CONSULTANT-SPECIFIC TOOLS (Strict Authenticated Context)
    # -------------------------------------------------------------

    def get_my_expenses(
        self,
        period: Optional[str] = "All Time",
        category: Optional[str] = None,
        project_code: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve authenticated consultant's expense lines with filters."""
        start = time.time()
        self._check_permission("get_my_expenses", self.auth_ctx.employee_id)

        query = (
            self.db.query(ExpenseLine, ExpenseReport)
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(ExpenseReport.employee_id == self.auth_ctx.employee_id)
        )
        if category:
            query = query.filter(ExpenseLine.category.ilike(category.strip()))
        if project_code:
            query = query.filter(ExpenseLine.project_code.ilike(project_code.strip()))

        records = query.order_by(ExpenseLine.date.desc()).all()
        res = [
            {
                "id": line.id,
                "report_number": rpt.report_number,
                "date": line.date,
                "merchant": line.merchant,
                "category": line.category,
                "amount": line.amount,
                "currency": line.currency,
                "project_code": line.project_code,
                "notes": line.notes,
                "exception_flag": line.exception_flag,
                "justification": line.justification,
                "status": rpt.status,
            }
            for line, rpt in records
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool(
            "get_my_expenses",
            {"category": category, "project_code": project_code, "period": period},
            {"count": len(res)},
            "SUCCESS",
            lat,
        )
        return res

    def get_my_expense_summary(self, period: Optional[str] = "All Time") -> Dict[str, Any]:
        """Aggregate summary strictly for authenticated consultant."""
        start = time.time()
        self._check_permission("get_my_expense_summary", self.auth_ctx.employee_id)
        return self.get_expense_summary(period=period)

    def get_my_project_assignments(self) -> List[Dict[str, Any]]:
        """Projects active for the consultant."""
        start = time.time()
        self._check_permission("get_my_project_assignments")
        # In BrightPath environment, ATLAS is the active consulting assignment
        projects = self.db.query(Project).filter(Project.status == "Active").all()
        res = [
            {
                "code": p.code,
                "name": p.name,
                "status": p.status,
                "budget_remaining": p.budget_remaining,
            }
            for p in projects
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_my_project_assignments", {}, res, "SUCCESS", lat)
        return res

    def get_my_project_budget(self, project_code: str) -> Dict[str, Any]:
        """Budget detail for a specific project."""
        start = time.time()
        self._check_permission("get_my_project_budget")
        return self.get_project_details(project_code)

    def get_my_policy_exceptions(self) -> List[Dict[str, Any]]:
        """Retrieve consultant's expense lines flagged as exceptions."""
        start = time.time()
        self._check_permission("get_my_policy_exceptions", self.auth_ctx.employee_id)
        records = (
            self.db.query(ExpenseLine, ExpenseReport)
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(
                ExpenseReport.employee_id == self.auth_ctx.employee_id,
                ExpenseLine.exception_flag == True,
            )
            .order_by(ExpenseLine.date.desc())
            .all()
        )
        res = [
            {
                "id": line.id,
                "report_number": rpt.report_number,
                "date": line.date,
                "merchant": line.merchant,
                "category": line.category,
                "amount": line.amount,
                "project_code": line.project_code,
                "justification": line.justification,
                "status": rpt.status,
            }
            for line, rpt in records
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_my_policy_exceptions", {}, res, "SUCCESS", lat)
        return res

    def get_my_submission_history(self) -> List[Dict[str, Any]]:
        """History of all submitted expense reports for current user."""
        start = time.time()
        self._check_permission("get_my_submission_history", self.auth_ctx.employee_id)
        reports = (
            self.db.query(ExpenseReport)
            .filter(ExpenseReport.employee_id == self.auth_ctx.employee_id)
            .order_by(ExpenseReport.created_at.desc())
            .all()
        )
        res = [
            {
                "report_number": r.report_number,
                "status": r.status,
                "total_amount": r.total_amount,
                "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
                "approved_by": r.approved_by,
                "lines_count": len(r.lines),
            }
            for r in reports
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_my_submission_history", {}, res, "SUCCESS", lat)
        return res

    def get_my_expense_trends(self, period: Optional[str] = "Recent") -> List[Dict[str, Any]]:
        """Monthly or date-wise spending trends for current user."""
        start = time.time()
        self._check_permission("get_my_expense_trends", self.auth_ctx.employee_id)
        records = (
            self.db.query(ExpenseLine.date, func.sum(ExpenseLine.amount).label("daily_total"))
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(ExpenseReport.employee_id == self.auth_ctx.employee_id)
            .group_by(ExpenseLine.date)
            .order_by(ExpenseLine.date.asc())
            .all()
        )
        res = [{"date": r.date, "amount": round(r.daily_total, 2)} for r in records]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_my_expense_trends", {"period": period}, res, "SUCCESS", lat)
        return res

    # -------------------------------------------------------------
    # 3. FINANCE CONTROLLER TOOLS (Company-Wide Access)
    # -------------------------------------------------------------

    def get_all_consultants(self) -> List[Dict[str, Any]]:
        """List all consultants and active employees."""
        start = time.time()
        self._check_permission("get_all_consultants")
        users = self.db.query(User).order_by(User.full_name.asc()).all()
        res = [
            {
                "employee_id": u.employee_id,
                "name": u.full_name,
                "email": u.email,
                "role": u.role,
            }
            for u in users
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_all_consultants", {}, res, "SUCCESS", lat)
        return res

    def get_consultant_details(self, employee_id: str) -> Dict[str, Any]:
        """Consultant profile and spending overview."""
        start = time.time()
        self._check_permission("get_consultant_details")
        u = self.db.query(User).filter(User.employee_id == employee_id.upper().strip()).first()
        if not u:
            res = {"error": f"Employee '{employee_id}' not found."}
            lat = int((time.time() - start) * 1000)
            self._log_tool("get_consultant_details", {"employee_id": employee_id}, res, "FAILED", lat)
            return res

        total_billed = (
            self.db.query(func.sum(ExpenseLine.amount))
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(ExpenseReport.employee_id == u.employee_id)
            .scalar()
            or 0.0
        )
        reports_count = (
            self.db.query(ExpenseReport).filter(ExpenseReport.employee_id == u.employee_id).count()
        )

        res = {
            "employee_id": u.employee_id,
            "name": u.full_name,
            "email": u.email,
            "role": u.role,
            "total_expenses_amount": round(total_billed, 2),
            "reports_count": reports_count,
        }
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_consultant_details", {"employee_id": employee_id}, res, "SUCCESS", lat)
        return res

    def get_consultant_expenses(
        self,
        employee_id: str,
        period: Optional[str] = "All Time",
        category: Optional[str] = None,
        project_code: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve specific consultant's expenses."""
        start = time.time()
        self._check_permission("get_consultant_expenses", employee_id)
        emp_id = employee_id.upper().strip()

        query = (
            self.db.query(ExpenseLine, ExpenseReport)
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(ExpenseReport.employee_id == emp_id)
        )
        if category:
            query = query.filter(ExpenseLine.category.ilike(category.strip()))
        if project_code:
            query = query.filter(ExpenseLine.project_code.ilike(project_code.strip()))

        records = query.order_by(ExpenseLine.date.desc()).all()
        res = [
            {
                "id": line.id,
                "report_number": rpt.report_number,
                "date": line.date,
                "merchant": line.merchant,
                "category": line.category,
                "amount": line.amount,
                "project_code": line.project_code,
                "notes": line.notes,
                "exception_flag": line.exception_flag,
                "justification": line.justification,
                "status": rpt.status,
            }
            for line, rpt in records
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool(
            "get_consultant_expenses",
            {"employee_id": emp_id, "period": period, "category": category, "project_code": project_code},
            {"count": len(res)},
            "SUCCESS",
            lat,
        )
        return res

    def get_all_expenses(
        self,
        period: Optional[str] = "All Time",
        category: Optional[str] = None,
        project_code: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Company-wide expense lines."""
        start = time.time()
        self._check_permission("get_all_expenses")

        query = self.db.query(ExpenseLine, ExpenseReport).join(
            ExpenseReport, ExpenseLine.report_id == ExpenseReport.id
        )
        if category:
            query = query.filter(ExpenseLine.category.ilike(category.strip()))
        if project_code:
            query = query.filter(ExpenseLine.project_code.ilike(project_code.strip()))
        if status:
            query = query.filter(ExpenseReport.status.ilike(status.strip()))

        records = query.order_by(ExpenseLine.date.desc()).all()
        users = {u.employee_id: u.full_name for u in self.db.query(User).all()}

        res = [
            {
                "id": line.id,
                "report_number": rpt.report_number,
                "employee_id": rpt.employee_id,
                "employee_name": users.get(rpt.employee_id, rpt.employee_id),
                "date": line.date,
                "merchant": line.merchant,
                "category": line.category,
                "amount": line.amount,
                "project_code": line.project_code,
                "exception_flag": line.exception_flag,
                "justification": line.justification,
                "status": rpt.status,
            }
            for line, rpt in records
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_all_expenses", {"category": category, "project_code": project_code}, {"count": len(res)}, "SUCCESS", lat)
        return res

    def get_company_expense_summary(self, period: Optional[str] = "All Time") -> Dict[str, Any]:
        """Executive financial overview across all employees."""
        start = time.time()
        self._check_permission("get_company_expense_summary")
        return self.get_expense_summary(period=period)

    def get_project_wise_expenses(self, period: Optional[str] = "All Time") -> List[Dict[str, Any]]:
        """Spend aggregated by project code."""
        start = time.time()
        self._check_permission("get_project_wise_expenses")
        rows = (
            self.db.query(
                ExpenseLine.project_code,
                func.sum(ExpenseLine.amount).label("total_amount"),
                func.count(ExpenseLine.id).label("line_count"),
            )
            .group_by(ExpenseLine.project_code)
            .all()
        )
        res = [
            {
                "project_code": r.project_code,
                "total_amount": round(r.total_amount, 2),
                "line_count": r.line_count,
            }
            for r in rows
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_project_wise_expenses", {"period": period}, res, "SUCCESS", lat)
        return res

    def get_consultant_wise_expenses(self, period: Optional[str] = "All Time") -> List[Dict[str, Any]]:
        """Spend aggregated by consultant."""
        start = time.time()
        self._check_permission("get_consultant_wise_expenses")
        users = {u.employee_id: u.full_name for u in self.db.query(User).all()}
        rows = (
            self.db.query(
                ExpenseReport.employee_id,
                func.sum(ExpenseLine.amount).label("total_amount"),
                func.count(ExpenseLine.id).label("line_count"),
                func.count(func.distinct(ExpenseReport.id)).label("report_count"),
            )
            .join(ExpenseLine, ExpenseLine.report_id == ExpenseReport.id)
            .group_by(ExpenseReport.employee_id)
            .order_by(func.sum(ExpenseLine.amount).desc())
            .all()
        )
        res = [
            {
                "employee_id": r.employee_id,
                "employee_name": users.get(r.employee_id, r.employee_id),
                "total_amount": round(r.total_amount, 2),
                "line_count": r.line_count,
                "report_count": r.report_count,
            }
            for r in rows
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_consultant_wise_expenses", {"period": period}, res, "SUCCESS", lat)
        return res

    def get_policy_exceptions(self, period: Optional[str] = "All Time") -> List[Dict[str, Any]]:
        """Retrieve all company-wide policy exception records."""
        start = time.time()
        self._check_permission("get_policy_exceptions")
        users = {u.employee_id: u.full_name for u in self.db.query(User).all()}
        records = (
            self.db.query(ExpenseLine, ExpenseReport)
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(ExpenseLine.exception_flag == True)
            .order_by(ExpenseLine.date.desc())
            .all()
        )
        res = [
            {
                "id": line.id,
                "report_number": rpt.report_number,
                "employee_id": rpt.employee_id,
                "employee_name": users.get(rpt.employee_id, rpt.employee_id),
                "date": line.date,
                "merchant": line.merchant,
                "category": line.category,
                "amount": line.amount,
                "project_code": line.project_code,
                "justification": line.justification,
                "status": rpt.status,
            }
            for line, rpt in records
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_policy_exceptions", {"period": period}, {"count": len(res)}, "SUCCESS", lat)
        return res

    def get_high_value_expenses(
        self, min_amount: float = 5000.0, period: Optional[str] = "All Time"
    ) -> List[Dict[str, Any]]:
        """Retrieve expenses exceeding threshold (e.g. ₹5,000 or ₹10,000)."""
        start = time.time()
        self._check_permission("get_high_value_expenses")
        users = {u.employee_id: u.full_name for u in self.db.query(User).all()}
        records = (
            self.db.query(ExpenseLine, ExpenseReport)
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(ExpenseLine.amount >= min_amount)
            .order_by(ExpenseLine.amount.desc())
            .all()
        )
        res = [
            {
                "id": line.id,
                "report_number": rpt.report_number,
                "employee_id": rpt.employee_id,
                "employee_name": users.get(rpt.employee_id, rpt.employee_id),
                "date": line.date,
                "merchant": line.merchant,
                "category": line.category,
                "amount": line.amount,
                "project_code": line.project_code,
                "exception_flag": line.exception_flag,
                "status": rpt.status,
            }
            for line, rpt in records
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_high_value_expenses", {"min_amount": min_amount}, {"count": len(res)}, "SUCCESS", lat)
        return res

    def get_duplicate_expenses(self, period: Optional[str] = "All Time") -> List[Dict[str, Any]]:
        """Detect duplicate submissions (same merchant, amount, category)."""
        start = time.time()
        self._check_permission("get_duplicate_expenses")
        # Find lines with duplicate merchant, amount, category
        duplicates = (
            self.db.query(
                ExpenseLine.merchant,
                ExpenseLine.amount,
                ExpenseLine.category,
                func.count(ExpenseLine.id).label("count"),
            )
            .group_by(ExpenseLine.merchant, ExpenseLine.amount, ExpenseLine.category)
            .having(func.count(ExpenseLine.id) > 1)
            .all()
        )
        res = [
            {
                "merchant": d.merchant,
                "amount": d.amount,
                "category": d.category,
                "occurrences": d.count,
            }
            for d in duplicates
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_duplicate_expenses", {"period": period}, res, "SUCCESS", lat)
        return res

    def get_budget_utilization(self) -> List[Dict[str, Any]]:
        """Compute budget burn rate across all projects."""
        start = time.time()
        self._check_permission("get_budget_utilization")
        projects = self.db.query(Project).all()
        from app.api.projects import PROJECT_METADATA
        res = []
        for p in projects:
            total_billed = (
                self.db.query(func.sum(ExpenseLine.amount))
                .filter(ExpenseLine.project_code == p.code)
                .scalar()
                or 0.0
            )
            meta = PROJECT_METADATA.get(p.code.upper(), {})
            init_budget = meta.get("initial_budget", p.budget_remaining if p.budget_remaining > 0 else (240000.0 if p.code == "ATLAS" else 0.0))
            rem = max(0.0, init_budget - total_billed) if init_budget > 0 else 0.0
            burn_pct = round((total_billed / init_budget) * 100, 1) if init_budget > 0 else (100.0 if p.status == "Closed" else 0.0)
            res.append(
                {
                    "code": p.code,
                    "name": p.name,
                    "status": p.status,
                    "initial_budget": init_budget,
                    "budget_remaining": rem,
                    "total_billed": round(total_billed, 2),
                    "burn_percentage": burn_pct,
                }
            )
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_budget_utilization", {}, res, "SUCCESS", lat)
        return res

    def compare_consultants(
        self, employee_ids: List[str], period: Optional[str] = "All Time"
    ) -> List[Dict[str, Any]]:
        """Compare spending patterns between two or more consultants."""
        start = time.time()
        self._check_permission("compare_consultants")
        res = []
        for emp_id in employee_ids:
            clean_id = emp_id.strip().upper()
            detail = self.get_consultant_details(clean_id)
            if "error" not in detail:
                res.append(detail)
        lat = int((time.time() - start) * 1000)
        self._log_tool("compare_consultants", {"employee_ids": employee_ids}, res, "SUCCESS", lat)
        return res

    def compare_projects(
        self, project_codes: List[str], period: Optional[str] = "All Time"
    ) -> List[Dict[str, Any]]:
        """Compare budget and spending between projects (e.g. ATLAS vs ORION)."""
        start = time.time()
        self._check_permission("compare_projects")
        res = []
        for code in project_codes:
            proj_data = self.get_project_details(code)
            if "error" not in proj_data:
                res.append(proj_data)
        lat = int((time.time() - start) * 1000)
        self._log_tool("compare_projects", {"project_codes": project_codes}, res, "SUCCESS", lat)
        return res

    def get_spending_trends(self, period: Optional[str] = "All Time") -> List[Dict[str, Any]]:
        """Company-wide daily/monthly expenditure trends."""
        start = time.time()
        self._check_permission("get_spending_trends")
        records = (
            self.db.query(ExpenseLine.date, func.sum(ExpenseLine.amount).label("daily_total"))
            .group_by(ExpenseLine.date)
            .order_by(ExpenseLine.date.asc())
            .all()
        )
        res = [{"date": r.date, "amount": round(r.daily_total, 2)} for r in records]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_spending_trends", {"period": period}, res, "SUCCESS", lat)
        return res

    def get_top_spending_consultants(
        self, limit: int = 10, period: Optional[str] = "All Time"
    ) -> List[Dict[str, Any]]:
        """Rank top spending consultants."""
        start = time.time()
        self._check_permission("get_top_spending_consultants")
        all_cons = self.get_consultant_wise_expenses(period)
        all_cons.sort(key=lambda x: x["total_amount"], reverse=True)
        res = all_cons[:limit]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_top_spending_consultants", {"limit": limit}, res, "SUCCESS", lat)
        return res

    def get_expense_audit_history(self, expense_id: str) -> List[Dict[str, Any]]:
        """Inspect audit events and approvals for an expense."""
        start = time.time()
        self._check_permission("get_expense_audit_history")
        logs = (
            self.db.query(AuditLog)
            .filter(AuditLog.details.like(f"%{expense_id}%"))
            .order_by(AuditLog.timestamp.desc())
            .all()
        )
        res = [
            {
                "event_type": l.event_type,
                "timestamp": l.timestamp.isoformat(),
                "details": l.details,
            }
            for l in logs
        ]
        lat = int((time.time() - start) * 1000)
        self._log_tool("get_expense_audit_history", {"expense_id": expense_id}, res, "SUCCESS", lat)
        return res
