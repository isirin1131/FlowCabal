"""Workflow system — mirrors flow-cabal/src/lib/core/workflow.ts.

WorkflowDefinition and Kahn's topological sort.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from .textblock import NodeId, generate_id
from .node import NodeDefinition, get_node_dependencies, node_from_dict, node_to_dict


# ---------------------------------------------------------------------------
# WorkflowDefinition
# ---------------------------------------------------------------------------

@dataclass(slots=True)
class WorkflowDefinition:
    id: str = field(default_factory=generate_id)
    name: str = ""
    nodes: dict[NodeId, NodeDefinition] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Topological sort (Kahn's algorithm, ported from workflow.ts)
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
# JSON serialization
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
