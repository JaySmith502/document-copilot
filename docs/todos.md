# Document Copilot — Build Checklist

Working checklist to implement the architecture in [architecture.md](architecture.md) and satisfy the [client brief](client-brief.md).

**Strategy:** backend-first (the product value — trust, grounding, citations — all lives there), with one thin end-to-end *tracer bullet* early to de-risk the Supabase-JWT → FastAPI → AI-SDK-streaming integration seam before deepening each layer. Order follows the Implementation Sequence in the architecture doc.

Each phase has a **✅ Done when** check — do not move on until it passes.

---

## Phase 0 — Prerequisites & accounts

- [x] Install toolchain: Python 3.12+, `uv`, Node 20+, `pnpm` (see [README](../README.md#prerequisites))
- [x] Create Supabase account + hosted project ([guide](guides/supabase-setup.md))
- [x] Create OpenAI API key
- [x] Fill `backend/.env` from `backend/.env.example` (Supabase URL/anon/service-role, `DATABASE_URL` direct/session string, `OPENAI_API_KEY`, `ALLOWED_ORIGINS`, embedding model + dims)
- [x] Fill `frontend/.env` from `frontend/.env.example` (`VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [x] Download sample corpus: `uv run data/download.py` (5 companies × 10-Ks, 2021–2025)

> ✅ **Done when:** both `.env` files validate, Supabase project is reachable, and `data/downloads/` has filings + `manifest.json`.

---

## Phase 1 — Scaffold backend service *(arch step 1)*

- [x] Backend: FastAPI app skeleton, `app/config.py` settings module (pydantic-settings, fail-fast on missing config), `app/main.py`, `/health` route, structlog setup
- [x] Backend: confirm `uv run uvicorn` boots and `/health` returns 200

> ✅ **Done when:** backend `/health` responds, reading config only through its settings module.

---

## Phase 2 — Data layer: models + migrations *(arch steps 2–3)*

- [x] Add SQLAlchemy models in `app/database/models.py`: `users`, `chat_threads`, `chat_messages`, `message_citations`, `source_documents`, `document_chunks`
- [x] Set up Alembic (connect via Supabase **direct/session** connection string, NOT the pooler)
- [x] First migration with explicit `op.execute()` for: `create extension vector`, `vector(1536)` embedding column, generated `tsvector` column, HNSW index (vector), GIN indexes (full-text + JSON metadata), RLS enablement + policies
- [x] `uv run alembic upgrade head` against Supabase; verify tables/extensions/indexes exist in dashboard
- [x] Commit models + migration together

> ✅ **Done when:** `alembic upgrade head` applies cleanly and all tables, the `vector` extension, and indexes exist in Supabase.

---

## Phase 3 — Tracer bullet: auth + streaming end-to-end *(arch steps 4–7)*

Goal: a logged-in analyst types a message and sees a streamed (stubbed) reply — proving the whole integration seam before any retrieval work. Starts by scaffolding the frontend, since this is where it first gets used.

- [x] Frontend: scaffold Vite + React + TS SPA, Tailwind + shadcn/ui, React Router, `src/lib/env.ts` (validates the 3 VITE_ vars) *(arch step 1)*
- [x] Frontend: confirm `pnpm dev` serves a blank app
- [x] Backend auth: `app/auth/dependencies.py` — verify `Authorization: Bearer <token>` via Supabase Auth, expose `get_current_user`; reject unauthenticated requests with 401
- [x] Backend: `app/database/supabase.py` — user-scoped + admin (service-role) client construction
- [ ] Backend: `POST /chat/stream` emitting **AI SDK-compatible** message parts with a hardcoded/echoed answer (no LLM yet)
- [ ] Frontend: `src/lib/supabase.ts` (browser client), `src/lib/http.ts` (fetch wrapper + bearer injection + typed errors), `src/lib/api.ts` (threads/messages calls)
- [ ] Frontend: Supabase email login page + session handling
- [ ] Frontend: minimal chat page using AI SDK `useChat` + `DefaultChatTransport` pointed at `/chat/stream`
- [ ] Wire CORS (`ALLOWED_ORIGINS`) so the SPA can reach FastAPI

> ✅ **Done when:** an analyst logs in with email, sends a message, and sees a streamed stub reply round-trip through FastAPI with a verified JWT.

---

## Phase 4 — Ingestion pipeline *(arch step 8)*

- [ ] Parse downloaded filings → normalized Markdown; store in `source_documents` with filing metadata (ticker, company, type, date, year, accession, source URL)
- [ ] Chunk Markdown into retrieval passages with metadata (chunk index, page/section, token count, offsets)
- [ ] Embed chunks via OpenAI; write embeddings + populate generated `tsvector`
- [ ] Idempotent re-runnable ingestion script (skip/upsert already-ingested filings)

> ✅ **Done when:** all sample filings are queryable in `source_documents` / `document_chunks` with non-null embeddings and search vectors; row counts match the manifest.

---

## Phase 5 — Hybrid retrieval *(arch steps 9–10)*

- [ ] `app/retrieval/queries.py`: semantic `pgvector` query + Postgres full-text query (bounded)
- [ ] `app/retrieval/fusion.py`: Reciprocal Rank Fusion in Python
- [ ] `app/retrieval/retriever.py`: query → fused source passages + neighboring-chunk fetch for grounding
- [ ] Backend unit tests: retrieval returns relevant chunks for a sample brief question (no LLM)

> ✅ **Done when:** retriever returns sensible, ranked, cited-capable passages for several example questions from the brief — verified by tests, not the UI.

---

## Phase 6 — PydanticAI agent + grounding *(arch steps 11–12)*

- [ ] `app/assistant/outputs.py`: `GroundedAnswer`, `Citation`, `SourcePassage`
- [ ] `app/assistant/deps.py` + `agent.py`: typed agent with bounded tools (`search_filings`, `read_chunk`, `read_surrounding_chunks`) — no agent-generated SQL
- [ ] `app/assistant/instructions.md`: product contract (answer only from passages, cite every claim, refuse when corpus insufficient, no investment advice)
- [ ] `app/grounding/validator.py`: every citation maps to a retrieved passage; ≥1 citation unless answer says "not enough evidence"; controlled failure on validation miss
- [ ] `app/chat/orchestrator.py` + `messages.py` + `streaming.py`: full turn lifecycle, AI SDK message conversion, real streaming
- [ ] Replace the Phase 3 stub: `/chat/stream` now runs the agent and streams real grounded answers
- [ ] Persist on success: user msg, assistant msg, cited chunks, usage — all tied to `user_id`
- [ ] Backend tests for citation extraction + grounding enforcement

> ✅ **Done when:** the example brief questions return grounded, cited answers via the API, and the bot correctly refuses when the corpus lacks evidence (the trust contract holds in tests).

---

## Phase 7 — Real chat UI & history *(arch step 13)*

- [ ] Thread list + create/load past conversations (analysts see their own history)
- [ ] Render citations, expandable source passages (company/filing/date/page + excerpt), empty states, streaming status
- [ ] Friendly error states mapped to backend error classes (401/403/404/422/502/500); distinguish network/CORS from HTTP failures

> ✅ **Done when:** an analyst can hold a real conversation, click any citation to see the underlying passage, and revisit past threads.

---

## Phase 8 — Deploy to Railway

- [ ] Frontend service: static Vite build
- [ ] Backend service: FastAPI + Uvicorn (stateless)
- [ ] Production env vars set per service; `ALLOWED_ORIGINS` points at deployed frontend
- [ ] Smoke test: login + a cited answer in production

> ✅ **Done when:** the deployed app serves a logged-in analyst a cited answer end-to-end.

---

## Definition of done (client brief)

- [ ] 5-senior-analyst pilot for a week
- [ ] Reported time saved ≥ 3 hours/analyst/week
- [ ] Trust contract holds: never invents facts, always cites, shows the passage

## Out of scope (do not build)

Trading recommendations · external data sources · multi-tenant · billing/paywalls · mobile app · direct OpenAI calls from the browser · Next.js/SSR.
