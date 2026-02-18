"""Prompt assembly — resolve TextBlockLists into final prompt strings."""

from __future__ import annotations

from ..models.textblock import TextBlockList, TextBlock, VirtualTextBlockDef
from ..models.node import NodeDefinition
from ..runner.cache import OutputCache


def resolve_text_blocks(tbl: TextBlockList, cache: OutputCache) -> str:
    """Resolve all blocks in a TextBlockList to a single string.

    - TextBlock: use content directly
    - VirtualTextBlockDef: look up resolved output from cache
    """
    parts: list[str] = []
    for block in tbl.blocks:
        if isinstance(block, TextBlock):
            parts.append(block.content)
        elif isinstance(block, VirtualTextBlockDef):
            resolved = cache.get(block.source_node_id)
            if resolved is not None:
                parts.append(resolved)
            else:
                label = block.display_name or block.source_node_id
                parts.append(f"[Unresolved: {label}]")
    return "\n".join(parts)


def build_prompt(
    node: NodeDefinition,
    cache: OutputCache,
    agent_ctx: object | None = None,
) -> tuple[str, str]:
    """Build (system, user) prompt strings for an LLM call.

    agent_ctx is reserved for Phase 3 — AgentContext with system_prefix/user_suffix.
    """
    system = resolve_text_blocks(node.api_config.system_prompt, cache)
    user = resolve_text_blocks(node.api_config.user_prompt, cache)

    # Phase 3: inject agent context
    if agent_ctx is not None:
        system_prefix = getattr(agent_ctx, "system_prefix", "")
        user_suffix = getattr(agent_ctx, "user_suffix", "")
        if system_prefix:
            system = system_prefix + "\n" + system if system else system_prefix
        if user_suffix:
            user = user + "\n" + user_suffix if user else user_suffix

    return system, user
