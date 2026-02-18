"""FlowCabal CLI — click-based command line interface."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import click

from .config import FlowCabalConfig
from .models.workflow import workflow_from_dict, workflow_to_dict
from .runner.engine import CliCallbacks, run_workflow


@click.group()
@click.version_option(version="0.1.0")
def cli() -> None:
    """FlowCabal — visual workflow editor for AI-assisted long-form writing."""


# ---------------------------------------------------------------------------
# init
# ---------------------------------------------------------------------------

@cli.command()
def init() -> None:
    """Create default config at ~/.flowcabal/config.toml."""
    config_path = FlowCabalConfig.config_path()
    if config_path.exists():
        click.echo(f"Config already exists at {config_path}")
        if not click.confirm("Overwrite?"):
            return

    config = FlowCabalConfig()
    config.save()
    click.echo(f"Created config at {config_path}")
    click.echo("Edit it to add your API key and endpoint settings.")


# ---------------------------------------------------------------------------
# run
# ---------------------------------------------------------------------------

@cli.command()
@click.argument("workflow_file", type=click.Path(exists=True, path_type=Path))
@click.option("--stream", is_flag=True, help="Stream LLM output to terminal")
@click.option("--agents", is_flag=True, help="Enable Role A (context) and Role C (monitor) agents")
def run(workflow_file: Path, stream: bool, agents: bool) -> None:
    """Execute a workflow from a JSON file."""
    config = FlowCabalConfig.load()
    if not config.user_llm.api_key:
        click.echo("Error: No API key configured. Run 'flowcabal init' and edit ~/.flowcabal/config.toml", err=True)
        sys.exit(1)

    with open(workflow_file) as f:
        data = json.load(f)

    workflow = workflow_from_dict(data)
    click.echo(f"Loaded workflow: {workflow.name} ({len(workflow.nodes)} nodes)", err=True)

    viking = None
    if agents:
        from .viking.client import init_viking
        from .viking.project import ensure_project
        viking = init_viking(config)
        ensure_project(viking)
        click.echo("Agents enabled (Role A context + Role C monitor)", err=True)

    callbacks = CliCallbacks(stream=stream)
    try:
        outputs = asyncio.run(run_workflow(
            workflow, config, stream=stream, callbacks=callbacks,
            viking=viking, enable_agents=agents,
        ))
    finally:
        if viking:
            viking.close()

    # Print final outputs to stdout
    click.echo("\n=== Workflow Outputs ===", err=True)
    for node_id, output in outputs.items():
        node = workflow.nodes.get(node_id)
        name = node.name if node else node_id
        click.echo(f"\n## {name}", err=True)
        click.echo(output)


# ---------------------------------------------------------------------------
# Phase 2: workflow subcommands (added later)
# ---------------------------------------------------------------------------

@cli.group()
def workflow() -> None:
    """Manage saved workflows."""


@workflow.command("list")
def workflow_list() -> None:
    """List saved workflows."""
    from .db import Database

    config = FlowCabalConfig.load()

    async def _list() -> None:
        async with Database(config) as db:
            workflows = await db.list_workflows()
            if not workflows:
                click.echo("No saved workflows.")
                return
            for wf in workflows:
                click.echo(f"  {wf['id'][:8]}...  {wf['name']}  (updated {wf['updated_at']})")

    asyncio.run(_list())


@workflow.command("save")
@click.argument("file", type=click.Path(exists=True, path_type=Path))
def workflow_save(file: Path) -> None:
    """Import a workflow from a JSON file into the database."""
    from .db import Database

    config = FlowCabalConfig.load()
    with open(file) as f:
        data = json.load(f)
    wf = workflow_from_dict(data)

    async def _save() -> None:
        async with Database(config) as db:
            await db.save_workflow(wf)
            click.echo(f"Saved workflow '{wf.name}' (id: {wf.id[:8]}...)")

    asyncio.run(_save())


@workflow.command("load")
@click.argument("workflow_id")
def workflow_load(workflow_id: str) -> None:
    """Print a saved workflow as JSON."""
    from .db import Database

    config = FlowCabalConfig.load()

    async def _load() -> None:
        async with Database(config) as db:
            wf = await db.load_workflow(workflow_id)
            if wf is None:
                # Try prefix match
                wf = await db.load_workflow_by_prefix(workflow_id)
            if wf is None:
                click.echo(f"Workflow '{workflow_id}' not found.", err=True)
                sys.exit(1)
            click.echo(json.dumps(workflow_to_dict(wf), indent=2))

    asyncio.run(_load())


@workflow.command("delete")
@click.argument("workflow_id")
def workflow_delete(workflow_id: str) -> None:
    """Delete a saved workflow."""
    from .db import Database

    config = FlowCabalConfig.load()

    async def _delete() -> None:
        async with Database(config) as db:
            deleted = await db.delete_workflow(workflow_id)
            if not deleted:
                deleted = await db.delete_workflow_by_prefix(workflow_id)
            if deleted:
                click.echo(f"Deleted workflow '{workflow_id}'.")
            else:
                click.echo(f"Workflow '{workflow_id}' not found.", err=True)

    asyncio.run(_delete())


@workflow.command("run")
@click.argument("workflow_id")
@click.option("--stream", is_flag=True, help="Stream LLM output to terminal")
@click.option("--agents", is_flag=True, help="Enable Role A (context) and Role C (monitor) agents")
def workflow_run(workflow_id: str, stream: bool, agents: bool) -> None:
    """Execute a saved workflow."""
    from .db import Database

    config = FlowCabalConfig.load()
    if not config.user_llm.api_key:
        click.echo("Error: No API key configured.", err=True)
        sys.exit(1)

    async def _run() -> None:
        async with Database(config) as db:
            wf = await db.load_workflow(workflow_id)
            if wf is None:
                wf = await db.load_workflow_by_prefix(workflow_id)
            if wf is None:
                click.echo(f"Workflow '{workflow_id}' not found.", err=True)
                sys.exit(1)

        viking = None
        if agents:
            from .viking.client import init_viking
            from .viking.project import ensure_project
            viking = init_viking(config)
            ensure_project(viking)
            click.echo("Agents enabled (Role A context + Role C monitor)", err=True)

        click.echo(f"Running workflow: {wf.name} ({len(wf.nodes)} nodes)", err=True)
        callbacks = CliCallbacks(stream=stream)
        try:
            outputs = await run_workflow(
                wf, config, stream=stream, callbacks=callbacks,
                viking=viking, enable_agents=agents,
            )
        finally:
            if viking:
                viking.close()

        click.echo("\n=== Workflow Outputs ===", err=True)
        for node_id, output in outputs.items():
            node = wf.nodes.get(node_id)
            name = node.name if node else node_id
            click.echo(f"\n## {name}", err=True)
            click.echo(output)

    asyncio.run(_run())


# ---------------------------------------------------------------------------
# Phase 2: project subcommands
# ---------------------------------------------------------------------------

@cli.group()
def project() -> None:
    """Manage the OpenViking project."""


@project.command("init")
def project_init() -> None:
    """Initialize the OpenViking project structure."""
    from .viking.client import init_viking
    from .viking.project import init_project

    config = FlowCabalConfig.load()
    client = init_viking(config)
    try:
        init_project(client)
        click.echo("OpenViking project initialized.")
    finally:
        client.close()


@project.command("status")
def project_status() -> None:
    """Show project status and stats."""
    from .viking.client import init_viking
    from .viking.project import get_project_status

    config = FlowCabalConfig.load()
    client = init_viking(config)
    try:
        status = get_project_status(client)
        if not status["initialized"]:
            click.echo("Project not initialized. Run 'flowcabal project init' first.")
            return
        click.echo("Project initialized.")
        for section, count in status.get("sections", {}).items():
            click.echo(f"  {section}: {count} items")
    finally:
        client.close()


# ---------------------------------------------------------------------------
# Phase 2: output subcommands
# ---------------------------------------------------------------------------

@cli.group()
def output() -> None:
    """Manage curated outputs."""


@output.command("persist")
@click.argument("node_id")
@click.option("--run-id", default="latest", help="Run ID (default: latest)")
@click.option("--name", default=None, help="Chapter/output name")
def output_persist(node_id: str, run_id: str, name: str | None) -> None:
    """Persist a node output to OpenViking."""
    from .viking.client import init_viking
    from .viking.project import ensure_project
    from .runner.curate import persist_output

    config = FlowCabalConfig.load()
    client = init_viking(config)
    try:
        ensure_project(client)
        # For now, read output from the run_outputs table
        # In the future, this will use the last run's cache
        from .db import Database

        async def _get_output() -> str | None:
            async with Database(config) as db:
                return await db.get_run_output(run_id, node_id)

        text = asyncio.run(_get_output())
        if not text:
            click.echo(f"No output found for node '{node_id}' in run '{run_id}'.", err=True)
            sys.exit(1)

        uri = persist_output(client, node_id, text, chapter_name=name)
        click.echo(f"Persisted output to {uri}")
    finally:
        client.close()


@output.command("list")
def output_list() -> None:
    """List curated outputs in OpenViking."""
    from .viking.client import init_viking
    from .runner.curate import list_outputs

    config = FlowCabalConfig.load()
    client = init_viking(config)
    try:
        outputs = list_outputs(client)
        if not outputs:
            click.echo("No curated outputs.")
            return
        for o in outputs:
            abstract = o.get("abstract", "")
            preview = abstract[:80] + "..." if len(abstract) > 80 else abstract
            click.echo(f"  {o['uri']}")
            if preview:
                click.echo(f"    {preview}")
    finally:
        client.close()
