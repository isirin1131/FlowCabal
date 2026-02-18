# FlowCabal

Visual workflow editor for AI-assisted long-form writing. ComfyUI, but for text.

## TODO

- [x] Base design (v3)
- [x] Reference design analysis (OpenViking/OpenClaw/Trellis)
- [x] v4 architecture design
- [x] Headless backend Phase 1: Foundation
  - [x] Core types (Python dataclasses mirroring TS `core/`)
  - [x] Pydantic config (`~/.flowcabal/config.toml`)
  - [x] Async OpenAI-compatible LLM client (streaming + non-streaming)
  - [x] core-runner (Kahn's topological sort → sequential execution)
  - [x] Prompt assembly (TextBlockList resolution + agent context injection)
  - [x] CLI entry point (`flowcabal init`, `flowcabal run`)
- [x] Headless backend Phase 2: Persistence + OpenViking
  - [x] SQLite persistence (workflows CRUD, run outputs)
  - [x] OpenViking embedded mode integration + project structure init
  - [x] Curation pipeline (persist approved outputs → OpenViking with L0/L1)
  - [x] Extended CLI (`flowcabal workflow/project/output` subcommands)
- [x] Headless backend Phase 3: Agent system
  - [x] Role A: intent analysis → OpenViking retrieval → context injection (~25-30K budget)
  - [x] Role C: factual consistency checking (character, timeline, world rules, continuity)
  - [x] Runner integration (retry loop + human escalation)
  - [x] Multi-angle profile generation (characters, plot-threads)
- [ ] Phase 4: Browser ↔ Backend integration
  - [ ] Python WebSocket server layer on top of headless API
  - [ ] Browser WebSocket client
  - [ ] Workflow sync: Browser → WS → Python → SQLite
  - [ ] Remove browser-side `db/` layer (IndexedDB/Dexie)
- [ ] Phase 5: Advanced capabilities
  - [ ] Role B: workflow construction suggestions
  - [ ] Role C: multi-agent cross-checking
  - [ ] Recursive invocation (iterative refinement)
  - [ ] Evolutionary iteration (generate N → evaluate → select → iterate)
  - [ ] Extended profile types (world state, themes, style)
- [ ] Phase 6: Polish
  - [ ] Agent chat interface (FloatingBall)
  - [ ] Profile management UI
  - [ ] Context source visualization (provenance)
  - [ ] Performance optimization + error recovery

## License

MIT
