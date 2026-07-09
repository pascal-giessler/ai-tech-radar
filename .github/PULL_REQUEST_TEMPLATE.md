## What & why

<!-- What does this PR change, and what problem does it solve? -->

## How was it tested?

<!-- Which of these did you run? -->
- [ ] `pytest -m "not slow and not integration"` (apps/api)
- [ ] `ruff check src tests` (apps/api)
- [ ] `npx vitest run && npx tsc --noEmit` (apps/web)
- [ ] Manually verified against `docker compose up --build`

## Checklist

- [ ] Focused change (one logical change per PR)
- [ ] Tests added/updated for behaviour changes
- [ ] Docs updated if user-facing (README, CONTRIBUTING)
