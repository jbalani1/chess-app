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
  engine_config_hash: string;
  created_at: string;
  best_move_san?: string;
  best_move_uci?: string;
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
