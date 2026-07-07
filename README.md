# AI Radar

**A live atlas of the tool sky.** AI Radar ingests trending GitHub repos and AI dev
tools automatically, embeds what they *do*, and draws them as an explorable 3D
landscape where semantic neighbours sit together — `headroom` and `rtk` cluster under
token-usage minimization, `litellm` lands in AI-proxy territory. Categories emerge
from the data; nothing is hand-curated, and nothing goes stale.

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
apps/api   Python 3.12 · FastAPI · DDD/hexagonal
           domain/        pure model: Tool, Cluster, TrendScorer (zero deps)
           application/   use cases: ingest → embed → project → cluster → label
           infrastructure/ GitHub source · pgvector repos · fastembed · UMAP · HDBSCAN
           interface/     HTTP + SSE
apps/web   Next.js 16 · React Three Fiber · Tailwind
db         Postgres 16 + pgvector
```

Pipeline on every scan: GitHub Search API → upsert tools + momentum score →
embed changed descriptions (`BAAI/bge-small-en-v1.5`, 384d) → UMAP to 3D →
HDBSCAN clusters → c-TF-IDF labels → broadcast to browsers.

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
