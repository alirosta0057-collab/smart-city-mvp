from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

_url = settings.database_url
_engine_kwargs: dict[str, object] = {"future": True}
if _url.startswith("sqlite"):
    # SQLite needs this for multi-threaded access from the async server, and
    # we make sure the parent directory exists so startup doesn't crash on a
    # fresh volume.
    _engine_kwargs["connect_args"] = {"check_same_thread": False}
    _db_path = _url.replace("sqlite:///", "", 1)
    if _db_path and not _db_path.startswith(":memory:"):
        parent = Path(_db_path).resolve().parent
        os.makedirs(parent, exist_ok=True)
else:
    _engine_kwargs["pool_pre_ping"] = True

engine = create_engine(_url, **_engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
