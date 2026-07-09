# Contributing to AI Radar

Thanks for your interest in improving AI Radar! Contributions of every kind are
welcome — bug reports, feature ideas, docs fixes, new area presets, and code.

## Quick start

```bash
git clone https://github.com/pascal-giessler/ai-tech-radar.git
cd ai-tech-radar
cp .env.example .env        # optional: add a GITHUB_TOKEN for faster discovery
docker compose up --build   # full stack on http://localhost:3000
```

For iterating natively (API on Python 3.12, web on Node 22), see the
[Development](README.md#development) section of the README.

## Running the checks

Every PR must pass the same checks CI runs:

```bash
# Backend (apps/api)
.venv/bin/ruff check src tests
.venv/bin/pytest -m "not slow and not integration"

# Integration tests need a pgvector Postgres (see README "Testing")

# Web (apps/web)
npx vitest run
npx tsc --noEmit
npm run build
```

## Project layout & principles

- `apps/api` — Python/FastAPI backend in a DDD/hexagonal layout:
  `domain/` (pure model, no I/O) → `application/` (use cases) →
  `infrastructure/` (GitHub, Postgres, ML adapters) → `interface/` (HTTP/SSE).
  Keep the domain layer free of framework and I/O imports.
- `apps/web` — Next.js frontend. The interactive app is client-side
  (`components/app/`); catalog pages are SSR for SEO.
- The **worker is the only writer**; the API is read-only. Cross-process
  signals travel over Postgres LISTEN/NOTIFY — don't add another broker.
- Data honesty: never fabricate values in the UI. If a signal is unavailable
  (e.g. commit stats without a token), show an explicit empty state.

## Making changes

1. Fork and create a feature branch: `git checkout -b feat/my-change`.
2. Keep PRs focused — one logical change per PR.
3. Add or update tests for any behaviour change. Fast unit tests live next to
   the layer they test; integration tests are marked `integration`.
4. Match the surrounding code style (ruff for Python; the web has no extra
   lint config beyond `tsc` — follow the existing idioms).
5. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit
   messages: `feat: …`, `fix: …`, `docs: …`, `refactor: …`, `test: …`.
6. Open a PR against `dev`. CI must be green; describe *what* and *why*.

## Adding an area preset

The most common contribution! Add an entry to
`apps/api/src/airadar/infrastructure/sources/presets.json`:

```json
{ "slug": "game-dev", "title": "Game Development",
  "topics": ["game-engine", "gamedev", "godot", "unity"],
  "seed_file": null }
```

Guidelines: pick GitHub topics that are actually used by active repos, keep
the list to ~4–8 topics, and only add a `seed_file` if you curate one.

## Reporting bugs & requesting features

Use the [issue templates](https://github.com/pascal-giessler/ai-tech-radar/issues/new/choose).
For security issues, please follow [SECURITY.md](SECURITY.md) instead of
opening a public issue.

## Code of conduct

By participating you agree to our [Code of Conduct](CODE_OF_CONDUCT.md).
