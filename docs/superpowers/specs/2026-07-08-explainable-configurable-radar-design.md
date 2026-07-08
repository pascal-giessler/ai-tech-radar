# AI Radar — Explainable, Configurable, Viral (Design)

**Date:** 2026-07-08
**Status:** Approved (autonomous /goal session)
**Extends:** `2026-07-07-airadar-design.md`, `2026-07-07-radar-rings-addendum.md`

## Goal

Make AI Radar's clusters **explainable**, its records **filterable**, its clusters
**hideable**, add a **hero overview visualization**, make cluster creation
**transparent and configurable**, and polish the whole surface toward "go viral /
forked by others" quality. Success = every suggestion below is implemented and the
radar reads as a great, honest overview of current trends in an area (AI by default,
swappable).

## Current-state facts (verified)

- Clustering is **unsupervised**: GitHub ingest → `bge-small` embeddings (384d) →
  UMAP→5d → **HDBSCAN** (`min_cluster_size=4`) → **c-TF-IDF** top-2-term label.
  Orchestrated by `application/recompute_landscape.py` in the **worker** process.
- `min_tools_for_clustering=12` is the only env-exposed knob; `min_cluster_size`,
  UMAP params are hardcoded. Ingest scope = hardcoded `TOPICS` in
  `infrastructure/github/source.py` + a curated `seed_tools.json`.
- Backend **already computes `AdoptionRing`** (Adopt/Trial/Assess/Hold) per tool and
  serves it in `/api/landscape` — but the **frontend ignores it**; the radar's rings
  encode a client-side momentum tier (`cineTier`) instead.
- **Cluster IDs are NOT stable** across recomputes (`SqlClusterRepository.replace_all`
  deletes + re-inserts). `slug` is the only stable cluster key. Frontend hue derives
  from `id` (`clusterHue`) → colors can reshuffle; we switch color keying to `slug`.
- `Cluster` has no `description`/`keywords` (domain, ORM, TS all lack them).
- `RecordsView` has text search + 4-column sort only — no filters.
- `ClustersView`'s "candidate cluster" builder is **client-only, ephemeral, does
  nothing**, and misleads (implies keyword-based clustering). It will be replaced.
- Web ↔ API: `GET /api/landscape` polled + re-fetched on SSE `landscape_updated`
  (Postgres NOTIFY → API fan-out). Worker is the only writer.

## Design

### A. Explain clusters + transparency

1. **Cluster Profile (computed, no LLM).** Extend the labeler to also return, per
   cluster: `keywords` (top ~6 c-TF-IDF terms) and a templated `description`
   ("N tools grouped by semantic similarity; strongest signals: *a, b, c*; mostly
   **<dominant ring>**."). Persist on `Cluster`.
   - Domain: `Cluster.keywords: list[str]`, `Cluster.description: str`.
   - ORM: add `keywords` (JSON/ARRAY) + `description` (Text) to `clusters_table`;
     migration in `migrate.py`.
   - Serialization: `cluster_summary` includes both. TS `Cluster` gains
     `keywords: string[]`, `description: string`.
   - Representative tools + ring mix are derived client-side from members (no schema
     change needed for those).
   - **Seam kept:** an `LlmClusterLabeler` adapter remains a documented future swap;
     not built now.

2. **"How it's determined" explainer.** A real panel (pipeline diagram
   ingest → embed → UMAP → HDBSCAN → c-TF-IDF → ring) with the live params
   (`min_cluster_size`, `min_tools`, current area) shown read-only. Reachable from
   the Clusters view and Overview. Replaces the misleading builder.

3. **Surface the real adoption ring.** Add `ring` to `ScopeNode` in `buildModel`.
   Used by Records (column + filter), Overview quadrant, and cluster ring-mix.

### A′. Activity & issues signals (repo health)

Enrich each tool with two live GitHub signals so the radar reflects real project
health, not just stars:
- `open_issues: int` — free: present on the GitHub search/repo response
  (`open_issues_count`).
- `commit_activity: list[int]` — weekly commit counts for the last ~12 weeks,
  **best-effort** via `GET /repos/{o}/{n}/stats/commit_activity` (guarded: may return
  202/empty or hit rate limits → store `[]` and degrade gracefully; never blocks
  ingest). Derived `commits_recent` = sum of the window.

Domain: `Tool.open_issues`, `Tool.commit_activity` (+ `commits_recent` property).
ORM/migration: `open_issues` (Integer), `commit_activity` (JSON). Serialization + TS
`Tool` gain both.

Uses:
- **Real sparkline:** when `commit_activity` is present, the tool trajectory sparkline
  uses *real* weekly commits instead of the synthetic `buildHist` projection —
  a direct honesty win. Synthetic remains the fallback, clearly labeled "modeled".
- **Records:** add "Issues" and "Activity" (12-week commit sparkbar) columns; issues
  and activity become filterable/sortable.
- **Overview / Dossier:** a small "maintenance health" cue (active vs stale) from
  `commits_recent`; optional bubble encoding.
- **TrendScore:** left unchanged for stability; folding commit velocity into momentum
  is documented as a future option, not done now (avoids destabilizing rings).

### B. Records filtering

Filter bar above the table, composable with existing search + sort:
- Cluster (multi-select), Adoption ring (multi), Momentum tier (multi), Language
  (multi), Min-score slider.
- Add a **Ring** column. Active-filter chips with one-click clear. Result count and
  "clear all". All client-side over `model.nodes`.

### C. Hide / unhide clusters (view layer)

- A `useClusterVisibility` hook backed by `localStorage`, keyed by **cluster slug**.
- Applied everywhere: radar (hidden nodes removed), records (rows removed + counts),
  overview, sidebar list, search results.
- Controls: per-cluster eye toggle (sidebar + Clusters view), "solo" (only this),
  "show all", "hide all". Hidden state survives recompute because it keys on slug.

### D. New "Overview" view (hero)

New nav item `overview` (becomes the default landing view).
- **Trend Quadrant:** SVG/canvas scatter. x = maturity (log10 stars), y = momentum
  (trend_score 0–100). Bubbles **colored by true adoption ring**, sized by 30-day
  gain, cluster hue as stroke. Reference lines at ring thresholds (stars 1.5k/15k,
  score 18/45) with quadrant region labels (Assess / Adopt / Hold / Trial). Hover →
  mini card; click → dossier. Honors visibility + filters.
- **Cluster momentum strip:** each visible cluster as a row: hue chip, label, member
  count, aggregate momentum sparkbar, dominant ring. Click → isolate/scroll.
- **Top Movers rail:** highest 30-day-gain tools.
- Screenshot-friendly composition (this is the shareable artifact).

### E. Configurable

**View config (localStorage):** visible clusters (C), records filters (B), radar
prefs (mode, zoom), default view.

**Live backend tuning:**
- New single-row `radar_settings` table: `area_preset: str`, `min_cluster_size: int`,
  `min_tools: int` (nullable → fall back to env defaults). Migration in `migrate.py`.
- `GET /api/settings` (current effective settings + available presets),
  `PATCH /api/settings` (writes row, emits `radar_config_changed` NOTIFY).
- Worker: on `radar_config_changed`, re-read settings and run an immediate
  ingest+recompute; the recompute reads `min_cluster_size`/`min_tools`/area from the
  row (fallback env). `RecomputeLandscape` and `HdbscanClusterer` take the value at
  call time.
- **Settings panel** (frontend): granularity slider (`min_cluster_size`, e.g. 2–12,
  "many small ↔ few big"), area preset picker, read-only view of derived params, and
  a "recompute now" action. Optimistic + SSE-driven refresh.

**Area presets (virality lever):**
- `infrastructure/sources/presets.py` + bundled JSON: each preset = `{slug, title,
  topics[], seed_file}`. AI is the default; ship 1–2 more (e.g. `rust`, `platform`)
  as proof + fork template. `github/source.py` reads topics from the active preset
  instead of the hardcoded constant. Title flows to the web header/SEO.
- Documented in README: "point AI Radar at any domain by adding a preset."

### F. Radar zoom

`RadarCanvas`: wheel + trackpad-pinch zoom about the cursor, `+ / − / reset`
controls, clamped scale, composed with existing orbit/tilt/timeline. Zoom persisted
to view config.

### G. Visual quality

Apply **design-taste-frontend** + **impeccable** to every new/changed surface within
the existing IBM-Plex / cyan "deep-space observatory" system: consistent spacing
scale, motion discipline (hardware-accelerated transforms, no layout thrash),
accessible contrast, focus states, empty/loading/error states, responsive behavior.

## Data flow (new/changed)

```
Settings panel → PATCH /api/settings → radar_settings row + NOTIFY radar_config_changed
Worker (LISTEN) → re-read settings → ingest(active area topics/seed) → recompute
  (min_cluster_size, min_tools from row) → embed → UMAP → HDBSCAN → c-TF-IDF(+keywords,
  description) → persist tools+clusters → NOTIFY landscape_updated
Web ← SSE landscape_updated → refetch /api/landscape (+ /api/settings on settings events)
Client-only: visibility + filters + radar prefs in localStorage, applied in buildModel
  consumers.
```

## Error handling

- `PATCH /api/settings` validates ranges (`min_cluster_size ≥ 2`, `min_tools ≥ 2`,
  known preset slug); rejects unknown presets 422.
- Worker recompute on config change is wrapped like the scheduled job (never crashes;
  logs; serves last-good landscape on failure). `max_instances=1, coalesce=True`
  still applies.
- Missing `radar_settings` row → env defaults (backward compatible; migration seeds a
  default row).
- localStorage parse failure → reset to defaults, never throw.
- Overview/records with everything hidden → explicit empty state ("all clusters
  hidden — show all").

## Testing

- **Backend (pytest, TDD):** labeler returns keywords + description for multi/single
  cluster; `RecomputeLandscape` honors injected `min_cluster_size`/`min_tools`;
  settings repository read/write + default fallback; `PATCH /api/settings` validation;
  preset resolves topics/seed; NOTIFY emitted on change (fake broadcaster).
- **Web (vitest):** filter composition (cluster×ring×tier×lang×score×search);
  visibility hook (localStorage, solo/hide-all, keyed by slug); quadrant scales
  (log-x, threshold lines, ring color mapping); buildModel maps `ring`.
- **Manual/Playwright smoke:** compose up → Overview renders quadrant; hide a cluster
  → gone everywhere; change granularity → clusters recompute and update via SSE.

## Out of scope (YAGNI)

LLM cluster labels (seam kept), per-user accounts/persisted personal radars,
historical ring movement, non-GitHub live sources, auth on settings (single-tenant
self-host assumption; documented).

## Build order

1. Backend: cluster keywords/description + activity/issues fields + migration +
   serialization + GitHub source enrichment (open_issues, best-effort commit stats).
2. Backend: `radar_settings` table, `GET/PATCH /api/settings`, worker
   `radar_config_changed` recompute, `min_cluster_size`/`min_tools` threaded through.
3. Backend: area presets (JSON + `presets.py` + `github/source.py` wiring).
4. Web shared: TS types (`keywords`, `description`, settings, presets), `ScopeNode.ring`,
   color keyed by slug, API client methods, `useClusterVisibility`, view-config store.
5. Web: Records filter bar + Ring column.
6. Web: Overview view (quadrant + cluster strip + top movers) + make default.
7. Web: cluster hide/unhide controls wired everywhere.
8. Web: Radar zoom.
9. Web: Settings panel + "How it's determined" explainer (replaces fake builder).
10. Design polish pass (design-taste-frontend + impeccable) + docs/README preset guide.
```
