"""Initial schema — workflows, config, run_outputs tables.

Revision ID: 0001
Revises: None
Create Date: 2026-02-18
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # Skip table creation if they already exist (pre-Alembic databases).
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing = set(insp.get_table_names())

    if "workflows" not in existing:
        op.create_table(
            "workflows",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("data", sa.Text(), nullable=False),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.Column("updated_at", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    if "config" not in existing:
        op.create_table(
            "config",
            sa.Column("key", sa.String(), nullable=False),
            sa.Column("value", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("key"),
        )

    if "run_outputs" not in existing:
        op.create_table(
            "run_outputs",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("run_id", sa.String(), nullable=False),
            sa.Column("workflow_id", sa.String(), nullable=False),
            sa.Column("node_id", sa.String(), nullable=False),
            sa.Column("output", sa.Text(), nullable=False),
            sa.Column("persisted", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("idx_run_outputs_run", "run_outputs", ["run_id"])
        op.create_index("idx_run_outputs_workflow", "run_outputs", ["workflow_id"])


def downgrade() -> None:
    op.drop_index("idx_run_outputs_workflow", table_name="run_outputs")
    op.drop_index("idx_run_outputs_run", table_name="run_outputs")
    op.drop_table("run_outputs")
    op.drop_table("config")
    op.drop_table("workflows")
