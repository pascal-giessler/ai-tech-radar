# AI Radar

**The living technology radar for AI dev tools.** AI Radar ingests trending GitHub
repos and AI dev tools automatically and places them on two axes — the same mental
model as the Thoughtworks Technology Radar, but computed live and never stale:

- **Semantic cluster** (the *what*): tools are embedded by what they do and grouped
  into emergent territories — `headroom` and `rtk` near token minimization, `litellm`
  in AI-proxy territory. Nothing is hand-curated.
- **Adoption ring** (the *recommendation*): every tool gets an **Adopt / Trial /
  Assess / Hold** ring, computed from its maturity (stars) and momentum. Adopt is the
  proven core; Assess is the emerging edge.

Two views of the same data: a 3D **Galaxy** (semantic space) and a classic 2D
**Radar** dial (angle = cluster, radius = ring). A curated seed list keeps staples
like `litellm` on the radar even when they aren't spiking this week.

## Quickstart

```bash
cp .env.example .env   # optionally add a GITHUB_TOKEN for faster discovery
docker compose up --build
```

Then open **http://localhost:3000**. The first scan runs immediately on boot
(the API downloads a small embedding model on first start — give it a minute);
after that the radar re-scans every 30 minutes and pushes updates to open
browsers over SSE.

That's the whole deployment. Postgres (with pgvector), API, and web UI all run
from the single compose file.

## What you get

- **`/`** — the 3D radar: tool nodes sized and pulsing by star momentum, coloured
  by emergent cluster, with a rotating radar sweep, search (`/`), fly-to and
  detail panel. A fully crawlable text index renders below the canvas.
- **`/tools`, `/tools/{slug}`, `/clusters/{slug}`** — server-rendered catalog pages
  with `SoftwareApplication`/`ItemList` JSON-LD, Open Graph tags and breadcrumbs.
- **`/llms.txt`** — the whole landscape as a compact markdown manifest for AI
  agents; **`/sitemap.xml`** and **`/robots.txt`** generated from live data.
- **`GET /api/landscape`** — the raw map as JSON, **`GET /api/events`** — SSE stream.

## Architecture

```
apps/api   Python 3.12 · FastAPI · DDD/hexagonal  (one image, three entrypoints)
           domain/        pure model: Tool, Cluster, TrendScorer (zero deps)
           application/   use cases: ingest → embed → project → cluster → label
           infrastructure/ GitHub source · pgvector repos · fastembed · UMAP · HDBSCAN
                          · pg NOTIFY/LISTEN event bus
           interface/     HTTP + SSE
           main:app       → API  (read-only HTTP + SSE, scales horizontally)
           worker         → the single writer (scheduled ingest → recompute → NOTIFY)
           migrate        → one-shot schema migration
apps/web   Next.js 16 · React · Tailwind
db         Postgres 16 + pgvector
```

**Runtime split (scale-safe).** The scheduler is *not* in the API — it lives in a
dedicated **worker** (run at replicas=1) so scaling the API never duplicates ingestion.
Landscape events cross process/pod boundaries over **Postgres LISTEN/NOTIFY**: the
worker publishes, every API replica listens and fans out to its own SSE clients — no
extra message broker. Schema is applied once by the **migrate** command (a k8s Job / a
compose one-shot), so replicas never race DDL.

Pipeline on every scan (worker): seed + GitHub sources (composite, fault-isolated) →
upsert tools + momentum score + adoption ring → embed changed descriptions
(`BAAI/bge-small-en-v1.5`, 384d) → UMAP to 3D → HDBSCAN clusters → c-TF-IDF labels →
`NOTIFY` → SSE.

**Resilience.** Keeps serving the last-good landscape through upstream failures: GitHub
retries with backoff, the composite source isolates any one source's outage, the worker
retries the DB and never overlaps a slow scan, and the NOTIFY listener auto-reconnects.
Health is split for orchestrators: **`GET /health`** is liveness (always `200` while
serving — never fails on DB/scan state), **`GET /health/ready`** is readiness (`SELECT 1`
→ `200`/`503`, plus scan freshness). Ingestion only upserts, so a failed scan can never
blank the map.

## Kubernetes

Manifests live in `deploy/k8s` (Kustomize base + `overlays/prod`):

```bash
# build & push images, set them + your host in overlays/prod/kustomization.yaml
cp deploy/k8s/base/secret.example.yaml deploy/k8s/base/secret.yaml   # fill in, keep out of git
kubectl apply -f deploy/k8s/base/secret.yaml
kubectl apply -k deploy/k8s/overlays/prod
```

You get: a pgvector `StatefulSet` (or point `DATABASE_URL` at managed Postgres and scale
it to 0), a `migrate` Job, an **api** Deployment (HPA 2–6, PodDisruptionBudget, split
liveness/readiness/startup probes), a single-replica **worker** (Recreate, model-cache
PVC, heartbeat liveness), a **web** Deployment, and an Ingress with SSE-friendly
buffering off. All pods run non-root with resource limits. Render locally with
`kubectl kustomize deploy/k8s/overlays/prod`.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | _(empty)_ | Optional; raises GitHub rate limit 60 → 5000 req/h |
| `INGEST_INTERVAL_MINUTES` | `30` | Scan cadence |
| `SITE_URL` | `http://localhost:3000` | Canonical URL for sitemap/llms.txt |
| `POSTGRES_PASSWORD` | `airadar` | Bundled database password |

## Development

```bash
# API (Python 3.12)
cd apps/api && python3.12 -m venv .venv && .venv/bin/pip install -e ".[dev]"
.venv/bin/pytest -m "not slow and not integration"   # fast suite
TEST_DATABASE_URL=... .venv/bin/pytest -m integration # needs pgvector postgres

# Web
cd apps/web && npm install
npx vitest run && npx tsc --noEmit
```

Design docs live in `docs/superpowers/specs/`, the implementation plan in
`docs/superpowers/plans/`.
