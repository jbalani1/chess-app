# Improvement Backlog

Prioritized queue for autonomous improvement. Pull from the **top of P0**, work down.
Add new findings as you discover them (during screenshot review, code reading, etc.).
Every item ties back to the North Star: *help a 700–1300 player see their mistake
patterns clearly and act on them.* See [docs/PERSONA.md](docs/PERSONA.md).

Priority key: **P0** = broken / blocks the core job · **P1** = high persona impact ·
**P2** = polish / nice-to-have. Mark items `[x]` and move to [PROGRESS.md](PROGRESS.md)
when shipped.

> Seeded 2026-05-29 from a baseline screenshot review (real data, user negrilmannings).
> Screenshots: `web/.screenshots/latest/`.

---

## P0 — Broken / blocks the core job

- [ ] **Bar charts render empty across the app.** "Mistakes by Game Phase" and "Mistakes
  by Time Control" on the Dashboard, and "Mistake Rate by Piece" on Mistakes → By Piece,
  show axes but **no bars**. Charts are the primary way a player *sees* a pattern, so this
  guts the core value. Likely a Recharts data-shape/keys mismatch or bar fill invisible on
  the dark theme. Investigate `MistakeChart` and the dashboard/by-piece data fetches.
  *(home.desktop, mistakes_piece.desktop)*

- [ ] **Mistakes → Overview tab shows 0 mistakes / 0 blunders** while the Dashboard reports
  4,494 mistakes and 2,717 blunders for the same player. The Overview aggregate fetch is
  broken or pointed at the wrong source. Only "Worst Piece: Rook" populates. Reconcile the
  Overview data source with the dashboard's. *(mistakes.desktop)*

- [ ] **Recurring mistakes errors: "Failed to fetch recurring mistakes."** This is the
  single most persona-critical feature (recurring patterns) and it hard-errors with an
  empty "Trouble Spots" panel. Debug `/api/insights/recurring` (or whichever endpoint the
  Recurring tab calls) and the query behind it. *(mistakes_recurring.desktop)*

- [ ] **Insights page reports "2 Issues" (runtime errors).** A red error badge appears
  bottom-left on `/insights`. Capture the console/network errors and fix. *(insights.desktop)*

- [ ] **Game detail page never settles network / may hang.** `/games/[id]` never reaches
  `networkidle` in the harness (timed out at 30s). Could be a polling loop, a stuck engine
  request, or a websocket. Verify the page actually finishes loading for a real user and
  isn't spinning. *(harness timeout)*

## P1 — High persona impact

- [ ] **Dashboard doesn't lead with patterns.** First view shows raw counts (Games,
  Accuracy, Mistakes, Blunders) and a generic Quick Actions grid. Per persona principle #2,
  the hero should be **"Your top 3 recurring mistakes this month"** — each a one-line plain
  headline + severity color + "Drill this" action. Demote the raw counts.

- [ ] **Translate engine numbers into plain language everywhere.** "Avg Eval Loss −163.87",
  "Move Quality" raw counts, centipawn deltas. Replace with human phrasing ("you typically
  go from a small edge to losing") and keep the raw number on hover/tap only. Persona #1.

- [ ] **No board previews on insight/mistake cards.** Patterns are abstract without the
  position. Add a mini-board thumbnail (the `ActionCard` board-preview pattern from
  `VISUAL_UPGRADE_PLAN.md`) to recurring-pattern and mistake cards, with the blunder square
  and better move highlighted. Persona #3.

- [ ] **Quantify impact in the player's currency.** Tie weaknesses to games lost / rating
  impact ("this pattern shows up in 6 of your last 10 losses"), not just frequency/cp.
  Persona #6.

- [ ] **Every insight needs a clear next action.** Audit all stat/insight surfaces; any
  dead-end stat gets a "Drill this" / "See these games" / "Practice this" CTA. Persona #5.

- [ ] **Sanity-check the Accuracy metric.** 77.78% accuracy alongside 4,494 mistakes +
  2,717 blunders over 623 games looks internally inconsistent. Confirm the formula and that
  it's meaningful for the player; consider replacing with something more honest/legible.

- [ ] **Reconsider "mistakes by piece" framing for the persona.** "Rook is your worst
  piece" isn't very actionable for a 950 player. Lead instead with mistake *types* (hung
  piece, missed tactic, back-rank) which map to drills. Keep by-piece as a secondary view.

## P2 — Polish / aesthetics

- [ ] **Empty states are vast dead space.** When a tab has no data (e.g. Overview), the
  page is mostly black. Add helpful empty states with guidance or a CTA to ingest games.

- [ ] **Mobile bottom-nav overlaps content** on the dashboard; ensure adequate bottom
  padding so the last card isn't covered. *(home.mobile)*

- [ ] **Quick Action cards are generic.** Consider board-preview thumbnails and copy that
  speaks to outcomes ("Fix the blunders losing you games") over feature names.

- [ ] **Consistent severity palette audit.** Verify good/inaccuracy/mistake/blunder colors
  are applied uniformly across boards, charts, badges, and tables. Persona #10.

---

## Done
_(Move shipped items here with date + PR link, or record in PROGRESS.md.)_
