"""Curation pipeline — persist approved outputs to OpenViking."""

from __future__ import annotations

import tempfile
from pathlib import Path

from openviking import SyncOpenViking

from ..models.textblock import NodeId


def persist_output(
    client: SyncOpenViking,
    node_id: NodeId,
    output: str,
    *,
    chapter_name: str | None = None,
    tags: list[str] | None = None,
) -> str:
    """Write a curated output to the manuscript section of OpenViking.

    Uses add_resource for full semantic processing (L0/L1 generation + vectorization).
    Returns the viking:// URI of the stored resource.
    """
    name = chapter_name or f"output-{node_id[:8]}"
    target_uri = f"viking://resources/project/manuscript/{name}/"

    # add_resource requires a filesystem path, so write to a temp file
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", delete=False, prefix=f"fc-{name}-"
    ) as f:
        f.write(output)
        tmp_path = f.name

    try:
        result = client.add_resource(
            path=tmp_path,
            target=target_uri,
            reason=f"Curated output from node {node_id}",
            instruction="Analyze narrative content, characters, and plot progression.",
            wait=True,
        )
        return result.get("root_uri", target_uri)
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def delete_output(client: SyncOpenViking, uri: str) -> None:
    """Remove a curated output from OpenViking."""
    client.rm(uri, recursive=True)


def list_outputs(client: SyncOpenViking) -> list[dict]:
    """List all curated outputs in the manuscript section."""
    try:
        ls_result = client.ls("viking://resources/project/manuscript/")
    except Exception:
        return []

    outputs: list[dict] = []
    if isinstance(ls_result, list):
        for item in ls_result:
            uri = item if isinstance(item, str) else item.get("uri", str(item))
            try:
                abstract = client.abstract(uri)
            except Exception:
                abstract = ""
            outputs.append({"uri": uri, "abstract": abstract})
    return outputs
