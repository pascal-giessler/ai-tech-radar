# AI Radar on Kubernetes

Kustomize manifests for a scale-safe deployment. Topology mirrors the compose stack:

```
db (StatefulSet/pgvector)  →  migrate (Job)  →  api (Deployment, HPA)  +  worker (Deployment, 1)  →  web (Deployment)
                                                        ▲   Postgres LISTEN/NOTIFY   │
                                                        └───────── events ───────────┘
```

## Layout

```
base/                 one copy of every resource
  namespace, configmap, secret.example.yaml (template — copy to secret.yaml)
  postgres.yaml       StatefulSet + headless Service + PVC
  migrate-job.yaml    runs `python -m airadar.migrate` once
  api.yaml            Deployment + Service + HPA(2–6) + PodDisruptionBudget
  worker.yaml         Deployment (replicas 1, Recreate) + model-cache PVC
  web.yaml            Deployment + Service
  ingress.yaml        / → web, /api + /health → api (SSE buffering off)
overlays/prod/        image tags, replica counts, host, (optional) secretGenerator
```

## Deploy

1. Build & push images, then set them in `overlays/prod/kustomization.yaml`
   (`images:` → your registry + immutable tag).
2. Set the host in the same file (the Ingress patch) and `SITE_URL` in
   `base/configmap.yaml`.
3. Provide the Secret (never commit real values):
   ```bash
   cp base/secret.example.yaml base/secret.yaml   # edit DATABASE_URL, POSTGRES_PASSWORD, GITHUB_TOKEN
   kubectl apply -f base/secret.yaml              # or sealed-secrets / external-secrets / SOPS
   ```
4. Apply:
   ```bash
   kubectl apply -k overlays/prod
   ```

Preview without a cluster: `kubectl kustomize overlays/prod`.

## Notes

- **Managed Postgres:** point `DATABASE_URL` at it and scale `postgres` StatefulSet to
  0 replicas (or drop it from the base kustomization).
- **Worker stays at replicas=1** — it's the single writer/scheduler. The `Recreate`
  strategy guarantees no two schedulers overlap.
- **Health probes:** liveness `GET /health` (always ok while serving), readiness
  `GET /health/ready` (`SELECT 1`), startup probe covers slow first DB connect. The
  worker uses a heartbeat-file liveness so a hung loop is caught without coupling to DB.
- **Migrations** run in the `migrate` Job before rollout; the worker also ensures the
  schema idempotently on boot, so a stale/immutable Job never blocks a redeploy.
