from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api.auth import get_current_user
from app.database.database import get_db
from app.database.models import AgentRun, ExpenseLine, ExpenseReport, PendingAction, Project, User
from app.database.schemas import (
    ExpenseReportDetailResponse,
    ExpenseReportListItem,
    ExpenseLineResponse,
    FinanceAnalyticsResponse,
    FinanceDecisionRequest,
    FinanceQueueItem,
)
from app.services.receipt_parser import UPLOAD_DIR
import os

router = APIRouter(prefix="/api/expenses", tags=["Expense Reports"])


class PaginatedReportsResponse(BaseModel):
    items: List[ExpenseReportListItem]
    total: int
    limit: int
    offset: int


@router.get("/reports", response_model=PaginatedReportsResponse)
def get_expense_reports(
    search: Optional[str] = Query(None, description="Search by report number, merchant, or project"),
    status: Optional[str] = Query(None, description="Filter by status: draft, submitted, approved, rejected"),
    project_code: Optional[str] = Query(None, description="Filter by project code, e.g. ATLAS, VOXORAAI, ORION"),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve expense reports with pagination and role-based scope isolation.
    - Consultant: only own reports
    - Finance Controller: all reports
    """
    query = db.query(ExpenseReport)

    # Role-based scoping
    if current_user.role != "Finance Controller":
        query = query.filter(ExpenseReport.employee_id == current_user.employee_id)

    # Filter by status
    if status and status.lower() != "all":
        query = query.filter(ExpenseReport.status == status.lower().strip())

    # Filter by project_code
    if project_code and project_code.lower() != "all":
        proj_term = project_code.upper().strip()
        matching_proj_report_ids = (
            db.query(ExpenseLine.report_id)
            .filter(ExpenseLine.project_code == proj_term)
            .distinct()
        )
        query = query.filter(ExpenseReport.id.in_(matching_proj_report_ids))

    # Search filter
    if search:
        search_term = f"%{search.strip()}%"
        # Search by report_number or line items matching merchant / project
        matching_line_report_ids = (
            db.query(ExpenseLine.report_id)
            .filter(
                (ExpenseLine.merchant.ilike(search_term))
                | (ExpenseLine.project_code.ilike(search_term))
                | (ExpenseLine.category.ilike(search_term))
            )
            .distinct()
        )
        query = query.filter(
            (ExpenseReport.report_number.ilike(search_term))
            | (ExpenseReport.id.in_(matching_line_report_ids))
        )

    total = query.count()
    reports = query.order_by(ExpenseReport.created_at.desc()).offset(offset).limit(limit).all()

    # Pre-fetch users for name display
    user_ids = {r.employee_id for r in reports}
    users_map = {u.employee_id: u for u in db.query(User).filter(User.employee_id.in_(user_ids)).all()}

    items: List[ExpenseReportListItem] = []
    for r in reports:
        emp = users_map.get(r.employee_id)
        emp_name = emp.full_name if emp else r.employee_id
        lines = r.lines or []
        project_codes = sorted(list({line.project_code for line in lines if line.project_code}))
        has_exception = any(line.exception_flag for line in lines)

        # Find trace ID if any
        run = db.query(AgentRun).filter(
            (AgentRun.report_id == r.report_number) | (AgentRun.report_id == r.id)
        ).first()
        trace_id = run.trace_id if run else None

        if not trace_id:
            # Check pending actions
            pa = db.query(PendingAction).filter(
                PendingAction.exact_payload.like(f"%{r.report_number}%")
            ).first()
            if pa:
                trace_id = pa.trace_id

        items.append(
            ExpenseReportListItem(
                id=r.id,
                report_number=r.report_number,
                employee_id=r.employee_id,
                employee_name=emp_name,
                status=r.status,
                total_amount=r.total_amount,
                currency=r.currency,
                created_at=r.created_at,
                submitted_at=r.submitted_at,
                approved_by=r.approved_by,
                approved_at=r.approved_at,
                finance_notes=r.finance_notes,
                lines_count=len(lines),
                project_codes=project_codes,
                has_exception=has_exception,
                trace_id=trace_id,
            )
        )

    return PaginatedReportsResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/reports/{report_identifier}", response_model=ExpenseReportDetailResponse)
def get_report_detail(
    report_identifier: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full details of an expense report, including lines, submitter, and project info."""
    report = (
        db.query(ExpenseReport)
        .filter(
            (ExpenseReport.id == report_identifier)
            | (ExpenseReport.report_number == report_identifier)
        )
        .first()
    )

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense report '{report_identifier}' not found.",
        )

    # Scope check: Consultants can only view their own reports
    if current_user.role != "Finance Controller" and report.employee_id != current_user.employee_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: You can only view your own expense reports.",
        )

    employee = db.query(User).filter(User.employee_id == report.employee_id).first()

    # Find associated trace
    run = db.query(AgentRun).filter(
        (AgentRun.report_id == report.report_number) | (AgentRun.report_id == report.id)
    ).first()
    trace_id = run.trace_id if run else None

    if not trace_id:
        pa = db.query(PendingAction).filter(
            PendingAction.exact_payload.like(f"%{report.report_number}%")
        ).first()
        if pa:
            trace_id = pa.trace_id

    # Retrieve project details for the primary project in lines
    project_details: Optional[Dict[str, Any]] = None
    if report.lines:
        first_proj_code = report.lines[0].project_code
        proj = db.query(Project).filter(Project.code == first_proj_code).first()
        if proj:
            project_details = {
                "code": proj.code,
                "name": proj.name,
                "status": proj.status,
                "budget_remaining": proj.budget_remaining,
            }

    return ExpenseReportDetailResponse(
        id=report.id,
        report_number=report.report_number,
        employee_id=report.employee_id,
        employee_name=employee.full_name if employee else report.employee_id,
        employee_email=employee.email if employee else None,
        status=report.status,
        total_amount=report.total_amount,
        currency=report.currency,
        created_at=report.created_at,
        submitted_at=report.submitted_at,
        approved_by=report.approved_by,
        approved_at=report.approved_at,
        finance_notes=report.finance_notes,
        lines=report.lines,
        trace_id=trace_id,
        project_details=project_details,
    )


# =========================================================================
# Finance Persona Specific Endpoints (Ravi Menon / Finance Controller Only)
# =========================================================================

@router.get("/finance/queue", response_model=List[FinanceQueueItem])
def get_finance_approval_queue(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all reports awaiting Finance review and sign-off.
    Exclusively available for Finance Controller persona.
    """
    if current_user.role != "Finance Controller":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only Finance Controller can access the approval queue.",
        )

    # All reports in 'submitted' status awaiting sign-off
    reports = (
        db.query(ExpenseReport)
        .filter(ExpenseReport.status == "submitted")
        .order_by(ExpenseReport.submitted_at.desc())
        .all()
    )

    users = db.query(User).all()
    users_map = {u.employee_id: u for u in users}

    items: List[FinanceQueueItem] = []
    for r in reports:
        emp = users_map.get(r.employee_id)
        lines = r.lines or []
        project_codes = sorted(list({line.project_code for line in lines if line.project_code}))
        has_exception = any(line.exception_flag for line in lines)
        is_high_val = r.total_amount > 10000.0

        run = db.query(AgentRun).filter(
            (AgentRun.report_id == r.report_number) | (AgentRun.report_id == r.id)
        ).first()
        trace_id = run.trace_id if run else None

        items.append(
            FinanceQueueItem(
                id=r.id,
                report_number=r.report_number,
                employee_id=r.employee_id,
                employee_name=emp.full_name if emp else r.employee_id,
                employee_email=emp.email if emp else None,
                status=r.status,
                total_amount=r.total_amount,
                currency=r.currency,
                submitted_at=r.submitted_at,
                created_at=r.created_at,
                lines_count=len(lines),
                project_codes=project_codes,
                has_exception=has_exception,
                is_high_value=is_high_val,
                trace_id=trace_id,
            )
        )

    return items


@router.post("/reports/{report_identifier}/finance-decision", response_model=ExpenseReportDetailResponse)
def execute_finance_decision(
    report_identifier: str,
    decision_req: FinanceDecisionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Execute Finance Controller's approval or rejection decision on a submitted expense report."""
    if current_user.role != "Finance Controller":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only Finance Controller can finalize expense reimbursement decisions.",
        )

    report = (
        db.query(ExpenseReport)
        .filter(
            (ExpenseReport.id == report_identifier)
            | (ExpenseReport.report_number == report_identifier)
        )
        .first()
    )

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report '{report_identifier}' not found.",
        )

    decision_norm = decision_req.decision.lower().strip()
    if decision_norm not in ["approved", "rejected"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Decision must be either 'approved' or 'rejected'.",
        )

    report.status = decision_norm
    report.approved_by = current_user.employee_id
    report.approved_at = datetime.now(timezone.utc)
    report.finance_notes = decision_req.notes

    # If approved, deduct budget from project
    if decision_norm == "approved" and report.lines:
        first_proj_code = report.lines[0].project_code
        proj = db.query(Project).filter(Project.code == first_proj_code).first()
        if proj and proj.budget_remaining >= report.total_amount:
            proj.budget_remaining = round(proj.budget_remaining - report.total_amount, 2)

    db.commit()
    db.refresh(report)

    employee = db.query(User).filter(User.employee_id == report.employee_id).first()

    run = db.query(AgentRun).filter(
        (AgentRun.report_id == report.report_number) | (AgentRun.report_id == report.id)
    ).first()
    trace_id = run.trace_id if run else None

    project_details = None
    if report.lines:
        first_proj_code = report.lines[0].project_code
        proj = db.query(Project).filter(Project.code == first_proj_code).first()
        if proj:
            project_details = {
                "code": proj.code,
                "name": proj.name,
                "status": proj.status,
                "budget_remaining": proj.budget_remaining,
            }

    return ExpenseReportDetailResponse(
        id=report.id,
        report_number=report.report_number,
        employee_id=report.employee_id,
        employee_name=employee.full_name if employee else report.employee_id,
        employee_email=employee.email if employee else None,
        status=report.status,
        total_amount=report.total_amount,
        currency=report.currency,
        created_at=report.created_at,
        submitted_at=report.submitted_at,
        approved_by=report.approved_by,
        approved_at=report.approved_at,
        finance_notes=report.finance_notes,
        lines=report.lines,
        trace_id=trace_id,
        project_details=project_details,
    )


@router.get("/finance/analytics", response_model=FinanceAnalyticsResponse)
def get_finance_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve aggregate financial KPIs, liability metrics, and category distributions."""
    if current_user.role != "Finance Controller":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only Finance Controller can view financial analytics.",
        )

    all_reports = db.query(ExpenseReport).all()
    all_lines = db.query(ExpenseLine).all()

    total_pending = sum(r.total_amount for r in all_reports if r.status == "submitted")
    pending_cnt = sum(1 for r in all_reports if r.status == "submitted")

    total_apprv = sum(r.total_amount for r in all_reports if r.status == "approved")
    apprv_cnt = sum(1 for r in all_reports if r.status == "approved")

    total_rej = sum(r.total_amount for r in all_reports if r.status == "rejected")
    rej_cnt = sum(1 for r in all_reports if r.status == "rejected")

    exc_cnt = sum(1 for r in all_reports if any(l.exception_flag for l in r.lines))
    high_val_cnt = sum(1 for r in all_reports if r.total_amount > 10000.0)

    # Spend by category
    spend_by_cat: Dict[str, float] = {}
    for line in all_lines:
        cat = line.category or "Other"
        spend_by_cat[cat] = round(spend_by_cat.get(cat, 0.0) + (line.amount or 0.0), 2)

    # Spend by project
    spend_by_proj: Dict[str, float] = {}
    for line in all_lines:
        proj = line.project_code or "UNASSIGNED"
        spend_by_proj[proj] = round(spend_by_proj.get(proj, 0.0) + (line.amount or 0.0), 2)

    return FinanceAnalyticsResponse(
        total_pending_liability=round(total_pending, 2),
        pending_count=pending_cnt,
        total_approved_spend=round(total_apprv, 2),
        approved_count=apprv_cnt,
        total_rejected_spend=round(total_rej, 2),
        rejected_count=rej_cnt,
        exception_count=exc_cnt,
        high_value_count=high_val_cnt,
        spend_by_category=spend_by_cat,
        spend_by_project=spend_by_proj,
    )


@router.get("/receipts/{filename}")
def get_receipt_file(
    filename: str,
):
    """Securely serves uploaded expense receipt images and PDFs for review by Consultant or Finance."""
    clean_filename = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_DIR, clean_filename)

    # Fallback to sample_receipts if not yet in uploads
    if not os.path.exists(file_path):
        sample_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "sample_receipts", clean_filename)
        )
        if os.path.exists(sample_path):
            file_path = sample_path

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Receipt file not found")

    ext = os.path.splitext(clean_filename)[1].lower()
    media_type = "application/pdf" if ext == ".pdf" else f"image/{ext.replace('.', '')}"
    if media_type == "image/jpg":
        media_type = "image/jpeg"

    return FileResponse(file_path, media_type=media_type, filename=clean_filename)


