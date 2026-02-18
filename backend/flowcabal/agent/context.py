"""Role A — Context agent. Queries OpenViking for relevant context.

Produces an AgentContext that is injected ephemerally into prompts.
Pure function of (node_config, project_state). Deterministic given same inputs.
"""

from __future__ import annotations

from openviking import SyncOpenViking

from ..config import LLMConfig
from ..models.node import NodeDefinition
from ..models.textblock import TextBlock
from .core import AgentContext, agent_generate


# Maximum token budget for context injection (~25-30K tokens ≈ ~100K chars)
_MAX_CONTEXT_CHARS = 100_000

# Deterministic includes — always injected if they exist
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
            # Read L1 (overview) for meta resources
            overview = viking.overview(uri)
            if overview:
                label = uri.split("/")[-2]  # e.g. "outline"
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
                    # Start with L1 (overview), upgrade to L2 if budget allows
                    overview = viking.overview(r.uri)
                    if overview:
                        add_context(f"Manuscript context", overview, r.uri)
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
    for block in node.api_config.system_prompt.blocks:
        if isinstance(block, TextBlock):
            parts.append(block.content)
    for block in node.api_config.user_prompt.blocks:
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
        # Fall back to using the prompt text directly as a search query
        return prompt_text[:500]
