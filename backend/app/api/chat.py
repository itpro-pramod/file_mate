import json
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from app.agents.expense_agent import ExpenseAgentRunner
from app.api.auth import get_current_user
from app.database.database import get_db
from app.database.models import Project, User
from app.database.schemas import ChatRequest, ChatResponse, ConfirmScannedReceiptRequest
from app.llm.factory import LLMProviderFactory
from app.observability.trace_service import TraceService
from app.services.receipt_parser import extract_text_from_receipt, parse_receipt_to_expense_dict, save_upload

router = APIRouter(prefix="/api/chat", tags=["Agent Chat"])


@router.post("/upload")
async def upload_receipt(
    file: UploadFile = File(...),
    project_code: Optional[str] = Form(None),
    caption: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Handles receipt file upload (PDF, PNG, JPG), runs OCR extraction, and processes through LangGraph."""
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty receipt file uploaded.")

    # 1. Save to local backend/uploads/receipts folder
    abs_path, stored_filename = save_upload(file_bytes, file.filename or "receipt.png")

    # 2. Run OCR extraction (RapidOCR / pypdf)
    ocr_text = extract_text_from_receipt(abs_path)
    if not ocr_text:
        ocr_text = f"Receipt file {file.filename} uploaded."

    # 3. Parse into structured candidate fields
    parsed = parse_receipt_to_expense_dict(
        raw_text=ocr_text,
        project_hint=project_code or caption,
        receipt_filename=stored_filename,
    )

    # 4. Check if project is identified
    active_projects = [
        {"code": p.code, "name": p.name}
        for p in db.query(Project).filter(Project.status == "Active").all()
    ]

    effective_project = parsed.get("project_code")
    detected_amount = float(parsed.get("amount", 0.0) or 0.0)

    # If project was NOT provided/found OR amount could not be detected, prompt user via disambiguation!
    if not effective_project or detected_amount <= 0.0:
        if detected_amount <= 0.0:
            msg = f"Scanned your {parsed['merchant']} receipt ({parsed['category']}), but could not reliably detect the total amount. Please verify the amount and select a project below."
        else:
            msg = f"Scanned your {parsed['merchant']} receipt for ₹{detected_amount:,.2f} ({parsed['category']}). Which project should this be billed to?"
        return {
            "status": "AwaitingProject",
            "needs_project_selection": True,
            "agent_message": msg,
            "extracted_data": parsed,
            "receipt_filename": stored_filename,
            "receipt_path": stored_filename,
            "available_projects": active_projects,
            "trace_id": "ocr-" + stored_filename[:8],
        }

    # 5. Project & amount are known! Formulate input and run through full LangGraph pipeline
    request_text = (
        f"{parsed['merchant']} {parsed['category']}.\n"
        f"Amount: {detected_amount} {parsed['currency']}.\n"
        f"Date: {parsed['date']}.\n"
        f"Project {effective_project}.\n"
        f"Receipt: {stored_filename}."
    )
    if caption:
        request_text += f"\nNotes: {caption}"

    llm_provider = LLMProviderFactory.get_provider(db=db)
    runner = ExpenseAgentRunner(db=db, llm_provider=llm_provider)

    res = await runner.run(
        request_text=request_text,
        employee_id=current_user.employee_id,
    )

    # Attach receipt_path to pending action if created
    if res.pending_action:
        from app.approvals.pending_action_service import PendingActionService
        pa = PendingActionService.get_action_by_id(db, res.pending_action.id)
        exact = json.loads(pa.exact_payload)
        exact["receipt_path"] = stored_filename
        pa.exact_payload = json.dumps(exact)
        db.commit()
        res.pending_action.exact_payload["receipt_path"] = stored_filename

    res_dict = res.model_dump()
    res_dict["receipt_filename"] = stored_filename
    res_dict["receipt_path"] = stored_filename
    res_dict["needs_project_selection"] = False
    return res_dict


@router.post("/confirm-scanned")
async def confirm_scanned_receipt(
    req: ConfirmScannedReceiptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assigns chosen project to a previously scanned receipt and runs through the LangGraph pipeline."""
    if req.amount <= 0.0:
        raise HTTPException(
            status_code=400,
            detail="Amount must be strictly greater than zero. Please provide a valid expense amount.",
        )

    request_text = (
        f"{req.merchant} {req.category}.\n"
        f"Amount: {req.amount} {req.currency}.\n"
        f"Date: {req.date}.\n"
        f"Project {req.project_code}.\n"
        f"Receipt: {req.receipt_filename}."
    )
    if req.notes:
        request_text += f"\nNotes: {req.notes}"

    llm_provider = LLMProviderFactory.get_provider(db=db)
    runner = ExpenseAgentRunner(db=db, llm_provider=llm_provider)

    res = await runner.run(
        request_text=request_text,
        employee_id=current_user.employee_id,
    )

    if res.pending_action:
        from app.approvals.pending_action_service import PendingActionService
        pa = PendingActionService.get_action_by_id(db, res.pending_action.id)
        exact = json.loads(pa.exact_payload)
        exact["receipt_path"] = req.receipt_filename
        pa.exact_payload = json.dumps(exact)
        db.commit()
        res.pending_action.exact_payload["receipt_path"] = req.receipt_filename

    res_dict = res.model_dump()
    res_dict["receipt_filename"] = req.receipt_filename
    res_dict["receipt_path"] = req.receipt_filename
    res_dict["needs_project_selection"] = False
    return res_dict


@router.get("/sample-receipts")
def list_sample_receipts():
    """Returns curated authentic sample receipts stored in backend/sample_receipts/ for quick testing."""
    return [
        {
            "id": "sample_uber_receipt.png",
            "name": "Uber Trip (Local Travel)",
            "filename": "sample_uber_receipt.png",
            "format": "PNG",
            "category": "Local Travel",
            "amount": 1250.0,
            "currency": "INR",
            "project_hint": "ATLAS",
            "description": "Airport T2 to Brightpath client office (₹1,250.00)",
        },
        {
            "id": "sample_uber_receipt.pdf",
            "name": "Uber Ride Invoice (PDF)",
            "filename": "sample_uber_receipt.pdf",
            "format": "PDF",
            "category": "Local Travel",
            "amount": 1250.0,
            "currency": "INR",
            "project_hint": "ATLAS",
            "description": "Standard official PDF ride receipt (₹1,250.00)",
        },
        {
            "id": "sample_hotel_lakeview.png",
            "name": "Hotel Lakeview (Lodging)",
            "filename": "sample_hotel_lakeview.png",
            "format": "PNG",
            "category": "Hotel",
            "amount": 6400.0,
            "currency": "INR",
            "project_hint": "ATLAS",
            "description": "Standard business lodging 1 night (₹6,400.00)",
        },
        {
            "id": "sample_cafe_mocha.png",
            "name": "Cafe Mocha (Meals - No Project)",
            "filename": "sample_cafe_mocha.png",
            "format": "PNG",
            "category": "Meals",
            "amount": 760.0,
            "currency": "INR",
            "project_hint": "Needs Project Selection",
            "description": "2x Veg Thali client lunch. Triggers project selection! (₹760.00)",
        },
        {
            "id": "sample_voxora_workshop.png",
            "name": "Voxora AI Workshop (Client Entertainment)",
            "filename": "sample_voxora_workshop.png",
            "format": "PNG",
            "category": "Client Entertainment",
            "amount": 4250.0,
            "currency": "INR",
            "project_hint": "VOXORAAI",
            "description": "Enterprise GenAI Workshop Catering & Facility (₹4,250.00)",
        },
    ]


@router.post("", response_model=ChatResponse)
async def process_chat(
    req: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Primary chat endpoint: receives receipt text, runs agent, returns extraction and confirmation card."""
    # Ensure employee ID always comes from the authenticated session!
    employee_id = current_user.employee_id

    # Input guardrail check before any LLM execution
    from app.guardrails.input_validation import InputValidationGuardrail
    InputValidationGuardrail.validate(req.message, employee_id)

    llm_provider = LLMProviderFactory.get_provider(db=db)
    runner = ExpenseAgentRunner(db=db, llm_provider=llm_provider)

    try:
        response = await runner.run(
            request_text=req.message,
            employee_id=employee_id,
            trace_id=req.trace_id,
        )
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent processing error: {str(e)}",
        )


@router.get("/{trace_id}", response_model=ChatResponse)
def get_chat_trace(
    trace_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve chat execution trace details."""
    run_detail = TraceService.get_run_detail(db, trace_id)
    if not run_detail:
        raise HTTPException(status_code=404, detail="Trace ID not found.")

    if run_detail.employee_id != current_user.employee_id and current_user.role != "Finance Controller":
        raise HTTPException(status_code=403, detail="Unauthorized access to run trace.")

    # Convert to ChatResponse
    pending_action = run_detail.pending_actions[0] if run_detail.pending_actions else None
    extracted = run_detail.extracted_data

    return ChatResponse(
        trace_id=run_detail.trace_id,
        agent_message=run_detail.outcome_summary or "",
        extracted_expense=extracted,
        pending_action=pending_action,
        policy_status="compliant" if run_detail.status == "Approved" else "none",
        status=run_detail.status,
        thought_time_seconds=round((run_detail.latency_ms or 0) / 1000.0, 1),
        report_id=run_detail.report_id,
    )
