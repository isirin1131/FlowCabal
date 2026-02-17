# FlowCabal

Visual workflow editor for AI-assisted long-form writing. ComfyUI, but for text.

## TODO

- [x] Base design (v3)
- [x] Reference design analysis (OpenViking/OpenClaw/Trellis)
- [x] v4 architecture design
- [ ] Phase 1: Infrastructure
  - [ ] Python WebSocket server + SQLite init
  - [ ] OpenViking embedded mode integration + project structure init
  - [ ] core-runner (basic linear execution, no Agent)
  - [ ] Browser WebSocket client
  - [ ] Workflow sync: Browser → WS → Python → SQLite
  - [ ] Remove browser-side `db/` layer (IndexedDB/Dexie)
- [ ] Phase 2: Agent core + basic profiling
  - [ ] Agent loop (observe → reason → act)
  - [ ] Role A: OpenViking retrieval + context injection
  - [ ] Role C: low-level factual checking (single agent first)
  - [ ] Curation pipeline: persist → OpenViking → async L0/L1
  - [ ] Basic profiles: character profiles, plot thread profiles
- [ ] Phase 3: Advanced capabilities
  - [ ] Role B: workflow construction suggestions
  - [ ] Role C: multi-agent cross-checking
  - [ ] Recursive invocation component
  - [ ] Evolutionary iteration component
  - [ ] Extended profile types (world state, themes, style)
- [ ] Phase 4: Polish
  - [ ] Agent chat interface (FloatingBall)
  - [ ] Profile management UI
  - [ ] Context source visualization (provenance)
  - [ ] Performance optimization + error recovery

## License

MIT
