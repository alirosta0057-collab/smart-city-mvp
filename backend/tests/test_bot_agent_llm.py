"""Tests for the bot agent's LLM routing + JSON parsing + safe fallback."""
from __future__ import annotations

import json

import pytest
from pytest import MonkeyPatch

from app.services import bot_agent
from app.services.bot_agent import (
    BotReply,
    _parse_llm_json,
    generate_reply,
    rule_based_reply,
)


class _FakeResponse:
    def __init__(self, payload: dict, status: int = 200):
        self._payload = payload
        self.status_code = status

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self) -> dict:
        return self._payload


class _FakeClient:
    def __init__(self, payload: dict | None = None, exc: Exception | None = None) -> None:
        self._payload = payload
        self._exc = exc
        self.last_url: str | None = None
        self.last_json: dict | None = None
        self.last_headers: dict | None = None

    async def __aenter__(self) -> _FakeClient:
        return self

    async def __aexit__(self, *args: object) -> None:
        return None

    async def post(self, url, json=None, headers=None):  # noqa: A002 - match httpx signature
        self.last_url = url
        self.last_json = json
        self.last_headers = headers
        if self._exc is not None:
            raise self._exc
        assert self._payload is not None
        return _FakeResponse(self._payload)


def _llm_payload(body: str, escalate: bool) -> dict:
    return {
        "choices": [
            {
                "message": {
                    "content": json.dumps({"body": body, "escalate": escalate}),
                }
            }
        ]
    }


def test_parse_llm_json_handles_code_fence() -> None:
    reply = _parse_llm_json('```json\n{"body": "hi", "escalate": false}\n```')
    assert reply == BotReply(body="hi", escalate=False)


def test_parse_llm_json_rejects_invalid() -> None:
    assert _parse_llm_json("not json") is None
    assert _parse_llm_json('{"escalate": true}') is None


def test_rule_based_reply_escalates_on_sos_keyword() -> None:
    reply = rule_based_reply("this is an emergency", turn=1)
    assert reply.escalate is True


def test_rule_based_reply_greets_on_empty() -> None:
    reply = rule_based_reply("", turn=1)
    assert reply.escalate is False
    assert "smart-city" in reply.body.lower() or "smart city" in reply.body.lower()


@pytest.mark.asyncio
async def test_generate_reply_uses_groq_when_configured(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(bot_agent.settings, "llm_provider", "groq")
    monkeypatch.setattr(bot_agent.settings, "groq_api_key", "test-key")
    monkeypatch.setattr(bot_agent.settings, "llm_model", "llama-3.3-70b-versatile")
    monkeypatch.setattr(bot_agent.settings, "llm_base_url", "")

    fake = _FakeClient(payload=_llm_payload("Here is a bill help answer.", False))
    monkeypatch.setattr(
        bot_agent.httpx, "AsyncClient", lambda **_: fake  # type: ignore[arg-type]
    )

    reply = await generate_reply("how do I pay my water bill?", turn=1)
    assert reply.body == "Here is a bill help answer."
    assert reply.escalate is False
    assert fake.last_url == "https://api.groq.com/openai/v1/chat/completions"
    assert fake.last_headers is not None
    assert fake.last_headers["Authorization"] == "Bearer test-key"
    assert fake.last_json is not None
    assert fake.last_json["model"] == "llama-3.3-70b-versatile"


@pytest.mark.asyncio
async def test_generate_reply_falls_back_when_llm_fails(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(bot_agent.settings, "llm_provider", "groq")
    monkeypatch.setattr(bot_agent.settings, "groq_api_key", "test-key")

    fake = _FakeClient(exc=RuntimeError("boom"))
    monkeypatch.setattr(
        bot_agent.httpx, "AsyncClient", lambda **_: fake  # type: ignore[arg-type]
    )

    reply = await generate_reply("fire!", turn=1)
    # Rule-based fallback should still escalate on the SOS keyword.
    assert reply.escalate is True


@pytest.mark.asyncio
async def test_generate_reply_skips_llm_when_not_configured(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.setattr(bot_agent.settings, "llm_provider", "")
    monkeypatch.setattr(bot_agent.settings, "groq_api_key", "")
    monkeypatch.setattr(bot_agent.settings, "openai_api_key", "")

    def _fail(**_kwargs: object) -> object:  # pragma: no cover - must not be called
        raise AssertionError("AsyncClient must not be used when LLM is unconfigured")

    monkeypatch.setattr(bot_agent.httpx, "AsyncClient", _fail)

    reply = await generate_reply("how are pickup days?", turn=1)
    assert reply.escalate is False
