import time
from typing import Any, Dict
from langchain_core.tools import tool
from sqlalchemy.orm import Session
from app.expense_api.mock_expense_api import MockExpenseAPI


def get_project_details_impl(project_code: str, db: Session) -> Dict[str, Any]:
    """Retrieve details for a project code including name, status, and budget remaining."""
    api = MockExpenseAPI(db)
    return api.get_project_details(project_code)
