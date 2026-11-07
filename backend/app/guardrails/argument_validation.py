from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.core.exceptions import GuardrailException
from app.database.models import ExpensePolicy, Project

# Controllable anchor date for test consistency
TEST_ANCHOR_DATE = date(2026, 10, 30)

ALLOWED_CATEGORIES = [
    "Meals",
    "Local Travel",
    "Hotel",
    "Client Entertainment",
]


def parse_date(date_str: str) -> Optional[date]:
    """Parse various date formats like 28 Oct 2026, 2026-10-28, etc."""
    if isinstance(date_str, date):
        return date_str
    if not date_str:
        return None

    cleaned = date_str.strip().replace(",", "")
    formats = [
        "%Y-%m-%d",
        "%d %b %Y",
        "%d %B %Y",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%Y/%m/%d",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    return None


class ArgumentValidationGuardrail:
    """Validates tool arguments before any action or Mock Expense API call."""

    @classmethod
    def validate_expense_line(
        cls,
        payload: Dict[str, Any],
        db: Session,
        reference_date: date = TEST_ANCHOR_DATE,
    ) -> Tuple[bool, Optional[str]]:
        # 1. Amount check
        amount_raw = payload.get("amount")
        if amount_raw is None:
            return False, "Expense amount is required."
        try:
            amount = float(amount_raw)
        except (ValueError, TypeError):
            return False, f"Invalid amount format: {amount_raw}."

        if amount <= 0:
            return False, f"Amount must be strictly greater than zero. Received: ₹{amount}."

        # 2. Currency check
        currency = str(payload.get("currency", "INR")).upper().strip()
        if currency != "INR":
            return False, f"Invalid currency '{currency}'. Brightpath Consulting policy only permits INR reimbursement."

        # 3. Date check
        date_raw = payload.get("date")
        if not date_raw:
            return False, "Receipt date is required."

        parsed = parse_date(str(date_raw))
        if not parsed:
            return False, f"Unable to parse receipt date: '{date_raw}'."

        if parsed > reference_date:
            return False, f"Receipt date '{parsed.isoformat()}' cannot be in the future (reference date: {reference_date.isoformat()})."

        sixty_days_ago = reference_date - timedelta(days=60)
        if parsed < sixty_days_ago:
            return False, f"Receipt date '{parsed.isoformat()}' is older than 60 days (policy cutoff: {sixty_days_ago.isoformat()})."

        # 4. Category check
        category = str(payload.get("category", "")).strip()
        matching_cat = next(
            (c for c in ALLOWED_CATEGORIES if c.lower() == category.lower()),
            None
        )
        if not matching_cat:
            allowed_str = ", ".join(ALLOWED_CATEGORIES)
            return False, f"Category '{category}' is not recognized. Allowed categories: {allowed_str}."

        # Update payload category to canonical title casing
        payload["category"] = matching_cat

        # 5. Project check
        project_code = str(payload.get("project_code", "")).strip().upper()
        if not project_code:
            return False, "Project code is required."

        project = db.query(Project).filter(Project.code == project_code).first()
        if not project:
            return False, f"Project '{project_code}' does not exist in company records."

        if project.status.lower() != "active":
            return False, f"Project '{project_code}' is {project.status}. Expenses cannot be charged against closed projects."

        return True, None
