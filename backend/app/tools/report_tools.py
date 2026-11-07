from typing import Any, Dict, List
from sqlalchemy.orm import Session
from app.expense_api.mock_expense_api import MockExpenseAPI


def get_employee_reports_impl(employee_id: str, db: Session) -> List[Dict[str, Any]]:
    """Retrieve existing expense reports and submitted expense lines for an employee."""
    api = MockExpenseAPI(db)
    return api.get_employee_reports(employee_id)
