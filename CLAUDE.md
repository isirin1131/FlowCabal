# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlowCabal is a client-server visual workflow editor for AI-assisted long-form writing. Users build custom AI workflows through a node-based interface ("ComfyUI for text"). The browser frontend handles UI and workflow execution; a Python backend provides an Agent system with OpenViking context management for heavy novel-writing scenarios.

Core paradigms: **prompt engineering** (node-level prompt design) and **context engineering** (agent-mediated context assembly from project knowledge).

## Architecture: Client-Server

```
Browser (Svelte)              ←── WebSocket ──→     Python Backend
├── UI Layer                                        ├── Agent (3 roles)
├── EventBus + WS Bridge                            │   ├── Context (A)
├── core/ (metadata)                                │   ├── Builder (B)
├── core-runner/ (execution)                        │   └── Monitor (C)
├── api/ (user's LLM calls)                         ├── OpenViking
└── db/ (IndexedDB)                                 └── Agent LLM Client
```

**Two LLM configurations:**
- **User LLM** (browser): Creative generation in workflow nodes. User's API key never leaves client.
- **Agent LLM** (Python): Meta-reasoning (evaluation, summarization, retrieval). Typically a cheaper/faster model.

## Development Commands

Frontend — run from `flow-cabal/`:

```bash
pnpm install      # Install dependencies
pnpm dev          # Start dev server (http://localhost:5173)
pnpm build        # Production build to dist/
pnpm preview      # Preview production build
pnpm check        # Type checking (svelte-check + tsc) - run before commits
pnpm lint         # ESLint
pnpm format       # Prettier formatting
```

Backend — run from `backend/` (not yet implemented):

```bash
pip install -r requirements.txt
python server.py  # Start WebSocket server
```

## Browser-Side Architecture

### Design Principle: metadata vs running-state separation

`core/` = metadata (static, serializable, persisted). `core-runner/` = runtime state (ephemeral, execution-only).

### Core Systems (`src/lib/core/`) — Metadata Only

1. **TextBlock System** (`textblock.ts`): `TextBlock` (static text) and `VirtualTextBlockDef` (reference to upstream node output, metadata only). `TextBlockList` manages sequences with dependency tracking.

2. **Node System** (`node.ts`): `NodeDefinition` — id, name, position, apiConfig. No runtime state.

3. **Workflow System** (`workflow.ts`): `WorkflowDefinition` — id, name, `Map<NodeId, NodeDefinition>`. Topological sort via Kahn's algorithm.

4. **API Configuration** (`apiconfig.ts`): `ApiConfiguration` with connection, parameters, and system/user prompts as `TextBlockList`.

### Prompt Assembly Pipeline (core-runner)

Three layers, assembled per-node during execution:

```
Layer 1: Static prompt (user's TextBlockList — persisted metadata)
Layer 2: Agent context injection (ephemeral, from Python via WebSocket)
Layer 3: VirtualTextBlock resolution (upstream node outputs)
    → Final prompt string → LLM API
```

The agent does NOT modify user's metadata. Context injection is ephemeral.

### EventBus + WebSocket Bridge (`src/lib/bus/`)

- `eventbus.ts` — Local typed pub/sub (unchanged from design_doc.typ)
- `events.ts` — Event types (local + agent protocol)
- `ws-bridge.ts` — Transparently bridges agent events to/from Python backend

### Other Browser Layers

- `api/` — `OpenAICompatibleClient` for user's LLM calls (regular + streaming)
- `db/` — IndexedDB via Dexie.js, repository pattern, `persisted()` rune
- `agent-client/` — WebSocket connection management, reconnection, health check
- `nodes/` — @xyflow node components: LLMNode, InputNode, OutputNode, TextNode
- `components/` — FlowCanvas, ContextMenu, NodeSidebar, Toolbar
- `utils/` — Layout (dagre/elk), validation, topological sort

### Key Architectural Gaps (Current Code)

1. FlowEditor uses @xyflow `Node[]`/`Edge[]` directly — not bridged to core types
2. Duplicate topological sort: `utils/computing.ts` vs `core/workflow.ts`
3. No workflow save/load in UI (DB layer exists but unused by FlowEditor)
4. No execution engine — `executeWorkflow()` just shows alert
5. No EventBus, core-runner, agent-client, or WebSocket bridge implemented yet

## Python Backend Architecture

### Agent System — Three Roles, One Loop

All roles share observe → reason → act, triggered by different events:

- **Role A (Context)**: Before each node, queries OpenViking for relevant context, injects into prompt. After each node, indexes output and updates summaries/entities.
- **Role B (Builder)**: Before execution, helps construct workflow topology and prompts from user intent + project context.
- **Role C (Monitor)**: After each node, evaluates output quality. Decides: approve / retry / flag to human.

### OpenViking Context Store

Virtual filesystem model for novel projects:

```
/project
├── /meta           — outline, style-guide, world-rules
├── /entities       — characters/, locations/, plot-threads/
├── /manuscript     — chapter-NN/ (content, summaries, entity-changes)
└── /summaries      — arc-level and full-work summaries
```

Provides: traceable retrieval, multi-level summarization, recursive context search.

### Backend Directory Structure

```
backend/
├── server.py          # WebSocket server
├── config.py          # Agent LLM configuration
├── protocol.py        # Message types (mirrors TS types)
├── agent/
│   ├── core.py        # Agent main loop
│   ├── context.py     # Role A
│   ├── builder.py     # Role B
│   ├── monitor.py     # Role C
│   └── skills/        # summarize, retrieve, evaluate, entity-track
└── viking/
    ├── adapter.py     # OpenViking integration
    └── project.py     # Novel project structure management
```

## WebSocket Protocol

Browser → Python: `agent:connect`, `agent:node-before`, `agent:node-output`, `agent:build-request`, `agent:human-decision`

Python → Browser: `agent:context-ready`, `agent:evaluation`, `agent:build-suggestion`, `agent:needs-human`, `agent:context-updated`, `agent:status`, `agent:error`

Full protocol definition in `docs/new_design.typ`.

## Tech Stack

### Frontend
- **Svelte 5** with Runes API (`$state`, `$derived`, `$effect`, `$props`, `$bindable`)
- **@xyflow/svelte** for node-based visual editing
- **Vite 7** + TypeScript 5.9
- **Tailwind CSS 3** (installed, used alongside scoped CSS)
- **Dexie.js** for IndexedDB persistence
- **dagre/elkjs** for automatic graph layout

### Backend
- **Python** with WebSocket server
- **OpenViking** for context management (virtual filesystem, multi-level summaries)
- **OpenAI-compatible API** for agent meta-reasoning

## Design Decisions

- **Metadata/running-state separation** — core/ is pure and serializable
- **Agent as context mediator** — not a peripheral observer, but the bridge between workflow and project knowledge
- **Three-layer prompt assembly** — static prompt + agent context + virtual block resolution
- **User API key stays in browser** — agent uses separate, cheaper model on backend
- **EventBus + WebSocket bridge** — same pub/sub pattern locally and across the wire
- **OpenViking for heavy context** — long novels require traceable, hierarchical, recursive context management
- **Immutable functional updates** in core/ — enables future undo/redo
- **Repository pattern** in db/ — abstract interfaces for testing

## Documentation

- `docs/new_design.typ` — **v3 architecture: Agent + OpenViking + client-server** (current)
- `docs/paper.typ` — Technical report (product vision, key features)
- `docs/design_doc.typ` — v2 architecture (EventBus + core-runner, still valid as foundation)
- `docs/messagebus_feasibility.typ` — EventBus feasibility analysis
- `docs/old/` — Superseded documents (do not reference)
