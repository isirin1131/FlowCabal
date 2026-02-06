# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FlowCabal is a browser-based visual workflow editor for AI-assisted text processing, following the "ComfyUI for text" paradigm. Users build custom AI workflows through a node-based interface using Svelte 5 and @xyflow/svelte.

## Development Commands

All commands run from the `flow-write/` directory:

```bash
pnpm install      # Install dependencies
pnpm dev          # Start dev server (http://localhost:5173)
pnpm build        # Production build to dist/
pnpm preview      # Preview production build
pnpm check        # Type checking (svelte-check + tsc) - run before commits
pnpm lint         # ESLint
pnpm format       # Prettier formatting
```

## Architecture

### Core Systems (`src/lib/core/`)

1. **TextBlock System** (`textblock.ts`): Two block types - `TextBlock` (static text) and `VirtualTextBlock` (dynamic references to upstream node outputs). `TextBlockList` manages sequences with dependency tracking.

2. **Node System** (`node.ts`): Represents LLM API calls. States: idle → pending → running → completed/error. Dependencies tracked through virtual blocks in prompts.

3. **Workflow System** (`workflow.ts`): Manages node collections and execution. Uses Kahn's algorithm for topological sort, sequential execution based on dependency order.

4. **API Configuration** (`apiconfig.ts`): LLM settings including connection (endpoint, apiKey, model), parameters (temperature, maxTokens, etc.), and prompts as TextBlockLists.

### Data Flow
```
User Input → TextBlocks → ApiConfiguration → LLM Client
→ ChatCompletionRequest → LLM API → ChatCompletionResponse
→ VirtualTextBlock Resolution → Downstream Nodes
```

### Key Directories

- `src/lib/core/` - Core business logic (nodes, workflows, text blocks)
- `src/lib/db/` - IndexedDB persistence via Dexie.js
- `src/lib/api/` - OpenAI-compatible LLM client
- `src/lib/components/` - Reusable UI components
- `src/lib/nodes/` - Svelte Flow node types (LLMNode, InputNode, OutputNode, TextNode)
- `src/lib/edges/` - Custom edge components
- `src/lib/utils/` - Layout algorithms (dagre/elk), validation, topological sort

### State Management

Uses Svelte 5 Runes (`$state`, `$derived`, `$effect`). All core data structures use immutable functional updates (return new objects, no mutations).

### Database Schema (IndexedDB)

- `workflows`: id, name, data (JSON), createdAt, updatedAt
- `settings`: key-value store for app preferences

## Tech Stack

- **Svelte 5** with Runes API
- **@xyflow/svelte** for node-based editing
- **Vite 7** + TypeScript 5.9
- **Tailwind CSS** with dark mode (class strategy)
- **Dexie.js** for IndexedDB
- **dagre/elkjs** for graph layout

## Design Decisions

- Immutable functional updates enable undo/redo capability
- Virtual text blocks allow prompts to dynamically reference upstream outputs
- OpenAI-compatible client works with any compatible provider (OpenAI, DeepSeek, local LLMs)
- Local-first with IndexedDB - no backend required
