"""Core-runner — execute a workflow against LLMs.

Merges: runner/engine.py, runner/prompt.py, runner/cache.py.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from .config import FlowCabalConfig
from .models import (
    NodeId,
    NodeDefinition,
    TextBlock,
    TextBlockList,
    VirtualTextBlockDef,
    WorkflowDefinition,
    topological_sort,
)
from . import llm


# ---------------------------------------------------------------------------
# ResolvedCallConfig — runtime-resolved LLM parameters
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class ResolvedCallConfig:
    endpoint: str
    api_key: str
    model: str
    temperature: float
    max_tokens: int
    top_p: float
    presence_penalty: float
    frequency_penalty: float
    streaming: bool


def resolve_call_config(
    config: FlowCabalConfig,
    hints: 'ParameterHints | None' = None,
) -> ResolvedCallConfig:
    """Merge user config defaults with optional per-node hints."""
    from .models import ParameterHints  # noqa: F811

    d = config.generation_defaults
    return ResolvedCallConfig(
        endpoint=config.user_llm.endpoint,
        api_key=config.user_llm.api_key,
        model=config.user_llm.model,
        temperature=hints.temperature if hints and hints.temperature is not None else d.temperature,
        max_tokens=hints.max_tokens if hints and hints.max_tokens is not None else d.max_tokens,
        top_p=d.top_p,
        presence_penalty=d.presence_penalty,
        frequency_penalty=d.frequency_penalty,
        streaming=d.streaming,
    )


# ---------------------------------------------------------------------------
# OutputCache
# ---------------------------------------------------------------------------

class OutputCache:
    """Simple dict wrapper for node outputs."""

    def __init__(self) -> None:
        self._data: dict[NodeId, str] = {}

    def set(self, node_id: NodeId, output: str) -> None:
        self._data[node_id] = output

    def get(self, node_id: NodeId) -> str | None:
        return self._data.get(node_id)

    def all(self) -> dict[NodeId, str]:
        return dict(self._data)

    def clear(self) -> None:
        self._data.clear()


# ---------------------------------------------------------------------------
# Prompt assembly
# ---------------------------------------------------------------------------

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

    agent_ctx: AgentContext with system_prefix/user_suffix (from agents.py).
    """
    system = resolve_text_blocks(node.system_prompt, cache)
    user = resolve_text_blocks(node.user_prompt, cache)

    if agent_ctx is not None:
        system_prefix = getattr(agent_ctx, "system_prefix", "")
        user_suffix = getattr(agent_ctx, "user_suffix", "")
        if system_prefix:
            system = system_prefix + "\n" + system if system else system_prefix
        if user_suffix:
            user = user + "\n" + user_suffix if user else user_suffix

    return system, user


# ---------------------------------------------------------------------------
# AgentHooks — protocol for optional agent integration
# ---------------------------------------------------------------------------

@runtime_checkable
class AgentHooks(Protocol):
    async def get_context(self, node_id: NodeId, node: NodeDefinition) -> object | None:
        """Role A: retrieve context. Returns AgentContext or None."""
        ...

    async def evaluate(self, node_id: NodeId, output: str, agent_ctx: object | None) -> object | None:
        """Role C: evaluate output. Returns Evaluation or None."""
        ...


# ---------------------------------------------------------------------------
# WorkflowCallbacks
# ---------------------------------------------------------------------------

class WorkflowCallbacks(Protocol):
    def on_node_start(self, node_id: NodeId, name: str) -> None: ...
    def on_node_streaming(self, node_id: NodeId, chunk: str) -> None: ...
    def on_node_complete(self, node_id: NodeId, output: str) -> None: ...
    def on_node_evaluation(self, node_id: NodeId, decision: str, reason: str) -> None: ...
    def on_human_decision(self, node_id: NodeId, reason: str) -> str: ...


class _NoopCallbacks:
    def on_node_start(self, node_id: NodeId, name: str) -> None:
        pass

    def on_node_streaming(self, node_id: NodeId, chunk: str) -> None:
        pass

    def on_node_complete(self, node_id: NodeId, output: str) -> None:
        pass

    def on_node_evaluation(self, node_id: NodeId, decision: str, reason: str) -> None:
        pass

    def on_human_decision(self, node_id: NodeId, reason: str) -> str:
        return "approve"


class CliCallbacks:
    """Print progress to stderr, for CLI usage."""

    def __init__(self, *, stream: bool = False) -> None:
        self.stream = stream

    def on_node_start(self, node_id: NodeId, name: str) -> None:
        print(f"\n--- Running node: {name} ({node_id[:8]}...) ---", file=sys.stderr)

    def on_node_streaming(self, node_id: NodeId, chunk: str) -> None:
        if self.stream:
            print(chunk, end="", flush=True)

    def on_node_complete(self, node_id: NodeId, output: str) -> None:
        print(f"\n--- Completed: {node_id[:8]}... ({len(output)} chars) ---", file=sys.stderr)

    def on_node_evaluation(self, node_id: NodeId, decision: str, reason: str) -> None:
        icon = {"approve": "+", "retry": "~", "flag_human": "!"}
        print(f"  [{icon.get(decision, '?')}] Evaluation: {decision} — {reason}", file=sys.stderr)

    def on_human_decision(self, node_id: NodeId, reason: str) -> str:
        print(f"\n  [!] Human review needed: {reason}", file=sys.stderr)
        print("  Accept this output? [y/n/r(etry)]: ", end="", file=sys.stderr, flush=True)
        response = input().strip().lower()
        if response in ("n", "r", "retry"):
            return "retry"
        return "approve"


# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

_MAX_RETRIES = 2


async def _generate_node_output(
    node_id: NodeId,
    node: NodeDefinition,
    cache: OutputCache,
    call_config: ResolvedCallConfig,
    stream: bool,
    cb: WorkflowCallbacks | _NoopCallbacks | CliCallbacks,
    agent_ctx: object | None = None,
) -> str:
    """Generate output for a single node."""
    system_prompt, user_prompt = build_prompt(node, cache, agent_ctx=agent_ctx)

    if stream and call_config.streaming:
        chunks: list[str] = []
        async for chunk in llm.generate_stream(call_config, system_prompt, user_prompt):
            chunks.append(chunk)
            cb.on_node_streaming(node_id, chunk)
        return "".join(chunks)
    else:
        return await llm.generate(call_config, system_prompt, user_prompt)


async def run_workflow(
    workflow: WorkflowDefinition,
    config: FlowCabalConfig,
    *,
    stream: bool = False,
    callbacks: WorkflowCallbacks | _NoopCallbacks | CliCallbacks | None = None,
    agent_hooks: AgentHooks | None = None,
) -> dict[NodeId, str]:
    """Execute a workflow sequentially in topological order.

    When agent_hooks is provided:
    - get_context() injects context from OpenViking into each node's prompt
    - evaluate() checks outputs for factual consistency

    Returns a dict of node_id -> output for all executed nodes.
    """
    cb = callbacks or _NoopCallbacks()
    cache = OutputCache()

    # Topological sort
    sort_result = topological_sort(workflow.nodes)
    if not sort_result.success:
        assert sort_result.error is not None
        raise RuntimeError(f"Cannot execute workflow: {sort_result.error.message}")

    for node_id in sort_result.order:
        node = workflow.nodes[node_id]
        cb.on_node_start(node_id, node.name)

        call_config = resolve_call_config(config, node.parameter_hints)

        # Role A — context injection
        agent_ctx = None
        if agent_hooks is not None:
            agent_ctx = await agent_hooks.get_context(node_id, node)

        # Generate with optional retry loop
        for attempt in range(_MAX_RETRIES + 1):
            output = await _generate_node_output(
                node_id, node, cache, call_config, stream, cb, agent_ctx
            )

            # Role C — factual consistency check
            if agent_hooks is not None:
                evaluation = await agent_hooks.evaluate(node_id, output, agent_ctx)
                if evaluation is not None:
                    decision_val = getattr(evaluation, "decision", None)
                    decision_value = decision_val.value if hasattr(decision_val, "value") else str(decision_val)
                    reason = getattr(evaluation, "reason", "")
                    cb.on_node_evaluation(node_id, decision_value, reason)

                    if decision_value == "retry" and attempt < _MAX_RETRIES:
                        print(f"  Retrying ({attempt + 1}/{_MAX_RETRIES})...", file=sys.stderr)
                        continue
                    elif decision_value == "flag_human":
                        human_decision = cb.on_human_decision(node_id, reason)
                        if human_decision == "retry" and attempt < _MAX_RETRIES:
                            continue

            break  # Accept the output

        cache.set(node_id, output)
        cb.on_node_complete(node_id, output)

    return cache.all()
