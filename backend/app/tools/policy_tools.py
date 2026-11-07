from typing import Any, Dict, List
from sqlalchemy.orm import Session
from app.expense_api.mock_expense_api import MockExpenseAPI


def get_expense_policy_impl(db: Session) -> List[Dict[str, Any]]:
    """Retrieve official company expense policies and spending limits."""
    api = MockExpenseAPI(db)
    return api.get_expense_policy()
