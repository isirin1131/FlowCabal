// ─────────────────────────────────────────────────────────
// OpenViking Technical Report
// ─────────────────────────────────────────────────────────

#set document(
  title: "OpenViking: The Context Database for AI Agents — A Comprehensive Technical Report",
  author: "Generated from Source Code Analysis",
  date: datetime(year: 2026, month: 2, day: 17),
)

#set page(
  paper: "a4",
  margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm),
  header: context {
    if counter(page).get().first() > 1 [
      #text(size: 9pt, fill: gray)[OpenViking Technical Report]
      #h(1fr)
      #text(size: 9pt, fill: gray)[February 2026]
    ]
  },
  footer: context {
    let page-num = counter(page).get().first()
    align(center)[
      #text(size: 9pt, fill: gray)[— #page-num —]
    ]
  },
)

#set text(font: "New Computer Modern", size: 11pt, lang: "en")
#set par(justify: true, leading: 0.65em)
#set heading(numbering: "1.1")

#show heading.where(level: 1): it => {
  pagebreak(weak: true)
  v(1em)
  text(size: 18pt, weight: "bold")[#it]
  v(0.5em)
}

#show heading.where(level: 2): it => {
  v(0.8em)
  text(size: 14pt, weight: "bold")[#it]
  v(0.3em)
}

#show heading.where(level: 3): it => {
  v(0.5em)
  text(size: 12pt, weight: "bold")[#it]
  v(0.2em)
}

#show raw.where(block: true): it => {
  block(
    fill: luma(245),
    inset: 10pt,
    radius: 4pt,
    width: 100%,
    text(size: 9pt)[#it],
  )
}

// ─────────────────────────────────────────────────────────
// Title Page
// ─────────────────────────────────────────────────────────
#v(4cm)

#align(center)[
  #text(size: 28pt, weight: "bold")[OpenViking]
  #v(0.5em)
  #text(size: 16pt, fill: gray)[The Context Database for AI Agents]
  #v(2em)
  #text(size: 13pt)[A Comprehensive Technical Report]
  #v(1em)
  #line(length: 40%, stroke: 0.5pt + gray)
  #v(1em)
  #text(size: 11pt, fill: gray)[
    Generated from Source Code Analysis \
    Repository: `volcengine/OpenViking` \
    License: Apache 2.0 \
    February 17, 2026
  ]
  #v(1em)
  #text(size: 11pt, fill: gray)[
    Initiated and Maintained by \
    *ByteDance Volcengine Viking Team*
  ]
]

#pagebreak()

// ─────────────────────────────────────────────────────────
// Table of Contents
// ─────────────────────────────────────────────────────────
#outline(title: "Table of Contents", depth: 3, indent: 1.5em)

// =============================================================
= Introduction
// =============================================================

== Background and Motivation

In the era of large language models (LLMs) and autonomous AI agents, the quality of the _context_ fed to a model is often more important than the model itself. AI agents---software systems that plan, execute multi-step tasks, and interact with external tools---face a fundamental challenge: *managing the ever-growing, heterogeneous context they need to operate effectively*.

Traditional Retrieval-Augmented Generation (RAG) pipelines treat context as flat text chunks stored in a vector database. While this approach is adequate for simple question-answering, it fails to meet the demands of sophisticated agent workflows for several reasons:

- *Fragmented context*: Memories live in one store, resources in another, and skills are scattered across tool definitions. There is no unified way to manage them.
- *Surging context demand*: A long-running agent task produces context at every execution step. Naive truncation or compression causes irreversible information loss.
- *Poor retrieval effectiveness*: Flat vector search lacks a global structural view, making it difficult to understand the full context of any given piece of information.
- *Unobservable retrieval*: The implicit retrieval chain of traditional RAG is a black box, making it hard to debug when errors occur.
- *Limited memory iteration*: Current memory systems are mere records of user interactions, lacking the ability to learn from the agent's own task execution experience.

== What is OpenViking?

*OpenViking* is an open-source _Context Database_ designed specifically for AI agents. Developed and maintained by the ByteDance Volcengine Viking Team, it was open-sourced in January 2026 under the Apache 2.0 license. The project's tagline succinctly captures its mission: _"Data in, Context out."_

OpenViking abandons the fragmented vector storage model of traditional RAG and innovatively adopts a *filesystem paradigm* to unify the structured organization of memories, resources, and skills needed by agents. With OpenViking, developers can build an agent's brain just like managing local files.

== Key Innovations

OpenViking introduces five key innovations that address the challenges outlined above:

+ *Filesystem Management Paradigm*: Unified context management of memories, resources, and skills based on a virtual filesystem with a `viking://` URI scheme.
+ *Tiered Context Loading (L0/L1/L2)*: Three-tier information structure loaded on demand, significantly reducing token consumption.
+ *Directory Recursive Retrieval*: Combines directory positioning with semantic search to achieve recursive and precise context acquisition.
+ *Visualized Retrieval Trajectory*: Full preservation of directory browsing and file positioning trajectories for observability.
+ *Automatic Session Management*: Automatically extracts long-term memory from conversations, making the agent smarter with use.

== Project History

The Viking team at ByteDance has a long history in unstructured information processing:

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Year*], [*Milestone*],
  [2019], [VikingDB vector database supported large-scale use across all ByteDance businesses],
  [2023], [VikingDB sold on Volcengine public cloud],
  [2024], [Launched developer product matrix: VikingDB, Viking KnowledgeBase, Viking MemoryBase],
  [2025], [Created upper-layer application products like AI Search and Vaka Knowledge Assistant],
  [Oct 2025], [Open-sourced MineContext, exploring proactive AI applications],
  [Jan 2026], [Open-sourced OpenViking, providing underlying context database support for AI Agents],
)

// =============================================================
= System Architecture
// =============================================================

OpenViking follows a layered, modular architecture that cleanly separates concerns across client interfaces, business logic services, domain-specific modules, and storage backends.

== Architecture Overview

The high-level architecture can be summarized as follows:

```
┌─────────────────────────────────────────────────────────┐
│                  Client Layer                           │
│   AsyncOpenViking | SyncOpenViking | HTTPClient | CLI   │
├─────────────────────────────────────────────────────────┤
│                  Service Layer                          │
│   FSService | SearchService | SessionService |          │
│   ResourceService | RelationService | PackService |     │
│   DebugService                                          │
├─────────────────────────────────────────────────────────┤
│              Domain Modules                             │
│   Retrieve (Intent + Hierarchical) | Session (Compress  │
│   + MemoryExtract) | Parse (Parsers + TreeBuilder +     │
│   SemanticQueue) | Models (VLM + Embedder)              │
├─────────────────────────────────────────────────────────┤
│               Storage Layer                             │
│        VikingFS (URI Abstraction)                       │
│   ┌──────────────────┬──────────────────┐               │
│   │   Vector Index   │      AGFS        │               │
│   │ (Semantic Search)│ (Content Storage) │               │
│   └──────────────────┴──────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

== Core Modules

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Module*], [*Responsibility*], [*Key Capabilities*],
  [Client], [Unified entry point], [Provides all operation interfaces; delegates to Service layer],
  [Service], [Business logic], [FSService, SearchService, SessionService, ResourceService, RelationService, PackService, DebugService],
  [Retrieve], [Context retrieval], [Intent analysis (IntentAnalyzer), hierarchical retrieval (HierarchicalRetriever), Rerank],
  [Session], [Session management], [Message recording, usage tracking, compression, memory commit],
  [Parse], [Context extraction], [Document parsing (PDF/MD/HTML/DOCX/PPTX/XLSX/EPUB), tree building, async semantic generation],
  [Compressor], [Memory compression], [6-category memory extraction, LLM-based deduplication decisions],
  [Storage], [Storage layer], [VikingFS virtual filesystem, vector index, AGFS integration],
  [Models], [AI model integration], [VLM providers (10+), embedding providers, provider registry],
)

== Service Layer Design

The Service layer decouples business logic from the transport layer, enabling reuse across HTTP Server, embedded SDK, and CLI:

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Service*], [*Responsibility*], [*Key Methods*],
  [FSService], [File system operations], [`ls`, `mkdir`, `rm`, `mv`, `tree`, `stat`, `read`, `abstract`, `overview`, `grep`, `glob`],
  [SearchService], [Semantic search], [`search`, `find`],
  [SessionService], [Session management], [`session`, `sessions`, `commit`, `delete`],
  [ResourceService], [Resource import], [`add_resource`, `add_skill`, `wait_processed`],
  [RelationService], [Relation management], [`relations`, `link`, `unlink`],
  [PackService], [Import/export], [`export_ovpack`, `import_ovpack`],
  [DebugService], [Debug and monitoring], [Observer (queue, VikingDB, VLM, system status)],
)

== Deployment Modes

OpenViking supports two deployment modes:

=== Embedded Mode

For local development and single-process applications. The client auto-starts an AGFS subprocess, uses a local vector index, and follows the singleton pattern:

```python
import openviking as ov
client = ov.OpenViking(path="./data")
client.initialize()
```

=== HTTP Server Mode

For team sharing, production deployment, and cross-language integration. The server runs as a standalone FastAPI process:

```python
# Python SDK connects to OpenViking Server
client = ov.SyncHTTPClient(url="http://localhost:1933", api_key="xxx")
client.initialize()
```

```bash
# Or use curl / any HTTP client
curl http://localhost:1933/api/v1/search/find \
  -H "X-API-Key: xxx" \
  -d '{"query": "how to use openviking"}'
```

The HTTP server supports API key authentication, CORS middleware, request timing, and structured JSON error responses. It is started via `openviking-server` or `python -m openviking serve`.

// =============================================================
= Core Concepts
// =============================================================

== Context Types

OpenViking abstracts all context into three fundamental types, based on a simplified mapping of human cognitive patterns:

=== Resource

Resources are external knowledge that agents can reference. They are _user-driven_, _static_ (content rarely changes after addition), and _structured_ (organized by project or topic in directory hierarchy). Examples include API documentation, product manuals, code repositories, research papers, and technical specifications.

```python
client.add_resource(
    "https://docs.example.com/api.pdf",
    reason="API documentation"
)
```

=== Memory

Memories are divided into _user memories_ and _agent memories_, representing learned knowledge about users and the world. They are _agent-driven_ (actively extracted and recorded by the agent), _dynamically updated_ (continuously updated from interactions), and _personalized_ (learned for specific users or agents).

OpenViking classifies memories into six categories:

#table(
  columns: (auto, auto, 1fr, auto),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Category*], [*Location*], [*Description*], [*Mergeable*],
  [profile], [`user/memories/profile.md`], [User basic info and identity], [Yes],
  [preferences], [`user/memories/preferences/`], [User preferences organized by topic], [Yes],
  [entities], [`user/memories/entities/`], [Entity memories (people, projects, concepts)], [Yes],
  [events], [`user/memories/events/`], [Event records (decisions, milestones)], [No],
  [cases], [`agent/memories/cases/`], [Specific problems + solutions learned by agent], [No],
  [patterns], [`agent/memories/patterns/`], [Reusable processes/methods discovered by agent], [Yes],
)

=== Skill

Skills are callable capabilities that agents can invoke, such as tool definitions, MCP tools, etc. They are _defined capabilities_ (tool definitions for completing specific tasks), _relatively static_ (definitions don't change at runtime), and _callable_ (agent decides when to use which skill).

```python
await client.add_skill({
    "name": "search-web",
    "description": "Search the web for information",
    "content": "# search-web\n..."
})
```

== Context Layers (L0/L1/L2)

OpenViking's three-layer information model is fundamental to its efficiency. Rather than stuffing massive amounts of context into a prompt all at once, content is automatically processed into three progressively detailed levels:

#table(
  columns: (auto, auto, auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Layer*], [*Name*], [*File*], [*Token Budget*], [*Purpose*],
  [L0], [Abstract], [`.abstract.md`], [\~100 tokens], [Vector search, quick filtering, one-sentence summary],
  [L1], [Overview], [`.overview.md`], [\~2k tokens], [Rerank scoring, content navigation, Agent decision-making],
  [L2], [Detail], [Original files], [Unlimited], [Full content, on-demand loading for deep reading],
)

=== Generation Mechanism

L0 and L1 are generated _asynchronously_ after resources are added. The `SemanticProcessor` traverses directories _bottom-up_, generating L0/L1 for each directory. Child directory L0 abstracts are aggregated into the parent's L1 overview, forming a hierarchical navigation structure.

```
Leaf nodes → Parent directories → Root (bottom-up)
```

=== Multimodal Support

- *L0/L1*: Always text (Markdown), even for non-text content
- *L2*: Can be any format (text, image, video, audio)

For binary content such as images or videos, L0/L1 provide textual descriptions generated by a Vision-Language Model (VLM).

== Viking URI

Viking URI is the unified resource identifier for all content in OpenViking. Every piece of context---whether a resource file, a memory entry, or a skill definition---has a unique URI.

=== Format

```
viking://{scope}/{path}
```

=== Scopes

#table(
  columns: (auto, 1fr, auto, auto),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Scope*], [*Description*], [*Lifecycle*], [*Visibility*],
  [`resources`], [Independent resources (docs, repos, web pages)], [Long-term], [Global],
  [`user`], [User-level data (profile, preferences, memories)], [Long-term], [Global],
  [`agent`], [Agent-level data (skills, instructions, memories)], [Long-term], [Global],
  [`session`], [Session-level data (messages, tools, history)], [Session lifetime], [Current session],
  [`queue`], [Processing queue], [Temporary], [Internal],
  [`temp`], [Temporary files during parsing], [During parsing], [Internal],
)

=== Initial Directory Structure

```
viking://
├── resources/{project}/       # Resource workspace
│   ├── .abstract.md
│   ├── .overview.md
│   └── {files...}
├── user/
│   ├── .overview.md           # User profile
│   └── memories/
│       ├── preferences/       # User preferences
│       ├── entities/          # Entity memories
│       └── events/            # Event records
├── agent/
│   ├── skills/                # Skill definitions
│   ├── memories/
│   │   ├── cases/
│   │   └── patterns/
│   └── instructions/
└── session/{session_id}/
    ├── messages.jsonl
    ├── .abstract.md
    ├── .overview.md
    └── history/
```

// =============================================================
= Storage Architecture
// =============================================================

OpenViking uses a _dual-layer storage architecture_ that separates content storage from index storage.

== VikingFS: The Virtual Filesystem

VikingFS is the unified URI abstraction layer that hides underlying storage details. It maps Viking URIs to physical storage paths and provides a POSIX-style API:

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Method*], [*Description*],
  [`read(uri)`], [Read file content],
  [`write(uri, data)`], [Write file],
  [`mkdir(uri)`], [Create directory],
  [`rm(uri)`], [Delete file/directory (syncs vector deletion)],
  [`mv(old, new)`], [Move/rename (syncs vector URI update)],
  [`abstract(uri)`], [Read L0 abstract],
  [`overview(uri)`], [Read L1 overview],
  [`relations(uri)`], [Get relation list],
  [`find(query, uri)`], [Semantic search],
)

VikingFS automatically maintains consistency between the vector index and AGFS. When a resource is deleted, all corresponding vector records are removed. When a resource is moved, all URI references in the vector index are updated.

== AGFS: Content Storage Backend

AGFS (Agent Graph File System) provides POSIX-style file operations with multiple backend support. It is implemented as a Go-based server that runs as a subprocess (in embedded mode) or as a shared service.

#table(
  columns: (auto, 1fr, auto),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Backend*], [*Description*], [*Configuration*],
  [`localfs`], [Local filesystem storage], [`path`],
  [`s3fs`], [S3-compatible object storage], [`bucket`, `endpoint`],
  [`memory`], [In-memory storage (for testing)], [—],
)

== Vector Index: The Semantic Layer

The vector index stores semantic indices for fast retrieval. It supports dense vectors, sparse vectors, and hybrid search.

=== Collection Schema

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Field*], [*Type*], [*Description*],
  [`id`], [string], [Primary key],
  [`uri`], [string], [Resource URI],
  [`parent_uri`], [string], [Parent directory URI],
  [`context_type`], [string], [resource / memory / skill],
  [`is_leaf`], [bool], [Whether leaf node (file vs. directory)],
  [`vector`], [vector], [Dense embedding vector],
  [`sparse_vector`], [sparse_vector], [Sparse embedding vector],
  [`abstract`], [string], [L0 abstract text],
  [`name`], [string], [Resource name],
  [`description`], [string], [Description],
  [`created_at`], [string], [Creation timestamp],
  [`active_count`], [int64], [Usage count],
)

=== Index Configuration

```python
index_meta = {
    "IndexType": "flat_hybrid",  # Hybrid dense+sparse index
    "Distance": "cosine",        # Cosine similarity
    "Quant": "int8",             # INT8 quantization
}
```

=== C++ High-Performance Engine

The vector index and key-value store are implemented in C++17 for maximum performance, exposed to Python via pybind11. The C++ engine includes:

- *IndexEngine*: A hybrid vector index supporting dense and sparse vectors, with operations for `add_data`, `delete_data`, `search`, and `dump` (persistence).
- *PersistStore*: A persistent key-value store backed by LevelDB, supporting batch operations, range scans, and serialized row storage.
- *VolatileStore*: An in-memory key-value store for testing and transient workloads.
- *BytesRow*: A schema-aware binary serialization/deserialization layer supporting multiple field types (int64, float32, string, binary, boolean, lists).

The C++ build system uses CMake with the following third-party dependencies:
- *LevelDB 1.23*: Persistent key-value storage
- *spdlog 1.14.1*: High-performance logging
- *RapidJSON*: JSON parsing
- *CRoaring*: Roaring bitmap operations

The build supports x86_64 with SSE3/native SIMD instructions and targets C++17 with cross-platform support (Linux, macOS, Windows).

=== Backend Support

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Backend*], [*Description*],
  [`local`], [Local persistence with C++ engine (default)],
  [`http`], [HTTP remote service],
  [`volcengine`], [Volcengine VikingDB cloud service],
)

// =============================================================
= Retrieval System
// =============================================================

OpenViking's retrieval system is one of its most innovative components. It uses a multi-stage pipeline: *intent analysis* → *hierarchical retrieval* → *reranking*.

== `find()` vs `search()`

OpenViking provides two retrieval APIs with different capabilities:

#table(
  columns: (auto, 1fr, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Feature*], [`find()`], [`search()`],
  [Session context], [Not needed], [Required],
  [Intent analysis], [Not used], [LLM-based analysis],
  [Query count], [Single query], [0--5 TypedQueries],
  [Latency], [Low], [Higher],
  [Use case], [Simple, direct queries], [Complex, multi-intent tasks],
)

== Intent Analysis

The `IntentAnalyzer` uses an LLM to analyze query intent and generate 0--5 `TypedQuery` objects. Each TypedQuery includes:

- *query*: A rewritten, optimized search query
- *context_type*: The target context type (MEMORY, RESOURCE, or SKILL)
- *intent*: The purpose of the query
- *priority*: An importance ranking (1--5)

Query styles are tailored to context types:
- *Skill queries*: Verb-first ("Create RFC document", "Extract PDF tables")
- *Resource queries*: Noun phrases ("RFC document template", "API usage guide")
- *Memory queries*: Possessive form ("User's code style preferences")

Special cases:
- *0 queries*: Chitchat or greetings that don't require retrieval
- *Multiple queries*: Complex tasks that may need skills + resources + memories

== Hierarchical Retrieval Algorithm

The `HierarchicalRetriever` uses a _priority queue_ to recursively search the directory structure. This is the core innovation that distinguishes OpenViking from flat vector search.

=== Algorithm Steps

+ *Determine root directories*: Map `context_type` to root directories (e.g., RESOURCE → `viking://resources/`)
+ *Global vector search*: Locate top-K starting directories
+ *Merge starting points*: Combine and score candidate directories using reranking
+ *Recursive search*: Use a min-heap priority queue to drill down through the directory tree
+ *Result conversion*: Convert to `MatchedContext` objects

=== Recursive Search Pseudocode

```python
while dir_queue:
    current_uri, parent_score = heapq.heappop(dir_queue)

    # Search children of current directory
    results = await search(parent_uri=current_uri)

    for r in results:
        # Score propagation: combine embedding score with parent context
        final_score = 0.5 * embedding_score + 0.5 * parent_score

        if final_score > threshold:
            collected.append(r)

            if not r.is_leaf:  # Directory → continue recursion
                heapq.heappush(dir_queue, (r.uri, final_score))

    # Convergence detection
    if topk_unchanged_for_3_rounds:
        break
```

=== Key Parameters

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Parameter*], [*Value*], [*Description*],
  [`SCORE_PROPAGATION_ALPHA`], [0.5], [50% embedding score + 50% parent context score],
  [`MAX_CONVERGENCE_ROUNDS`], [3], [Stop after 3 rounds with unchanged top-K],
  [`GLOBAL_SEARCH_TOPK`], [3], [Number of global search candidates],
  [`MAX_RELATIONS`], [5], [Maximum relations per resource],
  [`DIRECTORY_DOMINANCE_RATIO`], [1.2], [Directory score must exceed max child score by 20%],
)

== Reranking

Reranking refines candidate results using a dedicated reranking model (e.g., `doubao-seed-rerank` from Volcengine). It is applied at two points:

+ *Starting point evaluation*: Evaluate global search candidate directories
+ *Recursive search*: Evaluate children at each level of recursion

== Retrieval Results

```python
@dataclass
class FindResult:
    memories: List[MatchedContext]    # Matched memory contexts
    resources: List[MatchedContext]   # Matched resource contexts
    skills: List[MatchedContext]      # Matched skill contexts
    query_plan: Optional[QueryPlan]  # Present for search() only
    query_results: Optional[List[QueryResult]]
    total: int                       # Total matches
```

// =============================================================
= Context Extraction and Parsing
// =============================================================

OpenViking uses a three-phase async architecture for document parsing and context extraction. A key design principle is that *parsing and semantics are separated*: the parser never calls LLMs; semantic generation is fully asynchronous.

== Parsing Pipeline

```
Input File → Parser → TreeBuilder → SemanticQueue → Vector Index
                ↓           ↓              ↓
          Parse &       Move Files     L0/L1 Generation
          Convert       Queue Semantic  (LLM Async)
          (No LLM)
```

== Supported Formats

OpenViking includes a comprehensive parser registry supporting a wide range of document formats:

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Format*], [*Parser Class*], [*Extensions*],
  [Markdown], [`MarkdownParser`], [`.md`, `.markdown`],
  [Plain text], [`TextParser`], [`.txt`],
  [PDF], [`PDFParser`], [`.pdf`],
  [HTML], [`HTMLParser`], [`.html`, `.htm`],
  [Word], [`WordParser`], [`.docx`],
  [PowerPoint], [`PowerPointParser`], [`.pptx`],
  [Excel], [`ExcelParser`], [`.xlsx`],
  [EPUB], [`EpubParser`], [`.epub`],
  [Code], [`CodeRepositoryParser`], [`.py`, `.js`, `.go`, etc.],
  [Image], [`ImageParser`], [`.png`, `.jpg`, etc.],
  [Video], [`VideoParser`], [`.mp4`, `.avi`, etc.],
  [Audio], [`AudioParser`], [`.mp3`, `.wav`, etc.],
  [ZIP], [`ZipParser`], [`.zip`],
  [Directory], [`DirectoryParser`], [Filesystem directories],
)

== Smart Document Splitting

Documents are intelligently split based on token count:

```
If document_tokens <= 1024:
    → Save as single file
Else:
    → Split by headers
    → Section < 512 tokens → Merge with neighbors
    → Section > 1024 tokens → Create subdirectory
```

== TreeBuilder

The `TreeBuilder` moves parsed content from temporary storage to AGFS and queues semantic processing. It operates in five phases:

+ *Find document root*: Ensure exactly one subdirectory in temp
+ *Determine target URI*: Map base URI by scope (`resources`, `user`, `agent`)
+ *Recursively move directory tree*: Copy all files to AGFS
+ *Clean up temp directory*: Delete temp files
+ *Queue semantic generation*: Submit `SemanticMsg` to queue

== SemanticQueue: Async L0/L1 Generation

The `SemanticProcessor` handles asynchronous L0/L1 generation and vectorization. Processing flows bottom-up:

+ *Concurrent file summary generation*: Up to 10 concurrent LLM calls
+ *Collect child directory abstracts*: Read generated `.abstract.md` files
+ *Generate `.overview.md`*: LLM generates L1 overview from child summaries
+ *Extract `.abstract.md`*: Extract L0 from overview
+ *Write files*: Save to AGFS
+ *Vectorize*: Create `Context` objects and queue to `EmbeddingQueue`

// =============================================================
= Session Management
// =============================================================

Session management is the mechanism by which OpenViking enables agents to "learn from experience." It manages conversation messages, tracks context usage, and automatically extracts long-term memories.

== Session Lifecycle

```
Create → Interact (add messages, track usage) → Commit
```

```python
session = client.session(session_id="chat_001")
session.add_message("user", [TextPart("...")])
session.used(contexts=["viking://user/memories/profile.md"])
session.commit()  # Archive + memory extraction
```

== Message Structure

Messages consist of typed parts:

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Part Type*], [*Description*],
  [`TextPart`], [Plain text content],
  [`ContextPart`], [Context reference with URI and abstract],
  [`ToolPart`], [Tool call with input and output],
)

== Compression Strategy

When a session is committed, automatic archiving occurs:

+ Increment compression index
+ Copy current messages to archive directory (`history/archive_NNN/`)
+ Generate structured summary using LLM
+ Clear current messages list

The summary follows a structured format including one-line overview, key analysis, primary request and intent, key concepts, and pending tasks.

== Memory Extraction

The `MemoryExtractor` is the core component that enables agents to learn from their interactions. It operates in a multi-stage pipeline:

=== Extraction Pipeline

```
Messages → LLM Extract → Candidate Memories
                ↓
Vector Pre-filter → Find Similar Existing Memories
                ↓
LLM Dedup Decision → CREATE / UPDATE / MERGE / SKIP
                ↓
Write to AGFS → Vectorize
```

=== Deduplication Decisions

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Decision*], [*Description*],
  [`CREATE`], [New memory; create directly in the appropriate category directory],
  [`UPDATE`], [Update an existing memory with new information],
  [`MERGE`], [Merge multiple related memories into a consolidated entry],
  [`SKIP`], [Duplicate of existing memory; skip],
)

=== Language Detection

The memory extractor includes automatic language detection, scoped to user messages only, so that assistant/system text does not bias the target output language for stored memories.

// =============================================================
= Model Integration
// =============================================================

OpenViking integrates with a wide range of AI model providers through a unified provider registry system.

== VLM (Vision-Language Model) Providers

OpenViking uses VLM models for content understanding, L0/L1 generation, intent analysis, and memory extraction. It supports the following providers:

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Provider*], [*Model Family*], [*API Key Source*],
  [`volcengine`], [Doubao], [Volcengine Console],
  [`openai`], [GPT], [OpenAI Platform],
  [`anthropic`], [Claude], [Anthropic Console],
  [`deepseek`], [DeepSeek], [DeepSeek Platform],
  [`gemini`], [Gemini], [Google AI Studio],
  [`moonshot`], [Kimi], [Moonshot Platform],
  [`zhipu`], [GLM], [Zhipu Open Platform],
  [`dashscope`], [Qwen], [DashScope Console],
  [`minimax`], [MiniMax], [MiniMax Platform],
  [`openrouter`], [Any model], [OpenRouter],
  [`vllm`], [Local model], [Self-hosted],
)

The system uses a *Provider Registry* for unified model access. Providers are automatically detected based on model name keywords, enabling seamless switching between providers.

=== VLM Backend Implementations

OpenViking includes three VLM backend implementations:

- *OpenAI VLM*: Uses the OpenAI-compatible chat completions API
- *Volcengine VLM*: Uses the Volcengine ARK API with support for both model names and endpoint IDs
- *LiteLLM VLM*: Uses the LiteLLM library as a universal proxy for any LLM provider

=== Token Usage Tracking

The system includes comprehensive token usage tracking, recording input tokens, output tokens, and total tokens for each VLM call.

== Embedding Providers

For vectorization and semantic retrieval, OpenViking supports:

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Provider*], [*Description*],
  [`volcengine`], [Volcengine embedding models (e.g., `doubao-embedding-vision-250615`)],
  [`openai`], [OpenAI embedding models (e.g., `text-embedding-3-large`)],
  [`vikingdb`], [VikingDB native embeddings],
)

Embedding results include dense vectors and optionally sparse vectors for hybrid retrieval.

== Prompt Management

OpenViking uses a template-based prompt management system with Jinja2 templates stored as YAML files. Prompts are organized by task category (e.g., memory extraction, intent analysis, summarization) and support parameterized rendering.

// =============================================================
= HTTP Server and API
// =============================================================

OpenViking provides a comprehensive HTTP API built on FastAPI for production deployment.

== Server Architecture

The server is implemented in `openviking/server/` with:

- *`bootstrap.py`*: Server startup and configuration
- *`app.py`*: FastAPI application factory with lifespan management
- *`auth.py`*: API key authentication (X-API-Key header or Bearer token)
- *`config.py`*: Server configuration (port, CORS, API key)
- *`models.py`*: Pydantic request/response models
- *`dependencies.py`*: Dependency injection for service layer

== API Endpoints

=== System Endpoints

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Method*], [*Path*], [*Description*],
  [GET], [`/health`], [Health check (no auth required)],
  [GET], [`/api/v1/system/status`], [System component status],
  [POST], [`/api/v1/system/wait`], [Wait for async processing to complete],
)

=== Resource Endpoints

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Method*], [*Path*], [*Description*],
  [POST], [`/api/v1/resources`], [Add resource (URL, file, or directory)],
  [POST], [`/api/v1/skills`], [Add skill definition],
  [POST], [`/api/v1/pack/export`], [Export context as `.ovpack`],
  [POST], [`/api/v1/pack/import`], [Import `.ovpack` into target URI],
)

=== Filesystem Endpoints

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Method*], [*Path*], [*Description*],
  [GET], [`/api/v1/fs/ls`], [List directory contents],
  [GET], [`/api/v1/fs/tree`], [Get directory tree],
  [GET], [`/api/v1/fs/stat`], [Get resource metadata],
  [POST], [`/api/v1/fs/mkdir`], [Create directory],
  [DELETE], [`/api/v1/fs`], [Delete resource],
  [POST], [`/api/v1/fs/mv`], [Move/rename resource],
)

=== Content Endpoints

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Method*], [*Path*], [*Description*],
  [GET], [`/api/v1/content/read`], [Read full content (L2)],
  [GET], [`/api/v1/content/abstract`], [Read abstract (L0)],
  [GET], [`/api/v1/content/overview`], [Read overview (L1)],
)

=== Search Endpoints

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Method*], [*Path*], [*Description*],
  [POST], [`/api/v1/search/find`], [Simple semantic search],
  [POST], [`/api/v1/search/search`], [Context-aware search with intent analysis],
  [POST], [`/api/v1/search/grep`], [Content pattern search],
  [POST], [`/api/v1/search/glob`], [File pattern matching],
)

=== Session Endpoints

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Method*], [*Path*], [*Description*],
  [POST], [`/api/v1/sessions`], [Create new session],
  [GET], [`/api/v1/sessions`], [List all sessions],
  [GET], [`/api/v1/sessions/{id}`], [Get session details],
  [DELETE], [`/api/v1/sessions/{id}`], [Delete session],
  [POST], [`/api/v1/sessions/{id}/commit`], [Commit session (archive + extract)],
  [POST], [`/api/v1/sessions/{id}/messages`], [Add message to session],
)

=== Relation and Observer Endpoints

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Method*], [*Path*], [*Description*],
  [GET], [`/api/v1/relations`], [Get resource relations],
  [POST], [`/api/v1/relations/link`], [Create relation link],
  [DELETE], [`/api/v1/relations/link`], [Remove relation link],
  [GET], [`/api/v1/observer/queue`], [Queue processing status],
  [GET], [`/api/v1/observer/vikingdb`], [VikingDB status],
  [GET], [`/api/v1/observer/vlm`], [VLM status],
  [GET], [`/api/v1/observer/system`], [Overall system status],
)

== Response Format

All responses follow a unified JSON format:

```json
// Success
{
  "status": "ok",
  "result": { ... },
  "time": 0.123
}

// Error
{
  "status": "error",
  "error": {
    "code": "NOT_FOUND",
    "message": "Resource not found: viking://resources/nonexistent/"
  },
  "time": 0.01
}
```

== Error Codes

OpenViking defines a comprehensive set of error codes mapped to HTTP status codes:

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Code*], [*HTTP*], [*Description*],
  [`OK`], [200], [Success],
  [`INVALID_ARGUMENT`], [400], [Invalid parameter],
  [`INVALID_URI`], [400], [Invalid Viking URI format],
  [`NOT_FOUND`], [404], [Resource not found],
  [`ALREADY_EXISTS`], [409], [Resource already exists],
  [`UNAUTHENTICATED`], [401], [Missing or invalid API key],
  [`PERMISSION_DENIED`], [403], [Insufficient permissions],
  [`RESOURCE_EXHAUSTED`], [429], [Rate limit exceeded],
  [`DEADLINE_EXCEEDED`], [504], [Operation timed out],
  [`UNAVAILABLE`], [503], [Service unavailable],
  [`INTERNAL`], [500], [Internal server error],
  [`EMBEDDING_FAILED`], [500], [Embedding generation failed],
  [`VLM_FAILED`], [500], [VLM call failed],
  [`SESSION_EXPIRED`], [410], [Session no longer exists],
)

// =============================================================
= Rust CLI
// =============================================================

OpenViking includes a full-featured command-line interface written in Rust, providing a fast, compiled binary for interacting with OpenViking servers.

== Architecture

The Rust CLI is organized as a Cargo workspace member at `crates/ov_cli/`. It uses:

- *clap*: Command-line argument parsing with derive macros
- *reqwest*: HTTP client for server communication
- *tokio*: Async runtime
- *serde/serde_json*: JSON serialization
- *tabled*: Table formatting for terminal output

The CLI follows a clean architecture: `main.rs` → `commands/` modules → `client.rs` (HTTP client) → server.

== Available Commands

The CLI mirrors the full HTTP API surface:

=== Resource Management
- `add-resource <path>` --- Import a resource (URL, file, or directory)
- `add-skill <data>` --- Import a skill definition

=== Filesystem Operations
- `ls <uri>` --- List directory contents (aliases: `list`)
- `tree <uri>` --- Display directory tree
- `mkdir <uri>` --- Create directory
- `rm <uri>` --- Remove resource (aliases: `del`, `delete`)
- `mv <from> <to>` --- Move/rename (aliases: `rename`)
- `stat <uri>` --- Get resource metadata

=== Content Access
- `read <uri>` --- Read full content (L2)
- `abstract <uri>` --- Read abstract (L0)
- `overview <uri>` --- Read overview (L1)

=== Search Operations
- `find <query>` --- Simple semantic search
- `search <query>` --- Context-aware search with intent analysis
- `grep <uri> <pattern>` --- Content pattern search
- `glob <pattern>` --- File pattern matching

=== Session Management
- `session new` --- Create new session
- `session list` --- List all sessions
- `session get <id>` --- Get session details
- `session delete <id>` --- Delete session
- `session add-message <id>` --- Add message to session
- `session commit <id>` --- Commit session
- `add-memory <content>` --- One-shot memory addition

=== Relation Management
- `relations <uri>` --- List relations
- `link <from> <to...>` --- Create relation links
- `unlink <from> <to>` --- Remove relation link

=== Import/Export
- `export <uri> <to>` --- Export context as `.ovpack`
- `import <file> <uri>` --- Import `.ovpack`

=== System and Monitoring
- `status` --- Show component status
- `health` --- Quick health check
- `wait` --- Wait for async processing
- `observer queue|vikingdb|vlm|system` --- Observer status
- `config show|validate` --- Configuration management

== Output Formats

The CLI supports three output formats:

- *Table* (default): Human-readable tabular format
- *JSON* (`-o json`): Structured JSON matching the API response format
- *Compact* (`-c true`, default): Simplified output for agent consumption

== Build and Installation

```bash
# Install via script
curl -fsSL https://raw.githubusercontent.com/volcengine/OpenViking/\
    main/crates/ov_cli/install.sh | bash

# Or build from source
cargo install --git https://github.com/volcengine/OpenViking ov_cli
```

The release build uses `opt-level = 3`, LTO (Link-Time Optimization), and symbol stripping for maximum performance and minimal binary size.

// =============================================================
= Python SDK and CLI
// =============================================================

== Python SDK

The Python SDK provides both synchronous and asynchronous clients:

=== Client Classes

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Class*], [*Description*],
  [`SyncOpenViking`], [Synchronous client for embedded mode (aliased as `OpenViking`)],
  [`AsyncOpenViking`], [Asynchronous client for embedded mode (singleton pattern)],
  [`SyncHTTPClient`], [Synchronous client for HTTP mode],
  [`AsyncHTTPClient`], [Asynchronous client for HTTP mode],
)

All clients implement the same `BaseClient` interface, ensuring consistent behavior across deployment modes.

=== Quick Start Example

```python
import openviking as ov

client = ov.OpenViking(path="./data")
client.initialize()

# Add a resource
res = client.add_resource(path="https://example.com/doc.md")
root_uri = res["root_uri"]

# Wait for semantic processing
client.wait_processed()

# Get tiered content
abstract = client.abstract(root_uri)    # L0
overview = client.overview(root_uri)    # L1
content = client.read(root_uri)         # L2

# Semantic search
results = client.find("authentication", target_uri=root_uri)
for r in results.resources:
    print(f"  {r.uri} (score: {r.score:.4f})")

client.close()
```

== Python CLI

The Python CLI is implemented using *Typer* and provides the `openviking` command. It is defined as an entry point in `pyproject.toml`:

```toml
[project.scripts]
openviking = "openviking_cli.cli.main:app"
openviking-server = "openviking.server.bootstrap:main"
```

The Python CLI package (`openviking_cli/`) contains:
- `cli/` --- CLI command definitions
- `client/` --- HTTP and local client implementations
- `session/` --- Session management and user identification
- `utils/` --- Configuration, logging, URI parsing

// =============================================================
= Project Structure and Codebase
// =============================================================

== Directory Layout

```
OpenViking/
├── openviking/              # Core Python SDK
│   ├── __init__.py          # Public API exports
│   ├── async_client.py      # AsyncOpenViking client
│   ├── sync_client.py       # SyncOpenViking client
│   ├── agfs_manager.py      # AGFS subprocess management
│   ├── core/                # Core data models
│   │   ├── context.py       # Context base class
│   │   ├── directories.py   # Directory definitions
│   │   ├── building_tree.py # Tree building logic
│   │   ├── skill_loader.py  # Skill loading
│   │   └── mcp_converter.py # MCP tool conversion
│   ├── client/              # Client implementations
│   │   ├── local.py         # LocalClient (embedded)
│   │   └── session.py       # Session integration
│   ├── models/              # AI model integration
│   │   ├── vlm/             # VLM providers
│   │   │   ├── registry.py  # Provider registry
│   │   │   ├── backends/    # OpenAI, Volcengine, LiteLLM
│   │   │   └── token_usage.py
│   │   └── embedder/        # Embedding providers
│   │       ├── base.py      # Base embedder
│   │       ├── openai_embedders.py
│   │       └── volcengine_embedders.py
│   ├── parse/               # Document parsers
│   │   ├── registry.py      # Parser registry
│   │   ├── tree_builder.py  # TreeBuilder
│   │   ├── parsers/         # Format-specific parsers
│   │   │   ├── markdown.py, pdf.py, html.py
│   │   │   ├── word.py, powerpoint.py, excel.py
│   │   │   ├── epub.py, text.py, media.py
│   │   │   ├── code/, directory.py, zip_parser.py
│   │   │   └── constants.py, upload_utils.py
│   │   ├── resource_detector/ # Resource detection
│   │   ├── converter.py     # Format conversion
│   │   └── vlm.py           # VLM-based parsing
│   ├── retrieve/            # Retrieval system
│   │   ├── hierarchical_retriever.py
│   │   └── intent_analyzer.py
│   ├── session/             # Session management
│   │   ├── session.py       # Session core
│   │   ├── compressor.py    # Session compression
│   │   ├── memory_extractor.py  # Memory extraction
│   │   └── memory_deduplicator.py
│   ├── service/             # Service layer
│   │   ├── core.py          # OpenVikingService
│   │   ├── fs_service.py, search_service.py
│   │   ├── session_service.py, resource_service.py
│   │   ├── relation_service.py, pack_service.py
│   │   └── debug_service.py
│   ├── server/              # HTTP server
│   │   ├── app.py           # FastAPI application
│   │   ├── bootstrap.py     # Server startup
│   │   ├── auth.py, config.py, models.py
│   │   └── routers/         # API route handlers
│   ├── storage/             # Storage layer
│   │   ├── viking_fs.py     # VikingFS abstraction
│   │   ├── vectordb/        # Vector index
│   │   └── queuefs/         # Semantic processing queue
│   ├── message/             # Message handling
│   ├── prompts/             # Prompt templates
│   └── utils/               # Configuration, logging
├── openviking_cli/          # CLI package
│   ├── cli/                 # CLI commands
│   ├── client/              # HTTP/sync client
│   ├── session/             # Session/user ID
│   └── utils/               # Config, URI, logging
├── crates/                  # Rust crate
│   └── ov_cli/              # Rust CLI binary
│       └── src/             # Rust source files
├── src/                     # C++ extensions
│   ├── CMakeLists.txt       # Build configuration
│   ├── pybind11_interface.cpp
│   ├── index/               # Vector index engine
│   ├── store/               # Persistent/volatile stores
│   └── common/              # Shared utilities
├── third_party/             # Third-party dependencies
│   ├── agfs/                # AGFS filesystem (Go)
│   ├── leveldb-1.23/        # LevelDB
│   ├── spdlog-1.14.1/       # Logging library
│   ├── croaring/            # Roaring bitmaps
│   └── rapidjson/           # JSON parsing
├── tests/                   # Test suite
│   ├── client/              # Client tests
│   ├── engine/              # Engine tests
│   ├── integration/         # Integration tests
│   ├── session/             # Session tests
│   └── vectordb/            # Vector DB tests
├── examples/                # Usage examples
│   ├── quick_start.py       # Quick start example
│   ├── query/               # Query examples
│   ├── chatmem/             # Chat memory example
│   ├── memex/               # Memory extraction example
│   ├── mcp-query/           # MCP integration example
│   ├── openclaw-skill/      # Skill integration example
│   ├── server_client/       # Server/client example
│   └── common/              # Shared example code
├── docs/                    # Documentation
│   ├── en/                  # English docs
│   └── zh/                  # Chinese docs
└── .github/workflows/       # CI/CD workflows
```

== Language Composition

The codebase is a polyglot project spanning four programming languages:

#table(
  columns: (auto, 1fr, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Language*], [*Role*], [*Key Components*],
  [Python], [Core SDK, server, parsers, services], [openviking/, openviking_cli/, tests/],
  [Rust], [High-performance CLI], [crates/ov_cli/],
  [C++17], [Vector index engine, storage engine], [src/index/, src/store/],
  [Go], [AGFS filesystem server], [third_party/agfs/],
)

// =============================================================
= Build System and Dependencies
// =============================================================

== Python Build

The Python package uses `setuptools` with `setuptools-scm` for version management from Git tags. The build process includes:

+ *AGFS compilation*: Builds the Go-based AGFS server from source
+ *C++ extension compilation*: Uses CMake to build the vector index engine as a pybind11 module
+ *Package assembly*: Includes AGFS binary and compiled C++ extensions in the wheel

Key dependencies include:
- *pydantic* (>= 2.0): Data validation and serialization
- *httpx* (>= 0.25): HTTP client
- *fastapi* (>= 0.128) + *uvicorn*: HTTP server
- *openai* (>= 1.0): OpenAI API client
- *litellm* (>= 1.0): Universal LLM proxy
- *pdfplumber*, *python-docx*, *python-pptx*, *openpyxl*, *ebooklib*: Document parsing
- *markdownify*, *readabilipy*: HTML-to-markdown conversion
- *pyagfs*: AGFS client library
- *jinja2*: Template rendering for prompts
- *typer*: Python CLI framework
- *xxhash*: Fast hashing

== Rust Build

The Rust CLI uses a Cargo workspace with release profile optimizations:

```toml
[profile.release]
opt-level = 3
lto = true
strip = true
```

Key Rust dependencies:
- *clap*: CLI argument parsing
- *reqwest*: HTTP client
- *tokio*: Async runtime
- *serde/serde_json*: Serialization
- *tabled*: Table formatting

== C++ Build

The C++ extensions use CMake with:
- C++17 standard
- pybind11 for Python bindings
- LevelDB for persistent storage
- SIMD optimizations (SSE3 / native)
- Cross-platform support (Linux, macOS, Windows)

// =============================================================
= CI/CD and Quality Assurance
// =============================================================

== GitHub Actions Workflows

OpenViking uses a comprehensive, modular CI/CD pipeline with GitHub Actions:

=== Automatic Workflows

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Trigger*], [*Workflow*], [*Description*],
  [Pull Request], [`pr.yml`], [Lint (Ruff, Mypy) + Test Lite (Linux, Python 3.10)],
  [Push to Main], [`ci.yml`], [Full Test (Linux/Win/Mac, Python 3.10--3.13) + CodeQL],
  [Release Published], [`release.yml`], [Build sdist + wheels, publish to PyPI],
  [Weekly Cron], [`schedule.yml`], [CodeQL security scan every Sunday],
)

=== Manual Trigger Workflows

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Name*], [*ID*], [*Description*],
  [Lint Checks], [`_lint.yml`], [Ruff + Mypy checks],
  [Test Suite (Lite)], [`_test_lite.yml`], [Fast integration tests, configurable matrix],
  [Test Suite (Full)], [`_test_full.yml`], [Full tests on all platforms and Python versions],
  [Security Scan], [`_codeql.yml`], [CodeQL security analysis],
  [Build Distribution], [`_build.yml`], [Build wheels only (no publish)],
  [Publish Distribution], [`_publish.yml`], [Publish built packages to PyPI],
  [Rust CLI], [`rust-cli.yml`], [Build and test Rust CLI],
)

== Code Quality Tools

#table(
  columns: (auto, auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Tool*], [*Purpose*], [*Configuration*],
  [Ruff], [Linting + formatting + import sorting], [`pyproject.toml` — line length 100, double quotes],
  [Mypy], [Static type checking], [`pyproject.toml` — Python 3.10, check untyped defs],
  [pre-commit], [Git hooks for automated checks], [`.pre-commit-config.yaml`],
  [pytest], [Testing framework], [`pyproject.toml` — async mode, coverage reporting],
  [CodeQL], [Security vulnerability scanning], [GitHub Actions workflow],
)

== Testing Strategy

Tests are organized by module:

- `tests/client/` --- Client integration tests
- `tests/engine/` --- C++ engine tests
- `tests/integration/` --- End-to-end integration tests
- `tests/session/` --- Session management tests
- `tests/vectordb/` --- Vector database tests

Test configuration: asyncio auto mode, verbose output, and coverage reporting with `--cov=openviking --cov-report=term-missing`.

== Version Management

Versions are derived from Git tags using `setuptools-scm`:
- *Tag format*: `vX.Y.Z` (Semantic Versioning)
- *Release build*: Tag → version (e.g., `v0.1.0` → `0.1.0`)
- *Development build*: Includes commit count (e.g., `0.1.1.dev3`)

// =============================================================
= Configuration System
// =============================================================

OpenViking uses a two-file configuration system:

== `ov.conf` --- Core Configuration

Located at `~/.openviking/ov.conf` (or specified via `OPENVIKING_CONFIG_FILE`), this JSON file configures embedding models, VLM models, storage backends, and other core settings.

```json
{
  "embedding": {
    "dense": {
      "api_base": "https://ark.cn-beijing.volces.com/api/v3",
      "api_key": "your-api-key",
      "provider": "volcengine",
      "dimension": 1024,
      "model": "doubao-embedding-vision-250615"
    }
  },
  "vlm": {
    "api_base": "https://ark.cn-beijing.volces.com/api/v3",
    "api_key": "your-api-key",
    "provider": "volcengine",
    "model": "doubao-seed-1-8-251228"
  }
}
```

== `ovcli.conf` --- CLI/HTTP Client Configuration

Located at `~/.openviking/ovcli.conf` (or specified via `OPENVIKING_CLI_CONFIG_FILE`), this file configures the connection to an OpenViking server:

```json
{
  "url": "http://localhost:1933",
  "api_key": "your-key",
  "output": "table"
}
```

// =============================================================
= Import/Export: OVPack Format
// =============================================================

OpenViking supports exporting and importing context trees as `.ovpack` files. This enables:

- *Context portability*: Share context trees between OpenViking instances
- *Backup and restore*: Create backups of specific context subtrees
- *Collaboration*: Share pre-built context packages with team members

```python
# Export
client.export_ovpack(uri="viking://resources/my-project/", to="project.ovpack")

# Import
client.import_ovpack(file_path="project.ovpack", target_uri="viking://resources/")
```

// =============================================================
= Relation System
// =============================================================

OpenViking supports explicit relation links between resources, enabling agents to discover related context:

```python
# Create relation
client.link(
    from_uri="viking://resources/docs/auth",
    uris=["viking://resources/docs/security"],
    reason="Related security documentation"
)

# Get relations
relations = client.relations("viking://resources/docs/auth")
```

Relations are stored as `.relations.json` files within each directory and are surfaced during retrieval as `RelatedContext` objects attached to search results.

// =============================================================
= MCP Integration
// =============================================================

OpenViking includes a *Model Context Protocol (MCP)* converter (`mcp_converter.py`) that can automatically convert MCP tool definitions into OpenViking skill format. This enables agents built with MCP-compatible frameworks to seamlessly register their tools as searchable skills in OpenViking.

// =============================================================
= Examples and Use Cases
// =============================================================

The repository includes several comprehensive examples:

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Example*], [*Description*],
  [`quick_start.py`], [Minimal example: add resource, search, retrieve],
  [`query/`], [Query and retrieval examples],
  [`chatmem/`], [Chat memory management example],
  [`memex/`], [Memory extraction from conversations],
  [`mcp-query/`], [MCP tool integration with OpenViking],
  [`openclaw-skill/`], [Skill definition and registration],
  [`server_client/`], [Server deployment and client connection],
  [`common/`], [Shared utilities for examples],
)

// =============================================================
= Future Roadmap
// =============================================================

The project has documented a clear roadmap for future development:

== Completed Features

- Three-layer information model (L0/L1/L2)
- Viking URI addressing system
- Dual-layer storage (AGFS + Vector Index)
- Async/Sync client support
- Text resource management (Markdown, HTML, PDF, DOCX, PPTX, XLSX, EPUB)
- Automatic L0/L1 generation
- Semantic search with vector indexing
- Resource relations and linking
- Context-aware search with intent analysis
- Session management with memory extraction
- Memory deduplication with LLM
- Skill definition, storage, and MCP auto-conversion
- HTTP Server (FastAPI) with API key authentication
- Python and Rust CLI
- Pluggable embedding and LLM providers

== Planned Features

- *CLI enhancements*: Complete command-line interface for all operations; distributed storage backend
- *Multimodal support*: Intelligent parsing and access for images, video, and audio resources
- *Context management*: Propagation updates when context is modified; git-like version management and rollback
- *Access control*: Multi-Agent and Multi-User support; role-based isolation; permission design for resource directory nodes
- *Ecosystem integration*: Popular Agent framework adapters; plugin system for custom components

// =============================================================
= Design Principles
// =============================================================

OpenViking adheres to several key design principles:

#table(
  columns: (auto, 1fr),
  stroke: 0.5pt + gray,
  inset: 8pt,
  [*Principle*], [*Description*],
  [Pure Storage Layer], [Storage only handles AGFS operations and basic vector search; Rerank logic is in the retrieval layer],
  [Three-Layer Information], [L0/L1/L2 enables progressive detail loading, saving token consumption and cost],
  [Two-Stage Retrieval], [Vector search recalls candidates, Rerank improves accuracy],
  [Single Data Source], [All content is read from AGFS; the vector index only stores references, never content],
  [Separation of Parsing and Semantics], [Parsers never call LLMs; semantic generation is fully asynchronous],
  [Filesystem Paradigm], [All context is organized as a virtual filesystem with deterministic paths],
)

// =============================================================
= Conclusion
// =============================================================

OpenViking represents a significant advancement in the field of AI agent infrastructure. By reimagining context management through the lens of a filesystem paradigm, it addresses the fundamental limitations of traditional RAG approaches.

The project's key technical contributions include:

+ *A unified context model* that treats memories, resources, and skills as first-class citizens in a virtual filesystem, eliminating the fragmentation that plagues traditional approaches.

+ *A three-tier information model (L0/L1/L2)* that enables progressive loading of context, dramatically reducing token consumption while maintaining information completeness.

+ *A hierarchical retrieval algorithm* that combines global vector search with recursive directory exploration, achieving both breadth and depth in context discovery.

+ *An automatic memory extraction system* that enables agents to learn from their interactions, creating a self-improving cycle of knowledge accumulation.

+ *A polyglot architecture* spanning Python, Rust, C++, and Go, each language chosen for its strengths: Python for flexibility and ecosystem, Rust for CLI performance, C++ for vector engine speed, and Go for filesystem operations.

The project is actively maintained by the ByteDance Volcengine Viking Team, with a clear roadmap for future development including multimodal support, version management, access control, and ecosystem integration. As AI agents continue to evolve from simple chatbots to sophisticated autonomous systems, tools like OpenViking will become essential infrastructure for managing the context that powers their intelligence.

#v(2em)
#align(center)[
  #line(length: 30%, stroke: 0.5pt + gray)
  #v(0.5em)
  #text(size: 10pt, fill: gray)[
    End of Report \
    Generated February 17, 2026 \
    Source: `github.com/volcengine/OpenViking` \
    License: Apache 2.0
  ]
]
