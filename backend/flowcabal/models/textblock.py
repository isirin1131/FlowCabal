"""TextBlock system — mirrors flow-cabal/src/lib/core/textblock.ts.

Pure metadata definitions. Runtime resolution belongs in the runner.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Union
from uuid import uuid4

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
# JSON serialization helpers
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
