import os
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import Base, SessionLocal, engine
from app.expense_api.seed_data import seed_database


@pytest.fixture(scope="module")
def client():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="module")
def auth_headers(client):
    login_res = client.post(
        "/api/auth/login",
        json={"email": "priya.nair@brightpath.com", "password": "Admin@321"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_list_sample_receipts(client, auth_headers):
    """Verifies sample receipts endpoint lists available authentic files."""
    res = client.get("/api/chat/sample-receipts", headers=auth_headers)
    assert res.status_code == 200
    samples = res.json()
    assert len(samples) >= 4
    filenames = [s["filename"] for s in samples]
    assert "sample_uber_receipt.png" in filenames
    assert "sample_uber_receipt.pdf" in filenames
    assert "sample_hotel_lakeview.png" in filenames
    assert "sample_cafe_mocha.png" in filenames


def test_upload_receipt_image_with_project(client, auth_headers):
    """Upload an image receipt with explicit project code ATLAS."""
    sample_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "sample_receipts", "sample_uber_receipt.png"
    )
    assert os.path.exists(sample_path)

    with open(sample_path, "rb") as f:
        res = client.post(
            "/api/chat/upload",
            headers=auth_headers,
            files={"file": ("sample_uber_receipt.png", f, "image/png")},
            data={"project_code": "ATLAS", "caption": "Uber trip to BrightPath office"},
        )

    assert res.status_code == 200
    data = res.json()
    assert data["status"] in ["Pending", "Approved"]
    assert data["needs_project_selection"] is False
    assert "receipt_path" in data
    assert data["pending_action"] is not None
    assert data["pending_action"]["exact_payload"]["receipt_path"] == data["receipt_path"]


def test_upload_receipt_requiring_project_selection(client, auth_headers):
    """Upload a receipt (e.g. Cafe Mocha) without project code -> prompts user with 1-click pills."""
    sample_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "sample_receipts", "sample_cafe_mocha.png"
    )
    assert os.path.exists(sample_path)

    with open(sample_path, "rb") as f:
        res = client.post(
            "/api/chat/upload",
            headers=auth_headers,
            files={"file": ("sample_cafe_mocha.png", f, "image/png")},
        )

    assert res.status_code == 200
    data = res.json()
    assert data["needs_project_selection"] is True
    assert data["status"] == "AwaitingProject"
    assert "Cafe Mocha" in data["agent_message"]
    assert len(data["available_projects"]) >= 2
    assert "receipt_filename" in data

    # Now simulate 1-click project selection via /api/chat/confirm-scanned
    confirm_res = client.post(
        "/api/chat/confirm-scanned",
        headers=auth_headers,
        json={
            "receipt_filename": data["receipt_filename"],
            "project_code": "ATLAS",
            "merchant": data["extracted_data"]["merchant"],
            "category": data["extracted_data"]["category"],
            "amount": data["extracted_data"]["amount"],
            "currency": "INR",
            "date": data["extracted_data"]["date"],
            "notes": "Team lunch during BrightPath client visit",
        },
    )

    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["needs_project_selection"] is False
    assert confirm_data["pending_action"] is not None
    assert confirm_data["pending_action"]["exact_payload"]["project_code"] == "ATLAS"
    assert confirm_data["pending_action"]["exact_payload"]["receipt_path"] == data["receipt_filename"]


def test_serve_receipt_file(client, auth_headers):
    """Verifies that uploaded or sample receipts are served with correct media type."""
    # Test PNG retrieval
    png_res = client.get("/api/expenses/receipts/sample_uber_receipt.png", headers=auth_headers)
    assert png_res.status_code == 200
    assert "image/png" in png_res.headers.get("content-type", "")

    # Test PDF retrieval
    pdf_res = client.get("/api/expenses/receipts/sample_uber_receipt.pdf", headers=auth_headers)
    assert pdf_res.status_code == 200
    assert "application/pdf" in pdf_res.headers.get("content-type", "")
