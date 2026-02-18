"""SQLite persistence for workflows and metadata (SQLAlchemy async ORM)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from types import TracebackType

from sqlalchemy import Connection, delete, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine

from .config import FlowCabalConfig
from .db_models import RunOutputRow, WorkflowRow
from .models.textblock import NodeId
from .models.workflow import WorkflowDefinition, workflow_from_dict, workflow_to_dict


class Database:
    """Async SQLite wrapper for FlowCabal persistence."""

    def __init__(self, config: FlowCabalConfig) -> None:
        db_path = config.ensure_data_dir() / "flowcabal.db"
        self._engine: AsyncEngine = create_async_engine(
            f"sqlite+aiosqlite:///{db_path}",
            echo=False,
        )
        self._session = async_sessionmaker(
            self._engine, expire_on_commit=False
        )

    async def __aenter__(self) -> Database:
        from alembic import command
        from alembic.config import Config

        def _run_migrations(connection: Connection) -> None:
            cfg = Config()
            cfg.set_main_option(
                "script_location", str(Path(__file__).parent / "migrations")
            )
            cfg.attributes["connection"] = connection
            command.upgrade(cfg, "head")

        async with self._engine.begin() as conn:
            await conn.run_sync(_run_migrations)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        await self._engine.dispose()

    # -----------------------------------------------------------------------
    # Workflows
    # -----------------------------------------------------------------------

    async def save_workflow(self, wf: WorkflowDefinition) -> None:
        now = datetime.now(timezone.utc).isoformat()
        data = json.dumps(workflow_to_dict(wf))
        async with self._session() as session:
            existing = await session.get(WorkflowRow, wf.id)
            if existing is not None:
                existing.name = wf.name
                existing.data = data
                existing.updated_at = now
            else:
                session.add(WorkflowRow(
                    id=wf.id, name=wf.name, data=data,
                    created_at=now, updated_at=now,
                ))
            await session.commit()

    async def load_workflow(self, workflow_id: str) -> WorkflowDefinition | None:
        async with self._session() as session:
            row = await session.get(WorkflowRow, workflow_id)
            if row is None:
                return None
            return workflow_from_dict(json.loads(row.data))

    async def load_workflow_by_prefix(self, prefix: str) -> WorkflowDefinition | None:
        async with self._session() as session:
            stmt = (
                select(WorkflowRow)
                .where(WorkflowRow.id.startswith(prefix))
                .limit(1)
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            if row is None:
                return None
            return workflow_from_dict(json.loads(row.data))

    async def list_workflows(self) -> list[dict]:
        async with self._session() as session:
            stmt = (
                select(
                    WorkflowRow.id,
                    WorkflowRow.name,
                    WorkflowRow.created_at,
                    WorkflowRow.updated_at,
                )
                .order_by(WorkflowRow.updated_at.desc())
            )
            rows = (await session.execute(stmt)).all()
            return [
                {"id": r.id, "name": r.name,
                 "created_at": r.created_at, "updated_at": r.updated_at}
                for r in rows
            ]

    async def delete_workflow(self, workflow_id: str) -> bool:
        async with self._session() as session:
            stmt = delete(WorkflowRow).where(WorkflowRow.id == workflow_id)
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0  # type: ignore[union-attr]

    async def delete_workflow_by_prefix(self, prefix: str) -> bool:
        async with self._session() as session:
            stmt = delete(WorkflowRow).where(
                WorkflowRow.id.startswith(prefix)
            )
            result = await session.execute(stmt)
            await session.commit()
            return result.rowcount > 0  # type: ignore[union-attr]

    # -----------------------------------------------------------------------
    # Run outputs (temporary cache for curation)
    # -----------------------------------------------------------------------

    async def save_run_output(
        self, run_id: str, workflow_id: str, node_id: NodeId, output: str
    ) -> None:
        now = datetime.now(timezone.utc).isoformat()
        async with self._session() as session:
            session.add(RunOutputRow(
                run_id=run_id, workflow_id=workflow_id,
                node_id=node_id, output=output, created_at=now,
            ))
            await session.commit()

    async def get_run_output(self, run_id: str, node_id: NodeId) -> str | None:
        async with self._session() as session:
            stmt = (
                select(RunOutputRow.output)
                .where(RunOutputRow.run_id == run_id, RunOutputRow.node_id == node_id)
                .order_by(RunOutputRow.id.desc())
                .limit(1)
            )
            row = (await session.execute(stmt)).scalar_one_or_none()
            return row

    async def list_run_outputs(self, run_id: str) -> list[dict]:
        async with self._session() as session:
            stmt = (
                select(
                    RunOutputRow.node_id,
                    RunOutputRow.output,
                    RunOutputRow.persisted,
                    RunOutputRow.created_at,
                )
                .where(RunOutputRow.run_id == run_id)
                .order_by(RunOutputRow.id)
            )
            rows = (await session.execute(stmt)).all()
            return [
                {"node_id": r.node_id, "output": r.output,
                 "persisted": r.persisted, "created_at": r.created_at}
                for r in rows
            ]

    async def mark_persisted(self, run_id: str, node_id: NodeId) -> None:
        async with self._session() as session:
            stmt = (
                update(RunOutputRow)
                .where(RunOutputRow.run_id == run_id, RunOutputRow.node_id == node_id)
                .values(persisted=1)
            )
            await session.execute(stmt)
            await session.commit()
