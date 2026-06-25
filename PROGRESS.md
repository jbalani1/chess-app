# Progress Log

Append a dated entry whenever a feature, fix, or phase completes. Newest first.

## 2026-05-29 — Autonomous improvement workflow established

Set up the scaffolding for low-intervention improvement work focused on the
700–1300 ELO player (see [docs/PERSONA.md](docs/PERSONA.md)):

- **[CLAUDE.md](CLAUDE.md)** — working agreement: North Star, the improvement loop,
  run/test commands, quality gates, git/PR workflow, scope boundaries.
- **[docs/PERSONA.md](docs/PERSONA.md)** — target player profile + 10 design principles
  + per-change litmus tests.
- **`web/scripts/screenshot.mjs`** — Playwright visual-review harness. Captures every
  page at desktop (1440) + mobile (390) with real data; resolves dynamic routes via the
  live APIs. Output → `web/.screenshots/latest/` (git-ignored).
- **[BACKLOG.md](BACKLOG.md)** — prioritized queue, seeded from a baseline screenshot
  review.

Baseline review (24 pages captured) immediately surfaced P0 bugs: empty bar charts
app-wide, Mistakes→Overview showing 0 vs 4,494 on the dashboard, Recurring mistakes
"Failed to fetch", a "2 Issues" badge on Insights, and a hanging game-detail page. These
are queued in the backlog as the first work items.
