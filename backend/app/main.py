from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import admin, auth, businesses, categories, chat_ws, tickets, users
from app.core.config import settings
from app.core.db import Base, engine

app = FastAPI(title="Smart City MVP", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(categories.router)
app.include_router(businesses.router)
app.include_router(tickets.router)
app.include_router(admin.router)
app.include_router(chat_ws.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.on_event("startup")
def _init_db() -> None:
    """Auto-create tables and seed demo data on first startup.

    This keeps the SQLite/Fly.io deploy self-sufficient. For Postgres with
    Alembic, the migrations still run via `alembic upgrade head`.
    """
    # Import models so SQLAlchemy metadata is populated before create_all.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    from app.seed import seed

    try:
        seed()
    except Exception as exc:  # noqa: BLE001
        print(f"[startup] seed skipped: {exc}")


_STATIC_DIR = Path(__file__).resolve().parent / "static"
if _STATIC_DIR.is_dir():
    # Serve the prebuilt Next.js static export. `html=True` makes FastAPI
    # fall back to index.html for client-side routed paths.
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="frontend")
