# FlowCabal Developer Guide

## Project Overview

FlowCabal is a DAG-based AI-assisted novel writing workflow engine. It consists of two packages:
- `@flowcabal/engine` - Core engine with workspace, node, and LLM integration
- `@flowcabal/cli` - CLI built with yargs

Language: TypeScript with Bun runtime.

---

## Build / Type Check Commands

```bash
# Type check all packages
bun run typecheck

# Run CLI
bun run flowcabal

# Or directly
bun packages/cli/src/index.ts
```

There are **no dedicated lint or test commands** currently. Use `bun run typecheck` as the primary validation.

---

## Code Style Guidelines

### Imports
- Use absolute imports from packages: `import { foo } from '@flowcabal/engine'`
- Use relative imports for internal modules: `import { bar } from '../utils'`
- Group imports: external → internal → types
- Sort alphabetically within groups

### Types and Interfaces
- Define types in `packages/engine/src/types.ts` for shared interfaces
- Use discriminated unions for variant types (e.g., `TextBlock` in types.ts)
- Prefer interfaces for objects, type aliases for unions/primitives

### Naming Conventions
- Files: kebab-case (`memory-agent.ts`)
- Functions: camelCase (`addNode`, `removeNode`)
- Interfaces/Types: PascalCase (`NodeDef`, `TextBlock`)
- Constants: SCREAMING_SNAKE_CASE for config values
- Private functions: prefix with `_` (not used here)

### Error Handling
- CLI: use `console.error` and `process.exit(1)` for fatal errors
- Engine: return `null` or `false` for not-found cases, throw for unexpected errors
- Validate inputs early, return early with error messages

### Code Patterns

**Workspace operations** (in `workspace/core/`):
- Functions mutate the `Workspace` object in place
- Return `boolean` for success/failure, or the modified object
- Use Maps for `outputs`, `upstream`, `downstream` (converted to/from JSON)

**CLI commands**:
- Use yargs positional arguments for required inputs
- Use `--workspace` or `-w` option for workspace selection
- Call `requireRoot()` to ensure project initialized

**Block insertion**:
- `insertBlock(ws, nodeId, block, isSystem, index?)`
- `isSystem: boolean` determines `systemPrompt` vs `userPrompt`
- `index` defaults to append

### Formatting
- 2-space indentation
- No semicolons
- Trailing commas
- Single quotes for strings
- Max ~100 lines per file

### Schema Validation
- Use Zod for JSON schema validation (see `packages/engine/src/schema.ts`)
- Use `Schema.parse(data)` with try/catch for external input

### Avoiding Common Pitfalls
- Remember Maps/ Sets are not JSON-serializable; use `Object.fromEntries()` when writing to files
- When adding ref blocks, update both `upstream` and `downstream`
- When removing nodes, clean up stale/target arrays and outputs Map
- CLI commands need to handle the case where workspace is not set

---

## Project Structure

```
packages/
├── engine/src/
│   ├── agent/         # AI agent, memory, tools
│   ├── llm/          # LLM provider & generation
│   ├── workspace/    # Workspace core (node, graph, runner)
│   ├── paths.ts      # Path utilities & global config
│   ├── schema.ts     # Zod schemas
│   ├── types.ts      # TypeScript interfaces
│   └── index.ts      # Public exports
└── cli/src/
    ├── commands/     # yargs command handlers
    └── index.ts      # CLI entry point
```

---

## Key Patterns

**Adding a new CLI command**:
1. Add handler in `packages/cli/src/commands/<feature>.ts`
2. Export the handler function
3. Register in `packages/cli/src/index.ts` under appropriate `.command()`

**Adding engine functionality**:
1. Place in appropriate subdirectory under `packages/engine/src/`
2. Export via `packages/engine/src/index.ts`
3. Use Zod for input validation if called externally