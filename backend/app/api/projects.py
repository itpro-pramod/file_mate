from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api.auth import get_current_user
from app.database.database import get_db
from app.database.models import ExpenseLine, ExpenseReport, Project, User
from app.database.schemas import ProjectCreateRequest, ProjectExpenseLine, ProjectPortalItem

router = APIRouter(prefix="/api/projects", tags=["Projects Portal"])

PROJECT_METADATA = {
    "ATLAS": {
        "client": "BrightPath Digital Engagements (Client: Alpha Retailers)",
        "billing_guidelines": (
            "Meals: ₹1,500/day max (no alcohol). Local Travel: ₹3,000/trip max. "
            "Hotel: ₹7,000/night max. Client Entertainment requires Pre-approval ID."
        ),
        "description": "Active consulting engagement covering modern digital architecture & retail store modernization.",
        "initial_budget": 240000.0,
    },
    "VOXORAAI": {
        "client": "Voxora AI Labs (Enterprise Generative AI Engagements)",
        "billing_guidelines": (
            "Meals: ₹1,500/day max (no alcohol). Local Travel: ₹3,000/trip max. "
            "Hotel: ₹7,000/night max. AI Compute & Cloud APIs require Pre-approval ID."
        ),
        "description": "Next-generation enterprise Generative AI copilot deployment, multi-agent workflow orchestration, and cognitive automation.",
        "initial_budget": 500000.0,
    },
    "VOXORA": {
        "client": "Voxora AI Labs (Enterprise Generative AI Engagements)",
        "billing_guidelines": (
            "Meals: ₹1,500/day max (no alcohol). Local Travel: ₹3,000/trip max. "
            "Hotel: ₹7,000/night max. AI Compute & Cloud APIs require Pre-approval ID."
        ),
        "description": "Next-generation enterprise Generative AI copilot deployment, multi-agent workflow orchestration, and cognitive automation.",
        "initial_budget": 500000.0,
    },
    "ORION": {
        "client": "Legacy Systems Modernization (Completed)",
        "billing_guidelines": (
            "CLOSED PROJECT: No new expenses, reports, or line items may be billed to Project ORION. "
            "AI Agent will immediately reject any filing attempt with Guardrail 3 violation."
        ),
        "description": "Project concluded on 15 Oct 2026. Closed to further billings and accounting transactions.",
        "initial_budget": 0.0,
    },
}


@router.get("", response_model=List[ProjectPortalItem])
def get_all_projects_portal(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all projects with Option A project portal metrics, budgets, and historical billed expenses."""
    projects = db.query(Project).all()
    results: List[ProjectPortalItem] = []

    # Query all users for map
    users = db.query(User).all()
    users_map = {u.employee_id: u.full_name for u in users}

    for p in projects:
        meta = PROJECT_METADATA.get(
            p.code.upper(),
            {
                "client": "Internal / Client Engagement",
                "billing_guidelines": "Standard company expense policy applies.",
                "description": p.name,
                "initial_budget": p.budget_remaining,
            },
        )

        # Retrieve all expense lines for this project
        lines_query = (
            db.query(ExpenseLine, ExpenseReport)
            .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
            .filter(ExpenseLine.project_code == p.code.upper())
            .order_by(ExpenseLine.date.desc())
        )

        # For consultants, they can see their own project billed lines or all project billed lines in project portal
        lines_records = lines_query.all()

        total_billed = sum(line.amount for line, rpt in lines_records if line.amount > 0)
        initial_budget = meta["initial_budget"]
        remaining_budget = max(0.0, initial_budget - total_billed) if initial_budget > 0 else 0.0
        burn_pct = round((total_billed / initial_budget) * 100, 1) if initial_budget > 0 else (100.0 if p.status.lower() == "closed" else 0.0)

        expense_items: List[ProjectExpenseLine] = []
        for line, rpt in lines_records:
            # Consultants see lines, show submitter name
            submitter_name = users_map.get(rpt.employee_id, rpt.employee_id)
            expense_items.append(
                ProjectExpenseLine(
                    id=line.id,
                    report_id=rpt.id,
                    report_number=rpt.report_number,
                    employee_id=rpt.employee_id,
                    employee_name=submitter_name,
                    date=line.date,
                    merchant=line.merchant,
                    category=line.category,
                    amount=line.amount,
                    currency=line.currency,
                    notes=line.notes,
                    exception_flag=line.exception_flag,
                    justification=line.justification,
                    status=rpt.status,
                )
            )

        results.append(
            ProjectPortalItem(
                code=p.code,
                name=p.name,
                status=p.status,
                initial_budget=initial_budget,
                budget_remaining=remaining_budget,
                total_billed=round(total_billed, 2),
                burn_percentage=burn_pct,
                expense_count=len(expense_items),
                client=meta["client"],
                billing_guidelines=meta["billing_guidelines"],
                description=meta["description"],
                expenses=expense_items,
            )
        )

    return results


@router.get("/{project_code}", response_model=ProjectPortalItem)
def get_project_by_code(
    project_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve detailed portal view for a single project code."""
    project = db.query(Project).filter(Project.code == project_code.upper().strip()).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_code}' not found.",
        )

    meta = PROJECT_METADATA.get(
        project.code.upper(),
        {
            "client": "Internal / Client Engagement",
            "billing_guidelines": "Standard company expense policy applies.",
            "description": project.name,
            "initial_budget": project.budget_remaining,
        },
    )

    lines_records = (
        db.query(ExpenseLine, ExpenseReport)
        .join(ExpenseReport, ExpenseLine.report_id == ExpenseReport.id)
        .filter(ExpenseLine.project_code == project.code.upper())
        .order_by(ExpenseLine.date.desc())
        .all()
    )

    users = db.query(User).all()
    users_map = {u.employee_id: u.full_name for u in users}

    total_billed = sum(line.amount for line, rpt in lines_records if line.amount > 0)
    initial_budget = meta["initial_budget"]
    remaining_budget = max(0.0, initial_budget - total_billed) if initial_budget > 0 else 0.0
    burn_pct = round((total_billed / initial_budget) * 100, 1) if initial_budget > 0 else (100.0 if project.status.lower() == "closed" else 0.0)

    expense_items: List[ProjectExpenseLine] = [
        ProjectExpenseLine(
            id=line.id,
            report_id=rpt.id,
            report_number=rpt.report_number,
            employee_id=rpt.employee_id,
            employee_name=users_map.get(rpt.employee_id, rpt.employee_id),
            date=line.date,
            merchant=line.merchant,
            category=line.category,
            amount=line.amount,
            currency=line.currency,
            notes=line.notes,
            exception_flag=line.exception_flag,
            justification=line.justification,
            status=rpt.status,
        )
        for line, rpt in lines_records
    ]

    return ProjectPortalItem(
        code=project.code,
        name=project.name,
        status=project.status,
        initial_budget=initial_budget,
        budget_remaining=remaining_budget,
        total_billed=round(total_billed, 2),
        burn_percentage=burn_pct,
        expense_count=len(expense_items),
        client=meta["client"],
        billing_guidelines=meta["billing_guidelines"],
        description=meta["description"],
        expenses=expense_items,
    )


@router.post("/{project_code}/toggle-status", response_model=ProjectPortalItem)
def toggle_project_status(
    project_code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle a project's status between 'Active' and 'Closed'.
    Authorized strictly for the Finance Controller persona.
    """
    if current_user.role != "Finance Controller":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only Finance Controller can change project statuses.",
        )

    project = db.query(Project).filter(Project.code == project_code.upper().strip()).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_code}' not found.",
        )

    # Toggle status
    new_status = "Closed" if project.status.lower() == "active" else "Active"
    project.status = new_status
    db.commit()
    db.refresh(project)

    return get_project_by_code(project_code=project.code, current_user=current_user, db=db)


@router.post("", response_model=ProjectPortalItem, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new project with valid budget and metadata details.
    Authorized for the Finance Controller persona.
    """
    if current_user.role != "Finance Controller":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only Finance Controller can create projects.",
        )

    code = data.code.strip().upper()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project code is required.",
        )

    existing = db.query(Project).filter(Project.code == code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Project with code '{code}' already exists.",
        )

    init_budget = max(0.0, float(data.initial_budget))
    proj_status = data.status.capitalize() if data.status else "Active"

    new_project = Project(
        code=code,
        name=data.name.strip(),
        status=proj_status,
        budget_remaining=init_budget,
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    # Register in metadata dictionary
    PROJECT_METADATA[code] = {
        "client": data.client.strip() if data.client else "Internal / Client Engagement",
        "billing_guidelines": data.billing_guidelines.strip() if data.billing_guidelines else "Standard company expense policy applies.",
        "description": data.description.strip() if data.description else data.name.strip(),
        "initial_budget": init_budget,
    }

    return get_project_by_code(project_code=code, current_user=current_user, db=db)


