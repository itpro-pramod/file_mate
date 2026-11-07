from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.sql import text
from app.database.database import get_db

router = APIRouter(prefix="/api/health", tags=["System Health"])


@router.get("")
def health():
    return {
        "status": "healthy",
        "service": "filemate-backend",
        "version": "1.0.0",
    }


@router.get("/ready")
def readiness(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "ready" if db_status == "connected" else "not_ready",
        "database": db_status,
    }
