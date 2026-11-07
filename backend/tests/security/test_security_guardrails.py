import pytest
from app.database.models import ExpenseReport, PendingAction


def test_unauthenticated_request_rejected(client):
    """Calling /api/chat or /api/actions without bearer token fails with 401."""
    res1 = client.post("/api/chat", json={"message": "Uber 500 INR ATLAS"})
    assert res1.status_code == 401

    res2 = client.get("/api/actions/pending")
    assert res2.status_code == 401


def test_direct_write_bypass_blocked(client, auth_headers):
    """Attempting to approve a non-existent or fabricated action ID fails with 404."""
    fake_id = "fake-non-existent-action-id-9999"
    res = client.post(f"/api/actions/{fake_id}/approve", json={}, headers={**auth_headers})
    assert res.status_code == 404


def test_tampered_payload_hash_rejected(client, auth_headers, db_session):
    """If a pending action's payload is tampered in the database, approval is blocked."""
    # 1. Create legitimate pending action
    res = client.post(
        "/api/chat",
        json={"message": "Uber trip, 1,250 INR, 28 Oct 2026, ATLAS"},
        headers={**auth_headers},
    )
    action_id = res.json()["pending_action"]["id"]

    # 2. Maliciously tamper with the stored payload in SQLite (e.g. inject higher amount 50,000)
    action = db_session.query(PendingAction).filter(PendingAction.id == action_id).first()
    action.exact_payload = '{"amount": 50000.0, "category": "Local Travel", "merchant": "Uber"}'
    db_session.commit()

    # 3. Attempting to approve the tampered action must be rejected by payload hash verification!
    app_res = client.post(f"/api/actions/{action_id}/approve", json={}, headers={**auth_headers})
    assert app_res.status_code == 400
    assert "payload hash verification failed" in app_res.json()["detail"].lower()


def test_cross_employee_trace_isolation(client, auth_headers, ravi_auth_headers):
    """Priya (E1042) cannot view Ravi's (E2087) execution traces or logs."""
    # Ravi creates a run
    ravi_chat = client.post(
        "/api/chat",
        json={"message": "Hotel Lakeview, 1 night, 6,400 INR, 29 Oct 2026, ATLAS"},
        headers={**ravi_auth_headers},
    )
    ravi_trace_id = ravi_chat.json()["trace_id"]

    # Priya attempts to access Ravi's trace
    priya_access = client.get(f"/api/runs/{ravi_trace_id}", headers={**auth_headers})
    assert priya_access.status_code == 403
    assert "Unauthorized access" in priya_access.json()["detail"]
