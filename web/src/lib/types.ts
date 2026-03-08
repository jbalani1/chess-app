// TypeScript types for the chess analysis app

export type MoveClassification = 'good' | 'inaccuracy' | 'mistake' | 'blunder';
export type GamePhase = 'opening' | 'middlegame' | 'endgame';

export interface Game {
  id: string;
  username: string;
  chess_com_game_id: string;
  pgn: string;
  time_control: string;
  eco: string;
  opening_name: string;
  result: string;
  white_player: string;
  black_player: string;
  played_at: string;
  analyzed_at: string;
  engine_config_hash: string;
  created_at: string;
}

export type BlunderCategory =
  | 'hanging_piece'
  | 'missed_tactic'
  | 'overlooked_check'
  | 'greedy_capture'
  | 'back_rank'
  | 'opening_principle'
  | 'endgame_technique'
  | 'time_pressure'
  | 'positional_collapse'
  | 'calculation_error';

export interface TacticalMotif {
  motif_type: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  piece_involved: string;
  fen: string;
}

export interface PositionalPattern {
  pattern_type: string;
  description: string;
  severity: string;
  recommendation: string;
}

export interface Move {
  id: string;
  game_id: string;
  ply: number;
  move_san: string;
  move_uci: string;
  eval_before: number;
  eval_after: number;
  eval_delta: number;
  classification: MoveClassification;
  piece_moved: string;
  phase: GamePhase;
  position_fen: string;
  position_fen_before?: string | null;
  engine_config_hash: string;
  created_at: string;
  best_move_san?: string | null;
  best_move_uci?: string | null;
  captured_piece?: string | null;
  move_quality?: string;
  recommendations?: string[];
  tactical_motifs?: TacticalMotif[];
  positional_patterns?: PositionalPattern[];
  blunder_category?: BlunderCategory;
  blunder_details?: {
    confidence: number;
    explanation: string;
    [key: string]: unknown;
  };
}

export interface EngineConfig {
  config_hash: string;
  skill_level: number;
  threads: number;
  hash_mb: number;
  multi_pv: number;
  move_time_ms: number;
  stockfish_version: string;
  created_at: string;
}

export interface MistakeStats {
  total_moves: number;
  good_moves: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  avg_eval_delta: number;
  mistake_rate: number;
}

export interface MistakesByPiece extends MistakeStats {
  piece_moved: string;
}

export interface MistakesByOpening extends MistakeStats {
  eco: string;
  opening_name: string;
  games_played: number;
}

export interface MistakesByPhase extends MistakeStats {
  phase: GamePhase;
}

export interface MistakesByTimeControl extends MistakeStats {
  time_control: string;
  games_played: number;
}

export interface GameStatistics {
  total_games: number;
  total_moves: number;
  good_moves: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  avg_eval_delta: number;
  accuracy_percentage: number;
  mistake_rate: number;
}

export interface AnalysisRequest {
  username: string;
  year?: number;
  month?: number;
}

export interface GameFilters {
  username?: string;
  time_control?: string;
  date_from?: string;
  date_to?: string;
  eco?: string;
}

export interface MistakeFilters {
  groupBy: 'piece' | 'opening' | 'phase' | 'time_control';
  time_control?: string;
  date_from?: string;
  date_to?: string;
  phase?: GamePhase;
}

// Drill Mode Types
export interface DrillPosition {
  move_id: string;
  game_id: string;
  position_fen: string;
  best_move_san: string;
  best_move_uci: string;
  blunder_category: BlunderCategory;
  blunder_explanation: string;
  eval_delta: number;
  phase: GamePhase;
  ply: number;
  white_player: string;
  black_player: string;
  username: string;
  played_at: string;
  // Spaced repetition info (if previously attempted)
  next_review_at?: string | null;
  repetition_number?: number;
  last_attempt_correct?: boolean | null;
}

export interface DrillAttempt {
  id: string;
  move_id: string;
  username: string;
  attempted_move_uci: string | null;
  attempted_move_san: string | null;
  is_correct: boolean;
  time_spent_ms: number | null;
  easiness_factor: number;
  repetition_number: number;
  interval_days: number;
  next_review_at: string;
  created_at: string;
}

export interface DrillAttemptResult {
  is_correct: boolean;
  correct_move_san: string;
  correct_move_uci: string;
  explanation: string;
  eval_delta: number;
  next_review_at: string;
  repetition_number: number;
  interval_days: number;
}

export interface DrillStats {
  total_positions: number;
  total_attempts: number;
  accuracy_rate: number;
  positions_mastered: number;
  positions_due: number;
  current_streak: number;
  by_category: Record<BlunderCategory, CategoryDrillStats>;
}

export interface CategoryDrillStats {
  total: number;
  drilled: number;
  mastered: number;
  accuracy: number;
  due_count: number;
}

// Common interface for game data from Supabase joins
export interface JoinedGameData {
  id: string;
  username: string;
  white_player: string;
  black_player: string;
  result: string;
  opening_name: string;
  eco: string;
  time_control: string;
  played_at: string;
}

// Opening Prep Types
export interface OpeningPattern {
  eco: string
  opening_name: string
  user_color: 'white' | 'black'
  games_played: number
  opening_mistake_rate: number
  trouble_score: number
  trouble_positions: TroublePosition[]
}

export interface TroublePosition {
  position_fen: string
  move_number: number
  typical_ply: number
  occurrence_count: number
  mistake_count: number
  blunder_count: number
  inaccuracy_count: number
  good_count: number
  mistake_rate: number
  avg_eval_delta: number
  last_mistake_date: string | null
  recency_score: number
  your_moves: MoveChoice[]
}

export interface MoveChoice {
  move_san: string
  count: number
  classifications: { good: number; inaccuracy: number; mistake: number; blunder: number }
  avg_eval_delta: number
  best_move_san: string | null
  game_instances: { game_id: string; move_id: string; played_at: string; eval_delta: number }[]
}

// Pattern-based recurring mistakes
export interface PatternExample {
  fen: string
  move_san: string
  best_move_san: string | null
  eval_delta: number
  explanation: string | null
  game_id: string
  move_id: string
  played_at: string
  opening_name: string
  piece_moved: string
}

export interface PatternGroup {
  blunder_category: BlunderCategory
  phase: GamePhase
  count: number
  avg_eval_loss: number
  recent_count: number
  older_count: number
  trend: 'improving' | 'stable' | 'worsening'
  piece_breakdown: { piece: string; count: number }[]
  examples: PatternExample[]
  label: string
  description: string
  icon: string
  recommendation: string
  recency_score: number
}

// Helper to check if a move is checkmate
export function isCheckmate(move: Move): boolean {
  return move.move_san.endsWith('#')
}

// Helper to check if a move is check
export function isCheck(move: Move): boolean {
  return move.move_san.endsWith('+') || move.move_san.endsWith('#')
}

// Get the effective classification, accounting for checkmate
export function getEffectiveClassification(move: Move): MoveClassification {
  // Checkmate is always a good move
  if (isCheckmate(move)) {
    return 'good'
  }
  return move.classification
}
