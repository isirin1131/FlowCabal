"""Runtime output cache — holds node outputs during workflow execution."""

from __future__ import annotations

from ..models.textblock import NodeId


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
