import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.auth import get_current_user
from app.approvals.approval_service import ApprovalService
from app.approvals.pending_action_service import PendingActionService
from app.database.database import get_db
from app.database.models import PendingAction, User
from app.database.schemas import (
    ActionApprovalRequest,
    ActionEditRequest,
    ActionRejectRequest,
    PendingActionResponse,
)

router = APIRouter(prefix="/api/actions", tags=["Human Approval"])


def _to_response_model(pa: PendingAction) -> PendingActionResponse:
    return PendingActionResponse(
        id=pa.id,
        trace_id=pa.trace_id,
        employee_id=pa.employee_id,
        action_type=pa.action_type,
        tool_name=pa.tool_name,
        exact_payload=json.loads(pa.exact_payload),
        payload_hash=pa.payload_hash,
        status=pa.status,
        exception_flag=pa.exception_flag,
        policy_violation_details=pa.policy_violation_details,
        justification=pa.justification,
        rejection_reason=pa.rejection_reason,
        execution_result=json.loads(pa.execution_result) if pa.execution_result else None,
        created_at=pa.created_at,
        expires_at=pa.expires_at,
        approved_at=pa.approved_at,
        rejected_at=pa.rejected_at,
        executed_at=pa.executed_at,
    )


@router.get("/pending", response_model=List[PendingActionResponse])
def get_pending_actions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all pending actions awaiting approval for the signed-in employee."""
    actions = (
        db.query(PendingAction)
        .filter(PendingAction.employee_id == current_user.employee_id, PendingAction.status == "PENDING")
        .order_by(PendingAction.created_at.desc())
        .all()
    )
    return [_to_response_model(a) for a in actions]


@router.get("/{id}", response_model=PendingActionResponse)
def get_action(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a specific pending action."""
    action = PendingActionService.get_action_by_id(db, id)
    if action.employee_id != current_user.employee_id and current_user.role != "Finance Controller":
        raise HTTPException(status_code=403, detail="Unauthorized access to pending action.")
    return _to_response_model(action)


@router.post("/{id}/approve")
def approve_action(
    id: str,
    body: ActionApprovalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve and execute the exact stored payload against the Mock Expense API."""
    result = ApprovalService.approve_and_execute(
        db=db,
        action_id=id,
        employee_id=current_user.employee_id,
        justification=body.justification,
    )
    return {
        "status": "EXECUTED",
        "action_id": id,
        "message": "Action approved and successfully filed.",
        "execution_result": result,
    }


@router.post("/{id}/edit", response_model=PendingActionResponse)
def edit_action(
    id: str,
    body: ActionEditRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Invalidate previous action and create a revised pending action requiring fresh approval."""
    revised_dict = body.model_dump(exclude_unset=True)
    new_action = ApprovalService.edit_and_resubmit(
        db=db,
        action_id=id,
        employee_id=current_user.employee_id,
        revised_data=revised_dict,
    )
    return _to_response_model(new_action)


@router.post("/{id}/reject", response_model=PendingActionResponse)
def reject_action(
    id: str,
    body: ActionRejectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reject pending action. No write operation will be executed."""
    rejected_action = ApprovalService.reject_action(
        db=db,
        action_id=id,
        employee_id=current_user.employee_id,
        reason=body.rejection_reason,
    )
    return _to_response_model(rejected_action)
