"""Agent core — shared types and base loop for the agent system."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from openai import AsyncOpenAI

from ..config import LLMConfig


# ---------------------------------------------------------------------------
# AgentContext — injected into prompt assembly (Layer 2)
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class AgentContext:
    """Ephemeral context produced by Role A, injected into the prompt.

    system_prefix: prepended to the system prompt
    user_suffix:   appended to the user prompt
    sources:       URIs of OpenViking resources used (for traceability)
    """
    system_prefix: str = ""
    user_suffix: str = ""
    sources: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Evaluation — produced by Role C
# ---------------------------------------------------------------------------

class Decision(str, Enum):
    APPROVE = "approve"
    RETRY = "retry"
    FLAG_HUMAN = "flag_human"


@dataclass(slots=True)
class CheckResult:
    dimension: str   # e.g. "character_consistency", "timeline", "world_rules"
    passed: bool
    detail: str = ""


@dataclass(slots=True)
class Evaluation:
    decision: Decision
    confidence: float  # 0.0–1.0
    reason: str = ""
    checks: list[CheckResult] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Agent LLM helper
# ---------------------------------------------------------------------------

async def agent_generate(config: LLMConfig, system: str, user: str) -> str:
    """Single-shot generation using the agent LLM (for meta-reasoning)."""
    client = AsyncOpenAI(base_url=config.endpoint, api_key=config.api_key)
    messages: list[dict] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})

    response = await client.chat.completions.create(
        model=config.model,
        messages=messages,
        temperature=0.3,  # Low temperature for analytical tasks
        max_tokens=4096,
    )
    return response.choices[0].message.content or ""
