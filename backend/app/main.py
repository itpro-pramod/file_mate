from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api import actions, auth, chat, expenses, health, intelligence, policy, projects, runs, settings as settings_api
from app.core.config import settings
from app.core.exceptions import FileMateException
from app.core.logging import logger
from app.database.database import Base, SessionLocal, engine
from app.expense_api.seed_data import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Create tables and seed data
    logger.info("Initializing FileMate database and seed data...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
        logger.info("Database initialized and seeded successfully.")
    finally:
        db.close()
    yield
    # Shutdown
    logger.info("FileMate application shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    description="FileMate – Full-Stack Agentic Expense Assistant with Guardrails",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:8001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
@app.exception_handler(FileMateException)
async def filemate_exception_handler(request: Request, exc: FileMateException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code, "extra": exc.extra},
    )


# Include Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(actions.router)
app.include_router(runs.router)
app.include_router(expenses.router)
app.include_router(projects.router)
app.include_router(intelligence.router)
app.include_router(policy.router)
app.include_router(settings_api.router)

# Mount Docs & HTML Presentations as Static Files
from fastapi.staticfiles import StaticFiles
import os

docs_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "docs"))
if os.path.exists(docs_dir):
    app.mount("/presentations", StaticFiles(directory=docs_dir), name="presentations")


@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "status": "online",
        "documentation": "/docs",
        "active_provider": settings.LLM_PROVIDER,
    }
