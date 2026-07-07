# AI Radar — Adoption Rings & Resilience (Design Addendum)

**Date:** 2026-07-07
**Extends:** `2026-07-07-airadar-design.md`

## Why

The MVP places tools on one axis: emergent semantic clusters. A *technology radar*
in the sense people know it (Thoughtworks) has **two** axes — a category **and** an
adoption ring (Adopt / Trial / Assess / Hold). The ring is the recommendation: it
tells you what to *do* with a tool, not just where it sits.

**Sweet spot sharpened:** the Thoughtworks Technology Radar is hand-curated and
published twice a year — authoritative but always months stale, and it never covers
the long tail. AI Radar computes the ring **automatically and continuously** from live
signals. Positioning shifts from "a semantic map of tools" to **"the living technology
radar"** — the same mental model developers already trust, kept current by data.

## The new dimension: AdoptionRing

Four rings, matching the Thoughtworks vocabulary, defined for *this* product (live
discovery of dev/AI tooling) as a function of **maturity** (absolute stars) ×
**momentum** (the existing `TrendScore`):

| Ring | Meaning here | Rule (maturity × momentum) |
|---|---|---|
| **Adopt** | Proven and still thriving — safe default | mature (≥15k★) **and** warm (score ≥18) |
| **Trial** | Real traction, worth piloting | established (≥1.5k★) **and** hot (score ≥45), or established + warm |
| **Assess** | Emerging, unproven, worth watching | hot (score ≥45) but not yet established |
| **Hold** | Cooling or stalled — don't chase | cold (score <18) regardless of size |

Encoded as a pure domain service `AdoptionClassifier.classify(stars, stars_gained,
trend_score, age_days) -> AdoptionRing`, ordered decision tree, fully unit-tested.
The thresholds are deliberately opinionated and documented; they are the product's
point of view.

**Visual meaning.** The ring gives the radar its literal geometry: in the classic 2D
**Radar view**, angle encodes the semantic cluster (sector) and **radius encodes the
ring** (Adopt innermost → Hold outermost) — exactly the Thoughtworks layout, but live.
The 3D **Galaxy view** keeps the UMAP semantic galaxy and adds ring as colour + filter.
Users toggle between the two.

## Seed source: "the tools we're currently using"

GitHub trending misses tools that matter but aren't spiking this week. A curated
`SeedToolSource` (bundled JSON: rtk, headroom, litellm, and other stack staples)
composes with the GitHub source through a resilient `CompositeToolSource` so the radar
always contains a meaningful, recognisable core — and one source failing never blanks
the other.

## Resilience

The radar must keep serving its last-good landscape through any upstream failure.

- **GitHub source:** per-request retry with exponential backoff on transient errors
  (timeouts, 5xx, secondary-rate-limit); one failed query never aborts the scan.
- **Composite source:** each sub-source is isolated; a raising source yields nothing
  and is logged, the others still contribute.
- **Startup:** `init_db` retries on a backoff loop (DB may refuse connections briefly
  even behind a healthcheck).
- **Scheduler:** `max_instances=1`, `coalesce=True` — a slow scan never stacks.
- **Observability = resilience:** `/health` reports `status`, `last_successful_scan`,
  `tools_tracked`, and a `degraded` flag (never scanned, or last scan too old). Ingest
  only upserts, so a failed scan can never delete the existing landscape.

## Surfaces

Ring is a first-class field everywhere: API payloads, tool/cluster pages (with ring in
`SoftwareApplication` JSON-LD as an `additionalProperty`), `llms.txt` (grouped so agents
can answer "what should I adopt for X?"), ToolCard/Panel, plus the ring legend, ring
filter, and the new 2D Radar view.

## Out of scope (still YAGNI)

Manual ring overrides, per-user radars, historical ring movement ("moved in/out"),
non-GitHub live sources. The seams (`ToolSource`, `ClusterLabeler`) remain open for them.
