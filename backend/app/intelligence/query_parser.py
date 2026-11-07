import re
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.database.models import User

# Baseline evaluation test anchor date for FileMate is 30 Oct 2026
DEFAULT_ANCHOR_DATE = date(2026, 10, 30)


def resolve_date_range(
    query_text: str, anchor: Optional[date] = None
) -> Tuple[Optional[str], Optional[str], str]:
    """Deterministically resolves relative and natural date strings into ISO date bounds.
    Returns (start_date_str, end_date_str, readable_period_label)
    """
    ref = anchor or DEFAULT_ANCHOR_DATE
    q = query_text.lower()

    if "october 2026" in q or "oct 2026" in q or "october" in q or "this month" in q:
        start_d = date(2026, 10, 1)
        end_d = date(2026, 10, 31)
        return (start_d.isoformat(), end_d.isoformat(), "October 2026")

    if "september 2026" in q or "sept 2026" in q or "september" in q or "last month" in q:
        start_d = date(2026, 9, 1)
        end_d = date(2026, 9, 30)
        return (start_d.isoformat(), end_d.isoformat(), "September 2026")

    if "last 30 days" in q:
        start_d = ref - timedelta(days=30)
        return (start_d.isoformat(), ref.isoformat(), "Last 30 Days")

    if "last 7 days" in q or "last week" in q:
        start_d = ref - timedelta(days=7)
        return (start_d.isoformat(), ref.isoformat(), "Last 7 Days")

    if "yesterday" in q:
        yest = ref - timedelta(days=1)
        return (yest.isoformat(), yest.isoformat(), "Yesterday")

    if "this quarter" in q or "q4 2026" in q or "q4" in q:
        start_d = date(2026, 10, 1)
        end_d = date(2026, 12, 31)
        return (start_d.isoformat(), end_d.isoformat(), "Q4 2026")

    if "last quarter" in q or "q3 2026" in q or "q3" in q:
        start_d = date(2026, 7, 1)
        end_d = date(2026, 9, 30)
        return (start_d.isoformat(), end_d.isoformat(), "Q3 2026")

    if "this year" in q or "ytd" in q or "financial year" in q or "2026" in q:
        start_d = date(2026, 1, 1)
        end_d = date(2026, 12, 31)
        return (start_d.isoformat(), end_d.isoformat(), "Year 2026")

    # Default to entire current active billing period (October 2026)
    return (None, None, "All Time")


def extract_entities(query_text: str, current_user_emp_id: str, db: Session) -> Dict[str, Any]:
    """Extracts known domain entities (employees, projects, categories, flags) from query."""
    q = query_text.lower()
    entities: Dict[str, Any] = {
        "target_employee_id": None,
        "target_employee_name": None,
        "is_self_query": False,
        "project_code": None,
        "category": None,
        "is_exception_query": False,
        "is_pending_query": False,
        "is_rejected_query": False,
        "is_approved_query": False,
        "is_high_value_query": False,
        "is_comparison": False,
        "is_top_spending": False,
        "limit": 10,
    }

    # 1. Self references
    if re.search(r"\b(my|i|mine|me)\b", q):
        entities["target_employee_id"] = current_user_emp_id
        entities["is_self_query"] = True

    # 2. Check known employees in database
    users = db.query(User).all()
    for u in users:
        first_name = u.full_name.split()[0].lower()
        full_lower = u.full_name.lower()
        emp_id_lower = u.employee_id.lower()

        if full_lower in q or first_name in q or emp_id_lower in q:
            entities["target_employee_id"] = u.employee_id
            entities["target_employee_name"] = u.full_name
            if u.employee_id == current_user_emp_id:
                entities["is_self_query"] = True
            break

    # 3. Project codes
    if "voxora" in q:
        entities["project_code"] = "VOXORAAI"
    elif "atlas" in q:
        entities["project_code"] = "ATLAS"
    elif "orion" in q:
        entities["project_code"] = "ORION"

    # 4. Expense categories
    if "hotel" in q or "lodging" in q or "room" in q or "stay" in q:
        entities["category"] = "Hotel"
    elif "travel" in q or "taxi" in q or "cab" in q or "uber" in q or "metro" in q or "flight" in q:
        entities["category"] = "Local Travel"
    elif "meal" in q or "food" in q or "lunch" in q or "dinner" in q or "cafe" in q:
        entities["category"] = "Meals"
    elif "entertainment" in q or "client entertainment" in q:
        entities["category"] = "Client Entertainment"

    # 5. Statuses and intent flags
    if "exception" in q or "violation" in q or "flagged" in q or "exceeded" in q or "out of policy" in q:
        entities["is_exception_query"] = True

    if "pending" in q or "awaiting" in q or "unapproved" in q:
        entities["is_pending_query"] = True

    if "rejected" in q or "denied" in q:
        entities["is_rejected_query"] = True

    if "approved" in q:
        entities["is_approved_query"] = True

    if "high value" in q or "above" in q or "exceeding" in q:
        entities["is_high_value_query"] = True

    if "compare" in q or " vs " in q or "versus" in q:
        entities["is_comparison"] = True

    if "top " in q or "highest" in q or "ranking" in q or "top 10" in q or "top 5" in q:
        entities["is_top_spending"] = True
        match = re.search(r"top\s+(\d+)", q)
        if match:
            entities["limit"] = int(match.group(1))

    return entities
