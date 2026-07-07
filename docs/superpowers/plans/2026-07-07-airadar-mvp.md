# AI Radar MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the AI Radar MVP — automatic ingestion of trending GitHub repos, semantic 3D landscape (embed → UMAP → HDBSCAN → c-TF-IDF labels), SSR/SEO web UI with live SSE updates, deployable with `docker compose up` alone.

**Architecture:** Monorepo. `apps/api` = Python 3.12 FastAPI, hexagonal/DDD (pure domain, use cases over ports, adapters in infrastructure). `apps/web` = Next.js 15 App Router + React Three Fiber. Postgres+pgvector. Spec: `docs/superpowers/specs/2026-07-07-airadar-design.md`.

**Tech Stack:** FastAPI, SQLAlchemy 2, pgvector, httpx, APScheduler, sse-starlette, fastembed (BAAI/bge-small-en-v1.5, 384-dim), umap-learn, scikit-learn (`sklearn.cluster.HDBSCAN`), pytest; Next.js 15, TypeScript, Tailwind, @react-three/fiber + drei, vitest.

## Global Constraints

- Python 3.12; all backend code under `apps/api/src/airadar/`; tests under `apps/api/tests/`.
- Domain layer imports NOTHING outside stdlib. Application layer imports domain only. Ports are `typing.Protocol`.
- TDD: every task writes the failing test first, verifies red, implements, verifies green, commits.
- Embedding dimension is 384 everywhere (fastembed default model `BAAI/bge-small-en-v1.5`).
- UMAP seeded with `random_state=42`; HDBSCAN `min_cluster_size=4`; noise label `-1` → cluster "Uncharted".
- `MIN_TOOLS_FOR_CLUSTERING = 12`; below it all tools go to single "Uncharted" cluster at their UMAP positions.
- Env vars (single root `.env`): `DATABASE_URL`, `GITHUB_TOKEN` (optional), `INGEST_INTERVAL_MINUTES` (default 30), `API_URL` (web-side, default `http://api:8000`).
- Ports: web 3000, api 8000, db 5432 (internal only).
- Frontend copy/design: dark observatory aesthetic; display font Space Grotesk, mono IBM Plex Mono; no purple-gradient defaults.
- Commit after every green cycle with conventional-commit messages.

---

### Task 1: Backend scaffold

**Files:** Create `apps/api/pyproject.toml`, `apps/api/src/airadar/__init__.py`, `apps/api/tests/test_smoke.py`, root `.gitignore`.

- [ ] Write `pyproject.toml`: project `airadar`, deps `fastapi, uvicorn[standard], sqlalchemy>=2, psycopg[binary], pgvector, httpx, apscheduler, sse-starlette, pydantic-settings, fastembed, umap-learn, scikit-learn, numpy`; dev extras `pytest, pytest-asyncio, ruff, httpx`. `[tool.pytest.ini_options] pythonpath=["src"]`, marker `integration`.
- [ ] `python3.12 -m venv .venv && pip install -e ".[dev]"` (heavy ML deps OK).
- [ ] Failing smoke test `test_smoke.py::test_package_imports` (`import airadar`), run red → add package → green.
- [ ] Commit `chore: scaffold airadar api package`.

### Task 2: Domain model — value objects + Tool aggregate

**Files:** Create `src/airadar/domain/model/repo_ref.py`, `position.py`, `tool.py`, `cluster.py`, `slug.py`; Test `tests/domain/test_repo_ref.py`, `test_tool.py`, `test_slug.py`.

**Produces (later tasks rely on these exact names):**
- `RepoRef(owner: str, name: str)` frozen dataclass, `.full_name` = `"owner/name"`, `.slug` = `slugify(full_name)` (`"vercel-next-js"` style: lowercase, non-alnum → `-`).
- `slugify(text: str) -> str` in `slug.py`.
- `Position3D(x: float, y: float, z: float)` frozen.
- `Tool` (mutable dataclass, aggregate root): fields `ref: RepoRef, description: str, topics: list[str], language: str | None, url: str, stars: int, stars_prev: int | None, repo_created_at: datetime, first_seen_at: datetime, last_updated_at: datetime, trend_score: float = 0.0, position: Position3D | None = None, cluster_id: int | None = None, embedding: list[float] | None = None`; property `slug`; property `stars_gained` (`stars - stars_prev` if prev else `0`); method `record_signal(stars: int, at: datetime)` → shifts current stars to `stars_prev`, sets new stars + `last_updated_at`; method `content_fingerprint() -> str` (hash of name+description+topics, used to decide re-embedding).
- `Cluster(id: int, label: str, slug: str, size: int, centroid: Position3D)` frozen.

- [ ] Failing tests: slugify cases (`"LiteLLM/lite llm!"` → `"litellm-lite-llm"`), RepoRef full_name/slug, `record_signal` shifts prev and `stars_gained` computes, fingerprint changes when description changes and is stable otherwise.
- [ ] Red → implement → green → commit `feat(domain): Tool aggregate, RepoRef, Position3D, Cluster`.

### Task 3: TrendScorer domain service

**Files:** Create `src/airadar/domain/services/trend_scorer.py`; Test `tests/domain/test_trend_scorer.py`.

**Produces:** `TrendScorer.score(stars: int, stars_gained: int, age_days: float) -> float` — pure, `0 <= score <= 100`.

Formula: `velocity = 100 * (1 - exp(-max(stars_gained,0)/150))`; `recency_boost = 1 + 0.5 * max(0, (30 - age_days)) / 30`; `mass = 10 * (1 - exp(-stars/5000))`; `score = min(100, velocity * recency_boost + mass)`.

- [ ] Failing tests (behavioural, not formula-mirroring): bounded [0,100]; more gain ⇒ strictly higher; same gain younger repo ⇒ higher; zero-gain old small repo < 15; huge gain ⇒ > 60.
- [ ] Red → implement → green → commit `feat(domain): trend momentum scorer`.

### Task 4: Ports, fakes, IngestTrendingTools use case

**Files:** Create `src/airadar/domain/ports.py`, `src/airadar/application/dto.py`, `src/airadar/application/ingest_trending.py`; Test `tests/fakes.py`, `tests/application/test_ingest_trending.py`.

**Produces:**
- `ports.py` Protocols: `ToolRepository` (`get_by_ref(ref) -> Tool|None`, `get_by_slug(slug) -> Tool|None`, `upsert(tool) -> Tool`, `list_all() -> list[Tool]`, `list_ranked(limit:int) -> list[Tool]`), `ClusterRepository` (`replace_all(clusters:list[Cluster])`, `list_all()`, `get_by_slug(slug)`), `ToolSource` (`fetch_trending() -> list[DiscoveredTool]`), `EmbeddingModel` (`embed(texts:list[str]) -> list[list[float]]`), `Projector` (`project(embeddings:list[list[float]]) -> list[Position3D]`), `Clusterer` (`assign(embeddings) -> list[int]`), `ClusterLabeler` (`label(docs_by_cluster: dict[int, list[str]]) -> dict[int, str]`), `UpdateBroadcaster` (`publish(event: dict) -> None`), `Clock` (`now() -> datetime`).
- `dto.py`: `DiscoveredTool(owner, name, description, topics, language, stars, url, repo_created_at)`; `IngestReport(new: int, updated: int)`.
- `IngestTrendingTools(source, tools, scorer, clock).execute() -> IngestReport`: new ref → create Tool (first_seen=now, stars_prev=None); existing → `record_signal`; always rescore via `TrendScorer`; upsert. Source errors propagate (caller handles).
- `tests/fakes.py`: `InMemoryToolRepository`, `InMemoryClusterRepository`, `FakeToolSource(items)`, `FakeEmbedder` (deterministic vector from text hash), `GridProjector`, `ModuloClusterer`, `KeywordLabeler`, `RecordingBroadcaster`, `FixedClock`.

- [ ] Failing tests: new tool created with score > 0; second ingest of same ref updates stars (no duplicate) and stars_gained reflects delta; report counts correct.
- [ ] Red → implement → green → commit `feat(app): ingest trending tools use case + ports`.

### Task 5: RecomputeLandscape use case

**Files:** Create `src/airadar/application/recompute_landscape.py`; Test `tests/application/test_recompute_landscape.py`.

**Produces:** `RecomputeLandscape(tools, clusters, embedder, projector, clusterer, labeler, broadcaster, min_tools=12).execute() -> LandscapeReport(tool_count, cluster_count)`.

Behaviour: embed only tools whose `embedding is None` or fingerprint changed (store fingerprint alongside; embed text = `"{name}. {description}. topics: {', '.join(topics)}"`); project ALL embeddings → set positions; if count < min_tools → all in cluster 0 "Uncharted"; else clusterer assigns, `-1` → "Uncharted" cluster (id 0 reserved), labeler names real clusters from member descriptions, label → slug; centroid = mean member position; `clusters.replace_all`; broadcaster publishes `{"type":"landscape_updated","tool_count":N}`.

- [ ] Failing tests: positions assigned to every tool; below-threshold → 1 cluster "Uncharted"; above-threshold → clusters from Clusterer with labels from Labeler; noise → Uncharted; broadcaster received event; unchanged tools not re-embedded (FakeEmbedder counts calls).
- [ ] Red → implement → green → commit `feat(app): landscape recompute pipeline`.

### Task 6: Query use cases

**Files:** Create `src/airadar/application/queries.py`; Test `tests/application/test_queries.py`.

**Produces:** `GetLandscape(tools, clusters).execute() -> dict` shaped:
```json
{"tools":[{"slug","name","owner","description","language","topics","stars","stars_gained","trend_score","url","position":{"x","y","z"},"cluster_id"}],
 "clusters":[{"id","label","slug","size","centroid":{"x","y","z"}}],
 "generated_at": iso8601}
```
`GetTool(tools).execute(slug) -> dict|None` (same tool shape + `first_seen_at`, `repo_created_at`); `ListTools(tools).execute(limit=200)` ranked by trend_score; `ListClusters(clusters).execute()`.

- [ ] Failing tests for shape + ranking + missing-slug → None. Red → green → commit `feat(app): landscape/tool query use cases`.

### Task 7: FastAPI interface + SSE

**Files:** Create `src/airadar/interface/http.py` (`create_app(container) -> FastAPI`), `src/airadar/interface/container.py` (dataclass of wired use cases + broadcaster), `src/airadar/infrastructure/broadcast.py` (`AsyncFanoutBroadcaster`: per-subscriber `asyncio.Queue`, `subscribe() -> AsyncIterator[dict]`, sync-safe `publish`); Test `tests/interface/test_http.py`.

Routes: `GET /health` → `{"status":"ok"}`; `GET /api/landscape`; `GET /api/tools?limit=`; `GET /api/tools/{slug}` (404 if missing); `GET /api/clusters`; `GET /api/clusters/{slug}` → cluster + its tools; `GET /api/events` → `sse-starlette` EventSourceResponse streaming broadcaster events.

- [ ] Failing tests with `TestClient` + fake-backed container: health 200; landscape shape; tool 404; cluster detail includes member tools. SSE: publish then read one event via `client.stream`.
- [ ] Red → green → commit `feat(api): HTTP interface with SSE events`.

### Task 8: SQLAlchemy + pgvector persistence

**Files:** Create `src/airadar/infrastructure/persistence/orm.py` (tables `tools`, `clusters` incl. `Vector(384)` embedding, fingerprint column), `repositories.py` (`SqlToolRepository`, `SqlClusterRepository` implementing ports, session-per-call via sessionmaker), `database.py` (`make_engine(url)`, `init_db(engine)` = `CREATE EXTENSION IF NOT EXISTS vector` + `create_all`); Test `tests/infrastructure/test_repositories.py` marked `integration` (needs `TEST_DATABASE_URL`, skipped otherwise).

- [ ] Failing integration tests: upsert round-trips a full Tool (incl. embedding, position); upsert same ref updates; `list_ranked` orders by score; clusters `replace_all` swaps set.
- [ ] Start throwaway pg: `docker run -d --name airadar-test-db -e POSTGRES_PASSWORD=test -p 55432:5432 pgvector/pgvector:pg16`. Red → green → commit `feat(infra): pgvector persistence adapters`.

### Task 9: GitHub ToolSource adapter

**Files:** Create `src/airadar/infrastructure/github/source.py`; Test `tests/infrastructure/test_github_source.py` (httpx `MockTransport`, no network).

**Produces:** `GithubToolSource(token: str|None, client: httpx.Client|None)` implementing `ToolSource`. Queries GitHub Search API (`/search/repositories`) with query set:
`created:>{now-21d} stars:>50 sort:stars` and, per topic in `["llm","ai-agents","developer-tools","mcp","rag","llmops"]`, `topic:{t} pushed:>{now-7d} stars:>100 sort:updated`; `per_page=30`; dedup by full_name; map to `DiscoveredTool` (missing description → `""`). Auth header only when token set. 403/422 on one query → log + continue with others.

- [ ] Failing tests: parses fixture JSON into DiscoveredTools; dedups across queries; survives one 403; token → `Authorization: Bearer` header present.
- [ ] Red → green → commit `feat(infra): github trending source`.

### Task 10: ML adapters

**Files:** Create `src/airadar/infrastructure/ml/embedder.py` (`FastembedModel`), `projector.py` (`UmapProjector(random_state=42, n_components=3)`; scale output to radius ~10), `clusterer.py` (`HdbscanClusterer(min_cluster_size=4)` via `sklearn.cluster.HDBSCAN`), `labeler.py` (`CTfidfLabeler`: per-cluster doc concat → `TfidfVectorizer(stop_words="english", ngram_range=(1,2))` over cluster-docs → top-2 terms title-cased, e.g. "Token Usage"); Test `tests/infrastructure/test_ml_adapters.py`.

UMAP guard: `n_neighbors = min(15, n_samples - 1)`; if `n_samples < 4` fall back to deterministic small-grid positions.

- [ ] Failing tests (seeded, tiny inputs): embedder returns 384-dim vectors, similar sentences closer than dissimilar (cosine); projector returns n Position3D, deterministic across two runs; clusterer groups two obvious blobs (synthetic gaussians); labeler picks the distinguishing keyword ("token" cluster vs "proxy" cluster).
- [ ] Red → green → commit `feat(infra): embedding, projection, clustering, labeling adapters`.

### Task 11: Composition root, config, scheduler, entrypoint

**Files:** Create `src/airadar/config.py` (`Settings` via pydantic-settings: `database_url`, `github_token: str|None`, `ingest_interval_minutes: int = 30`, `min_tools_for_clustering: int = 12`), `src/airadar/main.py` (`build_container(settings)` wiring real adapters; FastAPI lifespan: `init_db`, start APScheduler `AsyncIOScheduler` job `ingest_and_recompute` every N min + one immediate background run; module-level `app`); Test `tests/test_composition.py` (build_container with fakes-friendly settings → app constructs; scheduler job registered).

- [ ] Failing test → implement → green. Run `uvicorn airadar.main:app` locally against test db as manual smoke. Commit `feat(api): composition root with scheduled ingestion`.

### Task 12: Web scaffold + typed API client

**Files:** Create `apps/web/` via `create-next-app` (TS, Tailwind, App Router, src dir), `src/lib/types.ts` (mirror Task 6 JSON shapes: `LandscapeData`, `Tool`, `Cluster`), `src/lib/api.ts` (`getLandscape()`, `getTool(slug)`, `getClusters()`, `getCluster(slug)` — server-side fetch to `process.env.API_URL`, `next: {revalidate: 60}`), `src/lib/format.ts` (`formatStars(1234)->"1.2k"`, `scoreTier(score)->"blazing"|"rising"|"steady"|"quiet"`), vitest config; Test `src/lib/format.test.ts`.

next.config: `rewrites: [{source:"/api/:path*", destination:`${API_URL}/api/:path*`}]`, `output:"standalone"`.

- [ ] Failing vitest for format utils → green. Commit `feat(web): scaffold with typed api client`.

### Task 13: SSR pages, SEO & agentic search surface

**Files:** Create `src/app/layout.tsx` (fonts, metadata template, dark theme), `src/app/tools/page.tsx`, `src/app/tools/[slug]/page.tsx` (generateMetadata + `SoftwareApplication` & `BreadcrumbList` JSON-LD `<script type="application/ld+json">`), `src/app/clusters/[slug]/page.tsx`, `src/app/sitemap.ts` (from API), `src/app/robots.ts` (allow all incl. GPTBot/ClaudeBot/PerplexityBot), `src/app/llms.txt/route.ts` (markdown manifest: site purpose + clusters with tools one-liners), `src/components/ToolCard.tsx`, `src/components/LandscapeIndex.tsx` (crawlable cluster→tools link tree used on `/`).

- [ ] Verify by `next build` + curl of each route against running api (manual verification steps; snapshot-test `llms.txt` route handler logic with vitest where pure).
- [ ] Commit `feat(web): SSR catalog pages with JSON-LD, sitemap, llms.txt`.

### Task 14: 3D radar scene + live SSE updates

**Files:** Create `src/app/page.tsx` (SSR fetch + `<RadarScene>` dynamic client import + `<LandscapeIndex>` below fold), `src/components/radar/RadarScene.tsx` (R3F `<Canvas>`, stars background, fog), `ToolNodes.tsx` (instanced spheres; scale & emissive by `trend_score`; cluster-hue coloring; hover → `<Html>` card; click → select), `ClusterLabels.tsx` (drei `<Billboard><Text>` at centroids), `CameraRig.tsx` (OrbitControls + fly-to-selected lerp), `ToolPanel.tsx` (side panel: stars, momentum, topics, GitHub link, cluster link), `SearchOverlay.tsx` (fuzzy filter, Enter → fly-to), `src/hooks/useLandscapeEvents.ts` (`EventSource("/api/events")` → on `landscape_updated` re-fetch `/api/landscape` via rewrite + toast "New tools detected"); Test `src/hooks/useLandscapeEvents.test.ts` (mock EventSource) and pure helpers (`clusterHue(id)`).

- [ ] Failing vitest for hook/helpers → green; visual verification via browser (screenshot).
- [ ] Commit `feat(web): 3D semantic radar with live updates`.

### Task 15: Docker Compose, Dockerfiles, README, end-to-end verify

**Files:** Create `apps/api/Dockerfile` (python:3.12-slim, install deps, `uvicorn airadar.main:app --host 0.0.0.0`), `apps/web/Dockerfile` (node:22-alpine multi-stage, standalone output), `docker-compose.yml` (db: `pgvector/pgvector:pg16` + volume + `pg_isready` healthcheck; api: depends_on healthy, env, `model-cache` volume for fastembed; web: `API_URL=http://api:8000`, port 3000), `.env.example`, `README.md` (what/why/quickstart/architecture diagram/env table).

- [ ] `docker compose up --build -d`; wait; verify: `curl :8000/health`, `curl :8000/api/landscape` non-empty after first ingest, `curl :3000` SSR contains tool links, `curl :3000/llms.txt`, `curl :3000/sitemap.xml`; browser screenshot of 3D radar.
- [ ] Commit `feat: docker compose deployment + docs`.

## Self-Review

- **Spec coverage:** ingestion (T4/9/11), semantic pipeline (T5/10), 3D UI (T14), SSR/SEO/llms.txt (T13), SSE realtime (T7/14), compose-only deploy (T15), DDD layering (T2–6 vs 8–11), TDD everywhere. Error handling: source failure isolation (T9), min-cluster threshold (T5), SSE slow-client queues (T7), SSR fallback content (T13/14). ✔
- **Type consistency:** DTO shapes fixed in T6 and mirrored in T12 `types.ts`; port names identical across T4–T11. ✔
- **Placeholders:** frontend visual composition (T13/14) intentionally specified by component contract + acceptance checks rather than full listings; executor is in-session with the spec's design direction. No TBDs. ✔
