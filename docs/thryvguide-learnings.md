# ThryvGuide Code Review — Learnings for ads-manager

## What We're Borrowing

### 1. TimingTracker Pattern
`services/api/src/utils/timing.util.ts`
Wraps any async call and records duration. Use for profiling Google Ads API calls, embedding lookups, and Claude response times.
→ Port to: `src/utils/timing.ts`

### 2. Prompt Loader with Handlebars
`services/api/src/utils/prompt-loader.util.ts`
Reads JSON prompt files, validates required fields (name, version, model, temperature, prompt), compiles with Handlebars (`{{token}}`), resolves model aliases from env vars.
→ Port to: `src/utils/prompt-loader.ts` — same interface, no NestJS/DI dependency

### 3. PGvector Embed → Search → Inject Pattern
`services/api/src/agents/services/reference.agent.ts`
`services/api/src/services/pgvector.service.ts`
Blueprint for expert knowledge lookup:
1. Embed the query text (OpenAI `text-embedding-3-small`, 1536 dims)
2. Call `searchSimilar()` filtered by `knowledge_type`
3. Inject top N chunks into prompt as `{{knowledge_context}}`
→ Port to: `src/db/pgvector.ts`

### 4. PDF Ingestion Pipeline
`services/api/src/services/pgvector.service.ts` → `processReferenceBook()`
Full pipeline for book ingestion:
- Read PDF → `RecursiveCharacterTextSplitter` (chunkSize: 1200, overlap: 250)
- Generate embeddings per chunk
- Insert to DB with metadata (author, filename, chunkIndex)
- Idempotency check: compare existing chunk count vs expected, skip if match
- Resume capability: track which files already imported (for large multi-file books)
→ Port to: `src/db/book-ingest.ts` (when ready, minus Supabase → raw pg)

### 5. Control Agent / Mode Routing Pattern
`services/api/src/agents/services/control.agent.ts`
Coordinator that:
- Runs pre-flight agents in parallel (some fire-and-forget async)
- Routes to mode-specific handler based on result
- Compiles final context object from all agent results
For ads-manager: optimizer loop runs data fetch + embedding search in parallel, then routes to analyze → propose → execute.
The `redFlagPromise` fire-and-forget pattern is useful for non-blocking background work.

### 6. Session Summarization → Rolling Context
`services/api/src/services/session-management.service.ts` → `summarizeSession()` + `updateHealthProfileSummary()`
After each run:
1. Summarize what happened (what was tried, what worked, what didn't)
2. Maintain a rolling "persona profile summary" — updated after each optimization run
3. Feed this summary as context to the next run
This is how the system learns over time without blowing up the context window.
→ Port to: `src/optimizer/run-summary.ts`

### 7. Context Builder Structure
`services/api/src/services/context-builder.service.ts`
Assemble context as clearly labeled sections:
```
=== Relevant Past Runs ===
...

=== Current Performance Data ===
...

=== Current Query ===
...
```
Use this pattern when building the Discord message that @'s Claude.

---

## What We're NOT Borrowing

- **NestJS** — plain TypeScript only
- **LangChain** — direct Anthropic SDK
- **Supabase** — raw pg
- **Streaming** — not needed for batch optimization loop
- **Complex session management** — our "session" = one optimization run

---

## Concrete Files to Create (from this review)

| File | Based On | Purpose |
|---|---|---|
| `src/utils/timing.ts` | `timing.util.ts` | TimingTracker for profiling |
| `src/utils/prompt-loader.ts` | `prompt-loader.util.ts` | Load + compile JSON prompt templates |
| `src/db/pgvector.ts` | `pgvector.service.ts` | Embed query, search by knowledge_type, insert embeddings |
| `src/db/book-ingest.ts` | `pgvector.service.ts` | PDF → chunk → embed → insert pipeline |
| `src/optimizer/run-summary.ts` | `session-management.service.ts` | Summarize each run, maintain rolling persona context |

---

## Key Config Values from ThryvGuide

- Embedding model: `text-embedding-3-small` (OpenAI), 1536 dimensions
- Chunk size: 1200 chars, overlap: 250 chars
- Top N chunks for context injection: 5
- Similarity threshold: 0.3 (general), 0.4 (higher-precision queries)
- Rolling summary max length: ~2000 characters (~400 tokens)
