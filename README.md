# FlowCabal

Visual workflow editor for AI-assisted long-form writing. ComfyUI, but for text.

## Roadmap

- [x] Base design
- [ ] [OpenViking](https://www.openviking.ai/) support
- [ ] Agent system
- [ ] Advanced features
- [ ] Implementation

## How It Works

Build custom AI workflows through a node-based interface. A local Python backend executes workflows, manages context with OpenViking, and stores everything in SQLite. The browser is just the UI.

```
Browser (Svelte)        ←── WS ──→     Python (local)
├── FlowEditor                         ├── core-runner
├── core/ (edit state)                  ├── Agent (A/B/C)
└── ws/ (client)                        ├── SQLite
                                        └── OpenViking
```

All data stays on your machine — API keys, outputs, project knowledge.

## Key Ideas

- **Curated outputs** — not every generation is worth keeping. You choose what to persist. Only curated content feeds into OpenViking for long-term memory.
- **Agent-mediated context** — three agent roles (context injection, workflow building, quality monitoring) run as same-process function calls alongside the execution engine.
- **SQLite as single storage** — workflows, curated outputs, and OpenViking knowledge in one file.

## Tech

- **Frontend**: Svelte 5, @xyflow/svelte, Vite 7, TypeScript, Tailwind
- **Backend**: Python, SQLite, OpenViking, OpenAI-compatible API

## License

MIT
