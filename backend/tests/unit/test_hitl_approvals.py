from datetime import datetime, timedelta, timezone
import pytest
from app.approvals.approval_service import ApprovalService
from app.approvals.payload_integrity import compute_payload_hash, verify_payload_hash
from app.approvals.pending_action_service import PendingActionService
from app.core.exceptions import (
    ActionAlreadyProcessedException,
    ActionExpiredException,
    PayloadTamperedException,
    UnauthorizedAccessException,
)
from app.database.models import ExpenseReport, PendingAction


def test_payload_hash_integrity():
    payload = {"merchant": "Uber", "amount": 1250.0, "category": "Local Travel"}
    h1 = compute_payload_hash(payload)
    # Order of keys in Python dict should not alter canonical hash
    payload_reordered = {"category": "Local Travel", "merchant": "Uber", "amount": 1250.0}
    assert verify_payload_hash(payload_reordered, h1) is True

    # Tampered payload fails verification
    tampered = {"merchant": "Uber", "amount": 45000.0, "category": "Local Travel"}
    assert verify_payload_hash(tampered, h1) is False


def test_pending_action_creation(db_session):
    payload = {"merchant": "Uber", "amount": 1250.0, "category": "Local Travel", "project_code": "ATLAS", "date": "2026-10-28"}
    action = PendingActionService.create_pending_action(
        db=db_session,
        trace_id="test-trace-1",
        employee_id="E1042",
        action_type="add_line",
        tool_name="add_expense_line",
        exact_payload=payload,
    )
    assert action.id is not None
    assert action.status == "PENDING"
    assert action.payload_hash == compute_payload_hash(payload)


def test_approve_and_execute(db_session):
    payload = {"merchant": "Uber", "amount": 1250.0, "category": "Local Travel", "project_code": "ATLAS", "date": "2026-10-28"}
    action = PendingActionService.create_pending_action(
        db=db_session,
        trace_id="test-trace-approve",
        employee_id="E1042",
        action_type="add_line",
        tool_name="add_expense_line",
        exact_payload=payload,
    )

    result = ApprovalService.approve_and_execute(
        db=db_session,
        action_id=action.id,
        employee_id="E1042",
    )

    assert result["status"] == "submitted"
    assert "report_number" in result
    assert action.status == "EXECUTED"

    # Verify duplicate approval is prevented
    with pytest.raises(ActionAlreadyProcessedException):
        ApprovalService.approve_and_execute(
            db=db_session,
            action_id=action.id,
            employee_id="E1042",
        )


def test_edit_invalidates_old_action(db_session):
    payload = {"merchant": "Hotel Lakeview", "amount": 6400.0, "category": "Hotel", "project_code": "ATLAS", "date": "2026-10-29"}
    original_action = PendingActionService.create_pending_action(
        db=db_session,
        trace_id="test-trace-edit",
        employee_id="E1042",
        action_type="add_line",
        tool_name="add_expense_line",
        exact_payload=payload,
    )

    # Edit amount to 6000
    new_action = ApprovalService.edit_and_resubmit(
        db=db_session,
        action_id=original_action.id,
        employee_id="E1042",
        revised_data={"amount": 6000.0},
    )

    assert original_action.status == "INVALIDATED"
    assert new_action.status == "PENDING"
    assert new_action.id != original_action.id

    # Old action can NO LONGER be approved
    with pytest.raises(ActionAlreadyProcessedException):
        ApprovalService.approve_and_execute(
            db=db_session,
            action_id=original_action.id,
            employee_id="E1042",
        )


def test_reject_action(db_session):
    payload = {"merchant": "Cafe Mocha", "amount": 760.0, "category": "Meals", "project_code": "ATLAS", "date": "2026-10-29"}
    action = PendingActionService.create_pending_action(
        db=db_session,
        trace_id="test-trace-reject",
        employee_id="E1042",
        action_type="add_line",
        tool_name="add_expense_line",
        exact_payload=payload,
    )

    rejected = ApprovalService.reject_action(
        db=db_session,
        action_id=action.id,
        employee_id="E1042",
        reason="Wrong project selected",
    )

    assert rejected.status == "REJECTED"
    assert rejected.rejection_reason == "Wrong project selected"

    # Rejected action cannot be approved
    with pytest.raises(ActionAlreadyProcessedException):
        ApprovalService.approve_and_execute(
            db=db_session,
            action_id=action.id,
            employee_id="E1042",
        )


def test_cross_employee_approval_blocked(db_session):
    payload = {"merchant": "Uber", "amount": 500.0, "category": "Local Travel", "project_code": "ATLAS", "date": "2026-10-28"}
    action = PendingActionService.create_pending_action(
        db=db_session,
        trace_id="test-trace-cross",
        employee_id="E1042",  # Belongs to Priya
        action_type="add_line",
        tool_name="add_expense_line",
        exact_payload=payload,
    )

    # Ravi attempts to approve Priya's action
    with pytest.raises(UnauthorizedAccessException):
        ApprovalService.approve_and_execute(
            db=db_session,
            action_id=action.id,
            employee_id="E2087",  # Ravi
        )


def test_expired_action_cannot_be_approved(db_session):
    payload = {"merchant": "Uber", "amount": 500.0, "category": "Local Travel", "project_code": "ATLAS", "date": "2026-10-28"}
    action = PendingActionService.create_pending_action(
        db=db_session,
        trace_id="test-trace-expired",
        employee_id="E1042",
        action_type="add_line",
        tool_name="add_expense_line",
        exact_payload=payload,
        expiry_minutes=-1,  # Already expired in past
    )

    with pytest.raises(ActionExpiredException):
        ApprovalService.approve_and_execute(
            db=db_session,
            action_id=action.id,
            employee_id="E1042",
        )
