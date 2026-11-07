import json
import time
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.agents.graph import ExpenseAgentWorkflow
from app.agents.state import AgentState
from app.approvals.pending_action_service import PendingActionService
from app.database.models import AgentRun, AuditLog
from app.database.schemas import ChatResponse, ExpenseExtraction, PendingActionResponse
from app.llm.base import BaseLLMProvider


class ExpenseAgentRunner:
    """Executes the agent workflow, records runs, and guarantees HITL compliance."""

    def __init__(self, db: Session, llm_provider: BaseLLMProvider):
        self.db = db
        self.llm = llm_provider

    async def run(
        self,
        request_text: str,
        employee_id: str,
        trace_id: Optional[str] = None,
    ) -> ChatResponse:
        t0 = time.time()
        tid = trace_id or str(uuid.uuid4())
        start_time = datetime.now(timezone.utc)

        # Initialize AgentRun record in database
        agent_run = AgentRun(
            trace_id=tid,
            employee_id=employee_id,
            request_text=request_text,
            status="Pending",
            start_time=start_time,
            created_at=start_time,
        )
        self.db.add(agent_run)
        self.db.commit()

        # Audit log for run initiation
        self.db.add(
            AuditLog(
                trace_id=tid,
                employee_id=employee_id,
                event_type="AGENT_RUN_INITIATED",
                details=f"User request received: {request_text[:120]}",
            )
        )
        self.db.commit()

        # Build and execute LangGraph state machine
        workflow = ExpenseAgentWorkflow(self.db, self.llm)
        graph = workflow.build_graph()

        initial_state = AgentState(
            trace_id=tid,
            employee_id=employee_id,
            request_text=request_text,
        )

        final_state = await graph.ainvoke(initial_state)
        # Ensure we have AgentState object
        if isinstance(final_state, dict):
            final_state = AgentState(**final_state)

        total_latency_ms = int((time.time() - t0) * 1000)
        thought_time_sec = round(total_latency_ms / 1000.0, 1)

        # Retrieve pending action if created
        pending_action_model: Optional[PendingActionResponse] = None
        if final_state.pending_action_id:
            pa = PendingActionService.get_action_by_id(self.db, final_state.pending_action_id)
            pending_action_model = PendingActionResponse(
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

        # Determine run status
        run_status = final_state.status
        if final_state.pending_action_id:
            run_status = "Pending"
        elif final_state.intent in ["out_of_scope"]:
            run_status = "Out of Scope"
        elif final_state.intent in ["blocked"]:
            run_status = "Blocked"
        elif not final_state.is_valid:
            run_status = "Guardrail" if "Guardrail" in [s.get("title", "") for s in final_state.timeline_steps] else "Failed"

        # Update AgentRun in database
        agent_run.status = run_status
        agent_run.end_time = datetime.now(timezone.utc)
        agent_run.latency_ms = total_latency_ms
        agent_run.prompt_tokens = final_state.prompt_tokens
        agent_run.completion_tokens = final_state.completion_tokens
        agent_run.total_tokens = final_state.total_tokens or (400 if final_state.extracted_expense else 0)
        agent_run.outcome_summary = final_state.final_agent_response[:200]
        if final_state.extracted_expense:
            agent_run.extracted_data = json.dumps(final_state.extracted_expense)

        self.db.commit()

        # Policy status
        policy_status = "none"
        if final_state.extracted_expense:
            if final_state.is_exception:
                policy_status = "exception"
            elif final_state.is_policy_compliant:
                policy_status = "compliant"
            else:
                policy_status = "violation"

        extracted_obj = None
        if final_state.extracted_expense:
            extracted_obj = ExpenseExtraction(**final_state.extracted_expense)

        return ChatResponse(
            trace_id=tid,
            agent_message=final_state.final_agent_response,
            extracted_expense=extracted_obj,
            pending_action=pending_action_model,
            policy_status=policy_status,
            policy_message=final_state.policy_message,
            duplicate_warning=final_state.duplicate_warning,
            status=run_status,
            thought_time_seconds=thought_time_sec,
            report_id=agent_run.report_id,
        )
