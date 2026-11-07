from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.database.models import ExpenseLine, ExpensePolicy, ExpenseReport


class PolicyValidationGuardrail:
    """Evaluates business expense policies, limit thresholds, alcohol restrictions, and duplicate expenses."""

    @classmethod
    def evaluate_policy(
        cls,
        payload: Dict[str, Any],
        db: Session,
    ) -> Tuple[bool, bool, Optional[str], Optional[str]]:
        """Evaluates payload against Brightpath Consulting expense policies.

        Returns:
            is_valid: bool (whether compliant with policy)
            is_exception: bool (true if over limit or requires justification)
            policy_message: human-readable policy status explanation
            exception_details: specific requirement needed (e.g. justification)
        """
        category = payload.get("category", "")
        amount = float(payload.get("amount", 0.0))
        notes = str(payload.get("notes", "")).lower()
        merchant = str(payload.get("merchant", "")).lower()

        # Check alcohol restriction
        alcohol_keywords = ["beer", "wine", "whiskey", "cocktail", "alcohol", "liquor", "bar bill"]
        for kw in alcohol_keywords:
            if kw in notes or kw in merchant:
                return (
                    False,
                    True,
                    f"Policy violation: Alcohol is not reimbursable under Brightpath policy (found '{kw}').",
                    "Alcohol expenses cannot be reimbursed.",
                )

        policy = db.query(ExpensePolicy).filter(ExpensePolicy.category == category).first()
        limit_amount = policy.limit_amount if policy else None

        # Check Category Limits
        if category == "Meals":
            daily_limit = 1500.0
            if amount > daily_limit:
                excess = amount - daily_limit
                return (
                    False,
                    True,
                    f"Expense amount ₹{amount:,.2f} exceeds the Meals policy limit of ₹{daily_limit:,.2f} per day by ₹{excess:,.2f}.",
                    f"Meals limit of ₹{daily_limit:,.2f} exceeded. Please enter a justification for the exception.",
                )

        elif category == "Local Travel":
            trip_limit = 3000.0
            if amount > trip_limit:
                excess = amount - trip_limit
                return (
                    False,
                    True,
                    f"Expense amount ₹{amount:,.2f} exceeds the Local Travel limit of ₹{trip_limit:,.2f} per trip by ₹{excess:,.2f}.",
                    f"Local Travel limit of ₹{trip_limit:,.2f} exceeded. Please enter a justification for the exception.",
                )

        elif category == "Hotel":
            nightly_limit = 7000.0
            if amount > nightly_limit:
                excess = amount - nightly_limit
                return (
                    False,
                    True,
                    f"Expense amount ₹{amount:,.2f} exceeds the Hotel policy limit of ₹{nightly_limit:,.2f} per night by ₹{excess:,.2f}.",
                    f"Hotel limit of ₹{nightly_limit:,.2f} exceeded. Please provide an itemised bill and a business justification before this expense can be approved.",
                )

        elif category == "Client Entertainment":
            # Check for pre-approval ID in notes or payload
            has_pre_approval = "approval" in notes or "pre-approval" in notes or "id" in notes
            if not has_pre_approval:
                return (
                    False,
                    True,
                    "Client Entertainment expenses require a valid Pre-approval ID.",
                    "Pre-approval ID is required for Client Entertainment reimbursement.",
                )

        # Stretch goal: Amounts > ₹10,000 need secondary approval from Finance Controller
        if amount > 10000.0:
            return (
                True,
                True,
                f"Expense amount ₹{amount:,.2f} exceeds ₹10,000 threshold and will require secondary approval from Finance Controller (Ravi Menon).",
                "Secondary approval required for expenses exceeding ₹10,000.",
            )

        return True, False, "This expense is within policy limits.", None

    @classmethod
    def check_duplicates(
        cls,
        payload: Dict[str, Any],
        employee_id: str,
        db: Session,
    ) -> Optional[str]:
        """Checks if a matching expense line was already submitted for this employee."""
        amount = float(payload.get("amount", 0.0))
        category = payload.get("category", "")
        project_code = str(payload.get("project_code", "")).upper()
        date_val = str(payload.get("date", ""))

        # Query existing submitted or draft lines
        existing_lines = (
            db.query(ExpenseLine)
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(
                ExpenseReport.employee_id == employee_id,
                ExpenseLine.category == category,
                ExpenseLine.project_code == project_code,
            )
            .all()
        )

        for line in existing_lines:
            # Check for same amount and similar date or exact line
            if abs(line.amount - amount) < 0.01:
                return (
                    f"Duplicate warning: A similar expense of ₹{line.amount:,.2f} for {line.category} under project {line.project_code} "
                    f"already exists in report {line.report.report_number} (dated {line.date}, merchant: '{line.merchant}')."
                )

        return None
