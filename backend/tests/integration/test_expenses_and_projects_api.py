import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import Base, SessionLocal, engine
from app.expense_api.seed_data import seed_database


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


def test_get_expenses_reports_consultant(real_db_client, priya_token):
    headers = {"Authorization": f"Bearer {priya_token}"}
    res = real_db_client.get("/api/expenses/reports", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] >= 1
    # Check that items belong only to E1042
    for item in data["items"]:
        assert item["employee_id"] == "E1042"
        assert "lines_count" in item
        assert "project_codes" in item


def test_get_report_detail(real_db_client, priya_token):
    headers = {"Authorization": f"Bearer {priya_token}"}
    res = real_db_client.get("/api/expenses/reports/RPT-10001", headers=headers)
    assert res.status_code == 200
    report = res.json()
    assert report["report_number"] == "RPT-10001"
    assert report["employee_id"] == "E1042"
    assert len(report["lines"]) >= 1
    assert report["lines"][0]["category"] == "Meals"
    assert report["project_details"] is not None
    assert report["project_details"]["code"] == "ATLAS"


def test_get_projects_portal_option_a(real_db_client, priya_token):
    headers = {"Authorization": f"Bearer {priya_token}"}
    res = real_db_client.get("/api/projects", headers=headers)
    assert res.status_code == 200
    projects = res.json()
    assert len(projects) >= 2
    atlas = next((p for p in projects if p["code"] == "ATLAS"), None)
    orion = next((p for p in projects if p["code"] == "ORION"), None)

    assert atlas is not None
    assert atlas["status"] == "Active"
    assert atlas["initial_budget"] == 240000.0
    assert atlas["budget_remaining"] <= 240000.0
    assert atlas["total_billed"] >= 980.0
    assert len(atlas["expenses"]) >= 1

    assert orion is not None
    assert orion["status"] == "Closed"
    assert orion["initial_budget"] == 0.0
    assert "CLOSED" in orion["billing_guidelines"].upper()


def test_get_single_project(real_db_client, priya_token):
    headers = {"Authorization": f"Bearer {priya_token}"}
    res = real_db_client.get("/api/projects/ATLAS", headers=headers)
    assert res.status_code == 200
    atlas = res.json()
    assert atlas["code"] == "ATLAS"
    assert atlas["status"] == "Active"


def test_finance_approval_queue_access_control(real_db_client, priya_token, ravi_token):
    # Consultant Priya should be denied access (403)
    priya_res = real_db_client.get("/api/expenses/finance/queue", headers={"Authorization": f"Bearer {priya_token}"})
    assert priya_res.status_code == 403

    # Finance Controller Ravi should be granted access (200)
    ravi_res = real_db_client.get("/api/expenses/finance/queue", headers={"Authorization": f"Bearer {ravi_token}"})
    assert ravi_res.status_code == 200
    queue = ravi_res.json()
    assert isinstance(queue, list)


def test_finance_decision_and_analytics(real_db_client, priya_token, ravi_token):
    # Priya cannot execute finance decisions (403)
    priya_decision = real_db_client.post(
        "/api/expenses/reports/RPT-10001/finance-decision",
        json={"decision": "approved", "notes": "Approved by Priya should fail"},
        headers={"Authorization": f"Bearer {priya_token}"},
    )
    assert priya_decision.status_code == 403

    # Ravi approves RPT-10001
    ravi_decision = real_db_client.post(
        "/api/expenses/reports/RPT-10001/finance-decision",
        json={"decision": "approved", "notes": "Audited and verified receipt."},
        headers={"Authorization": f"Bearer {ravi_token}"},
    )
    assert ravi_decision.status_code == 200
    data = ravi_decision.json()
    assert data["status"] == "approved"
    assert data["approved_by"] == "E2087"
    assert data["finance_notes"] == "Audited and verified receipt."

    # Ravi queries analytics
    analytics_res = real_db_client.get("/api/expenses/finance/analytics", headers={"Authorization": f"Bearer {ravi_token}"})
    assert analytics_res.status_code == 200
    analytics = analytics_res.json()
    assert analytics["total_approved_spend"] >= 980.0
    assert "Meals" in analytics["spend_by_category"]


def test_toggle_project_status_finance_only(real_db_client, priya_token, ravi_token):
    # Consultant cannot toggle status (403)
    priya_toggle = real_db_client.post(
        "/api/projects/ORION/toggle-status",
        headers={"Authorization": f"Bearer {priya_token}"},
    )
    assert priya_toggle.status_code == 403

    # Finance Controller can toggle
    ravi_toggle = real_db_client.post(
        "/api/projects/ORION/toggle-status",
        headers={"Authorization": f"Bearer {ravi_token}"},
    )
    assert ravi_toggle.status_code == 200
    assert ravi_toggle.json()["status"] == "Active"

    # Toggle back to Closed to preserve baseline
    ravi_toggle_back = real_db_client.post(
        "/api/projects/ORION/toggle-status",
        headers={"Authorization": f"Bearer {ravi_token}"},
    )
    assert ravi_toggle_back.status_code == 200
    assert ravi_toggle_back.json()["status"] == "Closed"


def test_voxora_project_portal_and_creation(real_db_client, priya_token, ravi_token):
    # Check that seeded Project VoxoraAI is accessible
    res = real_db_client.get("/api/projects/VOXORAAI", headers={"Authorization": f"Bearer {priya_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["code"] == "VOXORAAI"
    assert "VoxoraAI" in data["name"]
    assert data["status"] == "Active"
    assert data["initial_budget"] == 500000.0
    assert data["budget_remaining"] > 0

    # Consultant cannot create project (403)
    priya_create = real_db_client.post(
        "/api/projects",
        json={"code": "TESTPROJ", "name": "Test Project", "initial_budget": 100000.0},
        headers={"Authorization": f"Bearer {priya_token}"},
    )
    assert priya_create.status_code == 403

    # Finance Controller can create a project
    ravi_create = real_db_client.post(
        "/api/projects",
        json={
            "code": "TESTPROJ",
            "name": "Test Enterprise Project",
            "initial_budget": 150000.0,
            "client": "Test Client Corp",
            "description": "Test engagement description",
        },
        headers={"Authorization": f"Bearer {ravi_token}"},
    )
    assert ravi_create.status_code == 201
    created_data = ravi_create.json()
    assert created_data["code"] == "TESTPROJ"
    assert created_data["initial_budget"] == 150000.0


