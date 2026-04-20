"""Autonomous agent that tries to resolve a ticket before escalating to a human.

The default implementation is rule-based so the MVP works with zero external
dependencies. If an LLM provider/key is configured in settings, the bot will
use it instead — plug a provider in `generate_llm_reply` without changing
callers.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings


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


async def generate_reply(body: str, turn: int) -> BotReply:
    """Entry point used by the chat hub.

    Returns the bot's next turn and whether to escalate.
    """
    # Hook: if an LLM is configured, route through a provider here.
    if settings.llm_provider and (settings.openai_api_key or settings.anthropic_api_key):
        try:
            return await _llm_reply(body, turn)
        except Exception:  # noqa: BLE001 - never let the LLM take down the chat
            pass
    return rule_based_reply(body, turn)


async def _llm_reply(body: str, turn: int) -> BotReply:
    # Placeholder: wire in OpenAI / Anthropic here when a key is provided.
    # For now, defer to the rule-based implementation so behavior is deterministic.
    return rule_based_reply(body, turn)
