import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.approvals.payload_integrity import compute_payload_hash
from app.core.config import settings
from app.core.exceptions import (
    ActionAlreadyProcessedException,
    ActionExpiredException,
    ActionNotFoundException,
)
from app.database.models import PendingAction


class PendingActionService:
    """Manages the lifecycle of pending write operations awaiting human approval."""

    @staticmethod
    def create_pending_action(
        db: Session,
        trace_id: str,
        employee_id: str,
        action_type: str,
        tool_name: str,
        exact_payload: Dict[str, Any],
        exception_flag: bool = False,
        policy_violation_details: Optional[str] = None,
        justification: Optional[str] = None,
        expiry_minutes: Optional[int] = None,
    ) -> PendingAction:
        payload_hash = compute_payload_hash(exact_payload)
        now = datetime.now(timezone.utc)
        exp_minutes = expiry_minutes or settings.PENDING_ACTION_EXPIRY_MINUTES
        expires_at = now + timedelta(minutes=exp_minutes)

        action = PendingAction(
            trace_id=trace_id,
            employee_id=employee_id,
            action_type=action_type,
            tool_name=tool_name,
            exact_payload=json.dumps(exact_payload),
            payload_hash=payload_hash,
            status="PENDING",
            exception_flag=exception_flag,
            policy_violation_details=policy_violation_details,
            justification=justification,
            created_at=now,
            expires_at=expires_at,
        )
        db.add(action)
        db.commit()
        db.refresh(action)
        return action

    @staticmethod
    def get_action_by_id(db: Session, action_id: str) -> PendingAction:
        action = db.query(PendingAction).filter(PendingAction.id == action_id).first()
        if not action:
            raise ActionNotFoundException(action_id)

        # Check expiry
        now = datetime.now(timezone.utc)
        if action.status == "PENDING" and action.expires_at:
            exp = action.expires_at if action.expires_at.tzinfo else action.expires_at.replace(tzinfo=timezone.utc)
            if exp < now:
                action.status = "EXPIRED"
                db.commit()

        return action

    @staticmethod
    def invalidate_action(db: Session, action_id: str) -> PendingAction:
        action = PendingActionService.get_action_by_id(db, action_id)
        if action.status not in ["PENDING"]:
            raise ActionAlreadyProcessedException(action_id, action.status)

        action.status = "INVALIDATED"
        db.commit()
        db.refresh(action)
        return action

    @staticmethod
    def reject_action(
        db: Session,
        action_id: str,
        employee_id: str,
        reason: Optional[str] = "Rejected by user",
    ) -> PendingAction:
        action = PendingActionService.get_action_by_id(db, action_id)
        if action.status != "PENDING":
            raise ActionAlreadyProcessedException(action_id, action.status)

        action.status = "REJECTED"
        action.rejection_reason = reason
        action.rejected_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(action)
        return action
