from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.security import hash_password
from app.database.models import (
    ApplicationSetting,
    ExpenseLine,
    ExpensePolicy,
    ExpenseReport,
    Project,
    User,
)


def seed_database(db: Session):
    """Seed initial deterministic data for FileMate."""

    # 0. Migrate missing columns if running against an existing SQLite file
    from sqlalchemy import inspect, text
    from app.database.database import Base
    bind_engine = db.get_bind()
    Base.metadata.create_all(bind=bind_engine)
    insp = inspect(bind_engine)

    if "expense_reports" in insp.get_table_names():
        columns = [c["name"] for c in insp.get_columns("expense_reports")]
        with bind_engine.connect() as conn:
            if "approved_by" not in columns:
                conn.execute(text("ALTER TABLE expense_reports ADD COLUMN approved_by VARCHAR(50)"))
            if "approved_at" not in columns:
                conn.execute(text("ALTER TABLE expense_reports ADD COLUMN approved_at DATETIME"))
            if "finance_notes" not in columns:
                conn.execute(text("ALTER TABLE expense_reports ADD COLUMN finance_notes TEXT"))
            conn.commit()

    if "agent_runs" in insp.get_table_names():
        run_cols = [c["name"] for c in insp.get_columns("agent_runs")]
        with bind_engine.connect() as conn:
            if "module" not in run_cols:
                conn.execute(text("ALTER TABLE agent_runs ADD COLUMN module VARCHAR(50) DEFAULT 'EXPENSE_ASSISTANT'"))
            if "intent" not in run_cols:
                conn.execute(text("ALTER TABLE agent_runs ADD COLUMN intent VARCHAR(50)"))
            conn.commit()

    # 1. Users (Standard Password: Admin@321 for all personas)
    admin_hashed_pw = hash_password("Admin@321")

    users_seed = [
        {"email": "priya.nair@brightpath.com", "name": "Priya Nair", "id": "E1042", "role": "Consultant"},
        {"email": "ravi.menon@brightpath.com", "name": "Ravi Menon", "id": "E2087", "role": "Finance Controller"},
        {"email": "rohan.verma@brightpath.com", "name": "Rohan Verma", "id": "E1088", "role": "Consultant"},
        {"email": "ananya.sharma@brightpath.com", "name": "Ananya Sharma", "id": "E1095", "role": "Consultant"},
    ]

    for u in users_seed:
        existing = db.query(User).filter(User.employee_id == u["id"]).first()
        if not existing:
            db.add(
                User(
                    email=u["email"],
                    hashed_password=admin_hashed_pw,
                    full_name=u["name"],
                    employee_id=u["id"],
                    role=u["role"],
                )
            )
        else:
            existing.hashed_password = admin_hashed_pw

    db.commit()

    db.commit()

    # 2. Projects
    projects_data = [
        {"code": "ATLAS", "name": "Project Atlas Core", "status": "Active", "budget": 240000.0},
        {"code": "VOXORAAI", "name": "Project VoxoraAI", "status": "Active", "budget": 500000.0},
        {"code": "ORION", "name": "Project Orion Legacy", "status": "Closed", "budget": 0.0},
    ]

    for p in projects_data:
        existing_p = db.query(Project).filter(Project.code == p["code"]).first()
        if not existing_p:
            db.add(
                Project(
                    code=p["code"],
                    name=p["name"],
                    status=p["status"],
                    budget_remaining=p["budget"],
                )
            )

    db.commit()

    # 3. Expense Policies
    policies_data = [
        {
            "category": "Meals",
            "limit_amount": 1500.0,
            "limit_type": "per_day",
            "rule_description": "Maximum ₹1,500 per day. Alcohol is not reimbursable.",
            "currency": "INR",
        },
        {
            "category": "Local Travel",
            "limit_amount": 3000.0,
            "limit_type": "per_trip",
            "rule_description": "Maximum ₹3,000 per trip. Taxi, rideshare, metro allowed.",
            "currency": "INR",
        },
        {
            "category": "Hotel",
            "limit_amount": 7000.0,
            "limit_type": "per_night",
            "rule_description": "Maximum ₹7,000 per night. Itemised bill required.",
            "currency": "INR",
        },
        {
            "category": "Client Entertainment",
            "limit_amount": None,
            "limit_type": "none",
            "rule_description": "No fixed limit. Pre-approval ID required.",
            "currency": "INR",
        },
    ]

    for pol in policies_data:
        existing_pol = db.query(ExpensePolicy).filter(ExpensePolicy.category == pol["category"]).first()
        if not existing_pol:
            db.add(
                ExpensePolicy(
                    category=pol["category"],
                    limit_amount=pol["limit_amount"],
                    limit_type=pol["limit_type"],
                    rule_description=pol["rule_description"],
                    currency=pol["currency"],
                )
            )

    db.commit()

    # 4. Existing Report for Priya (E1042): Meals, 980 INR, Project ATLAS, dated 27 Oct 2026 (3 days ago from test date 30 Oct 2026)
    existing_report = db.query(ExpenseReport).filter(ExpenseReport.report_number == "RPT-10001").first()
    if not existing_report:
        report = ExpenseReport(
            report_number="RPT-10001",
            employee_id="E1042",
            status="submitted",
            total_amount=980.0,
            currency="INR",
            submitted_at=datetime(2026, 10, 27, 18, 0, tzinfo=timezone.utc),
        )
        db.add(report)
        db.flush()

        line = ExpenseLine(
            report_id=report.id,
            date="2026-10-27",
            merchant="Cafe Express Lunch",
            category="Meals",
            amount=980.0,
            currency="INR",
            project_code="ATLAS",
            notes="Team lunch working session",
            exception_flag=False,
        )
        db.add(line)
        db.commit()

    # 4. Mockup Reference Report RPT-10024 for Priya (E1042): Total ₹9,140 across 4 lines
    rpt_10024 = db.query(ExpenseReport).filter(ExpenseReport.report_number == "RPT-10024").first()
    if not rpt_10024:
        report24 = ExpenseReport(
            report_number="RPT-10024",
            employee_id="E1042",
            status="submitted",
            total_amount=9140.0,
            currency="INR",
            submitted_at=datetime(2026, 10, 30, 10, 0, tzinfo=timezone.utc),
        )
        db.add(report24)
        db.flush()

        lines24 = [
            ExpenseLine(
                report_id=report24.id,
                date="2026-10-29",
                merchant="Hotel Lakeview",
                category="Hotel",
                amount=6400.0,
                currency="INR",
                project_code="ATLAS",
                notes="Client onsite multi-day workshop accommodation",
                exception_flag=True,
                justification="Within limit (≤ ₹7,000 per night). Itemised bill provided.",
            ),
            ExpenseLine(
                report_id=report24.id,
                date="2026-10-28",
                merchant="Uber",
                category="Local Travel",
                amount=1250.0,
                currency="INR",
                project_code="ATLAS",
                notes="Airport to client office transfer",
                exception_flag=False,
            ),
            ExpenseLine(
                report_id=report24.id,
                date="2026-10-29",
                merchant="Cafe Mocha",
                category="Meals",
                amount=760.0,
                currency="INR",
                project_code="ATLAS",
                notes="Working lunch with client engineering lead",
                exception_flag=False,
            ),
            ExpenseLine(
                report_id=report24.id,
                date="2026-10-30",
                merchant="Metro Card Top-up",
                category="Local Travel",
                amount=500.0,
                currency="INR",
                project_code="ATLAS",
                notes="Client transit pass",
                exception_flag=False,
            ),
        ]
        for l in lines24:
            db.add(l)
        db.commit()

    # 4b. Seed reports for Rohan (E1088) and Ananya (E1095) for multi-consultant comparisons
    rpt_rohan = db.query(ExpenseReport).filter(ExpenseReport.report_number == "RPT-10045").first()
    if not rpt_rohan:
        report_rohan = ExpenseReport(
            report_number="RPT-10045",
            employee_id="E1088",
            status="approved",
            total_amount=5200.0,
            currency="INR",
            submitted_at=datetime(2026, 10, 25, 14, 0, tzinfo=timezone.utc),
            approved_by="E2087",
            approved_at=datetime(2026, 10, 26, 10, 0, tzinfo=timezone.utc),
        )
        db.add(report_rohan)
        db.flush()
        db.add(
            ExpenseLine(
                report_id=report_rohan.id,
                date="2026-10-25",
                merchant="Express Cabs",
                category="Local Travel",
                amount=2200.0,
                currency="INR",
                project_code="ATLAS",
                notes="Client site visit",
            )
        )
        db.add(
            ExpenseLine(
                report_id=report_rohan.id,
                date="2026-10-25",
                merchant="Gateway Diner",
                category="Meals",
                amount=3000.0,
                currency="INR",
                project_code="ATLAS",
                notes="Executive dinner",
                exception_flag=True,
                justification="Project Director pre-approval attached for client dinner.",
            )
        )
        db.commit()

    rpt_ananya = db.query(ExpenseReport).filter(ExpenseReport.report_number == "RPT-10062").first()
    if not rpt_ananya:
        report_ananya = ExpenseReport(
            report_number="RPT-10062",
            employee_id="E1095",
            status="submitted",
            total_amount=3850.0,
            currency="INR",
            submitted_at=datetime(2026, 10, 28, 9, 30, tzinfo=timezone.utc),
        )
        db.add(report_ananya)
        db.flush()
        db.add(
            ExpenseLine(
                report_id=report_ananya.id,
                date="2026-10-28",
                merchant="Blue Tokai Coffee",
                category="Meals",
                amount=850.0,
                currency="INR",
                project_code="ATLAS",
                notes="Breakfast with partner team",
            )
        )
        db.add(
            ExpenseLine(
                report_id=report_ananya.id,
                date="2026-10-28",
                merchant="City Taxi Services",
                category="Local Travel",
                amount=3000.0,
                currency="INR",
                project_code="ATLAS",
                notes="Transit between client data centers",
            )
        )
        db.commit()

    # 4d. Seed Project VoxoraAI Reference Report (RPT-20050)
    rpt_voxora = db.query(ExpenseReport).filter(ExpenseReport.report_number == "RPT-20050").first()
    if not rpt_voxora:
        report_vox = ExpenseReport(
            report_number="RPT-20050",
            employee_id="E1042",
            status="submitted",
            total_amount=4250.0,
            currency="INR",
            submitted_at=datetime(2026, 10, 31, 14, 30, tzinfo=timezone.utc),
        )
        db.add(report_vox)
        db.flush()

        lines_vox = [
            ExpenseLine(
                report_id=report_vox.id,
                date="2026-10-31",
                merchant="Uber Premium",
                category="Local Travel",
                amount=1750.0,
                currency="INR",
                project_code="VOXORAAI",
                notes="Client onsite kickoff meeting transfer to Voxora AI Innovation Center",
                exception_flag=False,
            ),
            ExpenseLine(
                report_id=report_vox.id,
                date="2026-10-31",
                merchant="The Capital Bistro",
                category="Meals",
                amount=1200.0,
                currency="INR",
                project_code="VOXORAAI",
                notes="Working lunch with Voxora AI Machine Learning Engineering team",
                exception_flag=False,
            ),
            ExpenseLine(
                report_id=report_vox.id,
                date="2026-10-31",
                merchant="Express Cloud Pass",
                category="Local Travel",
                amount=1300.0,
                currency="INR",
                project_code="VOXORAAI",
                notes="Return airport transit after AI deployment kickoff",
                exception_flag=False,
            ),
        ]
        db.add_all(lines_vox)
        db.commit()

    # 5. Application Settings default
    llm_setting = db.query(ApplicationSetting).filter(ApplicationSetting.key == "active_llm_provider").first()
    from app.core.config import settings
    default_provider = settings.LLM_PROVIDER.lower() if settings.LLM_PROVIDER else "azure_openai"
    if not llm_setting:
        db.add(ApplicationSetting(key="active_llm_provider", value=default_provider))
        db.commit()
    elif llm_setting.value != default_provider:
        llm_setting.value = default_provider
        db.commit()
