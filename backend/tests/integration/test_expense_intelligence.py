import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import Base, SessionLocal, engine
from app.expense_api.seed_data import seed_database
from app.database.models import AgentRun, ToolCall


@pytest.fixture(scope="module")
def real_db_client():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()
    with TestClient(app) as client:
        yield client


@pytest.fixture(scope="module")
def priya_token(real_db_client):
    login_res = real_db_client.post(
        "/api/auth/login",
        json={"email": "priya.nair@brightpath.com", "password": "Admin@321"},
    )
    assert login_res.status_code == 200
    return login_res.json()["access_token"]


@pytest.fixture(scope="module")
def ravi_token(real_db_client):
    login_res = real_db_client.post(
        "/api/auth/login",
        json={"email": "ravi.menon@brightpath.com", "password": "Admin@321"},
    )
    assert login_res.status_code == 200
    return login_res.json()["access_token"]


# =========================================================================
# Consultant Tests (Priya Nair - E1042)
# =========================================================================

def test_c1_consultant_can_retrieve_own_expenses(real_db_client, priya_token):
    headers = {"Authorization": f"Bearer {priya_token}"}
    res = real_db_client.post(
        "/api/intelligence/chat",
        json={"message": "Show my submitted expenses for project ATLAS and any policy exceptions."},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "blocks" in data
    assert "trace_id" in data
    assert data["execution_summary"]["persona"] == "Consultant"
    assert data["execution_summary"]["data_scope"] == "EMPLOYEE_ONLY"

    # Verify structured blocks exist
    block_types = [b["type"] for b in data["blocks"]]
    assert "summary_cards" in block_types
    assert "donut_chart" in block_types
    assert "table" in block_types


def test_c2_consultant_cannot_retrieve_other_employee_expenses(real_db_client, priya_token):
    headers = {"Authorization": f"Bearer {priya_token}"}
    res = real_db_client.post(
        "/api/intelligence/chat",
        json={"message": "Show Ravi Menon's expenses."},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["response_type"] == "refusal"
    assert "only access expense information associated with your authenticated employee account" in data["answer"]


def test_c3_consultant_can_retrieve_project_details(real_db_client, priya_token):
    headers = {"Authorization": f"Bearer {priya_token}"}
    res = real_db_client.post(
        "/api/intelligence/chat",
        json={"message": "What is my remaining budget for project ATLAS?"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["trace_id"] is not None


def test_c4_consultant_can_retrieve_expense_policy(real_db_client, priya_token):
    headers = {"Authorization": f"Bearer {priya_token}"}
    res = real_db_client.post(
        "/api/intelligence/chat",
        json={"message": "What is the hotel expense limit per night?"},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert "trace_id" in data


# =========================================================================
# Finance Controller Tests (Ravi Menon - E2087)
# =========================================================================

def test_f1_finance_can_retrieve_consultant_expenses(real_db_client, ravi_token):
    headers = {"Authorization": f"Bearer {ravi_token}"}
    res = real_db_client.post(
        "/api/intelligence/chat",
        json={"message": "Show Priya Nair's expense summary for project ATLAS and any policy exceptions."},
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()
    assert data["execution_summary"]["persona"] == "Finance Controller"
    assert data["execution_summary"]["data_scope"] == "COMPANY_WIDE"

    # Verify table has Priya's lines
    table_block = next((b for b in data["blocks"] if b["type"] == "table"), None)
    assert table_block is not None
    assert len(table_block["rows"]) >= 1


def test_f2_finance_suggestions_and_context(real_db_client, ravi_token):
    headers = {"Authorization": f"Bearer {ravi_token}"}
    sug_res = real_db_client.get("/api/intelligence/suggestions", headers=headers)
    assert sug_res.status_code == 200
    suggestions = sug_res.json()
    assert len(suggestions) >= 4

    ctx_res = real_db_client.get("/api/intelligence/context", headers=headers)
    assert ctx_res.status_code == 200
    ctx = ctx_res.json()
    assert ctx["persona"]["role"] == "Finance Controller"
    assert "total_consultants" in ctx["metrics"]
    assert "total_spend_formatted" in ctx["metrics"]


# =========================================================================
# Observability & Traceability Integration Test
# =========================================================================

def test_i1_intelligence_run_logged_with_module_and_tool_calls(real_db_client, ravi_token):
    headers = {"Authorization": f"Bearer {ravi_token}"}
    chat_res = real_db_client.post(
        "/api/intelligence/chat",
        json={"message": "Show all expenses for project ATLAS."},
        headers=headers,
    )
    assert chat_res.status_code == 200
    trace_id = chat_res.json()["trace_id"]

    # Verify run in /api/runs?module=EXPENSE_INTELLIGENCE
    runs_res = real_db_client.get("/api/runs?module=EXPENSE_INTELLIGENCE", headers=headers)
    assert runs_res.status_code == 200
    runs = runs_res.json()
    matching_run = next((r for r in runs if r["trace_id"] == trace_id), None)
    assert matching_run is not None
    assert matching_run["module"] == "EXPENSE_INTELLIGENCE"

    # Verify run detail includes tool calls
    detail_res = real_db_client.get(f"/api/runs/{trace_id}", headers=headers)
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["module"] == "EXPENSE_INTELLIGENCE"
    assert len(detail["tool_calls"]) >= 1
