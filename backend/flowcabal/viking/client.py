"""OpenViking client initialization and lifecycle."""

from __future__ import annotations

from pathlib import Path

from openviking import SyncOpenViking

from ..config import FlowCabalConfig


def init_viking(config: FlowCabalConfig) -> SyncOpenViking:
    """Create and initialize an OpenViking client in embedded mode.

    Data is stored under config.data_dir / "viking".
    VLM and embedding models are configured from config.agent_llm and config.embedding.
    """
    viking_path = config.ensure_data_dir() / "viking"
    viking_path.mkdir(parents=True, exist_ok=True)

    client = SyncOpenViking(path=str(viking_path))
    client.initialize()
    return client


def close_viking(client: SyncOpenViking) -> None:
    """Cleanly shut down the OpenViking client."""
    client.close()
