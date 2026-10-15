# AI Knowledge Inbox — Build Specification & Agent Instructions

You are a senior full-stack engineer. Build the project described below, phase by phase, following the **Coding Standards** and **Workflow Rules** strictly. Read this whole document before writing any code.

---

## 0. How to read this document

1. **Coding Standards** (Section 1) apply to every file you write.
2. **Workflow Rules** (Section 2) apply to every phase. They are non-negotiable.
3. **Project Spec** (Sections 3–8) says what to build.
4. **Phases** (Section 9) say in what order, with acceptance criteria.
5. **README requirements** (Section 10) and **Definition of Done** (Section 11) say how the work is judged.

If something is ambiguous, pick the simplest reasonable default, state the assumption in one line, and continue. Only stop to ask if you are genuinely blocked.

---

## 1. Coding Standards (TOP PRIORITY)

Code quality is the main evaluation criterion. The app must be small, but the code must look production-grade.

### 1.1 SOLID — apply concretely

| Principle | How it must show up in this codebase |
|---|---|
| **S** — Single Responsibility | One job per module: `Chunker`, `Embedder`, `Retriever`, `AnswerGenerator`, `UrlFetcher`, `ContentExtractor`. Route handlers only parse input, validate, call a service, and shape the response. No business logic in routes. |
| **O** — Open/Closed | Adding a new chunking strategy, embedding provider, LLM provider, or ingestor must require **adding** a class, not editing existing ones. |
| **L** — Liskov Substitution | Any implementation of `EmbeddingProvider`, `LLMProvider`, `VectorStore`, or `Chunker` must be swappable with no change to callers. Fakes used in tests must obey the same contract. |
| **I** — Interface Segregation | Small, focused interfaces. No "god" service interface. Callers depend only on the methods they use. |
| **D** — Dependency Inversion | Services depend on interfaces, never on concrete SDKs or `better-sqlite3` directly. Dependencies are injected via constructors and wired in **one** composition root (`server/src/container.ts`). |

### 1.2 Design patterns — use only where they solve a real problem

| Pattern | Where |
|---|---|
| **Strategy** | `Chunker` strategies; similarity/scoring function |
| **Adapter** | `OpenAIEmbeddingProvider`, `OpenAILLMProvider` (and optionally `AnthropicLLMProvider`) behind `EmbeddingProvider` / `LLMProvider` |
| **Repository** | `ItemRepository`, `ChunkRepository` wrap all SQLite access |
| **Factory** | `IngestorFactory` returns `NoteIngestor` or `UrlIngestor` by source type |
| **Dependency Injection** | Constructor injection, single composition root |
| **Pipeline** | Processing steps: fetch → extract → chunk → embed → store, as composable steps |
| **Observer / event emitter** | Ingest emits `item.created`; a background processor listens and runs the pipeline |

**Guardrail:** The brief explicitly says *avoid overengineering*. Do not add a pattern for show. If a pattern adds indirection without removing a real coupling or enabling a real swap, do not use it. Prefer simple, readable code over pattern count. Add a one-line comment only where a pattern's purpose is not obvious.

### 1.3 General rules

- **TypeScript strict mode** on both server and web. **No `any`.** No non-null assertions unless justified with a comment.
- **No god files.** Target under ~200 lines per file. Split by responsibility.
- **No copy-paste.** Extract shared logic (e.g., error mapping, API client, fetch wrappers).
- **Clear naming.** Intention-revealing names, no abbreviations, verbs for functions, nouns for classes.
- **Small functions.** One level of abstraction per function. Prefer early returns over deep nesting.
- **Immutability by default.** `const`, `readonly`, no mutation of inputs.
- **Typed errors.** A custom error hierarchy (`AppError` → `ValidationError`, `NotFoundError`, `UnprocessableContentError`, `UpstreamServiceError`) mapped to HTTP status codes in **one** error middleware.
- **Validation at the boundary.** All request bodies validated with `zod`; internal code trusts validated types.
- **Config in one place.** Environment variables parsed and validated once in `config.ts`; nothing else reads `process.env`.
- **No dead code, no commented-out code, no TODO litter.**
- **Comments explain why, not what.**
- **Tests:** Unit tests for the chunker, cosine similarity/retriever, and URL extraction/SSRF guard, using **fakes** for providers (this also proves the design is decoupled).

---

## 2. Workflow Rules (NON-NEGOTIABLE)

1. **NEVER run `git add`, `git commit`, `git push`, or any command that modifies git history or staging.** The developer controls version control. (Creating `.gitignore` as a normal file is fine.)
2. **Work one phase (feature) at a time.** Each phase in Section 9 is a single, coherent, committable unit that builds and runs on its own.
3. **After finishing a phase, STOP and output a "Phase Report"** in exactly this format:

   ```
   ## Phase N Complete: <phase name>

   ### Suggested commit message
   <type>(<scope>): <imperative summary, max 72 chars>

   <body: 2–5 lines on what changed and why>

   ### Files changed
   - path/to/file — short note

   ### How to verify
   - exact commands (tests, curl, or UI steps) and the expected result

   ### Assumptions / notes
   - anything the developer should know
   ```

4. **Commit message format: Conventional Commits** (`feat`, `fix`, `chore`, `refactor`, `test`, `docs`). Example: `feat(ingest): add URL ingestion with readability extraction`.
5. **Do NOT start the next phase until the developer replies that the commit is done** (e.g., "committed", "next"). No batching multiple phases into one response.
6. If the developer requests a change after a Phase Report, apply it, then output an updated Phase Report with a revised commit message.
7. Before each phase, state in 1–3 lines what you are about to build. Do not narrate every step.
8. Never leave the repo in a non-building state at the end of a phase.

---

## 3. Project Overview

**Product:** A minimal "AI Knowledge Inbox" web app. A single user can:

1. Save short text notes or URLs
2. Ask questions over their saved content
3. Get answers produced by a simple RAG (retrieval-augmented generation) pipeline, with cited sources

**Constraints from the brief:**
- Production-style but minimal. Clarity over beauty.
- Expected effort: 6–12 hours. No auth. Single-user.
- **Avoid:** full auth systems, Kubernetes theater, overengineered infrastructure.
- Evaluation covers: frontend + backend + async handling + AI integration + system design, API design, error handling, tradeoff awareness, debuggability, code quality.

---

## 4. Tech Stack (defaults — do not ask, just use)

**Backend**
- Node.js 20+, Express, TypeScript (strict)
- SQLite via `better-sqlite3`
- `zod` (validation), `pino` + `pino-http` (structured logging), `dotenv`
- `cheerio` + `@mozilla/readability` + `jsdom` (HTML → readable text)
- `openai` SDK: `text-embedding-3-small` for embeddings; a small chat model (configurable via env) for answers
- Tests: `vitest`

**Frontend**
- React 18 + Vite + TypeScript
- Hooks only for state (`useState`, `useEffect`, `useReducer`, custom hooks). No Redux.
- Plain CSS or Tailwind (optional). Clarity over beauty.

**Vector storage:** embeddings stored as `BLOB` (Float32) in SQLite; cosine similarity computed in memory over all chunks. Rationale goes in the README.

**Environment variables** (`server/.env.example`)
```
PORT=4000
OPENAI_API_KEY=
EMBEDDING_MODEL=text-embedding-3-small
CHAT_MODEL=gpt-4o-mini
DATABASE_PATH=./data/inbox.db
LOG_LEVEL=info
URL_FETCH_TIMEOUT_MS=10000
URL_MAX_BYTES=2000000
RETRIEVAL_TOP_K=5
MIN_SIMILARITY_SCORE=0.2
CORS_ORIGIN=http://localhost:5173
```

---

## 5. Repository Structure

```
ai-knowledge-inbox/
├── README.md
├── .gitignore
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── src/
│       ├── index.ts                  # starts the HTTP server only
│       ├── app.ts                    # builds the Express app from the container
│       ├── container.ts              # composition root (all wiring lives here)
│       ├── config.ts                 # env parsing/validation (zod)
│       ├── routes/
│       │   ├── ingest.route.ts
│       │   ├── items.route.ts
│       │   └── query.route.ts
│       ├── middleware/
│       │   ├── requestLogger.ts
│       │   ├── validate.ts           # zod validation middleware
│       │   └── errorHandler.ts       # maps AppError → HTTP response
│       ├── domain/
│       │   ├── types.ts              # Item, Chunk, Source, QueryResult, etc.
│       │   └── interfaces.ts         # Chunker, EmbeddingProvider, LLMProvider, VectorStore, repositories
│       ├── services/
│       │   ├── ingestion/
│       │   │   ├── IngestService.ts
│       │   │   ├── IngestorFactory.ts
│       │   │   ├── NoteIngestor.ts
│       │   │   └── UrlIngestor.ts
│       │   ├── processing/
│       │   │   ├── ProcessingPipeline.ts
│       │   │   └── ItemProcessor.ts  # event listener, runs pipeline in background
│       │   ├── chunking/
│       │   │   └── ParagraphChunker.ts
│       │   ├── embedding/
│       │   │   └── OpenAIEmbeddingProvider.ts
│       │   ├── retrieval/
│       │   │   ├── Retriever.ts
│       │   │   └── cosineSimilarity.ts
│       │   ├── answering/
│       │   │   ├── AnswerService.ts
│       │   │   ├── promptBuilder.ts
│       │   │   └── OpenAILLMProvider.ts
│       │   └── url/
│       │       ├── UrlFetcher.ts
│       │       ├── ContentExtractor.ts
│       │       └── ssrfGuard.ts
│       ├── db/
│       │   ├── database.ts           # connection + migrations
│       │   ├── schema.sql
│       │   ├── SqliteItemRepository.ts
│       │   └── SqliteChunkRepository.ts
│       ├── lib/
│       │   ├── logger.ts
│       │   ├── errors.ts             # AppError hierarchy
│       │   └── events.ts             # typed event emitter
│       └── __tests__/
└── web/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/client.ts             # single fetch wrapper + typed endpoints
        ├── types.ts
        ├── hooks/
        │   ├── useItems.ts           # fetch + poll while any item is pending
        │   └── useAsk.ts
        └── components/
            ├── AddItemForm.tsx
            ├── ItemList.tsx
            ├── AskBox.tsx
            └── AnswerPanel.tsx       # answer + source snippet cards
```

You may adjust file names slightly, but keep the separation of concerns.

---

## 6. Data Model (SQLite)

```sql
CREATE TABLE IF NOT EXISTS items (
  id            TEXT PRIMARY KEY,            -- uuid
  source_type   TEXT NOT NULL CHECK (source_type IN ('note','url')),
  url           TEXT,                        -- null for notes
  title         TEXT,
  raw_content   TEXT,                        -- note text, or extracted page text
  status        TEXT NOT NULL CHECK (status IN ('pending','ready','failed')),
  error         TEXT,                        -- human-readable failure reason
  created_at    TEXT NOT NULL                -- ISO 8601
);

CREATE TABLE IF NOT EXISTS chunks (
  id            TEXT PRIMARY KEY,            -- uuid
  item_id       TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  chunk_index   INTEGER NOT NULL,
  text          TEXT NOT NULL,
  embedding     BLOB NOT NULL,               -- Float32Array bytes
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chunks_item_id ON chunks(item_id);
```

---

## 7. API Contracts

All responses are JSON. All errors use this shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable message", "details": [] } }
```

Every response includes an `x-request-id` header (generated if absent) that also appears in logs.

### `POST /ingest`
Request:
```json
{ "type": "note" | "url", "content": "string" }
```
- `note`: `content` is plain text, 1–20,000 chars, trimmed, non-empty.
- `url`: `content` must be a valid `http`/`https` URL, max 2,048 chars.

Responses:
- `201 Created` (note): `{ "item": Item }` with `status: "ready"` once chunked and embedded. (Embedding may be done inline for notes since they are small.)
- `202 Accepted` (url): `{ "item": Item }` with `status: "pending"`. Fetch/extract/chunk/embed runs in the background.
- `400` validation error · `422` URL cannot be fetched/parsed (only when detected synchronously, e.g. blocked by SSRF guard) · `502` upstream embedding failure (note path)

### `GET /items`
Response `200`: 
```json
{ "items": [ { "id", "sourceType", "url", "title", "preview", "status", "error", "createdAt", "chunkCount" } ] }
```
- Newest first. `preview` = first ~200 chars of content. Do not return full raw content in the list.

### `POST /query`
Request:
```json
{ "question": "string" }
```
- Trimmed, 3–1,000 chars.

Response `200`:
```json
{
  "answer": "string with inline citations like [1], [2]",
  "sources": [
    { "index": 1, "itemId": "uuid", "chunkId": "uuid", "title": "string", "url": "string|null", "snippet": "string", "score": 0.83 }
  ]
}
```
- If no chunk meets `MIN_SIMILARITY_SCORE`, return `200` with an answer stating the saved content does not contain enough information, and `sources: []`. **Do not call the LLM in that case and do not fabricate.**
- `400` validation · `502` upstream embedding/LLM failure · `409`-style behaviour not needed.

### Status code summary
`200` OK · `201` created · `202` accepted (async work started) · `400` invalid input · `404` unknown route/resource · `422` valid request but content unprocessable · `500` unexpected · `502` upstream AI provider failure.

---

## 8. Core Behaviour Details

### 8.1 Chunking (Strategy: `ParagraphChunker`)
- Split on paragraph boundaries first, then sentences for oversized paragraphs.
- Target ~500 tokens (approximate with ~2,000 characters), with ~10–15% overlap between adjacent chunks to preserve context across boundaries.
- Deterministic and pure. Behind a `Chunker` interface so another strategy can be added without edits elsewhere.
- Document the rationale in the README (why not fixed-size, why not semantic chunking yet).

### 8.2 Embeddings
- Batch chunk texts per item in a single embeddings request where possible.
- Normalise vectors on write so cosine similarity reduces to a dot product (document this).
- Retry transient failures (429/5xx) with limited exponential backoff inside the provider adapter. Surface a typed `UpstreamServiceError` on final failure.

### 8.3 Retrieval
- Embed the question, load chunk embeddings, compute similarity, return top-K above `MIN_SIMILARITY_SCORE`.
- Only chunks from items with `status = 'ready'`.
- Behind a `VectorStore` interface (`search(queryVector, topK)`) so it can later be swapped for pgvector/Qdrant. The default implementation is the in-memory scan over SQLite-loaded vectors.

### 8.4 Answer generation
- System prompt: answer **only** from the provided context; cite sources as `[n]` matching numbered context blocks; if the context is insufficient, say so.
- Number context blocks in the same order as the `sources` array so citations map exactly.
- Low temperature (e.g. 0.2). Log token usage if available.

### 8.5 URL ingestion (async)
- `UrlIngestor` creates the item as `pending`, emits `item.created`, returns immediately.
- `ItemProcessor` handles the event and runs the pipeline: `fetch → extract → chunk → embed → store → mark ready`.
- On any failure: mark item `failed` with a clear, user-safe `error` message, and log the detailed error.
- **SSRF guard:** only `http`/`https`; resolve the hostname and reject private, loopback, link-local, and metadata ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`, etc.); limit redirects and re-check after redirect.
- **Fetch limits:** timeout (`URL_FETCH_TIMEOUT_MS`), max response size (`URL_MAX_BYTES`), `text/html` or `text/plain` content types only.
- **Extraction:** use Readability to get title + main text; fall back to stripped `body` text if Readability returns nothing; fail with a clear message if the result is empty.

### 8.6 Logging & debuggability
- `pino` structured JSON logs, one request-scoped child logger carrying `requestId`.
- Log: request start/end with duration and status, ingest item id and source type, pipeline step durations, chunk counts, embedding batch size, retrieval top-K and scores, LLM latency and token usage.
- **Never log** API keys or full raw content.
- Error middleware logs unexpected errors with stack traces and returns a generic message for 500s.

### 8.7 Frontend behaviour
- `AddItemForm`: toggle between Note and URL, client-side validation, disabled button + spinner while submitting, inline error display.
- `ItemList`: shows type, title/preview, timestamp, status badge (`pending` / `ready` / `failed` with error text). `useItems` polls every ~2s **only while** any item is `pending`, and stops afterwards.
- `AskBox` + `AnswerPanel`: loading state, error state, answer text, and source cards showing the snippet, item title/URL, and score. Citation markers `[n]` in the answer correspond to the source cards.
- Empty states for no items and no answer. Disable asking when there are no `ready` items.
- State via custom hooks; API access only through `api/client.ts`.

---

## 9. Phases

Each phase ends with a **Phase Report** (Section 2) and a **hard stop**.

### Phase 1 — Project scaffold & tooling
**Build:** monorepo folders, `server` and `web` package setup, strict `tsconfig`s, `.gitignore` (node_modules, dist, `.env`, `data/`), `.env.example`, npm scripts (`dev`, `build`, `test`, `lint` if added), a health route `GET /health`.
**Acceptance:** `npm run dev` starts server and web; `GET /health` returns `200`; TypeScript compiles with no errors.
**Suggested commit:** `chore: scaffold server and web projects with strict TypeScript`

### Phase 2 — Foundation: config, logging, errors, database
**Build:** `config.ts` (zod-validated env), `logger.ts`, request logger middleware with request id, `AppError` hierarchy, `errorHandler`, `validate` middleware, SQLite connection + schema migration on startup, domain types and interfaces, container skeleton.
**Acceptance:** invalid env fails fast with a clear message; an unknown route returns a `404` in the standard error shape; logs are JSON with `requestId`; DB file and tables are created on first run.
**Suggested commit:** `feat(core): add config, structured logging, error handling and sqlite schema`

### Phase 3 — Repositories & note ingestion (no embeddings yet)
**Build:** `ItemRepository` and `ChunkRepository` (interfaces + SQLite implementations), `IngestService`, `IngestorFactory`, `NoteIngestor` (stores the item as `pending` for now), `POST /ingest` for notes with validation, `GET /items`.
**Acceptance:** posting a note returns `201` with the item; `GET /items` lists it newest-first with a preview; invalid input returns `400` with details.
**Suggested commit:** `feat(ingest): add note ingestion and items listing endpoints`

### Phase 4 — Chunking & embeddings
**Build:** `Chunker` interface + `ParagraphChunker`, `EmbeddingProvider` interface + `OpenAIEmbeddingProvider` (batching, retry/backoff, normalisation), `ProcessingPipeline` (chunk → embed → store), wire it into `NoteIngestor` so notes end as `ready` with `chunkCount`. Unit tests for the chunker.
**Acceptance:** a note produces chunks with embeddings in SQLite; the item becomes `ready`; provider failure returns `502` and marks the item `failed`; chunker tests pass.
**Suggested commit:** `feat(processing): add paragraph chunker and OpenAI embeddings pipeline`

### Phase 5 — URL ingestion (async, safe)
**Build:** `ssrfGuard`, `UrlFetcher` (timeout, size limit, content-type check, redirect re-check), `ContentExtractor` (Readability + fallback), `UrlIngestor`, typed event emitter, `ItemProcessor` background listener, `202 Accepted` flow, failure states with clear messages. Unit tests for the SSRF guard and the extractor.
**Acceptance:** a valid URL returns `202` with `pending`, then becomes `ready` with title and chunks; a private IP URL is rejected; an unreachable or oversized page ends as `failed` with a clear `error`; tests pass.
**Suggested commit:** `feat(ingest): add async URL ingestion with SSRF protection and readability extraction`

### Phase 6 — Retrieval
**Build:** `VectorStore` interface + in-memory-over-SQLite implementation, `cosineSimilarity` (dot product on normalised vectors), `Retriever` (top-K, min score, ready items only). Unit tests with fake vectors.
**Acceptance:** given known vectors, the retriever returns the expected ordering and respects `topK` and the score threshold; tests pass.
**Suggested commit:** `feat(retrieval): add vector store and cosine similarity retriever`

### Phase 7 — RAG query endpoint
**Build:** `LLMProvider` interface + `OpenAILLMProvider`, `promptBuilder`, `AnswerService`, `POST /query`, the no-context short-circuit, source mapping with citations, logging of latency/tokens. Unit test for `promptBuilder` and for `AnswerService` using fake providers.
**Acceptance:** a question over saved notes returns an answer with `[n]` citations and matching `sources`; an unrelated question returns the "not enough information" answer with `sources: []` without calling the LLM; provider failure returns `502`.
**Suggested commit:** `feat(query): add RAG query endpoint with cited sources`

### Phase 8 — Frontend: add and list items
**Build:** API client, types, `useItems` (with conditional polling), `AddItemForm`, `ItemList`, status badges, error and empty states, basic layout.
**Acceptance:** add a note and a URL from the UI; items appear; pending items update to ready or failed without a manual refresh; polling stops when nothing is pending.
**Suggested commit:** `feat(web): add item creation form and live item list`

### Phase 9 — Frontend: ask and answer
**Build:** `useAsk`, `AskBox`, `AnswerPanel` with source cards and citation mapping, loading and error states, disabled state when there are no ready items.
**Acceptance:** ask a question in the UI and see the answer with source snippets; errors are shown clearly; the UI never crashes on a failed request.
**Suggested commit:** `feat(web): add question interface with cited answer and source snippets`

### Phase 10 — Hardening & polish
**Build:** review all status codes and error messages, request size limits (`express.json({ limit })`), CORS config, graceful shutdown (close DB, finish in-flight requests), a rate limit on `/query` and `/ingest` (simple in-memory, optional), final refactor pass for file size and duplication, remove dead code.
**Acceptance:** malformed JSON returns `400`; oversized body returns `413`; server shuts down cleanly on SIGTERM; no file noticeably over ~200 lines; all tests pass.
**Suggested commit:** `refactor(core): harden error handling, limits and graceful shutdown`

### Phase 11 — README & documentation
**Build:** `README.md` per Section 10, an optional seed script or sample notes for demo, optional architecture diagram in Mermaid.
**Acceptance:** a fresh clone can follow the README and run the app end to end.
**Suggested commit:** `docs: add README with setup, architecture and tradeoffs`

---

## 10. README Requirements (this is graded — do not rush)

The README must contain:

1. **Overview** — what the app does, in a short paragraph.
2. **Quick start** — prerequisites, install, env setup, run server and web, run tests. Commands must work from a clean clone.
3. **Architecture** — a short description of layers and flow (ingest → process → retrieve → answer). Include a Mermaid diagram if useful.
4. **API reference** — the three endpoints with example requests/responses and error shape.
5. **Design decisions & patterns** — which SOLID principles and patterns were used and where (brief, with file references). Note which patterns were deliberately *not* used to avoid overengineering.
6. **Tradeoffs**
   - **Chunking:** why paragraph-first with overlap; limits (no semantic/heading awareness); what to try next.
   - **Vector store:** why SQLite + in-memory cosine; why not a vector DB yet.
   - **Async processing:** why in-process event-driven background work for URLs.
   - **Embedding/LLM choices:** model choices and cost/latency notes.
7. **What breaks at scale** — linear scan over all vectors, memory growth, background work sharing the API process (no retries/durability), no dedup of repeated content, re-embedding cost on model change, SQLite single-writer limits, no rate limiting by user.
8. **What I would change for production** — pgvector/Qdrant/ANN index, durable job queue (e.g., BullMQ) with retries and dead-letter, auth and per-user data isolation, rate limiting and quotas, embedding model versioning and re-index jobs, content dedup/hash, hybrid search (BM25 + vectors) with reranking, observability (metrics, tracing), streaming answers, CI/CD, secrets management.
9. **Debugging guide** — how to read the logs, request ids, common failure causes.
10. **Known limitations** — be honest.
11. **How AI assisted** — a short, honest note on how an AI coding assistant was used and what was reviewed manually.

---

## 11. Definition of Done (verify before final report)

- [ ] Add a note → appears in list as `ready`
- [ ] Add a URL → appears as `pending`, then `ready` (or `failed` with a clear error)
- [ ] Ask a question → answer with `[n]` citations and visible source snippets
- [ ] Unrelated question → graceful "not enough information", no hallucination, no LLM call
- [ ] Private/loopback URLs rejected (SSRF guard)
- [ ] Correct HTTP status codes for validation, upstream, and unprocessable-content failures
- [ ] Structured logs with request id, durations, chunk counts; no secrets logged
- [ ] No `any`, no god files, no duplicated fetch/parse/error-mapping logic
- [ ] SOLID applied with a single composition root; providers swappable via interfaces
- [ ] Unit tests for chunker, retriever, SSRF guard, prompt builder, answer service (using fakes)
- [ ] `.env.example` present; app runs from a clean clone following the README
- [ ] README covers every item in Section 10
- [ ] Every phase delivered with a Phase Report and commit message; the agent **never ran any git commands**

---

## 12. Start

Begin with **Phase 1**. Before writing code, reply with:
1. A 3–5 line confirmation of the plan and any assumption you are making.
2. Then build Phase 1 and finish with its **Phase Report**. Stop and wait.