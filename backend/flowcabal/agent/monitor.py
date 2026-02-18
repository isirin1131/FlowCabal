"""Role C — Monitor agent. Low-level factual checking only.

Checks: continuity errors, entity state contradictions, timeline inconsistencies.
NO creative judgment — humans do final creative review.
"""

from __future__ import annotations

import json

from openviking import SyncOpenViking

from ..config import LLMConfig
from ..models.textblock import NodeId
from .core import AgentContext, CheckResult, Decision, Evaluation, agent_generate


# Dimensions to check
_CHECK_DIMENSIONS = [
    "character_consistency",
    "timeline",
    "world_rules",
    "continuity",
]


async def evaluate(
    node_id: NodeId,
    output: str,
    viking: SyncOpenViking,
    agent_llm: LLMConfig,
    agent_ctx: AgentContext | None = None,
) -> Evaluation:
    """Evaluate an LLM output for factual consistency.

    Uses the agent LLM to check the output against project context.
    Returns an Evaluation with a decision (approve/retry/flag_human).
    """
    # Gather reference context from OpenViking
    reference = _gather_reference(viking, agent_ctx)

    if not reference:
        # No reference material — can't check, auto-approve
        return Evaluation(
            decision=Decision.APPROVE,
            confidence=0.5,
            reason="No reference material available for checking.",
        )

    # Run the factual consistency check
    system = (
        "You are a factual consistency checker for a novel. Your job is to check "
        "whether a new passage contains any factual errors relative to the established "
        "context. Check ONLY for objective errors:\n"
        "- Character consistency: names, appearances, abilities, relationships\n"
        "- Timeline: chronological order, time references, ages\n"
        "- World rules: established magic systems, geography, laws of the world\n"
        "- Continuity: references to past events, object states, location of characters\n\n"
        "Do NOT judge writing quality, style, creativity, or artistic choices.\n\n"
        "Respond in JSON format:\n"
        '{"decision": "approve"|"retry"|"flag_human", "confidence": 0.0-1.0, '
        '"reason": "...", "checks": [{"dimension": "...", "passed": true/false, '
        '"detail": "..."}]}'
    )

    user = (
        f"## Reference Context\n{reference}\n\n"
        f"## New Passage to Check\n{output}\n\n"
        "Check the new passage for factual consistency errors against the reference "
        "context. Respond in the JSON format specified."
    )

    try:
        response = await agent_generate(agent_llm, system, user)
        return _parse_evaluation(response)
    except Exception as e:
        return Evaluation(
            decision=Decision.APPROVE,
            confidence=0.3,
            reason=f"Evaluation failed: {e}",
        )


def _gather_reference(
    viking: SyncOpenViking, agent_ctx: AgentContext | None
) -> str:
    """Collect reference material for consistency checking."""
    parts: list[str] = []

    # Use context from Role A if available
    if agent_ctx and agent_ctx.system_prefix:
        parts.append(agent_ctx.system_prefix)

    # Also pull in entity profiles directly
    entity_sections = ["characters", "locations", "plot-threads"]
    for section in entity_sections:
        uri = f"viking://resources/project/entities/{section}/"
        try:
            ls_result = viking.ls(uri)
            if isinstance(ls_result, list):
                for item in ls_result[:10]:  # Limit to 10 entities
                    item_uri = item if isinstance(item, str) else item.get("uri", str(item))
                    try:
                        abstract = viking.abstract(item_uri)
                        if abstract:
                            parts.append(f"Entity ({section}): {abstract}")
                    except Exception:
                        pass
        except Exception:
            pass

    return "\n\n".join(parts)


def _parse_evaluation(response: str) -> Evaluation:
    """Parse the LLM's JSON response into an Evaluation."""
    # Try to extract JSON from the response
    text = response.strip()

    # Handle markdown code blocks
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return Evaluation(
            decision=Decision.APPROVE,
            confidence=0.3,
            reason=f"Could not parse evaluation response.",
        )

    decision_str = data.get("decision", "approve")
    try:
        decision = Decision(decision_str)
    except ValueError:
        decision = Decision.APPROVE

    checks: list[CheckResult] = []
    for c in data.get("checks", []):
        checks.append(
            CheckResult(
                dimension=c.get("dimension", "unknown"),
                passed=c.get("passed", True),
                detail=c.get("detail", ""),
            )
        )

    return Evaluation(
        decision=decision,
        confidence=data.get("confidence", 0.5),
        reason=data.get("reason", ""),
        checks=checks,
    )
