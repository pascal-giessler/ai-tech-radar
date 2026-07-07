# AI Radar — Design Document

**Date:** 2026-07-07
**Status:** Approved for implementation (autonomous /goal session; decisions documented for later course-correction)

## 1. Vision & Market Sweet Spot

AI Radar is a **living landscape** of trending GitHub repos and AI/dev tools, placed
*semantically*: tools that solve the same problem sit next to each other on an explorable
3D map (e.g. `headroom` and `rtk` cluster under "token usage minimization", `litellm`
under "AI proxy/gateway").

**Competitive gap (validated by market scan, 2026-07-07):**

| Player | Trending signal | Semantic placement | Explorable UI | Self-hostable |
|---|---|---|---|---|
| GitHub Trending | ✅ live | ❌ flat list | ❌ | ❌ |
| OSSInsight | ✅ rankings | ❌ manual category tabs | ❌ tables | ❌ |
| Landscape maps (StackOne, ainativedev.io, CNCF-style) | ❌ stale | ⚠️ manual taxonomy | ⚠️ static image | ❌ |
| AI tool directories (tooldirectory.ai etc.) | ❌ | ❌ manual taxonomy | ❌ | ❌ |
| **AI Radar** | ✅ automatic ingestion | ✅ embeddings → emergent clusters | ✅ 3D map + SSR pages | ✅ Docker Compose |

**Sweet spot:** the only self-updating, semantically clustered, spatially explorable
radar for dev/AI tooling. Primary user: a developer choosing a tool ("show me everything
near X, ranked by momentum"). Categories *emerge from data* instead of lagging taxonomies.

## 2. Scope (MVP)

**In:**
- Automatic ingestion of trending GitHub repos (GitHub Search API; optional `GITHUB_TOKEN`),
  scheduled (default every 30 min) — "near-realtime".
- Semantic pipeline: embed (name + description + topics) → project to 3D (UMAP) →
  cluster (HDBSCAN) → auto-label clusters (c-TF-IDF keywords).
- 3D landscape UI (React Three Fiber): tool nodes sized/colored by trend momentum,
  cluster labels, hover cards, click → detail panel, search, fly-to.
- SSR/SEO surface: `/tools`, `/tools/[slug]`, `/clusters/[slug]` server-rendered pages,
  `sitemap.xml`, `robots.txt`, JSON-LD (`SoftwareApplication`), Open Graph, `llms.txt`
  for agentic search.
- Live updates via SSE: new/updated tools appear without reload.
- Deployment: `docker compose up` — nothing else. Three services + Postgres.

**Out (YAGNI for MVP):** user accounts, manual curation UI, Product Hunt/HN sources
(port-ready via `ToolSource` interface), LLM-generated cluster labels (adapter seam left),
historical time-travel view, comparisons/benchmarks.

## 3. Architecture

Monorepo, two apps + compose:

```
airadar/
├── apps/
│   ├── api/          # Python 3.12 · FastAPI · DDD/hexagonal · pytest (TDD)
│   └── web/          # Next.js 15 · React Three Fiber · Tailwind · vitest
├── docker-compose.yml
└── docs/
```

**Chosen approach (B):** Python backend for the ML core (fastembed ONNX embeddings —
small image, no torch; umap-learn; hdbscan) + Next.js for SEO-grade SSR frontend +
Postgres with pgvector.
Rejected: (A) all-TypeScript single app — JS clustering ecosystem too weak for the
product's core value; (C) microservices + queue — premature.

### 3.1 Backend — DDD / Hexagonal

Bounded context: **Cartography** (one context for MVP; Ingestion and Catalog are
modules within it, splittable later).

```
apps/api/src/airadar/
├── domain/           # pure, zero dependencies
│   ├── model/        # Tool (aggregate root), Cluster, value objects:
│   │                 #   RepoRef, TrendScore, Embedding, Position3D, Slug
│   ├── services/     # TrendScorer (momentum from star deltas)
│   └── ports/        # ToolRepository, ClusterRepository, ToolSource,
│                     # EmbeddingModel, Projector, Clusterer, ClusterLabeler,
│                     # UpdateBroadcaster
├── application/      # use cases, orchestration only
│   ├── ingest_trending.py      # IngestTrendingTools
│   ├── recompute_landscape.py  # RecomputeLandscape (project+cluster+label)
│   ├── get_landscape.py        # GetLandscape (map payload)
│   └── get_tool.py / list_*.py
├── infrastructure/   # adapters
│   ├── persistence/  # SQLAlchemy + pgvector implementations
│   ├── github/       # GitHub Search API ToolSource
│   ├── ml/           # FastembedModel, UmapProjector, HdbscanClusterer,
│   │                 # CTfidfLabeler
│   └── scheduling/   # APScheduler jobs (ingest → recompute)
└── interface/        # FastAPI routers, SSE endpoint, DTOs
```

**Ubiquitous language:** *Tool* (a repo/product on the radar), *Signal* (raw metrics
snapshot), *TrendScore* (computed momentum), *Landscape* (the projected map),
*Cluster* (emergent semantic territory).

**Key domain rules:**
- `TrendScore` = f(star velocity, recency, absolute stars) — pure domain service,
  fully unit-tested.
- A `Tool` is identified by `RepoRef` (owner/name); re-ingestion updates metrics,
  never duplicates.
- Landscape recompute is idempotent; positions are stable-ish across runs (UMAP
  seeded) so the map doesn't reshuffle wildly.

### 3.2 Data flow

```
[APScheduler] → IngestTrendingTools → GitHub Search API → upsert Tools + Signals
             → RecomputeLandscape → embed new/changed → UMAP 3D → HDBSCAN
             → c-TF-IDF labels → persist positions/clusters → SSE broadcast
[Next.js]    → GET /api/landscape (map JSON) · GET /api/tools/{slug} · SSE /api/events
```

### 3.3 Frontend

- `/` — 3D landscape (client component; R3F points + instanced meshes, bloom,
  cluster label sprites, orbit/fly controls, search-and-fly-to). Progressive:
  SSR shell with crawlable cluster/tool list under the canvas (`sr-only`-style +
  real links) so `/` is not an SEO black hole.
- `/tools`, `/tools/[slug]`, `/clusters/[slug]` — fully SSR, JSON-LD, OG tags.
- `/llms.txt` — agentic-search manifest: what the site is, machine-readable index
  of clusters/tools with one-line descriptions.
- SSE hook subscribes to `/api/events`; new tools animate in + toast.
- Design direction: dark "deep space observatory" aesthetic — the radar metaphor,
  restrained neon on near-black, one display face + one mono face, no generic
  purple-gradient SaaS look.

### 3.4 Deployment (Docker Compose only)

```yaml
services:
  db:    pgvector/pgvector:pg16      # volume, healthcheck
  api:   apps/api Dockerfile         # uvicorn + scheduler; model cache volume
  web:   apps/web Dockerfile         # next build standalone
```
Single `.env` (optional `GITHUB_TOKEN`, ingest interval). First boot: api runs
migrations, seeds by running one ingest+recompute immediately.

## 4. Error handling

- GitHub rate-limit/network failures: ingest job logs, backs off, retries next tick —
  never crashes the API; radar serves last known landscape.
- Recompute needs ≥ N tools (min cluster viability); below threshold everything is one
  "Uncharted" cluster.
- SSE clients: fan-out with per-client queues; slow clients dropped, UI auto-reconnects.
- Web: landscape fetch failure → SSR list still renders (content never blank).

## 5. Testing (TDD)

- **Domain/application:** pytest, in-memory fakes for all ports — fast, no I/O.
  TrendScorer, upsert semantics, recompute orchestration, SSE broadcast contract.
- **Infrastructure:** GitHub adapter against recorded fixtures; ML adapters with tiny
  deterministic inputs (seeded); repository tests against real Postgres
  (docker) marked `integration`.
- **Web:** vitest for scoring/format utils and data hooks; Playwright smoke
  (compose up → landscape renders, tool page SSRs) as manual/CI-optional.
- Red → green → refactor per feature; no implementation before a failing test.

## 6. SEO & Agentic Search

- SSR everything textual; canonical URLs; per-tool `SoftwareApplication` +
  `BreadcrumbList` JSON-LD; descriptive titles ("rtk — Token Usage Minimization · AI Radar").
- `sitemap.xml` generated from DB; `robots.txt` allows all incl. GPTBot/ClaudeBot etc.
- `llms.txt` (+ `llms-full.txt`) so agents can ingest the landscape without scraping.
- Cluster pages target the money query: "tools for &lt;emergent category&gt;".
