from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, auth, businesses, categories, chat_ws, tickets, users
from app.core.config import settings

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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
