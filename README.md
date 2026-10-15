# Silo Breaker — The Brain Connector

An always-on, hyper-private **Personal AI** that builds a lifelong knowledge
graph from everything you read — and interrupts you at the exact moment a
problem you are solving today rhymes with an article you read four weeks ago.

Built for the **NVIDIA / Nebius Personal AI Hackathon** on the required stack:
**Nebius Token Factory · NVIDIA Nemotron · Neon Database · Better Auth**.

---

## Why

Modern knowledge work is chaotic internet exploration spanning months: papers,
Wikipedia deep-dives, sci-fi novels, half-finished code notes. The context you
need usually exists — three silos away, six weeks back, never linked to what
you are doing now. Manual note-taking never survives that scale.

Silo Breaker removes the cognitive bottleneck of long-term retrieval by
**connecting the dots automatically** across different domains, and keeping the
entire graph strictly private to you.

## Core features (PRD → implementation)

| PRD requirement | Where it lives |
| --- | --- |
| **Always-on background engine** — passive observer pairing with the desktop workspace | `scripts/watch-workspace.ts` (`npm run engine`) → `POST /api/agent/ingest` |
| **Deep persistent vector memory** — lifelong, hyper-private knowledge graph | `src/server/memory/*` (Neon + pgvector, or local JSON fallback), 1536-dim embeddings |
| **Modular reusable skills** — "Silo-Breaker Synthesis" | `src/server/synthesis.ts`, reusable per-insight invocation |
| **Proactive synthesis alerts** — autonomous insight generator | `src/server/synthesis.ts` → `insights` table → Synthesis Intercom |
| **Secure onboarding (Flow 1)** | `/login` animated data-node screen, Better Auth, first-run onboarding overlay |
| **The "Silo Breaker" moment (Flow 2)** | Ambient orb → Intercom auto-expands → dual-pane current vs. historical context |

## UI/UX (Framer-inspired)

- **Palette:** Deep Void `#0A0A0A`, Elevated Charcoal `#141414`, Nebius Cyan
  `#00F0FF`, Nemotron Green `#76B900`, Crisp White `#F3F4F6`, Fog Gray `#9CA3AF`.
- **Type:** Instrument Serif (display) + Inter (body/UI) — high-contrast
  hierarchy for insight reveals.
- **Ambient header:** blurred glassmorphism strip with the Better Auth profile
  menu and a pulsing status orb (green = passive observer, cyan = synthesizing).
- **Knowledge Canvas:** bento-grid of recent research vectors with hover
  elevation, reading-rhythm chart and per-document connection hints.
- **Synthesis Intercom:** collapsed glowing button, bottom-right; expands
  upward autonomously when an alert lands, then opens the dual-pane view.

## Architecture

```
        ┌──────────────────────────  your machine  ─────────────────────────┐
        │  workspace files ──► background engine (passive observer)        │
        │        (watcher, hashing, no manual notes)                       │
        └───────────────────────────────┬──────────────────────────────────┘
                                        │ POST /api/agent/ingest (Bearer)
                                        ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │  Next.js 16 app                                                          │
 │  ├─ Better Auth  ──────────────► Neon Database (users / sessions)        │
 │  ├─ Ingestion    ── chunk ─► embed ─► vector memory (pgvector / local)   │
 │  ├─ Silo-Breaker Synthesis skill ─► Nebius Token Factory ─► Nemotron     │
 │  └─ UI           ── Ambient Header · Knowledge Canvas · Synthesis Intercom│
 └──────────────────────────────────────────────────────────────────────────┘
```

**Data flow:** capture/watch → sliding-window chunking → embedding
(`Qwen/Qwen3-Embedding-8B` at 1536 dims) → vector store → cosine cross-reference against
everything read before → Nemotron articulates the insight → Proactive Synthesis
Alert in the Intercom.

### Storage modes

- **`DATABASE_URL` set (Neon):** Drizzle + pgvector, HNSW cosine index,
  migrations via `npm run migrate`.
- **No `DATABASE_URL` (local):** file-backed vector store in
  `data/local-memory.json` + Better Auth's in-memory adapter. Same code paths,
  zero external services — perfect for demos and CI.

## Quick start

```bash
npm install
cp .env.example .env.local      # then edit values
npm run dev                     # http://localhost:3000
```

Optional (recommended for the full hackathon stack):

```bash
# 1. Neon: set DATABASE_URL in .env.local, then
npm run migrate

# 2. Nebius: set NEBIUS_API_KEY → Nemotron insights + real embeddings

# 3. Always-on background engine (new terminal):
#    SILO_ENGINE_TOKEN + SILO_OWNER_EMAIL must be in .env.local
npm run engine                  # watches ./samples/workspace by default
```

### Environment

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` | Better Auth homepage URL + ≥32 char secret |
| `DATABASE_URL` | Neon connection string (enables pgvector mode) |
| `NEBIUS_API_KEY` | Nebius Token Factory runtime calls (chat + embeddings) |
| `NEBIUS_CHAT_MODEL` | Defaults to `nvidia/Nemotron-3_5-Lightning` |
| `SILO_ENGINE_TOKEN`, `SILO_OWNER_EMAIL` | Background-engine auth + graph owner |
| `SILO_WATCH_DIR`, `SILO_POLL_SECONDS` | Workspace folder + scan interval |

## API surface

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST/GET` | `/api/auth/[...all]` | Better Auth | sign-up, sign-in, session |
| `GET/POST` | `/api/documents` | session | list / capture documents (URL import supported) |
| `GET` | `/api/documents/[id]` | session | full document (owner-scoped) |
| `GET/POST` | `/api/synthesis` | session | list alerts / run the Silo-Breaker skill |
| `PATCH` | `/api/insights/[id]` | session | accept or dismiss an alert |
| `POST` | `/api/agent/ingest` | `SILO_ENGINE_TOKEN` | background engine ingestion |

Every session-scoped route is scoped by the authenticated user id — two
accounts can never see each other's graphs.

## Tests

```bash
npm test          # vitest: chunking, embeddings, vector store, intercom flow
npm run typecheck # tsc --noEmit
npm run lint      # eslint
npm run build     # production build
```

## Project structure

```
src/
├─ app/
│  ├─ page.tsx                 # Knowledge Canvas (session-gated dashboard)
│  ├─ login/page.tsx           # Flow 1 — animated login / onboarding
│  └─ api/                     # auth, documents, synthesis, insights, agent
├─ components/                 # AmbientHeader, KnowledgeCanvas,
│                              # SynthesisIntercom, CaptureDialog, overlays
├─ lib/                        # auth client, shared view types
└─ server/
   ├─ auth.ts                  # Better Auth (Neon / memory adapters)
   ├─ db/                      # Drizzle schema + SQL migrations
   ├─ embeddings.ts            # Nebius embeddings + offline fallback
   ├─ ingest.ts                # chunking pipeline
   ├─ memory/                  # MemoryStore: Neon pgvector / local JSON
   └─ synthesis.ts             # Silo-Breaker Synthesis skill
scripts/
├─ watch-workspace.ts          # always-on background engine
└─ migrate.ts                  # applies SQL migrations to Neon
samples/workspace/             # demo reading material for the watcher
```

## Privacy & security

- Hyper-private by architecture: your graph lives in **your** Neon database (or
  entirely on disk locally) and is never used to train models.
- Sessions via Better Auth (httpOnly cookies, 30-day expiry, cookie cache).
- Route handlers are owner-scoped by `user.id` — never by client-supplied ids.
- Background engine authenticates with a server-side shared secret; the token
  never reaches the browser.
- `.env.local` and `data/` are git-ignored; no secrets in the repository.

## License

MIT — see [LICENSE](./LICENSE). CodeRabbit reviews run on every commit to keep
the Nebius × NVIDIA stack stable.

---

*Personal AI track · lifelong knowledge graph · proactive synthesis*
