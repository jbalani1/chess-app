# Architectural & Process Decisions

Append decisions that are hard to reverse or set lasting direction. Newest first.

## 2026-05-29 — Screenshot-driven visual review as the primary UX feedback loop

**Decision:** Adopt a Playwright headless-browser harness (`web/scripts/screenshot.mjs`)
as the canonical way to evaluate UI/UX, rather than reasoning about rendered output from
source alone.

**Why:** Aesthetic and flow problems (empty charts, broken tabs, dead space, mobile
layout) are invisible in code and were caught immediately once pages were rendered with
real data. A repeatable capture → look → critique → fix → re-capture loop is what lets
improvement work proceed with minimal human intervention.

**Trade-offs:** Adds `playwright` as a dev dependency (~Chromium download). Requires the
dev server running with real data. Acceptable: it's dev-only and git-ignored output.

## 2026-05-29 — Product North Star fixed to the 700–1300 ELO player

**Decision:** All improvement work is judged against one job — *help a mid-level player
see and act on their recurring mistake patterns in plain language.* Codified in
[CLAUDE.md](CLAUDE.md) + [docs/PERSONA.md](docs/PERSONA.md).

**Why:** Without a single target user, "improve the app" is unbounded. A concrete persona
("Maya," ~950) lets design choices be settled by principle instead of by asking.

**Implication:** Engine-precision features (deep lines, exact centipawns as headline
metrics) are explicitly deprioritized vs. plain-language pattern surfacing.

## 2026-05-29 — Branch + PR workflow for all improvement work

**Decision:** Never commit improvement work to `main`. One backlog item ≈ one focused PR
with before/after screenshots and quality-gate results; PRs left open for owner review.

**Why:** Owner opted into "commit + push + open PRs" to stay in the loop with minimal
effort. Small, screenshot-backed PRs are reviewable at a glance.
