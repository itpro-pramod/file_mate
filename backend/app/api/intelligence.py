import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.api.auth import get_current_user
from app.database.database import get_db
from app.database.models import (
    ExpenseLine,
    ExpenseReport,
    IntelligenceConversation,
    IntelligenceFeedback,
    IntelligenceMessage,
    Project,
    User,
)
from app.intelligence.agent import ExpenseIntelligenceAgent
from app.llm.factory import LLMProviderFactory

router = APIRouter(prefix="/api/intelligence", tags=["Expense Intelligence"])


class ChatQueryRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    trace_id: Optional[str] = None


class FeedbackRequest(BaseModel):
    message_id: str
    trace_id: str
    rating: str  # "thumbs_up" or "thumbs_down"
    comment: Optional[str] = None


@router.post("/chat")
async def process_intelligence_chat(
    req: ChatQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Processes natural language intelligence query and returns full structured response blocks."""
    llm_provider = LLMProviderFactory.get_provider(db=db)
    agent = ExpenseIntelligenceAgent(db=db, llm_provider=llm_provider)

    res = await agent.execute_query(
        query_text=req.message,
        current_user=current_user,
        conversation_id=req.conversation_id,
        trace_id=req.trace_id,
    )

    # If conversation_id is provided, persist messages
    if req.conversation_id:
        conv = (
            db.query(IntelligenceConversation)
            .filter(
                IntelligenceConversation.id == req.conversation_id,
                IntelligenceConversation.user_id == current_user.id,
            )
            .first()
        )
        if conv:
            # User message
            user_msg = IntelligenceMessage(
                conversation_id=conv.id,
                sender="user",
                content=req.message,
                trace_id=res.get("trace_id"),
            )
            db.add(user_msg)

            # Assistant message
            asst_msg = IntelligenceMessage(
                conversation_id=conv.id,
                sender="assistant",
                content=res.get("answer", ""),
                response_type=res.get("response_type"),
                blocks_json=json.dumps(res.get("blocks", [])),
                trace_id=res.get("trace_id"),
                follow_ups_json=json.dumps(res.get("follow_up_questions", [])),
                execution_summary_json=json.dumps(res.get("execution_summary", {})),
            )
            db.add(asst_msg)
            conv.updated_at = datetime.now(timezone.utc)
            db.commit()

    return res


@router.post("/chat/stream")
async def stream_intelligence_chat(
    req: ChatQueryRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Streams live execution stage events and structured results via Server-Sent Events (SSE)."""
    llm_provider = LLMProviderFactory.get_provider(db=db)
    agent = ExpenseIntelligenceAgent(db=db, llm_provider=llm_provider)

    async def event_generator():
        async for event in agent.execute_query_stream(
            query_text=req.message,
            current_user=current_user,
            conversation_id=req.conversation_id,
            trace_id=req.trace_id,
        ):
            event_name = event.get("event", "message")
            event_data = json.dumps(event.get("data", {}))
            yield f"event: {event_name}\ndata: {event_data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/suggestions")
def get_persona_suggestions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve clickable prompt suggestions dynamically populated from actual SQLite expenses, policies, and projects."""
    if current_user.role == "Finance Controller":
        # Check actual consultants who submitted expenses
        consultant_users = (
            db.query(User)
            .filter(User.role == "Consultant")
            .order_by(User.full_name.asc())
            .all()
        )
        sample_name = consultant_users[0].full_name if consultant_users else "Priya Nair"

        # Check active projects
        active_project = db.query(Project).filter(Project.status == "Active").first()
        proj_code = active_project.code if active_project else "ATLAS"

        # Check if any exceptions exist
        has_exceptions = (
            db.query(ExpenseLine).filter(ExpenseLine.exception_flag == True).first()
            is not None
        )

        return [
            {
                "label": f"Show {sample_name}'s expenses",
                "prompt": f"Show {sample_name}'s submitted expenses for project {proj_code} and any policy exceptions.",
                "icon": "user",
                "category": "Submitted Expenses",
                "description": f"View detailed line items and exceptions submitted by {sample_name}.",
            },
            {
                "label": f"Summarize expenses for project {proj_code}",
                "prompt": f"Summarize expenses and budget utilization for project {proj_code}.",
                "icon": "layers",
                "category": "Project Details",
                "description": f"Analyze spend, burn rate, and remaining budget for project {proj_code}.",
            },
            {
                "label": "Company expense policies & limits",
                "prompt": "What are the company expense policies and reimbursement limits?",
                "icon": "file",
                "category": "Policies",
                "description": "Review maximum limits for Hotel, Meals, and Local Travel.",
            },
            {
                "label": "Find policy exceptions this month",
                "prompt": "Find all policy exceptions and out-of-policy claims this month.",
                "icon": "alert",
                "category": "Exceptions",
                "description": "Inspect flagged line items requiring policy review.",
            },
            {
                "label": "Review pending expense reports",
                "prompt": "Show all pending expense reports awaiting finance sign-off.",
                "icon": "clock",
                "category": "Submitted Expenses",
                "description": "List all submitted expense reports awaiting finance approval.",
            },
            {
                "label": "Compare project spending",
                "prompt": "Compare spending and budget utilization across ATLAS and ORION.",
                "icon": "layers",
                "category": "Project Details",
                "description": "Side-by-side budget and expenditure comparison.",
            },
        ]
    else:
        # Consultant Persona: Query current user's actual database submissions
        emp_id = current_user.employee_id

        # Projects user has submitted expenses for
        user_lines = (
            db.query(ExpenseLine)
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(ExpenseReport.employee_id == emp_id)
            .all()
        )
        proj_codes = list({line.project_code for line in user_lines if line.project_code})
        top_proj = proj_codes[0] if proj_codes else "ATLAS"

        # Check if user has an exception line item
        user_exception = next((l for l in user_lines if l.exception_flag), None)
        exc_merchant = user_exception.merchant if user_exception else "Hotel Lakeview"

        return [
            {
                "label": f"Show my {top_proj} submitted expenses",
                "prompt": f"Show my submitted expense summary for project {top_proj} and any policy exceptions.",
                "icon": "user",
                "category": "Submitted Expenses",
                "description": f"Overview of your submitted expenses and line items under project {top_proj}.",
            },
            {
                "label": "Which of my reports are pending?",
                "prompt": "Which of my submitted expense reports are currently pending approval?",
                "icon": "clock",
                "category": "Submitted Expenses",
                "description": "Track the approval status of your recent submissions.",
            },
            {
                "label": f"Remaining budget for {top_proj}",
                "prompt": f"What is the remaining budget for project {top_proj}?",
                "icon": "layers",
                "category": "Project Details",
                "description": f"Check available budget and spending allocation for project {top_proj}.",
            },
            {
                "label": "What are my expense limits?",
                "prompt": "What is my hotel expense limit and travel policy?",
                "icon": "file",
                "category": "Policies",
                "description": "Check per-night hotel caps and meal allowance guidelines.",
            },
            {
                "label": f"Why was {exc_merchant} flagged?",
                "prompt": f"Why was my {exc_merchant} expense flagged as a policy exception?",
                "icon": "alert",
                "category": "Exceptions",
                "description": "Understand the policy justification and approval checklist.",
            },
            {
                "label": "Summarize my spending by category",
                "prompt": "Summarize my expenses for October 2026 by category.",
                "icon": "layers",
                "category": "Submitted Expenses",
                "description": "Category breakdown across hotel, local travel, and meals.",
            },
        ]


@router.get("/context")
def get_intelligence_context(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve dynamic right-side context panel data (Persona badge, Data at a glance, Quick actions)."""
    is_finance = current_user.role == "Finance Controller"

    total_consultants = db.query(User).filter(User.role == "Consultant").count()
    active_projects = db.query(Project).filter(Project.status == "Active").count()

    if is_finance:
        total_reports = db.query(ExpenseReport).count()
        total_spend = db.query(func.sum(ExpenseLine.amount)).scalar() or 0.0
        policy_exceptions = (
            db.query(ExpenseLine).filter(ExpenseLine.exception_flag == True).count()
        )
        quick_actions = [
            {"label": "Consultant Expense Summary", "prompt": "Show a summary of expenses grouped by consultant."},
            {"label": "Project Spend Analysis", "prompt": "Compare spending and budget utilization across ATLAS and ORION."},
            {"label": "Policy & Limits", "prompt": "Explain company expense limits for Hotel, Meals, and Local Travel."},
            {"label": "Exception Reports", "prompt": "Find all expenses flagged with policy exceptions."},
            {"label": "Top Spending Categories", "prompt": "Which expense categories have the highest spend this month?"},
        ]
        explanation = "You can view and analyze expenses for all consultants, projects, and policies."
    else:
        emp_id = current_user.employee_id
        total_reports = (
            db.query(ExpenseReport).filter(ExpenseReport.employee_id == emp_id).count()
        )
        total_spend = (
            db.query(func.sum(ExpenseLine.amount))
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(ExpenseReport.employee_id == emp_id)
            .scalar()
            or 0.0
        )
        policy_exceptions = (
            db.query(ExpenseLine)
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(ExpenseReport.employee_id == emp_id, ExpenseLine.exception_flag == True)
            .count()
        )
        quick_actions = [
            {"label": "My Expense Summary", "prompt": "Show my total expenses and category breakdown this month."},
            {"label": "My Project Spending", "prompt": "How much have I billed to project ATLAS?"},
            {"label": "My Expense Policy", "prompt": "What is the maximum reimbursable amount for local travel and hotel?"},
            {"label": "My Pending Expenses", "prompt": "Show all my expense reports awaiting finance sign-off."},
            {"label": "My Expense History", "prompt": "Show my full submission history and approval status."},
        ]
        explanation = "You can view and analyze your own expenses, assigned projects, and policies."

    return {
        "persona": {
            "name": current_user.full_name,
            "employee_id": current_user.employee_id,
            "role": current_user.role,
            "explanation": explanation,
        },
        "metrics": {
            "total_consultants": total_consultants,
            "active_projects": active_projects,
            "total_reports": total_reports,
            "total_spend_formatted": f"₹{total_spend:,.2f}".replace(".00", ""),
            "total_spend_raw": round(total_spend, 2),
            "policy_exceptions": policy_exceptions,
        },
        "quick_actions": quick_actions,
    }


@router.get("/conversations")
def get_user_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all conversations for authenticated user."""
    convs = (
        db.query(IntelligenceConversation)
        .filter(IntelligenceConversation.user_id == current_user.id)
        .order_by(IntelligenceConversation.updated_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "title": c.title,
            "persona": c.persona,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
            "message_count": len(c.messages),
        }
        for c in convs
    ]


@router.post("/conversations")
def create_conversation(
    title: Optional[str] = Query("New Conversation"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a fresh intelligence conversation session."""
    conv = IntelligenceConversation(
        user_id=current_user.id,
        employee_id=current_user.employee_id,
        persona=current_user.role,
        title=title or "New Conversation",
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"id": conv.id, "title": conv.title, "persona": conv.persona}


@router.get("/conversations/{conversation_id}")
def get_conversation_history(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full message history for a conversation."""
    conv = (
        db.query(IntelligenceConversation)
        .filter(
            IntelligenceConversation.id == conversation_id,
            IntelligenceConversation.user_id == current_user.id,
        )
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    msgs = (
        db.query(IntelligenceMessage)
        .filter(IntelligenceMessage.conversation_id == conv.id)
        .order_by(IntelligenceMessage.created_at.asc())
        .all()
    )

    result = []
    for m in msgs:
        blocks = []
        if m.blocks_json:
            try:
                blocks = json.loads(m.blocks_json)
            except Exception:
                blocks = []

        follow_ups = []
        if m.follow_ups_json:
            try:
                follow_ups = json.loads(m.follow_ups_json)
            except Exception:
                follow_ups = []

        exec_summary = {}
        if m.execution_summary_json:
            try:
                exec_summary = json.loads(m.execution_summary_json)
            except Exception:
                exec_summary = {}

        result.append(
            {
                "id": m.id,
                "sender": m.sender,
                "content": m.content,
                "response_type": m.response_type,
                "blocks": blocks,
                "trace_id": m.trace_id,
                "follow_up_questions": follow_ups,
                "execution_summary": exec_summary,
                "created_at": m.created_at.isoformat(),
            }
        )

    return {"conversation": {"id": conv.id, "title": conv.title}, "messages": result}


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes an intelligence conversation."""
    conv = (
        db.query(IntelligenceConversation)
        .filter(
            IntelligenceConversation.id == conversation_id,
            IntelligenceConversation.user_id == current_user.id,
        )
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    db.delete(conv)
    db.commit()
    return {"status": "deleted", "id": conversation_id}


@router.post("/feedback")
def submit_response_feedback(
    fb: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record user thumbs up/down feedback."""
    feedback = IntelligenceFeedback(
        message_id=fb.message_id,
        trace_id=fb.trace_id,
        employee_id=current_user.employee_id,
        rating=fb.rating,
        comment=fb.comment,
    )
    db.add(feedback)
    db.commit()
    return {"status": "recorded"}
