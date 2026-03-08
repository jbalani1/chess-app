"""
Tactic Analyzer Module
Analyzes the engine's best move to identify what tactic it contains.
This helps detect missed tactical opportunities.
"""

import chess
from typing import Optional, Dict, Any, List, Set
from dataclasses import dataclass, asdict


@dataclass
class TacticInfo:
    """Information about a detected tactic in a move"""
    tactic_type: str  # 'fork', 'pin', 'skewer', 'discovered_attack', 'back_rank',
                      # 'deflection', 'removal_of_defender', 'zwischenzug'
    description: str
    squares_involved: List[str]  # Key squares in the tactic
    piece_sacrificed: Optional[str] = None  # If the tactic involves a sacrifice


class TacticAnalyzer:
    """Analyzes chess moves for tactical themes"""

    PIECE_VALUES = {
        chess.PAWN: 100,
        chess.KNIGHT: 320,
        chess.BISHOP: 330,
        chess.ROOK: 500,
        chess.QUEEN: 900,
        chess.KING: 10000
    }

    PIECE_NAMES = {
        chess.PAWN: 'pawn',
        chess.KNIGHT: 'knight',
        chess.BISHOP: 'bishop',
        chess.ROOK: 'rook',
        chess.QUEEN: 'queen',
        chess.KING: 'king'
    }

    def analyze_best_move_tactic(self, fen_before: str, best_move_uci: str) -> Optional[TacticInfo]:
        """
        Analyze what tactic (if any) the best move contains.

        Args:
            fen_before: FEN string of position before the move
            best_move_uci: The engine's best move in UCI format

        Returns:
            TacticInfo if a tactic is detected, None otherwise
        """
        try:
            board = chess.Board(fen_before)
            move = chess.Move.from_uci(best_move_uci)

            if move not in board.legal_moves:
                return None

            # Check for various tactics in priority order
            tactics = [
                self._check_fork(board, move),
                self._check_discovered_attack(board, move),
                self._check_pin(board, move),
                self._check_skewer(board, move),
                self._check_back_rank(board, move),
                self._check_removal_of_defender(board, move),
                self._check_zwischenzug(board, move),
                self._check_deflection(board, move),
                self._check_trapped_piece(board, move),
                self._check_overloaded_piece(board, move),
            ]

            # Return the first detected tactic
            for tactic in tactics:
                if tactic:
                    return tactic

            return None

        except Exception as e:
            print(f"Error analyzing tactic: {e}")
            return None

    def _check_fork(self, board: chess.Board, move: chess.Move) -> Optional[TacticInfo]:
        """
        Check if the move creates a fork (piece attacks 2+ pieces).
        Includes pawn forks and attacks on any undefended piece.
        """
        moving_piece = board.piece_at(move.from_square)
        if not moving_piece:
            return None

        # Make the move
        board_after = board.copy()
        board_after.push(move)

        # Get squares attacked by the moved piece
        attacked_squares = board_after.attacks(move.to_square)

        # Find targets being attacked - include any piece (not just knight+)
        valuable_targets = []
        for sq in attacked_squares:
            target = board_after.piece_at(sq)
            if target and target.color != moving_piece.color:
                target_value = self.PIECE_VALUES.get(target.piece_type, 0)
                # Include any piece worth at least a pawn
                if target_value >= 100:
                    # Check if target is undefended or under-defended
                    defenders = board_after.attackers(target.color, sq)
                    attackers = board_after.attackers(moving_piece.color, sq)
                    # Count as fork target if: king, or undefended, or piece is valuable
                    if (target.piece_type == chess.KING or
                        len(defenders) == 0 or
                        target.piece_type in [chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN]):
                        valuable_targets.append((sq, target))

        if len(valuable_targets) >= 2:
            # Sort by value to get the most interesting targets
            valuable_targets.sort(key=lambda t: self.PIECE_VALUES.get(t[1].piece_type, 0), reverse=True)

            target_names = [f"{self.PIECE_NAMES[t[1].piece_type]} on {chess.square_name(t[0])}"
                           for t in valuable_targets]
            squares = [chess.square_name(move.to_square)] + [chess.square_name(t[0]) for t in valuable_targets]

            piece_name = self.PIECE_NAMES[moving_piece.piece_type]

            # Check if king is among targets (royal fork)
            has_king = any(t[1].piece_type == chess.KING for t in valuable_targets)
            fork_type = "royal fork" if has_king else "fork"

            return TacticInfo(
                tactic_type='fork',
                description=f"{piece_name.capitalize()} {fork_type} attacking {', '.join(target_names)}",
                squares_involved=squares
            )

        return None

    def _check_discovered_attack(self, board: chess.Board, move: chess.Move) -> Optional[TacticInfo]:
        """
        Check if the move reveals an attack from another piece.
        Detects attacks on any piece worth a bishop or more.
        """
        moving_piece = board.piece_at(move.from_square)
        if not moving_piece:
            return None

        moving_color = moving_piece.color

        board_after = board.copy()
        board_after.push(move)

        # Look for pieces that now attack valuable enemy pieces
        # that they couldn't attack before
        for sq in chess.SQUARES:
            piece = board.piece_at(sq)
            if not piece or piece.color != moving_color:
                continue
            if sq == move.from_square:  # Skip the moving piece itself
                continue

            # Check if this piece is a sliding piece that could have been blocked
            if piece.piece_type not in [chess.BISHOP, chess.ROOK, chess.QUEEN]:
                continue

            # Get attacks before and after
            attacks_before = board.attacks(sq)
            attacks_after = board_after.attacks(sq)

            # Find new attacks (squares now attacked that weren't before)
            new_attacks = attacks_after - attacks_before

            for target_sq in new_attacks:
                target = board_after.piece_at(target_sq)
                if target and target.color != moving_color:
                    # Include knight and bishop as targets (not just rook/queen/king)
                    if target.piece_type in [chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN, chess.KING]:
                        piece_name = self.PIECE_NAMES[piece.piece_type]
                        target_name = self.PIECE_NAMES[target.piece_type]

                        is_discovered_check = board_after.is_check()

                        if is_discovered_check:
                            return TacticInfo(
                                tactic_type='discovered_attack',
                                description=f"Discovered check! {piece_name.capitalize()} reveals attack on {target_name}",
                                squares_involved=[chess.square_name(sq), chess.square_name(move.from_square),
                                                chess.square_name(target_sq)]
                            )
                        else:
                            return TacticInfo(
                                tactic_type='discovered_attack',
                                description=f"Discovered attack: {piece_name.capitalize()} now attacks {target_name} on {chess.square_name(target_sq)}",
                                squares_involved=[chess.square_name(sq), chess.square_name(move.from_square),
                                                chess.square_name(target_sq)]
                            )

        return None

    def _check_pin(self, board: chess.Board, move: chess.Move) -> Optional[TacticInfo]:
        """
        Check if the move creates a pin — absolute (to king) or relative (to queen/rook).
        """
        moving_piece = board.piece_at(move.from_square)
        if not moving_piece:
            return None

        # Only sliding pieces can create pins
        if moving_piece.piece_type not in [chess.BISHOP, chess.ROOK, chess.QUEEN]:
            return None

        board_after = board.copy()
        board_after.push(move)

        enemy_color = not moving_piece.color

        # Check absolute pins (to king) — use python-chess built-in
        for sq in chess.SQUARES:
            piece = board_after.piece_at(sq)
            if not piece or piece.color != enemy_color:
                continue
            if piece.piece_type == chess.KING:
                continue

            if board_after.is_pinned(enemy_color, sq):
                pin_mask = board_after.pin(enemy_color, sq)
                if move.to_square in pin_mask:
                    pinned_name = self.PIECE_NAMES[piece.piece_type]
                    pinner_name = self.PIECE_NAMES[moving_piece.piece_type]

                    return TacticInfo(
                        tactic_type='pin',
                        description=f"{pinner_name.capitalize()} pins {pinned_name} to the king",
                        squares_involved=[chess.square_name(move.to_square), chess.square_name(sq)]
                    )

        # Check relative pins (to queen or rook) — manual ray check
        directions = []
        if moving_piece.piece_type in [chess.ROOK, chess.QUEEN]:
            directions.extend([(0, 1), (0, -1), (1, 0), (-1, 0)])
        if moving_piece.piece_type in [chess.BISHOP, chess.QUEEN]:
            directions.extend([(1, 1), (1, -1), (-1, 1), (-1, -1)])

        to_file = chess.square_file(move.to_square)
        to_rank = chess.square_rank(move.to_square)

        for df, dr in directions:
            pieces_on_ray = []
            f, r = to_file + df, to_rank + dr

            while 0 <= f <= 7 and 0 <= r <= 7:
                sq = chess.square(f, r)
                piece = board_after.piece_at(sq)
                if piece:
                    pieces_on_ray.append((sq, piece))
                    if len(pieces_on_ray) >= 2:
                        break
                    # Continue to find second piece
                f += df
                r += dr

            if len(pieces_on_ray) >= 2:
                front_sq, front_piece = pieces_on_ray[0]
                back_sq, back_piece = pieces_on_ray[1]

                # Relative pin: both enemy, front is less valuable, back is queen or rook
                if (front_piece.color == enemy_color and
                    back_piece.color == enemy_color and
                    back_piece.piece_type in [chess.QUEEN, chess.ROOK] and
                    self.PIECE_VALUES.get(front_piece.piece_type, 0) < self.PIECE_VALUES.get(back_piece.piece_type, 0)):

                    front_name = self.PIECE_NAMES[front_piece.piece_type]
                    back_name = self.PIECE_NAMES[back_piece.piece_type]
                    pinner_name = self.PIECE_NAMES[moving_piece.piece_type]

                    return TacticInfo(
                        tactic_type='pin',
                        description=f"{pinner_name.capitalize()} pins {front_name} to the {back_name}",
                        squares_involved=[chess.square_name(move.to_square),
                                        chess.square_name(front_sq),
                                        chess.square_name(back_sq)]
                    )

        return None

    def _check_skewer(self, board: chess.Board, move: chess.Move) -> Optional[TacticInfo]:
        """
        Check if the move creates a skewer (attack on piece with another piece behind).
        Also detects when front and back are equal value but front is attacked.
        """
        moving_piece = board.piece_at(move.from_square)
        if not moving_piece:
            return None

        # Only sliding pieces can skewer
        if moving_piece.piece_type not in [chess.BISHOP, chess.ROOK, chess.QUEEN]:
            return None

        board_after = board.copy()
        board_after.push(move)

        enemy_color = not moving_piece.color

        directions = []
        if moving_piece.piece_type in [chess.ROOK, chess.QUEEN]:
            directions.extend([(0, 1), (0, -1), (1, 0), (-1, 0)])
        if moving_piece.piece_type in [chess.BISHOP, chess.QUEEN]:
            directions.extend([(1, 1), (1, -1), (-1, 1), (-1, -1)])

        to_file = chess.square_file(move.to_square)
        to_rank = chess.square_rank(move.to_square)

        for df, dr in directions:
            pieces_on_ray = []
            f, r = to_file + df, to_rank + dr

            while 0 <= f <= 7 and 0 <= r <= 7:
                sq = chess.square(f, r)
                piece = board_after.piece_at(sq)
                if piece:
                    if piece.color == enemy_color:
                        pieces_on_ray.append((sq, piece))
                    break  # Stop at any piece
                f += df
                r += dr

            # Continue along ray for second piece
            if len(pieces_on_ray) == 1:
                f, r = f + df, r + dr
                while 0 <= f <= 7 and 0 <= r <= 7:
                    sq = chess.square(f, r)
                    piece = board_after.piece_at(sq)
                    if piece:
                        if piece.color == enemy_color:
                            pieces_on_ray.append((sq, piece))
                        break
                    f += df
                    r += dr

            if len(pieces_on_ray) >= 2:
                front_sq, front_piece = pieces_on_ray[0]
                back_sq, back_piece = pieces_on_ray[1]

                front_value = self.PIECE_VALUES.get(front_piece.piece_type, 0)
                back_value = self.PIECE_VALUES.get(back_piece.piece_type, 0)

                # Skewer: front piece is more valuable or equal (king, or value >= back)
                # Also include equal-value skewers (e.g. rook skewering rook)
                if (front_piece.piece_type == chess.KING or
                    front_value > back_value or
                    (front_value == back_value and front_value >= 300)):
                    front_name = self.PIECE_NAMES[front_piece.piece_type]
                    back_name = self.PIECE_NAMES[back_piece.piece_type]

                    return TacticInfo(
                        tactic_type='skewer',
                        description=f"Skewer: {front_name.capitalize()} attacked, {back_name} behind will be captured",
                        squares_involved=[chess.square_name(move.to_square),
                                        chess.square_name(front_sq),
                                        chess.square_name(back_sq)]
                    )

        return None

    def _check_back_rank(self, board: chess.Board, move: chess.Move) -> Optional[TacticInfo]:
        """
        Check if the move threatens or delivers back rank mate, or exploits
        back rank weakness (rook/queen invading with weak king shelter).
        """
        moving_piece = board.piece_at(move.from_square)
        if not moving_piece:
            return None

        # Only rooks and queens for back rank themes
        if moving_piece.piece_type not in [chess.ROOK, chess.QUEEN]:
            return None

        board_after = board.copy()
        board_after.push(move)

        enemy_color = not moving_piece.color
        enemy_king_sq = board_after.king(enemy_color)
        if enemy_king_sq is None:
            return None

        king_rank = chess.square_rank(enemy_king_sq)
        back_rank = 0 if enemy_color == chess.WHITE else 7

        # Check if it's checkmate
        if board_after.is_checkmate():
            if king_rank == back_rank:
                return TacticInfo(
                    tactic_type='back_rank',
                    description="Back rank checkmate!",
                    squares_involved=[chess.square_name(move.to_square),
                                    chess.square_name(enemy_king_sq)]
                )

        # Check if it delivers check on back rank
        if board_after.is_check() and king_rank == back_rank:
            # Check if king has escape squares
            escape_rank = 1 if enemy_color == chess.WHITE else 6
            has_escape = False

            king_file = chess.square_file(enemy_king_sq)
            for df in [-1, 0, 1]:
                f = king_file + df
                if 0 <= f <= 7:
                    escape_sq = chess.square(f, escape_rank)
                    blocking_piece = board_after.piece_at(escape_sq)
                    if blocking_piece and blocking_piece.color == enemy_color:
                        continue
                    if not board_after.is_attacked_by(moving_piece.color, escape_sq):
                        has_escape = True
                        break

            if not has_escape:
                return TacticInfo(
                    tactic_type='back_rank',
                    description="Back rank threat - king has no escape",
                    squares_involved=[chess.square_name(move.to_square),
                                    chess.square_name(enemy_king_sq)]
                )

        # Detect back rank invasion: rook/queen moves to back rank with weak shelter
        move_rank = chess.square_rank(move.to_square)
        if move_rank == back_rank and king_rank == back_rank:
            # King is on back rank and we're invading it
            escape_rank = 1 if enemy_color == chess.WHITE else 6
            blocked_escapes = 0
            total_escapes = 0

            king_file = chess.square_file(enemy_king_sq)
            for df in [-1, 0, 1]:
                f = king_file + df
                if 0 <= f <= 7:
                    total_escapes += 1
                    escape_sq = chess.square(f, escape_rank)
                    blocking_piece = board_after.piece_at(escape_sq)
                    if blocking_piece and blocking_piece.color == enemy_color:
                        blocked_escapes += 1

            if total_escapes > 0 and blocked_escapes >= total_escapes:
                return TacticInfo(
                    tactic_type='back_rank',
                    description="Back rank invasion - king shelter is weak with no escape squares",
                    squares_involved=[chess.square_name(move.to_square),
                                    chess.square_name(enemy_king_sq)]
                )

        return None

    def _check_removal_of_defender(self, board: chess.Board, move: chess.Move) -> Optional[TacticInfo]:
        """
        Check if the move captures a piece that was defending something.
        Threshold lowered to include any undefended piece (pawn or higher).
        """
        if not board.is_capture(move):
            return None

        moving_piece = board.piece_at(move.from_square)
        if not moving_piece:
            return None

        captured_sq = move.to_square
        if board.is_en_passant(move):
            captured_sq = chess.square(chess.square_file(move.to_square),
                                       chess.square_rank(move.from_square))

        captured_piece = board.piece_at(captured_sq)
        if not captured_piece:
            return None

        # What was the captured piece defending?
        defended_squares = board.attacks(captured_sq)

        board_after = board.copy()
        board_after.push(move)

        for sq in defended_squares:
            piece = board_after.piece_at(sq)
            if piece and piece.color != moving_piece.color:
                attackers = board_after.attackers(moving_piece.color, sq)
                defenders = board_after.attackers(not moving_piece.color, sq)

                if attackers and not defenders:
                    piece_value = self.PIECE_VALUES.get(piece.piece_type, 0)
                    # Lowered: any piece worth at least a pawn
                    if piece_value >= 100:
                        captured_name = self.PIECE_NAMES[captured_piece.piece_type]
                        target_name = self.PIECE_NAMES[piece.piece_type]

                        return TacticInfo(
                            tactic_type='removal_of_defender',
                            description=f"Removing defender: capturing {captured_name} leaves {target_name} on {chess.square_name(sq)} undefended",
                            squares_involved=[chess.square_name(move.to_square), chess.square_name(sq)]
                        )

        return None

    def _check_zwischenzug(self, board: chess.Board, move: chess.Move) -> Optional[TacticInfo]:
        """
        Check if the move is a zwischenzug (in-between move).
        Detects checks, captures, and major threats as intermediate moves.
        """
        moving_piece = board.piece_at(move.from_square)
        if not moving_piece:
            return None

        board_after = board.copy()
        board_after.push(move)

        # Check if there was a recent capture that could be recaptured
        if len(board.move_stack) == 0:
            return None

        last_move = board.move_stack[-1]
        if not board.is_capture(last_move):
            return None

        # Opponent just captured something. Instead of recapturing,
        # we're playing an intermediate move. Valid if:
        # 1. It's a check (classic zwischenzug)
        if board_after.is_check():
            return TacticInfo(
                tactic_type='zwischenzug',
                description="Zwischenzug! Check before recapture gains tempo",
                squares_involved=[chess.square_name(move.to_square),
                                chess.square_name(last_move.to_square)]
            )

        # 2. It captures a more valuable piece (upgrade capture)
        if board.is_capture(move):
            our_capture_target = board.piece_at(move.to_square)
            their_capture_target = board.piece_at(last_move.to_square)
            if our_capture_target and their_capture_target:
                our_value = self.PIECE_VALUES.get(our_capture_target.piece_type, 0)
                their_value = self.PIECE_VALUES.get(their_capture_target.piece_type, 0)
                if our_value > their_value:
                    return TacticInfo(
                        tactic_type='zwischenzug',
                        description=f"Zwischenzug! Capturing {self.PIECE_NAMES[our_capture_target.piece_type]} before recapturing",
                        squares_involved=[chess.square_name(move.to_square),
                                        chess.square_name(last_move.to_square)]
                    )

        # 3. It attacks the enemy queen or creates a mate threat
        attacked_squares = board_after.attacks(move.to_square)
        for sq in attacked_squares:
            target = board_after.piece_at(sq)
            if target and target.color != moving_piece.color and target.piece_type == chess.QUEEN:
                return TacticInfo(
                    tactic_type='zwischenzug',
                    description="Zwischenzug! Attacking queen before recapture",
                    squares_involved=[chess.square_name(move.to_square),
                                    chess.square_name(sq),
                                    chess.square_name(last_move.to_square)]
                )

        return None

    def _check_deflection(self, board: chess.Board, move: chess.Move) -> Optional[TacticInfo]:
        """
        Check if the move forces a defender away from a key square.
        Loosened: any piece defending something worth a knight+.
        """
        moving_piece = board.piece_at(move.from_square)
        if not moving_piece:
            return None

        board_after = board.copy()
        board_after.push(move)

        target_piece = board.piece_at(move.to_square)
        if not target_piece or target_piece.color == moving_piece.color:
            return None

        # What is this target piece currently defending?
        defended_by_target = board.attacks(move.to_square)

        for sq in defended_by_target:
            piece = board.piece_at(sq)
            if piece and piece.color != moving_piece.color and piece.piece_type != chess.KING:
                # Skip if we already attack this piece directly
                if sq in board.attacks(move.from_square) or sq in board_after.attacks(move.to_square):
                    continue

                defended_value = self.PIECE_VALUES.get(piece.piece_type, 0)

                # Lowered: defended piece just needs to be worth a pawn or more
                if defended_value >= 100:
                    # Check if we actually have an attacker on that piece
                    our_attackers = board_after.attackers(moving_piece.color, sq)
                    if our_attackers:
                        target_name = self.PIECE_NAMES[target_piece.piece_type]
                        defended_name = self.PIECE_NAMES[piece.piece_type]

                        return TacticInfo(
                            tactic_type='deflection',
                            description=f"Deflection: attacking {target_name} which defends the {defended_name} on {chess.square_name(sq)}",
                            squares_involved=[chess.square_name(move.to_square), chess.square_name(sq)]
                        )

        return None

    def _check_trapped_piece(self, board: chess.Board, move: chess.Move) -> Optional[TacticInfo]:
        """
        Check if the move traps an enemy piece (piece has no safe squares to move to).
        """
        moving_piece = board.piece_at(move.from_square)
        if not moving_piece:
            return None

        board_after = board.copy()
        board_after.push(move)

        enemy_color = not moving_piece.color

        # Check if any enemy piece is now attacked and has no safe retreat
        attacked_squares = board_after.attacks(move.to_square)
        for sq in attacked_squares:
            target = board_after.piece_at(sq)
            if not target or target.color != enemy_color:
                continue
            # Only interesting for pieces worth a knight or more
            if target.piece_type in [chess.PAWN, chess.KING]:
                continue

            target_value = self.PIECE_VALUES.get(target.piece_type, 0)
            if target_value < 300:
                continue

            # Check if target has any safe square to move to
            has_safe_square = False
            for legal_move in board_after.legal_moves:
                if legal_move.from_square == sq:
                    # Simulate the escape
                    board_escape = board_after.copy()
                    board_escape.push(legal_move)
                    # Check if landing square is safe
                    if not board_escape.is_attacked_by(moving_piece.color, legal_move.to_square):
                        has_safe_square = True
                        break

            if not has_safe_square:
                # Check that the piece is actually attacked (not just has no moves)
                attackers = board_after.attackers(moving_piece.color, sq)
                if attackers:
                    target_name = self.PIECE_NAMES[target.piece_type]
                    return TacticInfo(
                        tactic_type='fork',  # Classified under fork since no separate UI category
                        description=f"Trapped {target_name}! No safe squares to escape on {chess.square_name(sq)}",
                        squares_involved=[chess.square_name(move.to_square), chess.square_name(sq)]
                    )

        return None

    def _check_overloaded_piece(self, board: chess.Board, move: chess.Move) -> Optional[TacticInfo]:
        """
        Check if the move exploits an overloaded defender (piece defending multiple things).
        """
        moving_piece = board.piece_at(move.from_square)
        if not moving_piece:
            return None

        # Must be a capture to test overloading
        if not board.is_capture(move):
            return None

        captured_piece = board.piece_at(move.to_square)
        if not captured_piece:
            return None

        enemy_color = captured_piece.color

        # Check if a single defender was protecting both the captured piece
        # and something else valuable
        defenders_of_captured = board.attackers(enemy_color, move.to_square)

        board_after = board.copy()
        board_after.push(move)

        for defender_sq in defenders_of_captured:
            defender = board.piece_at(defender_sq)
            if not defender:
                continue

            # What else is this defender protecting?
            defender_attacks = board.attacks(defender_sq)
            for other_sq in defender_attacks:
                other_piece = board.piece_at(other_sq)
                if not other_piece or other_piece.color != enemy_color:
                    continue
                if other_sq == move.to_square:
                    continue  # Same square

                other_value = self.PIECE_VALUES.get(other_piece.piece_type, 0)
                if other_value < 300:
                    continue

                # After our capture, if the defender recaptures, is the other piece left hanging?
                # Check if defender is the sole defender of other_piece
                other_defenders = board.attackers(enemy_color, other_sq)
                other_attackers = board.attackers(moving_piece.color, other_sq)

                if other_attackers and defender_sq in other_defenders and len(other_defenders) <= 2:
                    defender_name = self.PIECE_NAMES[defender.piece_type]
                    other_name = self.PIECE_NAMES[other_piece.piece_type]

                    return TacticInfo(
                        tactic_type='deflection',  # Overloading is a type of deflection
                        description=f"Overloaded {defender_name}: defends both captured piece and {other_name} on {chess.square_name(other_sq)}",
                        squares_involved=[chess.square_name(move.to_square),
                                        chess.square_name(defender_sq),
                                        chess.square_name(other_sq)]
                    )

        return None


def analyze_best_move_tactic(fen_before: str, best_move_uci: str) -> Optional[Dict[str, Any]]:
    """
    Convenience function to analyze a best move for tactical themes.

    Args:
        fen_before: FEN string of position before the move
        best_move_uci: The engine's best move in UCI format

    Returns:
        Dictionary with tactic info or None if no tactic detected
    """
    analyzer = TacticAnalyzer()
    result = analyzer.analyze_best_move_tactic(fen_before, best_move_uci)

    if result:
        return asdict(result)
    return None
