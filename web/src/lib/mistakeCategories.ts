// Plain-language vocabulary for blunder categories, for a 700–1300 player who
// doesn't speak engine. Maps the analyzer's category keys to a human label, a
// one-line description, a drill tip, and a severity color. See docs/PERSONA.md
// (principle #1: plain language over engine output).

export interface CategoryMeta {
  label: string
  // One short line a player immediately understands.
  blurb: string
  // What to actually practice (plain, actionable).
  tip: string
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  hanging_piece: {
    label: 'Hanging pieces',
    blurb: 'You left a piece undefended.',
    tip: 'Before every move, scan for checks, captures and threats.',
  },
  missed_tactic: {
    label: 'Missed tactics',
    blurb: 'You had a winning tactic and played something else.',
    tip: 'A few tactics puzzles a day trains you to spot these.',
  },
  overlooked_check: {
    label: 'Overlooked checks',
    blurb: "You missed a check — yours or your opponent's.",
    tip: 'Always look at every check before deciding on a move.',
  },
  greedy_capture: {
    label: 'Greedy captures',
    blurb: 'You grabbed material that wasn’t actually free.',
    tip: 'Before taking, ask: “Why is this being offered to me?”',
  },
  back_rank: {
    label: 'Back-rank danger',
    blurb: 'Your king had no escape square on the back rank.',
    tip: 'Make luft (a pawn move for your king) once you’ve castled.',
  },
  opening_principle: {
    label: 'Shaky openings',
    blurb: 'Slips in the first handful of moves.',
    tip: 'Develop pieces, fight for the centre, castle early.',
  },
  endgame_technique: {
    label: 'Endgame technique',
    blurb: 'Winnable endgames slipped away.',
    tip: 'Drill the basics: king + pawn, and rook endgames.',
  },
  time_pressure: {
    label: 'Time scrambles',
    blurb: 'Mistakes that cluster when your clock is low.',
    tip: 'Spend your time earlier; don’t drift into time trouble.',
  },
  positional_collapse: {
    label: 'Positional drift',
    blurb: 'Your position slowly got worse without a clear blunder.',
    tip: 'Improve your worst-placed piece; make a plan each move.',
  },
  calculation_error: {
    label: 'Calculation slips',
    blurb: 'A line you started didn’t work out the way you saw it.',
    tip: 'Calculate forcing lines to the end before committing.',
  },
}

export function categoryMeta(category: string): CategoryMeta {
  return (
    CATEGORY_META[category] ?? {
      label: category.replace(/_/g, ' '),
      blurb: 'A recurring mistake in your games.',
      tip: 'Review these positions and look for the pattern.',
    }
  )
}

// Translate an average centipawn loss into how it *feels* in a game, so we never
// lead with a raw number. Mate scores inflate the average, so big = game-losing.
export function severityPhrase(avgEvalLossCp: number): string {
  const cp = Math.abs(avgEvalLossCp)
  if (cp >= 300) return 'usually a game-losing blunder'
  if (cp >= 150) return 'often enough to turn the game'
  return 'small slips that add up'
}

// Severity bucket → which palette colour to use (matches the app's classification
// colours / persona principle #10).
export function severityColorVar(avgEvalLossCp: number): string {
  const cp = Math.abs(avgEvalLossCp)
  if (cp >= 300) return 'var(--color-blunder)'
  if (cp >= 150) return 'var(--color-mistake)'
  return 'var(--color-inaccuracy)'
}
