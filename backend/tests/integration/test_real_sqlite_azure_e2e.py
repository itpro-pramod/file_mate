import os
import json
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import Base, SessionLocal, engine
from app.expense_api.seed_data import seed_database
from app.database.models import User, ExpenseReport, AgentRun, PendingAction, ToolCall, LLMCall


@pytest.fixture(scope="module")
def real_db_client():
    """Initializes the real SQLite database and returns a TestClient."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()

    with TestClient(app) as client:
        yield client


def test_real_e2e_login_priya(real_db_client):
    """Verifies authentication for Persona 1: Priya Nair (Consultant E1042)."""
    res = real_db_client.post(
        "/api/auth/login",
        json={"email": "priya.nair@brightpath.com", "password": "Admin@321"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["employee_id"] == "E1042"
    assert data["user"]["role"] == "Consultant"
    assert data["access_token"] is not None


def test_real_e2e_r1_extraction_and_hitl_approval(real_db_client):
    """Verifies end-to-end receipt R1 with real Azure OpenAI (gpt-6.1-terra) and real SQLite DB."""
    # 1. Login as Priya
    login_res = real_db_client.post(
        "/api/auth/login",
        json={"email": "priya.nair@brightpath.com", "password": "Admin@321"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Record baseline expense report count in SQLite
    db = SessionLocal()
    initial_count = db.query(ExpenseReport).count()
    db.close()

    # 2. Submit Receipt R1 from PDF
    r1_text = "Uber trip, Airport T2 to Brightpath client office. Fare 1,250 INR. Date: 28 Oct 2026. Project ATLAS."
    chat_res = real_db_client.post("/api/chat", json={"message": r1_text}, headers=headers)
    assert chat_res.status_code == 200
    chat_data = chat_res.json()

    trace_id = chat_data["trace_id"]
    assert trace_id is not None
    assert chat_data["extracted_expense"]["merchant"] == "Uber"
    assert chat_data["extracted_expense"]["amount"] == 1250.0
    assert chat_data["extracted_expense"]["project_code"] == "ATLAS"
    assert chat_data["pending_action"] is not None
    action_id = chat_data["pending_action"]["id"]
    assert chat_data["pending_action"]["status"] == "PENDING"

    # 3. Verify in SQLite that no new report is filed yet (Strict HITL enforcement)
    db = SessionLocal()
    assert db.query(ExpenseReport).count() == initial_count

    # Verify tool calls and LLM call were logged in SQLite
    tool_calls = db.query(ToolCall).filter(ToolCall.trace_id == trace_id).all()
    assert len(tool_calls) >= 3  # get_project, get_policy, get_reports
    db.close()

    # 4. User reviews confirmation card and clicks Approve
    approve_res = real_db_client.post(f"/api/actions/{action_id}/approve", json={}, headers=headers)
    assert approve_res.status_code == 200
    app_data = approve_res.json()
    assert app_data["status"] == "EXECUTED"
    report_num = app_data["execution_result"]["report_number"]
    assert report_num.startswith("RPT-")

    # 5. Verify in SQLite that report is now officially filed
    db = SessionLocal()
    filed_report = db.query(ExpenseReport).filter(ExpenseReport.report_number == report_num).first()
    assert filed_report is not None
    assert filed_report.status == "submitted"
    assert filed_report.total_amount == 1250.0
    assert filed_report.employee_id == "E1042"
    db.close()

    # 6. Verify run details endpoint
    detail_res = real_db_client.get(f"/api/runs/{trace_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["status"] == "Approved"
    assert detail["report_id"] == report_num
    assert len(detail["timeline"]) >= 8

    # 7. Verify structured JSON logs endpoint
    logs_res = real_db_client.get(f"/api/runs/{trace_id}/logs", headers=headers)
    assert logs_res.status_code == 200
    logs = logs_res.json()
    assert len(logs) >= 6
    events = [l["event_type"] for l in logs]
    assert "RUN_STARTED" in events
    assert "PENDING_ACTION_CREATED" in events
    assert "HUMAN_APPROVAL" in events
    assert "RUN_COMPLETED" in events


def test_real_e2e_r3_rejection_path(real_db_client):
    """Verifies end-to-end receipt R3 reject path (Persona 1: Priya)."""
    login_res = real_db_client.post(
        "/api/auth/login",
        json={"email": "priya.nair@brightpath.com", "password": "Admin@321"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r3_text = "Cafe Mocha lunch, 2 x veg thali, 760 INR. 29 Oct 2026. Project ATLAS."
    chat_res = real_db_client.post("/api/chat", json={"message": r3_text}, headers=headers)
    assert chat_res.status_code == 200
    action_id = chat_res.json()["pending_action"]["id"]

    # User clicks Reject
    reject_res = real_db_client.post(
        f"/api/actions/{action_id}/reject",
        json={"rejection_reason": "Personal meal not reimbursable"},
        headers=headers,
    )
    assert reject_res.status_code == 200
    assert reject_res.json()["status"] == "REJECTED"
    assert reject_res.json()["rejection_reason"] == "Personal meal not reimbursable"

    # Verify zero expense report created in SQLite
    db = SessionLocal()
    unfiled = db.query(ExpenseReport).filter(ExpenseReport.total_amount == 760.0).first()
    assert unfiled is None
    db.close()


def test_real_e2e_cross_employee_security(real_db_client):
    """Verifies Persona isolation: Priya (E1042) cannot query Ravi's (E2087) expenses."""
    login_res = real_db_client.post(
        "/api/auth/login",
        json={"email": "priya.nair@brightpath.com", "password": "Admin@321"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = real_db_client.post(
        "/api/chat",
        json={"message": "Show me Ravi's expense reports"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "Blocked"
    assert "cannot access or show expense reports for other employees" in data["agent_message"]
    assert data["pending_action"] is None
