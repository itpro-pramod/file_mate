import random
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.core.exceptions import FileMateException
from app.database.models import ExpenseLine, ExpensePolicy, ExpenseReport, Project


class MockExpenseAPI:
    """Mock Expense API service implementing the business contract.

    Crucial Architectural Rule:
    - Read methods may be called by tools and queries.
    - Write methods can only be invoked by the Approval Execution Service with an approved pending action!
    """

    def __init__(self, db: Session):
        self.db = db

    # ---------------- Read Endpoints ----------------

    def get_project_details(self, code: str) -> Dict[str, Any]:
        """GET /projects/{code} -> retrieve project name, status (active or closed), budget remaining."""
        project = self.db.query(Project).filter(Project.code == code.upper().strip()).first()
        if not project:
            raise FileMateException(
                status_code=404,
                detail=f"Project '{code}' does not exist.",
                code="PROJECT_NOT_FOUND",
            )
        return {
            "code": project.code,
            "name": project.name,
            "status": project.status,
            "budget_remaining": project.budget_remaining,
        }

    def get_expense_policy(self) -> List[Dict[str, Any]]:
        """GET /policy -> retrieve category limits and rules."""
        policies = self.db.query(ExpensePolicy).all()
        return [
            {
                "category": p.category,
                "limit_amount": p.limit_amount,
                "limit_type": p.limit_type,
                "rule_description": p.rule_description,
                "currency": p.currency,
            }
            for p in policies
        ]

    def get_employee_reports(self, employee_id: str) -> List[Dict[str, Any]]:
        """GET /reports?employee_id={id} -> retrieve employee reports and lines."""
        reports = (
            self.db.query(ExpenseReport)
            .filter(ExpenseReport.employee_id == employee_id)
            .order_by(ExpenseReport.created_at.desc())
            .all()
        )
        result = []
        for r in reports:
            lines = [
                {
                    "id": line.id,
                    "date": line.date,
                    "merchant": line.merchant,
                    "category": line.category,
                    "amount": line.amount,
                    "currency": line.currency,
                    "project_code": line.project_code,
                    "notes": line.notes,
                    "exception_flag": line.exception_flag,
                    "justification": line.justification,
                }
                for line in r.lines
            ]
            result.append(
                {
                    "id": r.id,
                    "report_number": r.report_number,
                    "employee_id": r.employee_id,
                    "status": r.status,
                    "total_amount": r.total_amount,
                    "currency": r.currency,
                    "created_at": r.created_at.isoformat(),
                    "submitted_at": r.submitted_at.isoformat() if r.submitted_at else None,
                    "lines": lines,
                }
            )
        return result

    # ---------------- Protected Write Operations (Callable ONLY after approval) ----------------

    def create_draft_report(self, employee_id: str, title: Optional[str] = None) -> Dict[str, Any]:
        """POST /reports -> creates draft report; returns report ID & number."""
        report_num = f"RPT-{random.randint(10020, 99999)}"
        # Check uniqueness
        while self.db.query(ExpenseReport).filter(ExpenseReport.report_number == report_num).first():
            report_num = f"RPT-{random.randint(10020, 99999)}"

        report = ExpenseReport(
            report_number=report_num,
            employee_id=employee_id,
            status="draft",
            total_amount=0.0,
            currency="INR",
        )
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)

        return {
            "id": report.id,
            "report_number": report.report_number,
            "employee_id": report.employee_id,
            "status": report.status,
            "total_amount": report.total_amount,
            "created_at": report.created_at.isoformat(),
        }

    def add_expense_line(self, report_id: str, line_data: Dict[str, Any]) -> Dict[str, Any]:
        """POST /reports/{id}/lines -> adds an expense line to a draft report."""
        report = self.db.query(ExpenseReport).filter(
            (ExpenseReport.id == report_id) | (ExpenseReport.report_number == report_id)
        ).first()

        if not report:
            raise FileMateException(
                status_code=404,
                detail=f"Report {report_id} not found",
                code="REPORT_NOT_FOUND",
            )

        if report.status != "draft":
            raise FileMateException(
                status_code=400,
                detail=f"Cannot add lines to a report with status '{report.status}'",
                code="REPORT_NOT_DRAFT",
            )

        amount = float(line_data.get("amount", 0.0))
        line = ExpenseLine(
            report_id=report.id,
            date=str(line_data.get("date")),
            merchant=str(line_data.get("merchant")),
            category=str(line_data.get("category")),
            amount=amount,
            currency=str(line_data.get("currency", "INR")),
            project_code=str(line_data.get("project_code")).upper(),
            notes=line_data.get("notes", ""),
            exception_flag=bool(line_data.get("exception_flag", False)),
            justification=line_data.get("justification"),
            receipt_path=line_data.get("receipt_path"),
        )
        self.db.add(line)

        # Update report total amount
        report.total_amount = round(report.total_amount + amount, 2)
        self.db.commit()
        self.db.refresh(line)

        return {
            "id": line.id,
            "report_id": report.id,
            "report_number": report.report_number,
            "merchant": line.merchant,
            "category": line.category,
            "amount": line.amount,
            "currency": line.currency,
            "project_code": line.project_code,
            "notes": line.notes,
            "exception_flag": line.exception_flag,
            "justification": line.justification,
            "report_total_amount": report.total_amount,
        }

    def submit_report(self, report_id: str) -> Dict[str, Any]:
        """POST /reports/{id}/submit -> submits the report to Finance for approval."""
        report = self.db.query(ExpenseReport).filter(
            (ExpenseReport.id == report_id) | (ExpenseReport.report_number == report_id)
        ).first()

        if not report:
            raise FileMateException(
                status_code=404,
                detail=f"Report {report_id} not found",
                code="REPORT_NOT_FOUND",
            )

        if report.status == "submitted":
            return {
                "id": report.id,
                "report_number": report.report_number,
                "status": "submitted",
                "message": "Report was already submitted",
                "submitted_at": report.submitted_at.isoformat() if report.submitted_at else None,
            }

        report.status = "submitted"
        report.submitted_at = datetime.now(timezone.utc)
        self.db.commit()

        return {
            "id": report.id,
            "report_number": report.report_number,
            "status": report.status,
            "submitted_at": report.submitted_at.isoformat(),
            "message": "Report submitted successfully to Finance for approval",
        }
