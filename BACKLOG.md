# Backlog

Seeded from real findings, not invented. The daily agent may work from this,
add to it, or go beyond it — see `AGENT.md`. Tick things off in PRs.

## Known defects

- [ ] **`ingest.py` mislabels mate-score moves as blunders.** In some
      checkmate branches it forces `classification = 'blunder'` even when the
      evaluation improved — 13 such moves in the last 50 Black games, 12 of them
      the engine's own top choice. Everything downstream now filters with
      `eval_delta < 0` to compensate; fixing it at the source would let that
      filter go away. `worker/ingest.py`, the branches around line 480.
- [x] **`blunder_classifier._check_hanging_piece` is over-broad.** It flags any
      attacked, undefended piece after a move regardless of whether the move
      caused it, which is why `hanging_piece` accounts for ~75% of categorised
      blunders and tells you little. `see.avoidable_drop()` already computes the
      honest version; the classifier could use it.
- [ ] **Stored `blunder_category` values predate the classifier fix.** Existing
      rows came from the old ingest classifier and/or
      `backfill_blunder_categories.py` (which guesses from eval alone — any
      150cp+ loss becomes `hanging_piece`). They keep the old labels until
      re-derived with `classify_move_blunder` over `position_fen_before`, which
      needs a write-role run.
- [ ] **`ingest.py` passes the opponent's best reply to the classifier.** It
      sends `analysis_result['best_move']` (the best move *after* the played
      move) as `best_move_uci`, so `best_move` in `blunder_details` is the
      wrong side's move and the `missed_tactic` branch can never fire.
- [ ] **No failure alarm on the nightly ingest.** The 2026-08-25 run died
      silently and nobody knew until games stopped appearing. `daily_ingest.sh`
      should check for its own DONE marker and shout if it is missing.
- [ ] **Other routes may still have the unchunked `.in('game_id', …)` bug.**
      `/api/openings` and `/api/positions` were fixed; audit the rest against
      `lib/queryChunks.ts`.

## Improvements worth considering

- [ ] **Trend over time in the Explorer.** Recency filtering exists, but there
      is no way to see whether a leak is getting better or worse. A sparkline of
      error rate per 20-game block, respecting the active filters, would answer
      "am I actually improving?"
- [ ] **Drill straight from a filter.** The Explorer finds recurring mistakes
      and the app has a drill mode; they do not connect. "Drill these 7
      positions" from a recurring group is the obvious missing link.
- [ ] **Opponent-strength context.** Nothing accounts for opponent rating. A
      blunder against a 1400 and a loss to a 2000 are not the same signal.
- [ ] **Migrate the old `/mistakes` tabs onto `explorer_query`.** They still
      fetch every mistake and slice it in JavaScript, which gets slower with
      every game. The RPC and `user_mistakes` view already exist.
- [ ] **Unused indexes.** 22 indexes have never been scanned, ~7 MB total.
      Some are genuinely dead, some may just predate the queries that would use
      them. Wants evidence before dropping anything.
- [ ] **The Italian findings are not in the app.** `worker/reports/2026-08-20/`
      contains a full opening analysis that only exists as a static page. The
      repertoire-level view (which openings, from which first move, with what
      results) could live in the app and stay current.

## Answered questions worth not re-litigating

- Recency is resolved at the **game** level before move filters, so adding a
  move filter cannot silently change which games are in the window.
- The `anon` key is read-only by design; every write goes through the service
  role. Do not "fix" a permission error by widening anon's grants.
- Reads are open to `anon` deliberately — this is a single-user app whose data
  already reaches the browser. The hardening is write revocation.
