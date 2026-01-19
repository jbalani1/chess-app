"""
Blunder Classification Module
Analyzes mistakes and blunders to categorize WHY they happened
"""

import chess
from typing import Optional, Dict, Any, List
from dataclasses import dataclass
from enum import Enum


class BlunderCategory(Enum):
    HANGING_PIECE = "hanging_piece"
    MISSED_TACTIC = "missed_tactic"
    OVERLOOKED_CHECK = "overlooked_check"
    GREEDY_CAPTURE = "greedy_capture"
    BACK_RANK = "back_rank"
    OPENING_PRINCIPLE = "opening_principle"
    ENDGAME_TECHNIQUE = "endgame_technique"
    TIME_PRESSURE = "time_pressure"
    POSITIONAL_COLLAPSE = "positional_collapse"
    CALCULATION_ERROR = "calculation_error"


@dataclass
class BlunderClassification:
    category: BlunderCategory
    confidence: float  # 0.0 to 1.0
    details: Dict[str, Any]
    explanation: str


class BlunderClassifier:
    """Classifies mistakes and blunders into taxonomy categories"""

    def __init__(self, engine=None):
        self.engine = engine  # ChessEngine instance for deeper analysis

    def classify(
        self,
        board_before: chess.Board,
        move_played: chess.Move,
        board_after: chess.Board,
        eval_before: int,
        eval_after: int,
        best_move: Optional[chess.Move],
        best_move_eval: Optional[int],
        phase: str,
        clock_seconds: Optional[int] = None,
    ) -> BlunderClassification:
        """
        Classify a mistake/blunder into a category.

        Args:
            board_before: Position before the move
            move_played: The move that was played
            board_after: Position after the move
            eval_before: Centipawn evaluation before move
            eval_after: Centipawn evaluation after move
            best_move: Engine's recommended move
            best_move_eval: Eval after best move
            phase: 'opening', 'middlegame', or 'endgame'
            clock_seconds: Remaining time when move was made (if available)

        Returns:
            BlunderClassification with category, confidence, and details
        """
        eval_loss = abs(eval_after - eval_before)
        details = {
            "move_played": move_played.uci(),
            "eval_loss": eval_loss,
            "best_move": best_move.uci() if best_move else None,
        }

        # Priority order: most specific first

        # 1. Time pressure (if clock data available)
        if clock_seconds is not None and clock_seconds < 60:
            return BlunderClassification(
                category=BlunderCategory.TIME_PRESSURE,
                confidence=0.9,
                details={**details, "clock_remaining": clock_seconds},
                explanation=f"Move made with only {clock_seconds}s remaining"
            )

        # 2. Overlooked check/checkmate
        result = self._check_overlooked_check(board_before, move_played, board_after)
        if result:
            return BlunderClassification(
                category=BlunderCategory.OVERLOOKED_CHECK,
                confidence=result["confidence"],
                details={**details, **result["details"]},
                explanation=result["explanation"]
            )

        # 3. Back rank weakness
        result = self._check_back_rank(board_before, move_played, board_after)
        if result:
            return BlunderClassification(
                category=BlunderCategory.BACK_RANK,
                confidence=result["confidence"],
                details={**details, **result["details"]},
                explanation=result["explanation"]
            )

        # 4. Hanging piece
        result = self._check_hanging_piece(board_before, move_played, board_after)
        if result:
            return BlunderClassification(
                category=BlunderCategory.HANGING_PIECE,
                confidence=result["confidence"],
                details={**details, **result["details"]},
                explanation=result["explanation"]
            )

        # 5. Greedy capture
        result = self._check_greedy_capture(board_before, move_played, board_after, eval_loss)
        if result:
            return BlunderClassification(
                category=BlunderCategory.GREEDY_CAPTURE,
                confidence=result["confidence"],
                details={**details, **result["details"]},
                explanation=result["explanation"]
            )

        # 6. Opening principle violation
        if phase == "opening":
            result = self._check_opening_principle(board_before, move_played)
            if result:
                return BlunderClassification(
                    category=BlunderCategory.OPENING_PRINCIPLE,
                    confidence=result["confidence"],
                    details={**details, **result["details"]},
                    explanation=result["explanation"]
                )

        # 7. Endgame technique
        if phase == "endgame":
            return BlunderClassification(
                category=BlunderCategory.ENDGAME_TECHNIQUE,
                confidence=0.6,
                details=details,
                explanation="Endgame technique error - review endgame principles"
            )

        # 8. Missed tactic (if we had a winning move)
        if best_move and best_move_eval and (best_move_eval - eval_after) > 150:
            result = self._check_missed_tactic(board_before, best_move)
            if result:
                return BlunderClassification(
                    category=BlunderCategory.MISSED_TACTIC,
                    confidence=result["confidence"],
                    details={**details, **result["details"]},
                    explanation=result["explanation"]
                )

        # 9. Large eval swing = calculation error
        if eval_loss > 400:
            return BlunderClassification(
                category=BlunderCategory.CALCULATION_ERROR,
                confidence=0.7,
                details=details,
                explanation=f"Large eval loss ({eval_loss}cp) suggests calculation error"
            )

        # 10. Default: positional collapse
        return BlunderClassification(
            category=BlunderCategory.POSITIONAL_COLLAPSE,
            confidence=0.5,
            details=details,
            explanation="Position deteriorated without clear tactical cause"
        )

    def _check_overlooked_check(
        self, board_before: chess.Board, move: chess.Move, board_after: chess.Board
    ) -> Optional[Dict]:
        """Check if player missed a check or allowed checkmate"""

        # Did opponent have checkmate that wasn't blocked?
        board_before.push(move)
        if board_before.is_checkmate():
            board_before.pop()
            return None  # Player delivered checkmate, not a blunder

        # Check if opponent now has checkmate
        if board_after.is_checkmate():
            return {
                "confidence": 0.95,
                "details": {"allowed_checkmate": True},
                "explanation": "Move allowed immediate checkmate"
            }

        # Check if opponent has check that leads to material loss
        for response in board_after.legal_moves:
            if board_after.is_check():
                return {
                    "confidence": 0.8,
                    "details": {"walked_into_check_sequence": True},
                    "explanation": "Overlooked check sequence"
                }
                break

        board_before.pop()
        return None

    def _check_back_rank(
        self, board_before: chess.Board, move: chess.Move, board_after: chess.Board
    ) -> Optional[Dict]:
        """Check for back rank weakness"""

        turn = board_before.turn
        back_rank = 0 if turn == chess.WHITE else 7

        # Find king position
        king_square = board_after.king(turn)
        if king_square is None:
            return None

        king_rank = chess.square_rank(king_square)

        # King on back rank with no escape squares?
        if king_rank == back_rank:
            # Check if pawns block escape
            escape_squares = []
            for delta in [-1, 0, 1]:
                file = chess.square_file(king_square) + delta
                if 0 <= file <= 7:
                    escape_rank = back_rank + (1 if turn == chess.WHITE else -1)
                    escape_sq = chess.square(file, escape_rank)
                    piece = board_after.piece_at(escape_sq)
                    if piece and piece.color == turn and piece.piece_type == chess.PAWN:
                        escape_squares.append(chess.square_name(escape_sq))

            if len(escape_squares) >= 2:
                # Check if opponent has rook/queen on file
                for sq in chess.SQUARES:
                    piece = board_after.piece_at(sq)
                    if piece and piece.color != turn:
                        if piece.piece_type in [chess.ROOK, chess.QUEEN]:
                            if chess.square_file(sq) == chess.square_file(king_square):
                                return {
                                    "confidence": 0.85,
                                    "details": {
                                        "back_rank_weak": True,
                                        "blocking_pawns": escape_squares
                                    },
                                    "explanation": "Back rank weakness exploited"
                                }
        return None

    def _check_hanging_piece(
        self, board_before: chess.Board, move: chess.Move, board_after: chess.Board
    ) -> Optional[Dict]:
        """Check if a piece was left hanging (undefended)"""

        turn = board_before.turn

        # Check all player's pieces after the move
        for square in chess.SQUARES:
            piece = board_after.piece_at(square)
            if piece and piece.color == turn and piece.piece_type != chess.KING:
                # Is this piece attacked?
                attackers = board_after.attackers(not turn, square)
                if attackers:
                    # Is it defended?
                    defenders = board_after.attackers(turn, square)
                    if not defenders:
                        piece_value = self._piece_value(piece.piece_type)
                        return {
                            "confidence": 0.9,
                            "details": {
                                "hanging_piece": piece.symbol().upper(),
                                "square": chess.square_name(square),
                                "piece_value": piece_value
                            },
                            "explanation": f"{piece.symbol().upper()} on {chess.square_name(square)} left undefended"
                        }
        return None

    def _check_greedy_capture(
        self, board_before: chess.Board, move: chess.Move, board_after: chess.Board,
        eval_loss: int
    ) -> Optional[Dict]:
        """Check if player captured material but lost more"""

        if not board_before.is_capture(move):
            return None

        captured = board_before.piece_at(move.to_square)
        if not captured:
            # En passant
            captured_value = 100
        else:
            captured_value = self._piece_value(captured.piece_type)

        # If we captured something valuable but lost even more eval
        if captured_value >= 100 and eval_loss > captured_value + 100:
            return {
                "confidence": 0.85,
                "details": {
                    "captured_value": captured_value,
                    "net_loss": eval_loss
                },
                "explanation": f"Captured {captured_value}cp material but lost {eval_loss}cp"
            }
        return None

    def _check_opening_principle(
        self, board_before: chess.Board, move: chess.Move
    ) -> Optional[Dict]:
        """Check for opening principle violations"""

        piece = board_before.piece_at(move.from_square)
        if not piece:
            return None

        ply = len(board_before.move_stack)
        violations = []

        # Early queen moves (before move 10)
        if piece.piece_type == chess.QUEEN and ply < 20:
            violations.append("early_queen_move")

        # Moving same piece twice in opening
        if ply < 20:
            for prev_move in board_before.move_stack[-4:]:
                if prev_move.from_square == move.to_square:
                    violations.append("moving_same_piece_twice")
                    break

        # Not castling when king in center late
        if piece.piece_type == chess.KING and ply > 16:
            if not board_before.has_castling_rights(board_before.turn):
                pass  # Already castled or lost rights
            elif chess.square_file(move.from_square) == 4:  # King still on e-file
                violations.append("delayed_castling")

        if violations:
            return {
                "confidence": 0.7,
                "details": {"violations": violations},
                "explanation": f"Opening principle violation: {', '.join(violations)}"
            }
        return None

    def _check_missed_tactic(
        self, board: chess.Board, best_move: chess.Move
    ) -> Optional[Dict]:
        """Determine what type of tactic was missed"""

        board_copy = board.copy()
        board_copy.push(best_move)

        tactic_type = None

        # Check if best move was a fork
        moved_piece = board.piece_at(best_move.from_square)
        if moved_piece:
            attacks_after = list(board_copy.attacks(best_move.to_square))
            valuable_attacks = []
            for sq in attacks_after:
                target = board_copy.piece_at(sq)
                if target and target.color != moved_piece.color:
                    if target.piece_type in [chess.QUEEN, chess.ROOK, chess.KING]:
                        valuable_attacks.append(chess.square_name(sq))
            if len(valuable_attacks) >= 2:
                tactic_type = "fork"

        # Check if best move was a discovered attack
        # (piece moves, revealing attack from another piece)

        # Check if best move delivered check
        if board_copy.is_check():
            if tactic_type:
                tactic_type = f"{tactic_type}_with_check"
            else:
                tactic_type = "check_tactic"

        if tactic_type:
            return {
                "confidence": 0.8,
                "details": {"tactic_type": tactic_type},
                "explanation": f"Missed {tactic_type}"
            }

        return {
            "confidence": 0.6,
            "details": {"tactic_type": "unknown"},
            "explanation": "Missed stronger continuation"
        }

    @staticmethod
    def _piece_value(piece_type: chess.PieceType) -> int:
        """Standard piece values in centipawns"""
        values = {
            chess.PAWN: 100,
            chess.KNIGHT: 320,
            chess.BISHOP: 330,
            chess.ROOK: 500,
            chess.QUEEN: 900,
            chess.KING: 0
        }
        return values.get(piece_type, 0)


def classify_move_blunder(
    position_fen: str,
    move_uci: str,
    eval_before: int,
    eval_after: int,
    best_move_uci: Optional[str],
    best_move_eval: Optional[int],
    phase: str,
    clock_seconds: Optional[int] = None
) -> Dict[str, Any]:
    """
    Convenience function to classify a blunder from raw data.

    Returns dict with:
        - category: BlunderCategory value
        - confidence: float
        - details: dict
        - explanation: str
    """
    board_before = chess.Board(position_fen)
    move_played = chess.Move.from_uci(move_uci)
    board_after = board_before.copy()
    board_after.push(move_played)

    best_move = chess.Move.from_uci(best_move_uci) if best_move_uci else None

    classifier = BlunderClassifier()
    result = classifier.classify(
        board_before=board_before,
        move_played=move_played,
        board_after=board_after,
        eval_before=eval_before,
        eval_after=eval_after,
        best_move=best_move,
        best_move_eval=best_move_eval,
        phase=phase,
        clock_seconds=clock_seconds
    )

    return {
        "category": result.category.value,
        "confidence": result.confidence,
        "details": result.details,
        "explanation": result.explanation
    }
