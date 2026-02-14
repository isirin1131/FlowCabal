# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

FlowCabal — visual workflow editor for AI-assisted long-form writing ("ComfyUI for text"). Browser UI + local Python backend.

## Architecture

```
Browser (Svelte)        ←── WS ──→     Python (local)
├── FlowEditor                         ├── core-runner
├── core/ (edit state)                  ├── Agent (A/B/C)
└── ws/ (client)                        ├── SQLite
                                        ├── OpenViking
                                        └── LLM Client
```

Everything runs locally. API keys never leave the user's machine.

**Two LLMs**: User LLM (creative generation, e.g. Opus/GPT-4) and Agent LLM (meta-reasoning, e.g. Haiku/GPT-4o-mini). Both called from local Python.

## Commands

Frontend (`flow-cabal/`):

```bash
pnpm install    pnpm dev      pnpm build
pnpm check      pnpm lint     pnpm format
```

Backend (`backend/`, not yet implemented):

```bash
pip install -r requirements.txt
python server.py
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
5. No WS client, Python backend, or Agent yet

## Python Backend (local)

### SQLite — unified storage

One `.sqlite` file: workflows, curated outputs, OpenViking data. No IndexedDB, no separate filesystem.

### core-runner

```python
for node_id in kahn_order:
    context = role_a.get_context(node_id)   # function call
    prompt = build_prompt(node, context)      # function call
    output = llm.generate(prompt)             # local HTTP
    evaluation = role_c.evaluate(output)      # function call
    ws.push(node_id, output, evaluation)      # push to UI
```

### Prompt assembly

```
TextBlockList → Agent context injection (Role A) → VirtualTextBlock resolution → LLM
```

Agent does NOT modify persisted metadata. Context injection is ephemeral.

### Agent — three roles

- **A (Context)**: queries SQLite/OpenViking for relevant context, injects into prompt. Indexes curated outputs.
- **B (Builder)**: constructs workflow topology and prompts from user intent.
- **C (Monitor)**: evaluates output quality. Approve / retry / flag to human.

### Curated output store

Only user-approved outputs enter SQLite. Runtime cache (Python memory) holds all outputs during execution; user selects which to persist. Only curated outputs trigger OpenViking indexing.

### OpenViking

Virtual filesystem backed by SQLite: `/meta`, `/entities`, `/manuscript`, `/summaries`. Traceable retrieval, multi-level summarization, recursive context search.

### Directory structure

```
backend/
├── server.py          # WebSocket
├── config.py          # LLM config
├── protocol.py        # Message types
├── db.py              # SQLite
├── runner/
│   ├── engine.py      # core-runner
│   ├── prompt.py      # Prompt assembly
│   └── cache.py       # Output cache
├── agent/
│   ├── core.py        # Agent loop
│   ├── context.py     # Role A
│   ├── builder.py     # Role B
│   ├── monitor.py     # Role C
│   └── skills/        # summarize, retrieve, evaluate, entity
└── viking/
    ├── adapter.py     # OpenViking ↔ SQLite
    └── project.py     # Project structure
```

## WebSocket Protocol

Push-oriented. Python executes internally, browser receives results.

Browser → Python: `connect`, `workflow:save/load/list/run/cancel`, `build:request/accept/reject`, `output:persist/delete`, `human:decision`

Python → Browser: `node:started/streaming/completed/needs-human`, `workflow:completed/error`, `build:suggestion`, `output:persisted`, `status`

Full protocol in `docs/new_design.typ`.

## Tech Stack

- **Frontend**: Svelte 5 (Runes), @xyflow/svelte, Vite 7, TypeScript 5.9, Tailwind 3, dagre/elkjs
- **Backend**: Python, SQLite, OpenViking, OpenAI-compatible API

## Design Decisions

- **Local backend** — all data on user's machine, no trust issues
- **SQLite unified storage** — one file replaces IndexedDB + OpenViking filesystem
- **core-runner in Python** — agent integration via function calls, not WS round-trips
- **Curated outputs** — only user-approved content feeds OpenViking
- **Browser as thin UI** — no execution, no persistence, no EventBus
- **Three-layer prompt** — static + agent context + virtual block resolution
- **Immutable core/** — functional updates, future undo/redo

## Docs

- `docs/new_design.typ` — **v3 architecture** (current)
- `docs/paper.typ` — Product vision
- `docs/design_doc.typ` — v2 (superseded)
- `docs/old/` — Do not reference
