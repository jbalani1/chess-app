# Chess Analysis App — Working Agreement

This file is the operating manual for autonomous improvement of this app. Read it
in full at the start of any improvement session. It is intentionally opinionated so
work can proceed with **minimal intervention from the human owner**.

## North Star

**This app exists to help a 700–1300 ELO chess player *see the patterns in their own
mistakes* — clearly, quickly, and without chess-engine jargon — and know what to do
next.**

Every change is judged against one question: *Does this make a mid-level player's
recurring mistakes more obvious and more actionable?* If a change is technically neat
but doesn't move that needle, it is low priority.

The target player is defined in detail in **[docs/PERSONA.md](docs/PERSONA.md)**. Design
and copy principles for that player live there too. Read it before any UI work.

## The autonomous improvement loop

Work in this repeatable cycle. You do not need to ask permission to run it.

1. **Pick** the top unblocked item from [BACKLOG.md](BACKLOG.md) (or, for a review pass,
   capture fresh screenshots and critique them — step 3).
2. **See the current state.** Run the screenshot harness (below) to capture every page
   as it renders *with real data*, then actually look at the images. Reading code is not
   enough for UX/aesthetic work — view the rendered pages.
3. **Critique** against the North Star + [docs/PERSONA.md](docs/PERSONA.md). Be concrete:
   name the page, the element, and why it fails a 700–1300 player. Add findings to
   [BACKLOG.md](BACKLOG.md) with a priority.
4. **Change** the code. Match surrounding style. TypeScript strict, functional patterns.
5. **Verify.** Re-run the screenshot harness for the affected page(s) and compare
   before/after. Run quality gates (below). Fix what you broke.
6. **Log** to [PROGRESS.md](PROGRESS.md). Record any hard-to-reverse or architectural
   decision in [DECISIONS.md](DECISIONS.md). Record anything that blocks you in
   [BLOCKERS.md](BLOCKERS.md) and keep moving.
7. **Ship.** Commit on a feature branch, push, and open a PR (see Git workflow).

## Seeing the app (visual review harness)

Aesthetic and UX problems are invisible in source. Always review rendered pages.

```bash
# 1. Start the dev server (kill any process already on :3000 first)
make dev                      # serves http://localhost:3000

# 2. In another shell, capture every page at desktop + mobile widths
cd web && node scripts/screenshot.mjs
```

Screenshots land in `web/.screenshots/latest/` (git-ignored). The harness resolves real
dynamic routes (a real game id, opening slug, etc.) by querying the live APIs, so you see
true data, not placeholders. After capturing, **Read the PNGs** and critique them.

To compare before/after a change, copy `latest/` aside first:
`cp -r web/.screenshots/latest web/.screenshots/before`.

## Running, ingesting, testing

| Task | Command |
|------|---------|
| Web dev server | `make dev` (port 3000) |
| Production build (quality gate) | `cd web && npm run build` |
| Lint (quality gate) | `cd web && npm run lint` |
| Python tests (quality gate for worker) | `make test` |
| Ingest + analyze new games | `make analyze USERNAME=negrilmannings YEAR=<y> MONTH=<m>` |
| Incremental ingest of recent games | `cd worker && python ingest_recent.py` |

The Supabase DB already holds analyzed games for **negrilmannings** — pages render real
data. The Python worker uses `worker/venv`. Stockfish auto-downloads on first run.

## Quality gates (must pass before opening a PR)

1. `cd web && npm run lint` — no new errors.
2. `cd web && npm run build` — compiles clean.
3. `make test` — if you touched anything under `worker/`.
4. Fresh screenshots of every page you changed, visually checked, attached to the PR.

If a gate fails, fix it autonomously (try 2–3 approaches) before surfacing a blocker.

## Git workflow

The owner opted into **commit + push + open PRs**. So:

- Never commit improvement work directly to `main`. Branch first:
  `git checkout -b improve/<short-slug>`.
- Make focused commits with clear messages. End commit messages with the
  `Co-Authored-By` trailer (see global instructions).
- Push the branch and open a PR with `gh`. The PR body must include:
  - **What & why** — the player-facing problem it solves (tie to the North Star).
  - **Before/after screenshots** for any visual change (use the harness output).
  - **Gates run** — lint / build / tests results.
- Keep PRs small and single-purpose so they're easy to review. One backlog item ≈ one PR
  unless they're tightly coupled.
- Do not merge for the owner. Leave PRs open for review.

## Scope boundaries (act without asking)

Proceed autonomously on: UI/UX/aesthetic changes, new analysis views, copy/labeling,
new components, refactors, adding tests, dev tooling, dependency additions needed for the
work, screenshot capture, and ingesting more of the owner's own games for testing.

Pause and ask (via a PR comment or BLOCKERS.md, don't block the run) only for:
**destructive DB schema migrations**, **deleting analyzed game data**, anything touching
**secrets/`.env`**, or a **product-direction change** that contradicts the North Star.

## Logging conventions

- **[PROGRESS.md](PROGRESS.md)** — append a dated line whenever a feature/phase completes.
- **[DECISIONS.md](DECISIONS.md)** — append architectural / hard-to-reverse decisions with
  rationale.
- **[BLOCKERS.md](BLOCKERS.md)** — anything that stopped you; keep working around it.
- **[BACKLOG.md](BACKLOG.md)** — the prioritized queue of improvements. Pull from the top,
  add findings as you discover them.

## Stack reference

- **web/** — Next.js 15 (App Router), React 19, TypeScript, Tailwind v4, Recharts,
  react-chessboard. Dark theme, Chess.com-inspired (see `VISUAL_UPGRADE_PLAN.md`).
- **worker/** — Python 3.11, python-chess, Stockfish, psycopg2. Ingestion + analysis.
- **db/** — Supabase PostgreSQL; `schema.sql` holds tables + aggregation views.
- Chess.com username under analysis: **negrilmannings**.
