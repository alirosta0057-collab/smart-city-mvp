from __future__ import annotations

import os
import tempfile
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Configure an isolated SQLite database for tests before importing the app.
_db_fd, _db_path = tempfile.mkstemp(suffix=".db")
os.close(_db_fd)
os.environ["DATABASE_URL"] = f"sqlite:///{_db_path}"
os.environ.setdefault("JWT_SECRET", "test-secret")

from app.core import db as core_db  # noqa: E402
from app.core.db import Base  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _init_db() -> Iterator[None]:
    engine = create_engine(
        f"sqlite:///{_db_path}",
        future=True,
        connect_args={"check_same_thread": False},
    )
    core_db.engine = engine  # type: ignore[assignment]
    core_db.SessionLocal = sessionmaker(  # type: ignore[assignment]
        bind=engine, autoflush=False, autocommit=False, future=True
    )
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)
    try:
        os.remove(_db_path)
    except OSError:
        pass


@pytest.fixture(autouse=True)
def _clean_db() -> Iterator[None]:
    yield
    # Clean all tables after each test for isolation.
    with core_db.engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)
