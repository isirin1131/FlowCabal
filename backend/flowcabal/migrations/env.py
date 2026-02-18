"""Alembic environment configuration for FlowCabal migrations."""

from __future__ import annotations

from alembic import context
from sqlalchemy import inspect, pool, text

from flowcabal.db_models import Base

target_metadata = Base.metadata


def _stamp_existing_db(connection) -> None:
    """Stamp pre-Alembic databases at the initial revision.

    If schema tables exist but alembic_version doesn't, this is a database
    created by the old create_all path. Stamp it at 0001 so the initial
    migration is skipped.
    """
    insp = inspect(connection)
    tables = set(insp.get_table_names())
    if "workflows" in tables and "alembic_version" not in tables:
        connection.execute(text(
            "CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL)"
        ))
        connection.execute(text(
            "INSERT INTO alembic_version (version_num) VALUES ('0001')"
        ))


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — emit SQL to stdout."""
    url = context.config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    Two paths:
    - Programmatic (db.py): connection passed via config.attributes["connection"]
    - CLI (alembic CLI): uses sqlalchemy.url from alembic.ini
    """
    connectable = context.config.attributes.get("connection", None)

    if connectable is not None:
        # Programmatic path — reuse the connection from db.py
        _stamp_existing_db(connectable)
        context.configure(
            connection=connectable,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    else:
        # CLI path — use sqlalchemy.url from alembic.ini (project-local dev DB)
        from sqlalchemy import create_engine

        url = context.config.get_main_option("sqlalchemy.url")
        engine = create_engine(url, poolclass=pool.NullPool)
        with engine.connect() as connection:
            _stamp_existing_db(connection)
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                render_as_batch=True,
            )
            with context.begin_transaction():
                context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
