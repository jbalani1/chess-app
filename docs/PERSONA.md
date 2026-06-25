# Target Player & Design Principles

This document defines *who* we build for and *how* the UI should behave for them. The
root [CLAUDE.md](../CLAUDE.md) North Star points here. Read it before any UI/UX or copy
work.

## Who: the 700–1300 ELO player

**"Maya," rapid rating ~950.** Plays a few games most days on Chess.com. Knows how the
pieces move, basic openings by name, and the idea of "don't hang pieces" — but:

- **Doesn't speak engine.** "−245 cp", "eval delta", "ACPL", "+1.8" mean little. She
  understands *"you dropped a free knight"* and *"this was your turning point."*
- **Repeats the same mistakes** without noticing the pattern. She loses to back-rank
  mates, hangs pieces when attacked on two squares, and rushes in winning positions —
  but experiences each loss as a one-off, not a *recurring theme.*
- **Has limited time and patience.** Won't read a wall of text or scrub a 60-move eval
  graph. Wants the 2–3 things that actually cost her games, ranked.
- **Wants to improve, not just measure.** A number going down isn't useful unless she
  knows what to *practice.* Every insight should imply an action.
- **Plays on her phone as much as her laptop.** Mobile is a first-class surface.

### What she does NOT need
- Centipawn precision, deep engine lines, or master-level positional nuance.
- Every move annotated. Highlight the few that mattered; mute the rest.
- Opening theory beyond ~move 8–10. Her games are decided by blunders, not prep.

## The job to be done

> "Show me the handful of mistake patterns that are actually costing me games, in plain
> language, and tell me what to drill so I stop making them."

Three verbs, in order: **Notice → Understand → Act.**

1. **Notice** — surface recurring patterns she'd never spot herself (e.g. *"You've hung
   a piece to a fork 14 times this month — almost always when behind on the clock"*).
2. **Understand** — show the concrete position(s) so the pattern clicks visually.
3. **Act** — link straight to a drill / set of her own positions to practice it.

## Design principles

Apply these on every screen. When a design choice is ambiguous, the principle wins.

1. **Plain language over engine output.** Translate every metric into human terms.
   Centipawns → "you went from winning to losing." Classification → "free piece," "missed
   a winning tactic," "rushed in a won game." Keep the raw number available on hover/tap
   for the curious, but never lead with it.

2. **Lead with the pattern, not the game list.** The first thing she sees should be
   *"Your top 3 recurring mistakes,"* not a table of 200 moves. Aggregate first, drill
   down on demand.

3. **Always show the board.** A mistake pattern is abstract until she sees the position.
   Every insight should be one tap from the actual board state where it happened, with the
   blunder and the better move highlighted in color (not just notation).

4. **Rank ruthlessly; cap at 3–5.** A list of 20 weaknesses is as useless as none. Show
   the few that cost the most rating/points, sorted by impact. Hide the long tail behind
   "show more."

5. **Every insight ends in an action.** No dead-end stats. Each pattern card has a clear
   next step: "Drill this," "See the 6 games where this happened," "Practice this endgame."

6. **Quantify impact in her currency.** Not "−245 cp average loss" but *"these mistakes
   cost you ~8 games this month"* or *"this is your #1 rating leak."* Tie weaknesses to
   wins/losses and rating where possible.

7. **Encourage, don't scold.** She's losing games and feels it. Frame as growth:
   "Here's your biggest opportunity," not "You blundered 47 times." Celebrate improvement
   over time (trends that are getting better).

8. **Mobile-first, thumb-friendly.** Test every layout at 390px wide. Tap targets ≥44px.
   Boards and charts must be legible on a phone. No hover-only information.

9. **Fast and skimmable.** Color, icons, and one-line headlines do the work. A player
   should grasp her top problem in <5 seconds without reading a paragraph.

10. **Consistent visual language for mistake severity.** Use the established palette
    everywhere: good `#81B64C`, inaccuracy `#F5A623`, mistake `#E5944D`, blunder `#E5484D`.
    Same colors on boards, charts, badges, and lists so severity is instantly readable.

## Litmus tests for any change

Before shipping a UI change, check:

- [ ] Could Maya understand this without knowing what a centipawn is?
- [ ] Does it surface a *pattern*, or just another isolated stat?
- [ ] Is there a board to look at, with the key squares highlighted?
- [ ] Is there a clear next action?
- [ ] Does it read well on a 390px phone screen?
- [ ] Are the top items ranked by real impact, with the long tail hidden?
