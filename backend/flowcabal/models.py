"""Core model types — TextBlock, NodeDefinition, WorkflowDefinition.

Pure headless models. No frontend concepts (Position), no user-specific config
(ApiConnection, ApiParameters). Workflow files are shareable.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal
from uuid import uuid4


# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

type NodeId = str
type TextBlockId = str


def generate_id() -> str:
    return str(uuid4())


# ---------------------------------------------------------------------------
# TextBlock — static text
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class TextBlock:
    type: Literal["text"] = field(default="text", init=False)
    id: TextBlockId = field(default_factory=generate_id)
    content: str = ""


# ---------------------------------------------------------------------------
# VirtualTextBlockDef — references another node's output
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class VirtualTextBlockDef:
    type: Literal["virtual"] = field(default="virtual", init=False)
    id: TextBlockId = field(default_factory=generate_id)
    source_node_id: NodeId = ""
    display_name: str | None = None


# ---------------------------------------------------------------------------
# Union + container
# ---------------------------------------------------------------------------

type AnyTextBlockDef = TextBlock | VirtualTextBlockDef


@dataclass(slots=True)
class TextBlockList:
    id: str = field(default_factory=generate_id)
    blocks: list[AnyTextBlockDef] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Dependency extraction
# ---------------------------------------------------------------------------

def get_dependencies(tbl: TextBlockList) -> list[NodeId]:
    """Return deduplicated source node IDs referenced by virtual blocks."""
    seen: set[NodeId] = set()
    result: list[NodeId] = []
    for block in tbl.blocks:
        if isinstance(block, VirtualTextBlockDef) and block.source_node_id not in seen:
            seen.add(block.source_node_id)
            result.append(block.source_node_id)
    return result


# ---------------------------------------------------------------------------
# ParameterHints — optional per-node suggestions (not full config)
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class ParameterHints:
    temperature: float | None = None
    max_tokens: int | None = None


# ---------------------------------------------------------------------------
# NodeDefinition — headless, no Position or ApiConfig
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class NodeDefinition:
    id: NodeId = field(default_factory=generate_id)
    name: str = ""
    system_prompt: TextBlockList = field(default_factory=TextBlockList)
    user_prompt: TextBlockList = field(default_factory=TextBlockList)
    parameter_hints: ParameterHints | None = None


def get_node_dependencies(node: NodeDefinition) -> list[NodeId]:
    """Return all node IDs this node depends on (via virtual blocks)."""
    sys_deps = get_dependencies(node.system_prompt)
    usr_deps = get_dependencies(node.user_prompt)
    seen: set[NodeId] = set(sys_deps)
    result = list(sys_deps)
    for d in usr_deps:
        if d not in seen:
            seen.add(d)
            result.append(d)
    return result


# ---------------------------------------------------------------------------
# WorkflowDefinition
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class WorkflowDefinition:
    id: str = field(default_factory=generate_id)
    name: str = ""
    nodes: dict[NodeId, NodeDefinition] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Topological sort (Kahn's algorithm)
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class DependencyError:
    type: Literal["cycle", "missing"]
    node_ids: list[NodeId]
    message: str


@dataclass(slots=True)
class TopologicalSortResult:
    success: bool
    order: list[NodeId] = field(default_factory=list)
    error: DependencyError | None = None


def topological_sort(nodes: dict[NodeId, NodeDefinition]) -> TopologicalSortResult:
    """Kahn's algorithm. Returns execution order or error."""
    in_degree: dict[NodeId, int] = {nid: 0 for nid in nodes}
    dependents: dict[NodeId, list[NodeId]] = {nid: [] for nid in nodes}

    for nid, node in nodes.items():
        deps = get_node_dependencies(node)
        for dep_id in deps:
            if dep_id not in nodes:
                return TopologicalSortResult(
                    success=False,
                    error=DependencyError(
                        type="missing",
                        node_ids=[nid, dep_id],
                        message=f'Node "{node.name}" depends on missing node "{dep_id}"',
                    ),
                )
            in_degree[nid] = in_degree.get(nid, 0) + 1
            dependents[dep_id].append(nid)

    queue: list[NodeId] = [nid for nid, deg in in_degree.items() if deg == 0]
    result: list[NodeId] = []

    while queue:
        current = queue.pop(0)
        result.append(current)
        for dep in dependents.get(current, []):
            in_degree[dep] -= 1
            if in_degree[dep] == 0:
                queue.append(dep)

    if len(result) != len(nodes):
        cycle_nodes = [nid for nid in nodes if nid not in result]
        return TopologicalSortResult(
            success=False,
            error=DependencyError(
                type="cycle",
                node_ids=cycle_nodes,
                message=f"Circular dependency detected involving nodes: {', '.join(cycle_nodes)}",
            ),
        )

    return TopologicalSortResult(success=True, order=result)


# ---------------------------------------------------------------------------
# JSON serialization — TextBlock helpers
# ---------------------------------------------------------------------------

def _block_to_dict(block: AnyTextBlockDef) -> dict:
    if isinstance(block, TextBlock):
        return {"type": "text", "id": block.id, "content": block.content}
    return {
        "type": "virtual",
        "id": block.id,
        "sourceNodeId": block.source_node_id,
        **({"displayName": block.display_name} if block.display_name else {}),
    }


def _block_from_dict(d: dict) -> AnyTextBlockDef:
    if d["type"] == "text":
        return TextBlock(id=d["id"], content=d.get("content", ""))
    return VirtualTextBlockDef(
        id=d["id"],
        source_node_id=d.get("sourceNodeId", d.get("source_node_id", "")),
        display_name=d.get("displayName", d.get("display_name")),
    )


def text_block_list_to_dict(tbl: TextBlockList) -> dict:
    return {"id": tbl.id, "blocks": [_block_to_dict(b) for b in tbl.blocks]}


def text_block_list_from_dict(d: dict) -> TextBlockList:
    return TextBlockList(
        id=d["id"],
        blocks=[_block_from_dict(b) for b in d.get("blocks", [])],
    )


# ---------------------------------------------------------------------------
# JSON serialization — Node
# ---------------------------------------------------------------------------

def _hints_to_dict(h: ParameterHints) -> dict:
    d: dict = {}
    if h.temperature is not None:
        d["temperature"] = h.temperature
    if h.max_tokens is not None:
        d["max_tokens"] = h.max_tokens
    return d


def _hints_from_dict(d: dict) -> ParameterHints:
    return ParameterHints(
        temperature=d.get("temperature"),
        max_tokens=d.get("maxTokens", d.get("max_tokens")),
    )


def node_to_dict(node: NodeDefinition) -> dict:
    d: dict = {
        "id": node.id,
        "name": node.name,
        "system_prompt": text_block_list_to_dict(node.system_prompt),
        "user_prompt": text_block_list_to_dict(node.user_prompt),
    }
    if node.parameter_hints is not None:
        d["parameter_hints"] = _hints_to_dict(node.parameter_hints)
    return d


def node_from_dict(d: dict) -> NodeDefinition:
    """Deserialize a node. Accepts both new flat format and legacy apiConfig format."""
    # Legacy format: apiConfig.systemPrompt / apiConfig.userPrompt
    if "apiConfig" in d or "api_config" in d:
        api_raw = d.get("apiConfig", d.get("api_config", {}))
        sp_raw = api_raw.get("systemPrompt", api_raw.get("system_prompt", {"id": generate_id(), "blocks": []}))
        up_raw = api_raw.get("userPrompt", api_raw.get("user_prompt", {"id": generate_id(), "blocks": []}))

        # Extract hints from legacy parameters
        params_raw = api_raw.get("parameters", {})
        hints = None
        if params_raw:
            temp = params_raw.get("temperature")
            max_t = params_raw.get("maxTokens", params_raw.get("max_tokens"))
            if temp is not None or max_t is not None:
                hints = ParameterHints(temperature=temp, max_tokens=max_t)

        return NodeDefinition(
            id=d["id"],
            name=d.get("name", ""),
            system_prompt=text_block_list_from_dict(sp_raw),
            user_prompt=text_block_list_from_dict(up_raw),
            parameter_hints=hints,
        )

    # New flat format
    sp_raw = d.get("system_prompt", d.get("systemPrompt", {"id": generate_id(), "blocks": []}))
    up_raw = d.get("user_prompt", d.get("userPrompt", {"id": generate_id(), "blocks": []}))
    hints = None
    if hints_raw := d.get("parameter_hints", d.get("parameterHints")):
        hints = _hints_from_dict(hints_raw)

    return NodeDefinition(
        id=d["id"],
        name=d.get("name", ""),
        system_prompt=text_block_list_from_dict(sp_raw),
        user_prompt=text_block_list_from_dict(up_raw),
        parameter_hints=hints,
    )


# ---------------------------------------------------------------------------
# JSON serialization — Workflow
# ---------------------------------------------------------------------------

def workflow_to_dict(wf: WorkflowDefinition) -> dict:
    return {
        "id": wf.id,
        "name": wf.name,
        "nodes": {nid: node_to_dict(n) for nid, n in wf.nodes.items()},
    }


def workflow_from_dict(d: dict) -> WorkflowDefinition:
    nodes_raw = d.get("nodes", {})
    # Support both dict-of-dicts and list-of-dicts
    if isinstance(nodes_raw, list):
        nodes = {n["id"]: node_from_dict(n) for n in nodes_raw}
    else:
        nodes = {nid: node_from_dict(n) for nid, n in nodes_raw.items()}
    return WorkflowDefinition(
        id=d.get("id", generate_id()),
        name=d.get("name", ""),
        nodes=nodes,
    )
