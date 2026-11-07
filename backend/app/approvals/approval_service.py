import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.approvals.payload_integrity import verify_payload_hash
from app.approvals.pending_action_service import PendingActionService
from app.core.exceptions import (
    ActionAlreadyProcessedException,
    ActionExpiredException,
    ActionNotFoundException,
    FileMateException,
    PayloadTamperedException,
    UnauthorizedAccessException,
)
from app.database.models import AgentRun, Approval, AuditLog, ExpenseReport, PendingAction
from app.expense_api.mock_expense_api import MockExpenseAPI
from app.guardrails.argument_validation import ArgumentValidationGuardrail
from app.guardrails.owasp_llm_guardrails import telemetry_tracker
from app.guardrails.policy_validation import PolicyValidationGuardrail


class ApprovalService:
    """Enforces human-in-the-loop authorization gates and executes approved payloads."""

    @classmethod
    def approve_and_execute(
        cls,
        db: Session,
        action_id: str,
        employee_id: str,
        justification: Optional[str] = None,
    ) -> Dict[str, Any]:
        action = PendingActionService.get_action_by_id(db, action_id)

        # 1. Authorization check: Priya can only approve her own actions
        if action.employee_id != employee_id:
            raise UnauthorizedAccessException("You cannot approve pending actions belonging to another employee.")

        # 2. Status verification
        if action.status == "EXPIRED":
            raise ActionExpiredException(action_id)
        if action.status != "PENDING":
            raise ActionAlreadyProcessedException(action_id, action.status)

        # 3. Expiry verification
        now = datetime.now(timezone.utc)
        if action.expires_at:
            exp = action.expires_at if action.expires_at.tzinfo else action.expires_at.replace(tzinfo=timezone.utc)
            if exp < now:
                action.status = "EXPIRED"
                db.commit()
                raise ActionExpiredException(action_id)

        # 4. Payload integrity verification
        try:
            payload = json.loads(action.exact_payload)
        except Exception:
            raise PayloadTamperedException(action_id)

        if not verify_payload_hash(payload, action.payload_hash):
            raise PayloadTamperedException(action_id)

        # 5. Policy exception check: require justification if flagged
        effective_justification = justification or action.justification or payload.get("justification")
        if action.exception_flag and (not effective_justification or not str(effective_justification).strip()):
            raise FileMateException(
                status_code=400,
                detail=f"This expense exceeds company policy limits: {action.policy_violation_details}. A written business justification is required before it can be approved and filed.",
                code="JUSTIFICATION_REQUIRED",
            )

        if effective_justification:
            action.justification = effective_justification
            payload["justification"] = effective_justification

        # 6. Execute against Mock Expense API
        mock_api = MockExpenseAPI(db)
        execution_start = time.time()
        execution_result: Dict[str, Any] = {}

        try:
            if action.action_type in ["add_line", "add_expense_line"]:
                # Check if employee has an open draft report, or create one
                draft_report = (
                    db.query(ExpenseReport)
                    .filter(ExpenseReport.employee_id == employee_id, ExpenseReport.status == "draft")
                    .first()
                )
                if not draft_report:
                    created_draft = mock_api.create_draft_report(employee_id=employee_id)
                    report_id = created_draft["id"]
                else:
                    report_id = draft_report.id

                # Add the line
                line_res = mock_api.add_expense_line(report_id, payload)

                # Submit the report
                submit_res = mock_api.submit_report(report_id)

                execution_result = {
                    "report_id": report_id,
                    "report_number": submit_res.get("report_number"),
                    "line_id": line_res.get("id"),
                    "status": "submitted",
                    "amount": line_res.get("amount"),
                    "currency": line_res.get("currency"),
                    "message": "Expense report successfully created, line added, and submitted to Finance.",
                }

            elif action.action_type == "create_report":
                execution_result = mock_api.create_draft_report(employee_id=employee_id)

            elif action.action_type == "submit_report":
                report_id = payload.get("report_id")
                execution_result = mock_api.submit_report(report_id)

            else:
                raise FileMateException(status_code=400, detail=f"Unknown action type: {action.action_type}")

            # 7. Update action status
            action.status = "EXECUTED"
            action.approved_at = now
            action.executed_at = datetime.now(timezone.utc)
            action.execution_result = json.dumps(execution_result)

            # Record Approval
            approval_entry = Approval(
                pending_action_id=action.id,
                trace_id=action.trace_id,
                approver_employee_id=employee_id,
                decision="APPROVED",
                payload_hash_verified=True,
                notes=effective_justification,
            )
            db.add(approval_entry)
            telemetry_tracker.record("hitl_approval_gates_enforced")

            # Update AgentRun status
            agent_run = db.query(AgentRun).filter(AgentRun.trace_id == action.trace_id).first()
            if agent_run:
                agent_run.status = "Approved"
                agent_run.report_id = execution_result.get("report_number")
                agent_run.outcome_summary = f"Expense filed successfully. Report ID: {execution_result.get('report_number')}"

            # Audit log
            db.add(
                AuditLog(
                    trace_id=action.trace_id,
                    employee_id=employee_id,
                    event_type="HUMAN_APPROVAL_EXECUTED",
                    details=f"Action {action.id} approved and executed. Report ID: {execution_result.get('report_number')}",
                )
            )

            db.commit()
            db.refresh(action)
            return execution_result

        except Exception as e:
            db.rollback()
            action.status = "FAILED"
            action.execution_result = json.dumps({"error": str(e)})
            db.commit()
            raise FileMateException(
                status_code=500,
                detail=f"Execution of approved action failed: {str(e)}",
                code="EXECUTION_FAILED",
            )

    @classmethod
    def edit_and_resubmit(
        cls,
        db: Session,
        action_id: str,
        employee_id: str,
        revised_data: Dict[str, Any],
    ) -> PendingAction:
        action = PendingActionService.get_action_by_id(db, action_id)

        # 1. Authorization check
        if action.employee_id != employee_id:
            raise UnauthorizedAccessException("You cannot edit pending actions belonging to another employee.")

        if action.status != "PENDING":
            raise ActionAlreadyProcessedException(action_id, action.status)

        # 2. Invalidate previous pending action (Old action cannot be approved!)
        PendingActionService.invalidate_action(db, action_id)

        # 3. Merge payloads
        original_payload = json.loads(action.exact_payload)
        new_payload = original_payload.copy()
        for k, v in revised_data.items():
            if v is not None:
                new_payload[k] = v

        # 4. Revalidate with Guardrails
        is_valid, arg_err = ArgumentValidationGuardrail.validate_expense_line(new_payload, db)
        if not is_valid:
            raise FileMateException(
                status_code=400,
                detail=f"Revised expense details failed validation: {arg_err}",
                code="VALIDATION_FAILED",
            )

        # 5. Re-evaluate policy
        is_policy_valid, is_exception, policy_msg, exception_details = PolicyValidationGuardrail.evaluate_policy(
            new_payload, db
        )

        # 6. Create NEW Pending Action
        new_action = PendingActionService.create_pending_action(
            db=db,
            trace_id=action.trace_id,
            employee_id=employee_id,
            action_type=action.action_type,
            tool_name=action.tool_name,
            exact_payload=new_payload,
            exception_flag=is_exception,
            policy_violation_details=exception_details,
            justification=revised_data.get("justification") or original_payload.get("justification"),
        )

        # Audit log
        db.add(
            AuditLog(
                trace_id=action.trace_id,
                employee_id=employee_id,
                event_type="PENDING_ACTION_EDITED",
                details=f"Action {action_id} invalidated and replaced by {new_action.id}.",
            )
        )
        db.commit()

        return new_action

    @classmethod
    def reject_action(
        cls,
        db: Session,
        action_id: str,
        employee_id: str,
        reason: Optional[str] = "Rejected by user",
    ) -> PendingAction:
        action = PendingActionService.get_action_by_id(db, action_id)

        if action.employee_id != employee_id:
            raise UnauthorizedAccessException("You cannot reject pending actions belonging to another employee.")

        if action.status != "PENDING":
            raise ActionAlreadyProcessedException(action_id, action.status)

        rejected_action = PendingActionService.reject_action(db, action_id, employee_id, reason)

        # Record in approvals table
        approval_entry = Approval(
            pending_action_id=action.id,
            trace_id=action.trace_id,
            approver_employee_id=employee_id,
            decision="REJECTED",
            payload_hash_verified=True,
            notes=reason,
        )
        db.add(approval_entry)

        # Update AgentRun status
        agent_run = db.query(AgentRun).filter(AgentRun.trace_id == action.trace_id).first()
        if agent_run:
            agent_run.status = "Rejected"
            agent_run.outcome_summary = f"User rejected the expense proposal: {reason}"

        # Audit log
        db.add(
            AuditLog(
                trace_id=action.trace_id,
                employee_id=employee_id,
                event_type="HUMAN_APPROVAL_REJECTED",
                details=f"Action {action.id} was rejected by {employee_id}. Reason: {reason}",
            )
        )
        db.commit()
        db.refresh(rejected_action)

        return rejected_action
