# AI Radar — Kubernetes-Hostable, Scale-Robust Backend (Design Addendum)

**Date:** 2026-07-08
**Extends:** `2026-07-07-airadar-design.md`, `2026-07-07-radar-rings-addendum.md`

## Why

The backend already satisfies "Postgres + Docker + clean DDD + robust": hexagonal
layering (pure domain, use cases over ports, adapters in infrastructure), pgvector
persistence, retry/backoff ingestion, degraded-aware health. Two things block a
*correct* Kubernetes deployment, and both are architecture — not ops — problems:

1. **The scheduler runs inside the API process.** On k8s the API scales to N replicas;
   N schedulers would each ingest and recompute → duplicate work, thrashing writes.
2. **SSE broadcast is in-process.** `AsyncFanoutBroadcaster` fans events to SSE clients
   connected to *this* process. Split web/worker pods, and an ingest in the worker never
   reaches SSE clients on the API pods.

Both are fixed by respecting the existing ports — no domain change.

## The design

### 1. Split into two runtimes (one image, two entrypoints)

| Process | Replicas | Responsibility |
|---|---|---|
| **api** (`airadar.main:app`) | N (HPA) | Serve HTTP + SSE. Read-only over the landscape. No scheduler, no ML model. Fast startup. |
| **worker** (`python -m airadar.worker`) | 1 | Own the scheduled pipeline: ingest → embed → project → cluster → label → persist → publish. The only writer. |

Same container image; the k8s manifests / compose just run different commands. Clean
CQRS-ish separation: writes concentrated in one worker, reads scaled horizontally.

### 2. Cross-pod events via Postgres LISTEN/NOTIFY

The `UpdateBroadcaster` port gets a second adapter — no new infrastructure, reuse
Postgres:

- **worker** publishes through `PgNotifyPublisher` → `NOTIFY airadar_events, '<json>'`.
- **api** runs a `PgNotifyListener` background task → `LISTEN airadar_events`, and on each
  notification calls the in-process `AsyncFanoutBroadcaster.publish`, which fans out to
  that pod's SSE clients. Auto-reconnects with backoff.

Every API replica hears every event; SSE works across any number of pods. Domain and
application layers are untouched — they still depend only on `UpdateBroadcaster`.

### 3. Migrations as a one-shot command

`python -m airadar.migrate` runs `init_db_with_retry` (CREATE EXTENSION + create_all +
idempotent additive `ALTER`s) and exits. Run as a k8s **Job** (and a compose one-shot
service) *before* api/worker. Neither api nor worker migrate on startup, so replicas
never race schema changes — they just retry connecting until the schema is present.

### 4. Health split for k8s probes

- **`GET /health`** — *liveness*: always `200 {"status":"alive"}` while the process
  serves. Never fails on degraded/DB state (or k8s would kill healthy pods).
- **`GET /health/ready`** — *readiness*: `SELECT 1` via a `DatabaseHealth` port →
  `200` when reachable, `503` when not, plus scan freshness detail. Gates traffic and
  rollouts.

The worker exposes the same liveness via a tiny probe (process-alive file / `SELECT 1`).

### 5. Graceful shutdown & safety

- Uvicorn handles SIGTERM; the API lifespan cancels the listener task cleanly; the worker
  lifespan stops the scheduler (`wait=False`) and closes the publisher.
- Containers run as **non-root**, read-only-friendly, with resource requests/limits.
- Ingestion only upserts → a crashed/rescheduled worker never deletes the landscape.

## Kubernetes manifests (`deploy/k8s`)

Kustomize **base** + **overlays/prod**:

- `namespace`, `configmap` (intervals, thresholds, URLs), `secret` (DB creds, optional
  `GITHUB_TOKEN`) — templated, never committed with real values.
- **postgres**: `StatefulSet` (pgvector image) + headless `Service` + `PVC`; or point
  `DATABASE_URL` at a managed/operator Postgres by scaling this to zero.
- **migrate**: `Job` (`airadar.migrate`), run before rollouts.
- **api**: `Deployment` (N replicas) + `Service` + `HPA` (CPU) + `PodDisruptionBudget` +
  liveness/readiness/startup probes.
- **worker**: `Deployment` (replicas 1, `Recreate` strategy) + model-cache `PVC`.
- **web**: `Deployment` + `Service` (Next.js standalone).
- **ingress**: routes `/` → web, `/api` + `/health` → api.
- Every pod: non-root `securityContext`, resource limits, `RollingUpdate` (api/web),
  probes wired to the split health endpoints.

`kubectl kustomize deploy/k8s/overlays/prod` renders the full set; validated client-side.

## Compose parity

Compose mirrors the topology so local == prod shape: `db` → `migrate` (one-shot) →
`api` + `worker` → `web`. `api` and `worker` `depends_on` `migrate`
`service_completed_successfully`.

## Out of scope (YAGNI)

Helm chart (Kustomize is enough here), leader election for >1 worker, a dedicated
message broker (Postgres NOTIFY suffices at this scale), autoscaling the worker.
