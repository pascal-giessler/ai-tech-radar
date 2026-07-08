<div align="center">

# AI Radar

**The living technology radar for AI dev tools.**

Trending GitHub repos and AI dev tools, scanned continuously and plotted on a live radar —
by **momentum** (range) and **semantic category** (bearing). The Thoughtworks Technology
Radar's mental model, kept current by data instead of a twice-a-year PDF.

<!-- Replace OWNER with your GitHub org/user once pushed -->
[![CI](https://github.com/OWNER/airadar/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/airadar/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/python-3.12-blue)
![Next.js](https://img.shields.io/badge/next.js-16-black)
![Postgres](https://img.shields.io/badge/postgres-16%20%2B%20pgvector-336791)
![Deploy](https://img.shields.io/badge/deploy-Docker%20%C2%B7%20Kubernetes-2496ed)

</div>

---

## Contents

- [What it does](#what-it-does)
- [Getting started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [Architecture](#architecture)
- [Kubernetes](#kubernetes)
- [Configuration](#configuration)
- [CI/CD](#cicd)
- [Project layout](#project-layout)

## What it does

- **Semantic clustering** — tools are embedded by *what they do* and grouped into emergent
  territories (`headroom` + `rtk` near token minimization, `litellm` in AI-proxy land).
  Nothing is hand-curated.
- **Live momentum radar** — a canvas scope with a rotating sweep that pings contacts, a
  top-mover reticle, a **Perspective** mode (star-height bars), and a **13-week timeline**
  scrubber. Records table and a cluster back-office round out the app.
- **Automatic ingestion** — a curated seed list plus GitHub trending, re-scanned every
  30 min; updates stream to open browsers over SSE.
- **SEO + agentic search** — SSR catalog pages with JSON-LD, `sitemap.xml`, and a
  `/llms.txt` manifest of the whole landscape.
- **Runs anywhere** — one `docker compose up`, or a scale-safe Kubernetes deployment.

## Getting started

**Prerequisites:** Docker + Docker Compose. That's it — Postgres, the API, the worker,
and the web UI all run from the compose file.

```bash
git clone https://github.com/OWNER/airadar.git
cd airadar

cp .env.example .env        # optional: add a GITHUB_TOKEN for faster discovery
docker compose up --build
```

Then open **http://localhost:3000**.

The stack starts in the right order automatically — `db` → `migrate` (one-shot schema) →
`api` + `worker` → `web`. The worker downloads a small embedding model on first boot
(give it ~a minute), runs the first scan, and the radar fills in. After that it re-scans
every 30 minutes and pushes updates live.

> **Port already taken?** Override host ports in `.env`: `WEB_PORT`, `API_PORT`.

Quick health check:

```bash
curl localhost:8000/health          # {"status":"alive"}
curl localhost:8000/health/ready     # {"ready":true, "tools_tracked":…, …}
curl localhost:8000/api/landscape    # the raw map as JSON
```

## Development

Run the pieces natively while iterating.

```bash
# --- API (Python 3.12) ---
cd apps/api
python3.12 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/ruff check src tests
.venv/bin/uvicorn airadar.main:app --reload        # needs a reachable DATABASE_URL

# --- Web (Node 22) ---
cd apps/web
npm install
npm run dev                                          # http://localhost:3000
```

The API image has three entrypoints (all from one image):

| Command | Role |
| --- | --- |
| `uvicorn airadar.main:app` | API — read-only HTTP + SSE (scales horizontally) |
| `python -m airadar.worker` | the single writer: scheduled ingest → recompute → publish |
| `python -m airadar.migrate` | one-shot schema migration |

## Testing

```bash
# Backend
cd apps/api
.venv/bin/pytest -m "not slow and not integration"    # fast unit/use-case suite
# integration tests need a pgvector Postgres:
docker run -d --name pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=airadar_test \
  -p 55432:5432 pgvector/pgvector:pg16
TEST_DATABASE_URL=postgresql+psycopg://postgres:test@localhost:55432/airadar_test \
  .venv/bin/pytest -m integration

# Web
cd apps/web
npx vitest run && npx tsc --noEmit
```

`-m slow` covers the tests that download the embedding model; they're excluded by default.

## Architecture

```
apps/api   Python 3.12 · FastAPI · DDD/hexagonal  (one image, three entrypoints)
           domain/         pure model: Tool, Cluster, TrendScorer, AdoptionClassifier
           application/    use cases: ingest → embed → project → cluster → label
           infrastructure/ GitHub source · pgvector repos · fastembed · UMAP · HDBSCAN
                           · Postgres LISTEN/NOTIFY event bus
           interface/      HTTP + SSE
apps/web   Next.js 16 · React · Tailwind  (radar scope, records, clusters, dossiers)
db         Postgres 16 + pgvector
deploy/k8s Kustomize base + overlays/prod
```

**Runtime split (scale-safe).** The scheduler is *not* in the API — it lives in a
dedicated **worker** (replicas = 1) so scaling the API never duplicates ingestion.
Landscape events cross pod boundaries over **Postgres LISTEN/NOTIFY**: the worker
publishes, every API replica listens and fans out to its own SSE clients — no extra
message broker. Schema is applied once by the **migrate** command, so replicas never
race DDL.

**Resilience.** Keeps serving the last-good landscape through upstream failures: GitHub
retries with backoff, the composite source isolates any one source's outage, the worker
retries the DB and never overlaps a slow scan, and the NOTIFY listener auto-reconnects.
Health is split for orchestrators — **`/health`** is liveness (always `200` while
serving), **`/health/ready`** is readiness (`SELECT 1` → `200`/`503`). Ingestion only
upserts, so a failed scan can never blank the map.

## Kubernetes

Manifests live in `deploy/k8s` (Kustomize base + `overlays/prod`):

```bash
# 1. build & push images, then set them + your host in overlays/prod/kustomization.yaml
# 2. provide the Secret (never commit real values):
cp deploy/k8s/base/secret.example.yaml deploy/k8s/base/secret.yaml   # edit
kubectl apply -f deploy/k8s/base/secret.yaml
# 3. deploy:
kubectl apply -k deploy/k8s/overlays/prod
```

You get a pgvector `StatefulSet` (or point `DATABASE_URL` at managed Postgres and scale it
to 0), a `migrate` Job, an **api** Deployment (HPA 2–6, PodDisruptionBudget, split
liveness/readiness/startup probes), a single-replica **worker** (Recreate, model-cache PVC,
heartbeat liveness), a **web** Deployment, and an Ingress with SSE buffering off. All pods
run non-root with resource limits. Render locally with
`kubectl kustomize deploy/k8s/overlays/prod`. Full guide: [`deploy/k8s/README.md`](deploy/k8s/README.md).

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | compose-internal | SQLAlchemy URL (`postgresql+psycopg://…`) |
| `GITHUB_TOKEN` | _(empty)_ | Optional; raises GitHub rate limit 60 → 5000 req/h |
| `INGEST_INTERVAL_MINUTES` | `30` | Scan cadence (worker) |
| `SITE_URL` | `http://localhost:3000` | Canonical URL for sitemap/llms.txt |
| `POSTGRES_PASSWORD` | `airadar` | Bundled database password |
| `WEB_PORT` / `API_PORT` | `3000` / `8000` | Host ports (compose) |

## CI/CD

GitHub Actions ([`​.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every PR
and on pushes to **`main`** and **`dev`**:

| Job | What it checks |
| --- | --- |
| **backend** | `ruff` lint, fast pytest suite, and integration tests against a pgvector service container |
| **web** | `vitest`, `tsc --noEmit`, and a production `next build` |
| **manifests** | `kubectl kustomize` renders base + prod overlays |
| **publish** | on push to `main`/`dev` only, after the above pass: builds and pushes the `api` and `web` images to GitHub Container Registry |

Image tags: `dev` branch → `:dev`; `main` branch → `:latest` + `:sha-<short>`. Published to
`ghcr.io/OWNER/airadar-api` and `ghcr.io/OWNER/airadar-web`. Point
`deploy/k8s/overlays/prod/kustomization.yaml` at these.

**Branching:** `dev` is integration, `main` is production — protect both so merges require
the CI checks above.

## Project layout

```
apps/api            FastAPI backend (domain / application / infrastructure / interface)
apps/web            Next.js frontend (app shell, radar canvas, records, clusters, dossiers)
deploy/k8s          Kustomize manifests (base + overlays/prod)
docker-compose.yml  local full stack: db · migrate · api · worker · web
docs/superpowers    design specs and implementation plans
.github/workflows   CI/CD pipeline
```
