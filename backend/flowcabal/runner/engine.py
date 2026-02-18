"""Core-runner — execute a workflow against LLMs."""

from __future__ import annotations

import sys
from typing import Protocol

from openviking import SyncOpenViking

from ..config import FlowCabalConfig
from ..models.textblock import NodeId
from ..models.node import ApiConnection
from ..models.workflow import WorkflowDefinition, topological_sort
from ..agent.core import AgentContext, Decision
from .. import llm
from .cache import OutputCache
from .prompt import build_prompt


# ---------------------------------------------------------------------------
# Callbacks protocol
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


def _resolve_connection(node_connection: ApiConnection, config: FlowCabalConfig) -> ApiConnection:
    """Use node's connection if configured, else fall back to global user_llm."""
    if node_connection.api_key:
        return node_connection
    return ApiConnection(
        endpoint=config.user_llm.endpoint,
        api_key=config.user_llm.api_key,
        model=node_connection.model if node_connection.model != "gpt-4o" else config.user_llm.model,
    )


async def _generate_node_output(
    node_id: NodeId,
    node: 'NodeDefinition',
    cache: OutputCache,
    connection: ApiConnection,
    stream: bool,
    cb: WorkflowCallbacks | _NoopCallbacks | CliCallbacks,
    agent_ctx: AgentContext | None = None,
) -> str:
    """Generate output for a single node."""
    from ..models.node import NodeDefinition  # avoid circular

    system_prompt, user_prompt = build_prompt(node, cache, agent_ctx=agent_ctx)

    if stream and node.api_config.parameters.streaming:
        chunks: list[str] = []
        async for chunk in llm.generate_stream(
            connection, node.api_config.parameters, system_prompt, user_prompt
        ):
            chunks.append(chunk)
            cb.on_node_streaming(node_id, chunk)
        return "".join(chunks)
    else:
        return await llm.generate(
            connection, node.api_config.parameters, system_prompt, user_prompt
        )


async def run_workflow(
    workflow: WorkflowDefinition,
    config: FlowCabalConfig,
    *,
    stream: bool = False,
    callbacks: WorkflowCallbacks | _NoopCallbacks | CliCallbacks | None = None,
    viking: SyncOpenViking | None = None,
    enable_agents: bool = False,
) -> dict[NodeId, str]:
    """Execute a workflow sequentially in topological order.

    When enable_agents=True and a viking client is provided:
    - Role A injects context from OpenViking into each node's prompt
    - Role C evaluates outputs for factual consistency

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

        connection = _resolve_connection(node.api_config.connection, config)

        # Phase 3: Role A — context injection
        agent_ctx: AgentContext | None = None
        if enable_agents and viking is not None:
            from ..agent.context import get_context
            agent_ctx = await get_context(node_id, node, viking, config.agent_llm)

        # Generate with optional retry loop
        for attempt in range(_MAX_RETRIES + 1):
            output = await _generate_node_output(
                node_id, node, cache, connection, stream, cb, agent_ctx
            )

            # Phase 3: Role C — factual consistency check
            if enable_agents and viking is not None:
                from ..agent.monitor import evaluate
                evaluation = await evaluate(
                    node_id, output, viking, config.agent_llm, agent_ctx
                )
                cb.on_node_evaluation(node_id, evaluation.decision.value, evaluation.reason)

                if evaluation.decision == Decision.RETRY and attempt < _MAX_RETRIES:
                    print(f"  Retrying ({attempt + 1}/{_MAX_RETRIES})...", file=sys.stderr)
                    continue
                elif evaluation.decision == Decision.FLAG_HUMAN:
                    human_decision = cb.on_human_decision(node_id, evaluation.reason)
                    if human_decision == "retry" and attempt < _MAX_RETRIES:
                        continue

            break  # Accept the output

        cache.set(node_id, output)
        cb.on_node_complete(node_id, output)

    return cache.all()
