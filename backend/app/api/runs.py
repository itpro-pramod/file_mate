from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.api.auth import get_current_user
from app.database.database import get_db
from app.database.models import User
from app.database.schemas import AgentRunDetail, AgentRunSummary
from app.observability.trace_service import TraceService

router = APIRouter(prefix="/api/runs", tags=["Runs & Observability"])


@router.get("", response_model=List[AgentRunSummary])
def get_runs(
    search: Optional[str] = Query(None, description="Search trace ID or request text"),
    status: Optional[str] = Query(None, description="Filter by status"),
    module: Optional[str] = Query(None, description="Filter by module: EXPENSE_ASSISTANT or EXPENSE_INTELLIGENCE"),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve recent runs for the authenticated employee."""
    emp_id = None if current_user.role == "Finance Controller" else current_user.employee_id
    return TraceService.get_recent_runs(
        db=db,
        employee_id=emp_id,
        search=search,
        status_filter=status,
        module=module,
        limit=limit,
        offset=offset,
    )


@router.get("/{trace_id}", response_model=AgentRunDetail)
def get_run_by_trace(
    trace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full execution detail, timeline, and tool telemetry for a trace ID."""
    detail = TraceService.get_run_detail(db, trace_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Run trace {trace_id} not found.")

    if detail.employee_id != current_user.employee_id and current_user.role != "Finance Controller":
        raise HTTPException(status_code=403, detail="Unauthorized access to run trace.")

    return detail


@router.get("/{trace_id}/logs")
def get_run_logs(
    trace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export complete JSON structured log events for a trace ID."""
    detail = TraceService.get_run_detail(db, trace_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Run trace {trace_id} not found.")

    if detail.employee_id != current_user.employee_id and current_user.role != "Finance Controller":
        raise HTTPException(status_code=403, detail="Unauthorized access to run logs.")

    logs = TraceService.get_run_logs_json(db, trace_id)
    return logs
