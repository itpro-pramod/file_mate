import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

TEST_DB_FILE = "/tmp/filemate_test.db"
if os.path.exists(TEST_DB_FILE):
    try:
        os.remove(TEST_DB_FILE)
    except Exception:
        pass

# Set test environment
os.environ["APP_ENV"] = "test"
os.environ["DEBUG"] = "false"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_FILE}"

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
settings.DATABASE_URL = f"sqlite:///{TEST_DB_FILE}"

from app.core.security import create_access_token
from app.database import database
from app.database.database import Base, get_db
from app.expense_api.seed_data import seed_database
from app.main import app

# Create a shared engine for tests
TEST_ENGINE = create_engine(
    f"sqlite:///{TEST_DB_FILE}",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)

# Override database.engine and database.SessionLocal
database.engine = TEST_ENGINE
database.SessionLocal = TestingSessionLocal


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=TEST_ENGINE)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()
    yield
    try:
        if os.path.exists(TEST_DB_FILE):
            os.remove(TEST_DB_FILE)
    except Exception:
        pass


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def priya_token():
    return create_access_token(data={"sub": "E1042", "email": "priya.nair@brightpath.com", "role": "Consultant"})


@pytest.fixture
def ravi_token():
    return create_access_token(data={"sub": "E2087", "email": "ravi.menon@brightpath.com", "role": "Finance Controller"})


@pytest.fixture
def auth_headers(priya_token):
    return {"Authorization": f"Bearer {priya_token}"}


@pytest.fixture
def ravi_auth_headers(ravi_token):
    return {"Authorization": f"Bearer {ravi_token}"}
