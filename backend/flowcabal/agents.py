"""Agent system — shared types, Role A context, Role C monitor, profile generation.

Merges: agent/core.py, agent/context.py, agent/monitor.py, viking/profiles.py.
"""

from __future__ import annotations

import json
import tempfile
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

from openai import AsyncOpenAI
from openviking import SyncOpenViking

from .config import LLMConfig
from .models import NodeId, NodeDefinition, TextBlock


# ---------------------------------------------------------------------------
# Agent core types
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


# ---------------------------------------------------------------------------
# Role A — Context agent
# ---------------------------------------------------------------------------

_MAX_CONTEXT_CHARS = 100_000

_DETERMINISTIC_INCLUDES = [
    "viking://resources/project/meta/outline/",
    "viking://resources/project/meta/style-guide/",
]


async def get_context(
    node_id: str,
    node: NodeDefinition,
    viking: SyncOpenViking,
    agent_llm: LLMConfig,
) -> AgentContext:
    """Build context for a node by querying OpenViking.

    Retrieval pipeline:
    1. Intent analysis from node's prompt content
    2. Deterministic includes: /meta/outline, /meta/style-guide
    3. Profile navigation (L1 of relevant profiles)
    4. Hierarchical manuscript search (L0 scan → L1 read → L2 deep read)

    Bounded to ~25-30K token budget.
    """
    context_parts: list[str] = []
    sources: list[str] = []
    budget_remaining = _MAX_CONTEXT_CHARS

    def add_context(label: str, content: str, uri: str) -> None:
        nonlocal budget_remaining
        if not content or budget_remaining <= 0:
            return
        entry = f"### {label}\n{content}\n"
        if len(entry) > budget_remaining:
            entry = entry[:budget_remaining] + "\n[...truncated]"
        context_parts.append(entry)
        sources.append(uri)
        budget_remaining -= len(entry)

    # Step 1: Extract intent from node's prompt content
    prompt_text = _extract_prompt_text(node)
    intent = ""
    if prompt_text:
        intent = await _analyze_intent(prompt_text, agent_llm)

    # Step 2: Deterministic includes
    for uri in _DETERMINISTIC_INCLUDES:
        try:
            overview = viking.overview(uri)
            if overview:
                label = uri.split("/")[-2]
                add_context(f"Meta: {label}", overview, uri)
        except Exception:
            pass

    # Step 3: Profile navigation — read L1 of relevant profiles
    if intent and budget_remaining > 0:
        profile_sections = ["characters", "plot-threads", "world-state", "themes"]
        for section in profile_sections:
            if budget_remaining <= 0:
                break
            section_uri = f"viking://resources/project/profiles/{section}/"
            try:
                ls_result = viking.ls(section_uri)
                if isinstance(ls_result, list):
                    for item in ls_result:
                        if budget_remaining <= 0:
                            break
                        item_uri = item if isinstance(item, str) else item.get("uri", str(item))
                        try:
                            overview = viking.overview(item_uri)
                            if overview:
                                add_context(f"Profile ({section})", overview, item_uri)
                        except Exception:
                            pass
            except Exception:
                pass

    # Step 4: Semantic search for relevant manuscript content
    if intent and budget_remaining > 0:
        try:
            results = viking.find(
                intent,
                target_uri="viking://resources/project/manuscript/",
                limit=5,
            )
            for r in results.resources:
                if budget_remaining <= 0:
                    break
                try:
                    overview = viking.overview(r.uri)
                    if overview:
                        add_context("Manuscript context", overview, r.uri)
                except Exception:
                    pass
        except Exception:
            pass

    # Build the AgentContext
    if not context_parts:
        return AgentContext(sources=sources)

    system_prefix = (
        "## Project Context (auto-retrieved)\n\n"
        "The following context was automatically retrieved from the project knowledge base. "
        "Use it to maintain consistency with established characters, plot, and world rules.\n\n"
        + "\n".join(context_parts)
    )

    return AgentContext(
        system_prefix=system_prefix,
        sources=sources,
    )


def _extract_prompt_text(node: NodeDefinition) -> str:
    """Extract plain text from the node's prompt blocks for intent analysis."""
    parts: list[str] = []
    for block in node.system_prompt.blocks:
        if isinstance(block, TextBlock):
            parts.append(block.content)
    for block in node.user_prompt.blocks:
        if isinstance(block, TextBlock):
            parts.append(block.content)
    return " ".join(parts)


async def _analyze_intent(prompt_text: str, agent_llm: LLMConfig) -> str:
    """Use the agent LLM to analyze the prompt's intent for retrieval."""
    system = (
        "You are a retrieval query generator. Given a writing prompt, "
        "produce a concise search query (1-2 sentences) that captures what context "
        "would be needed from the project's knowledge base to write this section well. "
        "Focus on: characters involved, plot threads referenced, locations mentioned, "
        "timeline position, and any world-building rules that apply."
    )
    user = f"Writing prompt:\n{prompt_text[:2000]}\n\nSearch query:"

    try:
        return await agent_generate(agent_llm, system, user)
    except Exception:
        return prompt_text[:500]


# ---------------------------------------------------------------------------
# Role C — Monitor agent
# ---------------------------------------------------------------------------

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
    """Evaluate an LLM output for factual consistency."""
    reference = _gather_reference(viking, agent_ctx)

    if not reference:
        return Evaluation(
            decision=Decision.APPROVE,
            confidence=0.5,
            reason="No reference material available for checking.",
        )

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

    if agent_ctx and agent_ctx.system_prefix:
        parts.append(agent_ctx.system_prefix)

    entity_sections = ["characters", "locations", "plot-threads"]
    for section in entity_sections:
        uri = f"viking://resources/project/entities/{section}/"
        try:
            ls_result = viking.ls(uri)
            if isinstance(ls_result, list):
                for item in ls_result[:10]:
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
    text = response.strip()

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
            reason="Could not parse evaluation response.",
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


# ---------------------------------------------------------------------------
# LiveAgentHooks — implements AgentHooks using Role A + Role C
# ---------------------------------------------------------------------------

class LiveAgentHooks:
    """Connects the runner to live Role A / Role C agents via OpenViking."""

    def __init__(self, viking: SyncOpenViking, agent_llm: LLMConfig) -> None:
        self.viking = viking
        self.agent_llm = agent_llm

    async def get_context(self, node_id: NodeId, node: NodeDefinition) -> AgentContext | None:
        return await get_context(node_id, node, self.viking, self.agent_llm)

    async def evaluate(self, node_id: NodeId, output: str, agent_ctx: object | None) -> Evaluation | None:
        ctx = agent_ctx if isinstance(agent_ctx, AgentContext) else None
        return await evaluate(node_id, output, self.viking, self.agent_llm, ctx)


# ---------------------------------------------------------------------------
# Profile generation (standalone function)
# ---------------------------------------------------------------------------

_PROFILE_PROMPTS = {
    "characters": (
        "Analyze the manuscript content and create a comprehensive character profile. Include:\n"
        "- Full name and aliases\n"
        "- Physical description\n"
        "- Personality traits and arc\n"
        "- Key relationships\n"
        "- Current status and location in the story\n"
        "- Notable quotes or speech patterns"
    ),
    "plot-threads": (
        "Analyze the manuscript content and create a plot thread summary. Include:\n"
        "- Thread name and description\n"
        "- Current status (active, resolved, dormant)\n"
        "- Key events in chronological order\n"
        "- Characters involved\n"
        "- Unresolved questions or hooks\n"
        "- Connections to other plot threads"
    ),
}


async def generate_profile(
    viking: SyncOpenViking,
    agent_llm: LLMConfig,
    profile_type: str,
    entity_name: str,
) -> str:
    """Generate or regenerate a profile for a specific entity."""
    if profile_type not in _PROFILE_PROMPTS:
        raise ValueError(f"Unknown profile type: {profile_type}. Supported: {list(_PROFILE_PROMPTS.keys())}")

    manuscript_content = _gather_entity_mentions(viking, entity_name)

    if not manuscript_content:
        return f"No manuscript content found mentioning '{entity_name}'."

    system = (
        f"You are a literary analyst creating a {profile_type.rstrip('s')} profile for a novel. "
        "Be thorough and precise. Only include information explicitly present in the text."
    )
    user = (
        f"{_PROFILE_PROMPTS[profile_type]}\n\n"
        f"Entity name: {entity_name}\n\n"
        f"Manuscript content:\n{manuscript_content[:30000]}"
    )

    profile_text = await agent_generate(agent_llm, system, user)

    profile_uri = f"viking://resources/project/profiles/{profile_type}/{entity_name}/"
    try:
        viking.mkdir(profile_uri)
    except Exception:
        pass

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", delete=False, prefix=f"profile-{entity_name}-"
    ) as f:
        f.write(f"# {entity_name}\n\n{profile_text}")
        tmp_path = f.name

    try:
        viking.add_resource(
            path=tmp_path,
            target=profile_uri,
            reason=f"Profile for {entity_name} ({profile_type})",
            wait=True,
        )
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    return profile_text


def _gather_entity_mentions(viking: SyncOpenViking, entity_name: str) -> str:
    """Search OpenViking for manuscript passages mentioning an entity."""
    parts: list[str] = []

    try:
        results = viking.find(
            entity_name,
            target_uri="viking://resources/project/manuscript/",
            limit=10,
        )
        for r in results.resources:
            try:
                content = viking.read(r.uri)
                if content:
                    parts.append(content)
            except Exception:
                try:
                    overview = viking.overview(r.uri)
                    if overview:
                        parts.append(overview)
                except Exception:
                    pass
    except Exception:
        pass

    return "\n\n---\n\n".join(parts)
