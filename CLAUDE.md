# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

FlowCabal — visual workflow editor for AI-assisted long-form writing ("ComfyUI for text"). Target: high-quality ultra-long novels (potentially millions of words). Browser UI + local Python backend.

## Architecture

```
Browser (Svelte)        ←── WS ──→     Python (local)
├── FlowEditor                         ├── core-runner
├── core/ (edit state)                  ├── Agent (A/B/C)
└── ws/ (client)                        ├── SQLite (workflows)
                                        ├── OpenViking (knowledge)
                                        └── LLM Client
```

Everything runs locally. API keys never leave the user's machine.

**Dual storage**: SQLite for workflow definitions/metadata. OpenViking (`uv add openviking`, embedded mode) for manuscript content, profiles, entities, retrieval indexes.

**Three model configs**: User LLM (creative generation, e.g. Opus/GPT-4), Agent LLM (meta-reasoning + OpenViking VLM, e.g. Haiku/GPT-4o-mini), Embedding model (OpenViking vector search).

## Commands

Frontend (`flow-cabal/`):

```bash
pnpm install    pnpm dev      pnpm build
pnpm check      pnpm lint     pnpm format
```

Backend (`backend/`):

```bash
uv venv --python 3.13
uv sync
uv run flowcabal --help
uv run flowcabal init           # create config
uv run flowcabal run <file.json> --stream --agents
```

## Browser (Svelte, UI only)

Thin client. Edits workflows, displays results. No execution, no persistence.

### `src/lib/core/` — Edit State

Workflow metadata types, synced to Python via WebSocket.

- `textblock.ts` — `TextBlock`, `VirtualTextBlockDef`, `TextBlockList`
- `node.ts` — `NodeDefinition` (id, name, position, apiConfig)
- `workflow.ts` — `WorkflowDefinition` (id, name, `Map<NodeId, NodeDefinition>`), Kahn's topological sort
- `apiconfig.ts` — `ApiConfiguration` (connection, parameters, prompts as `TextBlockList`)

### Other browser modules

- `ws/` — WebSocket client
- `nodes/` — @xyflow components (LLMNode, InputNode, OutputNode, TextNode)
- `components/` — FlowCanvas, ContextMenu, NodeSidebar, Toolbar
- `utils/` — Layout (dagre/elk), validation

### Current gaps

1. FlowEditor uses @xyflow types directly, not bridged to `core/`
2. Duplicate topological sort: `utils/computing.ts` vs `core/workflow.ts`
3. `db/` layer (IndexedDB/Dexie) still exists — to be removed
4. `executeWorkflow()` is a stub (shows alert)
5. No WS client yet — backend uses CLI interface

## Python Backend (local) — IMPLEMENTED

Headless CLI-first backend. No WebSocket server yet (future thin layer).

### Status

- **Phase 1** (Foundation): Core types, config, LLM client, runner, CLI — DONE
- **Phase 2** (Persistence): SQLite CRUD, OpenViking integration, curation pipeline — DONE
- **Phase 3** (Agents): Role A context, Role C monitor, profile generation — DONE
- **Phase 4** (Advanced): Recursive/evolutionary execution, Role B builder, WS server — DEFERRED

### Dual storage

- **SQLite**: workflow definitions, execution state, curation metadata, configuration
- **OpenViking** (embedded mode, AGFS subprocess): manuscript content, multi-angle profiles, entities, summaries, L0/L1/L2, vector indexes, entity relations

### core-runner

```python
for node_id in kahn_order:
    context = role_a.get_context(node_id)   # function call + OpenViking retrieval
    prompt = build_prompt(node, context)      # function call
    output = llm.generate(prompt)             # local HTTP
    evaluation = role_c.evaluate(output)      # function call (multi-angle cross-check)
    ws.push(node_id, output, evaluation)      # push to UI
```

Supports advanced patterns: recursive invocation (iterative refinement) and evolutionary iteration (generate N → evaluate → select → iterate).

### Prompt assembly

```
TextBlockList → Agent context injection (Role A) → VirtualTextBlock resolution → LLM
```

Agent does NOT modify persisted metadata. Context injection is ephemeral — a pure function of (node_config, project_state). Deterministic given same inputs.

### Agent — three roles

- **A (Context)**: queries OpenViking for relevant context via hierarchical retrieval + intent analysis. Uses multi-angle profiles as primary navigation. Operates within bounded token budget (~25-30K).
- **B (Builder)**: constructs workflow topology and prompts from user intent.
- **C (Monitor)**: low-level factual checking only — continuity errors, entity state contradictions, timeline inconsistencies. Multi-agent cross-checking for "zero errors" in verifiable dimensions. NO creative judgment — humans do final creative review.

### Multi-angle profiling system

Generalized L0/L1/L2: not just chapter summaries, but arbitrary projections of the entire work — character profiles, plot thread status, world state, themes, style fingerprints. Each profile is an OpenViking resource with auto-generated L0/L1/L2. Profiles regenerated async when curated outputs change.

### Curated output store

Only user-approved outputs enter OpenViking. Runtime cache (Python memory) holds all outputs during execution; user selects which to persist. Curation triggers: consistency checks, OpenViking ingestion, async profile regeneration.

### OpenViking

Used as a direct dependency (`uv add openviking`), embedded mode. Virtual filesystem with `viking://` URIs:

```
viking://resources/project/
├── /meta          — outline, style guide, world rules
├── /entities      — characters, locations, plot threads
├── /manuscript    — chapter content (L2, with auto L0/L1)
├── /summaries     — arc summaries, full-work summary
└── /profiles      — multi-angle profiles (characters, plot-threads, world-state, themes, style)
```

Provides: L0/L1/L2 three-level info model, hierarchical retrieval, intent analysis, entity relations, async semantic processing, vector search.

### Directory structure

```
backend/
├── pyproject.toml
├── .python-version              # 3.13
├── examples/
│   └── sample_workflow.json     # Sample 2-node workflow
└── flowcabal/
    ├── __init__.py
    ├── cli.py                   # click CLI entry point
    ├── config.py                # Pydantic settings (~/.flowcabal/config.toml)
    ├── llm.py                   # OpenAI-compatible async client
    ├── db.py                    # SQLite persistence (aiosqlite)
    ├── models/
    │   ├── __init__.py
    │   ├── textblock.py         # TextBlock, VirtualTextBlockDef, TextBlockList
    │   ├── node.py              # NodeDefinition, ApiConfiguration, JSON serde
    │   └── workflow.py          # WorkflowDefinition, topological_sort, JSON serde
    ├── runner/
    │   ├── __init__.py
    │   ├── engine.py            # core-runner (topo sort → LLM → cache, agent integration)
    │   ├── prompt.py            # Prompt assembly (resolve virtual blocks + agent context)
    │   ├── cache.py             # Runtime output cache
    │   └── curate.py            # Curation pipeline (persist to OpenViking)
    ├── agent/
    │   ├── __init__.py
    │   ├── core.py              # AgentContext, Evaluation, Decision types
    │   ├── context.py           # Role A (intent analysis → OpenViking retrieval)
    │   ├── builder.py           # Role B (stub, Phase 4)
    │   └── monitor.py           # Role C (factual consistency checking)
    └── viking/
        ├── __init__.py
        ├── client.py            # OpenViking SyncOpenViking init/close
        ├── project.py           # Project structure (viking:// directory layout)
        └── profiles.py          # Multi-angle profile generation
```

### CLI usage

```bash
flowcabal init                              # create ~/.flowcabal/config.toml
flowcabal run <workflow.json> [--stream] [--agents]  # execute from file
flowcabal workflow save/list/load/delete/run         # SQLite persistence
flowcabal project init/status               # OpenViking project
flowcabal output persist/list               # curation
```

## WebSocket Protocol

Push-oriented. Python executes internally, browser receives results.

Browser → Python: `connect`, `workflow:save/load/list/run/cancel`, `build:request/accept/reject`, `output:persist/delete`, `human:decision`

Python → Browser: `node:started/streaming/completed/needs-human`, `node:iteration`, `workflow:completed/error`, `build:suggestion`, `output:persisted`, `profile:updated`, `status`

Full protocol in `docs/new_design_v4.typ`.

## Tech Stack

- **Frontend**: Svelte 5 (Runes), @xyflow/svelte, Vite 7, TypeScript 5.9, Tailwind 3, dagre/elkjs
- **Backend**: Python (uv), SQLite, OpenViking, OpenAI-compatible API

## Design Decisions

- **Local backend** — all data on user's machine, no trust issues
- **Dual storage (SQLite + OpenViking)** — SQLite for structured workflow data, OpenViking for knowledge/content (avoids reimplementing L0/L1/L2, retrieval, relations on SQLite)
- **core-runner in Python** — agent integration via function calls, not WS round-trips
- **Curated outputs** — only user-approved content feeds OpenViking
- **Browser as thin UI** — no execution, no persistence, no EventBus
- **Three-layer prompt** — static + agent context + virtual block resolution; injection is ephemeral and deterministic
- **Multi-angle profiling over entity state machines** — flexible projections, not rigid records
- **Role C low-level only** — factual cross-checking, not creative judgment; humans judge quality
- **Immutable core/** — functional updates, future undo/redo

## Docs

- `docs/new_design_v4.typ` — **v4 architecture** (current)
- `docs/new_design.typ` — v3 architecture (superseded by v4)
- `docs/reference_design_analysis_zh.typ` — Reference design analysis (OpenViking/OpenClaw/Trellis)
- `docs/paper.typ` — Product vision
- `docs/design_doc.typ` — v2 (superseded)
- `docs/old/` — Do not reference
