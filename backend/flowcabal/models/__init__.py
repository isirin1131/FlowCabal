"""Core model types mirroring the frontend core/ TypeScript definitions."""

from .textblock import (
    TextBlock,
    VirtualTextBlockDef,
    AnyTextBlockDef,
    TextBlockList,
    get_dependencies,
)
from .node import (
    Position,
    ApiConnection,
    ApiParameters,
    ApiConfiguration,
    NodeDefinition,
    get_node_dependencies,
)
from .workflow import (
    WorkflowDefinition,
    DependencyError,
    TopologicalSortResult,
    topological_sort,
)

__all__ = [
    "TextBlock",
    "VirtualTextBlockDef",
    "AnyTextBlockDef",
    "TextBlockList",
    "get_dependencies",
    "Position",
    "ApiConnection",
    "ApiParameters",
    "ApiConfiguration",
    "NodeDefinition",
    "get_node_dependencies",
    "WorkflowDefinition",
    "DependencyError",
    "TopologicalSortResult",
    "topological_sort",
]
