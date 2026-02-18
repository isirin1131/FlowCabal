"""SQLite persistence for workflows and metadata."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from types import TracebackType

import aiosqlite

from .config import FlowCabalConfig
from .models.textblock import NodeId
from .models.workflow import WorkflowDefinition, workflow_from_dict, workflow_to_dict


_SCHEMA = """
CREATE TABLE IF NOT EXISTS workflows (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    data        TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_outputs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id     TEXT NOT NULL,
    workflow_id TEXT NOT NULL,
    node_id    TEXT NOT NULL,
    output     TEXT NOT NULL,
    persisted  INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_run_outputs_run ON run_outputs(run_id);
CREATE INDEX IF NOT EXISTS idx_run_outputs_workflow ON run_outputs(workflow_id);
"""


class Database:
    """Async SQLite wrapper for FlowCabal persistence."""

    def __init__(self, config: FlowCabalConfig) -> None:
        self._db_path = config.ensure_data_dir() / "flowcabal.db"
        self._db: aiosqlite.Connection | None = None

    async def __aenter__(self) -> Database:
        self._db = await aiosqlite.connect(self._db_path)
        self._db.row_factory = aiosqlite.Row
        await self._db.executescript(_SCHEMA)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        if self._db:
            await self._db.close()
            self._db = None

    @property
    def db(self) -> aiosqlite.Connection:
        assert self._db is not None, "Database not opened. Use 'async with Database(...)'"
        return self._db

    # -----------------------------------------------------------------------
    # Workflows
    # -----------------------------------------------------------------------

    async def save_workflow(self, wf: WorkflowDefinition) -> None:
        now = datetime.now(timezone.utc).isoformat()
        data = json.dumps(workflow_to_dict(wf))
        await self.db.execute(
            """INSERT INTO workflows (id, name, data, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET name=?, data=?, updated_at=?""",
            (wf.id, wf.name, data, now, now, wf.name, data, now),
        )
        await self.db.commit()

    async def load_workflow(self, workflow_id: str) -> WorkflowDefinition | None:
        cursor = await self.db.execute(
            "SELECT data FROM workflows WHERE id = ?", (workflow_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return workflow_from_dict(json.loads(row["data"]))

    async def load_workflow_by_prefix(self, prefix: str) -> WorkflowDefinition | None:
        cursor = await self.db.execute(
            "SELECT data FROM workflows WHERE id LIKE ? LIMIT 1", (prefix + "%",)
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return workflow_from_dict(json.loads(row["data"]))

    async def list_workflows(self) -> list[dict]:
        cursor = await self.db.execute(
            "SELECT id, name, created_at, updated_at FROM workflows ORDER BY updated_at DESC"
        )
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]

    async def delete_workflow(self, workflow_id: str) -> bool:
        cursor = await self.db.execute(
            "DELETE FROM workflows WHERE id = ?", (workflow_id,)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    async def delete_workflow_by_prefix(self, prefix: str) -> bool:
        cursor = await self.db.execute(
            "DELETE FROM workflows WHERE id LIKE ?", (prefix + "%",)
        )
        await self.db.commit()
        return cursor.rowcount > 0

    # -----------------------------------------------------------------------
    # Run outputs (temporary cache for curation)
    # -----------------------------------------------------------------------

    async def save_run_output(
        self, run_id: str, workflow_id: str, node_id: NodeId, output: str
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        await self.db.execute(
            """INSERT INTO run_outputs (run_id, workflow_id, node_id, output, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (run_id, workflow_id, node_id, output, now),
        )
        await self.db.commit()

    async def get_run_output(self, run_id: str, node_id: NodeId) -> str | None:
        cursor = await self.db.execute(
            "SELECT output FROM run_outputs WHERE run_id = ? AND node_id = ? ORDER BY id DESC LIMIT 1",
            (run_id, node_id),
        )
        row = await cursor.fetchone()
        return row["output"] if row else None

    async def list_run_outputs(self, run_id: str) -> list[dict]:
        cursor = await self.db.execute(
            "SELECT node_id, output, persisted, created_at FROM run_outputs WHERE run_id = ? ORDER BY id",
            (run_id,),
        )
        return [dict(row) for row in await cursor.fetchall()]

    async def mark_persisted(self, run_id: str, node_id: NodeId) -> None:
        await self.db.execute(
            "UPDATE run_outputs SET persisted = 1 WHERE run_id = ? AND node_id = ?",
            (run_id, node_id),
        )
        await self.db.commit()
