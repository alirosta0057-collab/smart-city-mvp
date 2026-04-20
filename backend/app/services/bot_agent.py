"""Autonomous agent that tries to resolve a ticket before escalating to a human.

The default implementation is rule-based so the MVP works with zero external
dependencies. If an LLM provider is configured in settings, the bot routes
through it instead; on any error it falls back to the rule-based reply so the
chat never stalls.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class BotReply:
    body: str
    escalate: bool


ESCALATION_KEYWORDS = {
    "sos",
    "emergency",
    "urgent",
    "ambulance",
    "fire",
    "police",
    "help now",
    "اورژانس",
    "آتش",
    "پلیس",
    "کمک فوری",
    "فوری",
}


RULE_BASED_FAQ: list[tuple[tuple[str, ...], str]] = [
    (
        ("hours", "open", "closed", "ساعت", "باز"),
        "Most businesses in the directory show their opening hours in the details panel. "
        "You can also filter the directory by 'Open now'.",
    ),
    (
        ("trash", "garbage", "waste", "زباله"),
        "Waste pickup happens every Monday, Wednesday, and Friday morning. "
        "For a missed pickup, I can escalate to a municipal agent — just say 'escalate'.",
    ),
    (
        ("water", "outage", "electric", "power", "آب", "برق"),
        "I can log a utility outage ticket for you. Please share your exact address and I will "
        "hand this to a utility agent right away.",
    ),
    (
        ("pay", "bill", "invoice", "قبض", "پرداخت"),
        "Bills can be viewed and paid from your citizen panel under 'Services > Bills'. "
        "If a bill is missing or incorrect, I will escalate to a billing agent.",
    ),
]


GREETING = (
    "Hi! I'm your smart-city assistant. Tell me what you need — directions, "
    "reporting an issue, utilities, or emergencies. I'll try to help and can "
    "hand you off to a human agent if needed."
)


SYSTEM_PROMPT = """You are the Smart City autonomous assistant for a virtual
location-based smart-city platform. You help citizens with municipal services,
business directory questions, utilities, waste, bills, directions, and
general-information queries. You are friendly, concise (2-4 sentences),
bilingual English/Farsi (respond in the same language the user wrote in).

Rules:
- If the user is in a real emergency (medical, fire, crime, explicit SOS, or
  anything life-threatening), set escalate=true and tell them a human agent
  is being connected.
- If the user explicitly asks for a human / agent / escalation, set
  escalate=true.
- If the user's question is ambiguous or needs specific account data you
  don't have, ask one clarifying question (escalate=false). After 3 back-and-
  forth turns without resolution, set escalate=true.
- Otherwise, answer directly and keep escalate=false.

You MUST reply with a single JSON object and nothing else:
{"body": "<your reply to the user>", "escalate": <true|false>}
"""


def _matches(body_lower: str, keywords: tuple[str, ...]) -> bool:
    return any(k in body_lower for k in keywords)


def rule_based_reply(body: str, turn: int) -> BotReply:
    body_lower = body.lower().strip()

    if not body_lower:
        return BotReply(body=GREETING, escalate=False)

    if any(k in body_lower for k in ESCALATION_KEYWORDS):
        return BotReply(
            body="This sounds urgent — escalating to the nearest available human agent now.",
            escalate=True,
        )

    if body_lower in {"escalate", "human", "agent", "انسان", "ایجنت", "پشتیبانی"}:
        return BotReply(
            body="Connecting you to a human agent. Please hold on.",
            escalate=True,
        )

    for keywords, response in RULE_BASED_FAQ:
        if _matches(body_lower, keywords):
            return BotReply(body=response, escalate=False)

    # After a few back-and-forths without a confident match, hand off.
    if turn >= 3:
        return BotReply(
            body=(
                "I'm not fully sure I can solve this on my own. "
                "Let me connect you to a human agent."
            ),
            escalate=True,
        )

    return BotReply(
        body=(
            "Could you give me more detail? For example: your location, what service "
            "you need, or 'escalate' to reach a human agent."
        ),
        escalate=False,
    )


def _llm_config() -> tuple[str, str, str, str] | None:
    """Return (base_url, api_key, model, provider) or None if not configured."""
    provider = (settings.llm_provider or "").lower().strip()
    if provider in {"openai"}:
        key = settings.openai_api_key
        base = settings.llm_base_url or "https://api.openai.com/v1"
        model = settings.llm_model or "gpt-4o-mini"
    elif provider == "groq":
        key = settings.groq_api_key or settings.openai_api_key
        base = settings.llm_base_url or "https://api.groq.com/openai/v1"
        model = settings.llm_model or "llama-3.3-70b-versatile"
    else:
        return None
    if not key:
        return None
    return base, key, model, provider


def _parse_llm_json(raw: str) -> BotReply | None:
    raw = raw.strip()
    if raw.startswith("```"):
        # Strip code fences like ```json\n...\n```
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    body = data.get("body")
    escalate = bool(data.get("escalate", False))
    if not isinstance(body, str) or not body.strip():
        return None
    return BotReply(body=body.strip(), escalate=escalate)


async def _openai_compatible_reply(body: str, turn: int) -> BotReply | None:
    cfg = _llm_config()
    if cfg is None:
        return None
    base, key, model, _provider = cfg

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Turn #{turn}. User message: {body}",
            },
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=settings.llm_timeout_seconds) as client:
        res = await client.post(
            f"{base.rstrip('/')}/chat/completions",
            json=payload,
            headers=headers,
        )
        res.raise_for_status()
        data = res.json()
    content = data["choices"][0]["message"]["content"]
    return _parse_llm_json(content)


async def generate_reply(body: str, turn: int) -> BotReply:
    """Entry point used by the ticket flow. Always returns a BotReply."""
    if _llm_config() is not None:
        try:
            reply = await _openai_compatible_reply(body, turn)
            if reply is not None:
                return reply
        except Exception as exc:  # noqa: BLE001 - never let the LLM take down chat
            logger.warning("LLM reply failed, falling back to rules: %s", exc)
    return rule_based_reply(body, turn)
