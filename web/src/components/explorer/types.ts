export interface FacetValue {
  value: string
  count: number
}

export interface MistakeRow {
  id: string
  game_id: string
  ply: number
  move_number: number
  move_san: string
  best_move_san: string | null
  piece_moved: string | null
  phase: string
  classification: string
  blunder_category: string | null
  eval_before_user: number | null
  edge_bucket: string
  cp_lost: number
  avoidable_loss: number | null
  user_color: string
  vs_first_move: string | null
  user_reply: string | null
  opening_clean: string | null
  opening_family: string | null
  eco: string | null
  result: string
  time_control: string | null
  played_at: string
  white_player: string
  black_player: string
  game_url: string | null
}

export interface RecurringGroup {
  move_san: string
  piece: string | null
  n: number
  blunders: number
  avg_cp: number
  drops: number
  first_move_no: number
  last_move_no: number
  phases: string[] | null
  edges: string[] | null
  better: string[] | null
  examples:
    | {
        game_id: string
        move_id: string
        ply: number
        url: string | null
        move_no: number
        opponent: string | null
        played_at: string | null
      }[]
    | null
}

export interface BreakdownCell {
  phase: string
  edge: string
  n: number
  avg_cp: number
  drops: number
}

export interface ExplorerResponse {
  total: number
  summary: {
    mistakes: number
    blunders: number
    games: number
    avg_cp_lost: number
    material_drops: number
    pawns_dropped: number
    from_winning: number
    games_in_scope: number
    clean_games: number
    window_from: string | null
    window_to: string | null
  }
  facets: Record<string, FacetValue[]>
  breakdown: BreakdownCell[]
  recurring: RecurringGroup[]
  rows: MistakeRow[]
}

export type Filters = Record<string, string>

/** Ordered best-to-worst so the matrix reads like an evaluation bar.
 *  'mating' and 'mated' are kept separate from 'winning'/'losing': a slower
 *  mate is not a thrown game, and folding them together overstated how often a
 *  won position was actually given away. */
export const EDGE_ORDER = [
  'mating', 'winning', 'better', 'equal', 'worse', 'losing', 'mated',
] as const
export const PHASE_ORDER = ['opening', 'middlegame', 'endgame'] as const

export const EDGE_LABEL: Record<string, string> = {
  mating: 'Forced mate for you',
  mated: 'Forced mate against you',
  winning: 'Winning (+3 or more)',
  better: 'Better (+1 to +3)',
  equal: 'Level (−1 to +1)',
  worse: 'Worse (−3 to −1)',
  losing: 'Lost (−3 or worse)',
  unknown: 'Unknown',
}

export const EDGE_SHORT: Record<string, string> = {
  mating: 'Had mate',
  mated: 'Was mated',
  winning: 'Winning',
  better: 'Better',
  equal: 'Level',
  worse: 'Worse',
  losing: 'Lost',
  unknown: '?',
}

export const PIECE_LABEL: Record<string, string> = {
  K: 'King',
  Q: 'Queen',
  R: 'Rook',
  B: 'Bishop',
  N: 'Knight',
  P: 'Pawn',
}

/** In-app review link. Matches the convention the rest of the app uses:
 *  the game page reads `move` and jumps to that move. */
export function reviewUrl(gameId: string, moveId: string): string {
  return `/games/${gameId}?move=${moveId}`
}

/** Deep link to the move on chess.com, falling back to the plain game page. */
export function moveUrl(url: string | null, ply: number): string | null {
  if (!url) return null
  return `${url.replace('/game/live/', '/analysis/game/live/')}?tab=review&move=${ply}`
}

export function formatEval(cp: number | null): string {
  if (cp === null || cp === undefined) return '—'
  if (cp > 3000) return 'mating'
  if (cp < -3000) return 'mated'
  return `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(2)}`
}

export function formatCpLost(cp: number): string {
  if (cp >= 3000) return 'game'
  return `−${(cp / 100).toFixed(1)}`
}

/** Recency is a scoping choice, not a facet: `last_games` counts games while
 *  `last_days` counts calendar time, and only one can be active at a time. */
export const RECENCY_OPTIONS = [
  { key: 'last_games', value: '20', label: 'Last 20 games' },
  { key: 'last_games', value: '50', label: 'Last 50 games' },
  { key: 'last_games', value: '100', label: 'Last 100 games' },
  { key: 'last_days', value: '30', label: 'Last 30 days' },
  { key: 'last_days', value: '90', label: 'Last 90 days' },
  { key: 'last_days', value: '365', label: 'Last year' },
] as const

export const RECENCY_KEYS = ['last_games', 'last_days'] as const
