"""
Positional Error Classifier
Analyzes mistakes/blunders to identify positional themes:
  - Pawn structure errors (poisoned pawn, structure damage, weak squares, pawn shield)
  - Piece placement errors (queen wandering, trapped piece, passive piece, undeveloped army, knight on rim)
  - King safety errors (delayed castling, king on open file)
  - Defender/coordination errors (removing defender, forced bad recapture, fianchetto bishop loss, blocking own pieces)
  - Strategic errors (bad trades, ignoring center, rook with no open file)

Flags recurring patterns (same error in same opening) so the user can spot habits.
"""

import os
import sys
import json
import argparse
import chess
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Optional, List, Dict, Any, Set, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

USERNAME = 'negrilmannings'

PIECE_VALUES = {
    chess.PAWN: 100,
    chess.KNIGHT: 320,
    chess.BISHOP: 330,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,
}

PIECE_NAMES = {
    chess.PAWN: 'pawn', chess.KNIGHT: 'knight', chess.BISHOP: 'bishop',
    chess.ROOK: 'rook', chess.QUEEN: 'queen', chess.KING: 'king',
}


@dataclass
class PositionalError:
    category: str
    subcategory: Optional[str]
    confidence: float
    explanation: str
    details: Dict[str, Any]


# ---------------------------------------------------------------------------
# Pawn structure helpers
# ---------------------------------------------------------------------------

def get_pawn_files(board: chess.Board, color: chess.Color) -> Dict[int, List[int]]:
    """Return {file: [squares]} for all pawns of a color."""
    files: Dict[int, List[int]] = {}
    for sq in board.pieces(chess.PAWN, color):
        f = chess.square_file(sq)
        files.setdefault(f, []).append(sq)
    return files


def count_doubled(board: chess.Board, color: chess.Color) -> int:
    return sum(1 for sqs in get_pawn_files(board, color).values() if len(sqs) > 1)


def get_isolated_pawns(board: chess.Board, color: chess.Color) -> List[int]:
    pf = get_pawn_files(board, color)
    isolated = []
    for f, sqs in pf.items():
        has_neighbor = any((f + d) in pf for d in (-1, 1))
        if not has_neighbor:
            isolated.extend(sqs)
    return isolated


def is_file_open(board: chess.Board, file: int, color: chess.Color) -> str:
    """Return 'open', 'semi_open', or 'closed'."""
    friendly_pawns = any(
        chess.square_file(sq) == file for sq in board.pieces(chess.PAWN, color)
    )
    enemy_pawns = any(
        chess.square_file(sq) == file for sq in board.pieces(chess.PAWN, not color)
    )
    if not friendly_pawns and not enemy_pawns:
        return 'open'
    if not friendly_pawns:
        return 'semi_open'
    return 'closed'


def king_is_castled(board: chess.Board, color: chess.Color) -> Optional[str]:
    """Return 'kingside', 'queenside', or None."""
    king_sq = board.king(color)
    if king_sq is None:
        return None
    f = chess.square_file(king_sq)
    r = chess.square_rank(king_sq)
    back_rank = 0 if color == chess.WHITE else 7
    if r != back_rank and r != (back_rank + (1 if color == chess.WHITE else -1)):
        return None
    if f >= 6:
        return 'kingside'
    if f <= 2:
        return 'queenside'
    return None


def pawn_shield_squares(board: chess.Board, color: chess.Color) -> List[int]:
    """Return the pawn shield squares in front of the castled king."""
    side = king_is_castled(board, color)
    if not side:
        return []
    shield_rank = 1 if color == chess.WHITE else 6
    if side == 'kingside':
        files = [5, 6, 7]
    else:
        files = [0, 1, 2]
    return [chess.square(f, shield_rank) for f in files]


def count_undeveloped_minors(board: chess.Board, color: chess.Color) -> int:
    """Count minor pieces still on their starting squares."""
    if color == chess.WHITE:
        starts = {chess.B1: chess.KNIGHT, chess.G1: chess.KNIGHT,
                  chess.C1: chess.BISHOP, chess.F1: chess.BISHOP}
    else:
        starts = {chess.B8: chess.KNIGHT, chess.G8: chess.KNIGHT,
                  chess.C8: chess.BISHOP, chess.F8: chess.BISHOP}
    count = 0
    for sq, expected in starts.items():
        p = board.piece_at(sq)
        if p and p.color == color and p.piece_type == expected:
            count += 1
    return count


# ---------------------------------------------------------------------------
# Detectors — each returns Optional[PositionalError]
# ---------------------------------------------------------------------------

def detect_fianchetto_bishop_loss(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    piece = board_before.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.BISHOP:
        return None
    fian_squares_w = {chess.G2: 'kingside', chess.B2: 'queenside'}
    fian_squares_b = {chess.G7: 'kingside', chess.B7: 'queenside'}
    fian = fian_squares_w if color == chess.WHITE else fian_squares_b
    if move.from_square not in fian:
        return None
    side = fian[move.from_square]
    castled = king_is_castled(board_before, color)
    if castled != side:
        return None
    is_capture = board_before.is_capture(move)
    conf = 0.9 if is_capture else 0.75
    sq_name = chess.square_name(move.from_square)
    return PositionalError(
        category='fianchetto_bishop_loss', subcategory=side,
        confidence=conf,
        explanation=f"Fianchetto bishop on {sq_name} lost while king castled {side}",
        details={'square': sq_name, 'side': side, 'was_trade': is_capture}
    )


def detect_pawn_shield_damage(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    piece = board_before.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.PAWN:
        return None
    if eval_loss < 30:
        return None
    shields = pawn_shield_squares(board_before, color)
    if move.from_square not in shields:
        return None
    sq_name = chess.square_name(move.from_square)
    already_advanced = sum(
        1 for s in shields
        if s != move.from_square and not board_before.piece_at(s)
    )
    conf = 0.9 if already_advanced >= 1 else 0.8
    return PositionalError(
        category='pawn_shield_damage', subcategory=None,
        confidence=conf,
        explanation=f"Pushed pawn shield pawn on {sq_name} in front of castled king",
        details={'square': sq_name, 'other_shield_pawns_missing': already_advanced}
    )


def detect_king_on_open_file(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    king_sq = board_after.king(color)
    if king_sq is None:
        return None
    king_file = chess.square_file(king_sq)
    status = is_file_open(board_after, king_file, color)
    if status == 'closed':
        return None
    enemy_heavy = any(
        board_after.piece_at(sq) and board_after.piece_at(sq).piece_type in (chess.ROOK, chess.QUEEN)
        for sq in board_after.pieces(chess.ROOK, not color) | board_after.pieces(chess.QUEEN, not color)
        if chess.square_file(sq) == king_file
    )
    if not enemy_heavy and status != 'open':
        return None
    conf = 0.85 if enemy_heavy else 0.65
    return PositionalError(
        category='king_on_open_file', subcategory=status,
        confidence=conf,
        explanation=f"King on {status} {chess.FILE_NAMES[king_file]}-file" +
                    (" with enemy heavy piece" if enemy_heavy else ""),
        details={'file': chess.FILE_NAMES[king_file], 'status': status, 'enemy_heavy': enemy_heavy}
    )


def detect_piece_trapped(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    piece = board_before.piece_at(move.from_square)
    if not piece or piece.piece_type in (chess.PAWN, chess.KING):
        return None
    if eval_loss < 100:
        return None
    # After making the move, does the piece have any safe squares?
    has_safe = False
    for lm in board_after.legal_moves:
        if lm.from_square == move.to_square:
            test = board_after.copy()
            test.push(lm)
            if not test.is_attacked_by(not color, lm.to_square):
                has_safe = True
                break
    if has_safe:
        return None
    # Is the piece attacked?
    if not board_after.is_attacked_by(not color, move.to_square):
        return None
    pname = PIECE_NAMES[piece.piece_type]
    sq = chess.square_name(move.to_square)
    return PositionalError(
        category='piece_trapped', subcategory=pname,
        confidence=0.9,
        explanation=f"{pname.capitalize()} trapped on {sq} with no safe retreat",
        details={'piece': pname, 'square': sq}
    )


def detect_poisoned_pawn(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    if not board_before.is_capture(move):
        return None
    captured = board_before.piece_at(move.to_square)
    if not captured or captured.piece_type != chess.PAWN:
        return None
    if eval_loss < 80:
        return None
    piece = board_before.piece_at(move.from_square)
    if not piece:
        return None
    was_defended = bool(board_before.attackers(not color, move.to_square))
    pname = PIECE_NAMES[piece.piece_type]
    sq = chess.square_name(move.to_square)
    conf = 0.85 if was_defended else 0.7
    return PositionalError(
        category='poisoned_pawn', subcategory=None,
        confidence=conf,
        explanation=f"{pname.capitalize()} grabbed {'defended ' if was_defended else ''}pawn on {sq}, lost {eval_loss}cp",
        details={'piece': pname, 'square': sq, 'defended': was_defended, 'eval_loss': eval_loss}
    )


def detect_knight_on_rim(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    piece = board_before.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.KNIGHT:
        return None
    dest_file = chess.square_file(move.to_square)
    if dest_file not in (0, 7):
        return None
    if eval_loss < 40:
        return None
    sq = chess.square_name(move.to_square)
    conf = 0.85 if eval_loss > 80 else 0.65
    return PositionalError(
        category='knight_on_rim', subcategory=None,
        confidence=conf,
        explanation=f"Knight moved to rim square {sq} — controls fewer squares",
        details={'square': sq, 'eval_loss': eval_loss}
    )


def detect_queen_wandering(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, ply: int = 0, **kw
) -> Optional[PositionalError]:
    piece = board_before.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.QUEEN:
        return None
    if ply > 20:
        return None
    if eval_loss < 30:
        return None
    undeveloped = count_undeveloped_minors(board_before, color)
    if undeveloped < 1:
        return None
    # Count prior queen moves for this color
    queen_moves = 0
    temp = board_before.copy()
    while temp.move_stack:
        m = temp.pop()
        if len(temp.move_stack) % 2 == (0 if color == chess.WHITE else 1):
            p = temp.piece_at(m.from_square)
            if p and p.piece_type == chess.QUEEN and p.color == color:
                queen_moves += 1
    conf = 0.85 if queen_moves >= 2 else 0.7
    return PositionalError(
        category='queen_wandering', subcategory=None,
        confidence=conf,
        explanation=f"Queen move #{queen_moves+1} before move 10 with {undeveloped} undeveloped minor piece(s)",
        details={'queen_moves_so_far': queen_moves + 1, 'undeveloped_minors': undeveloped}
    )


def detect_delayed_castling(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, ply: int = 0, **kw
) -> Optional[PositionalError]:
    if ply < 16:
        return None
    if eval_loss < 30:
        return None
    if not board_before.has_castling_rights(color):
        return None
    king_sq = board_before.king(color)
    if king_sq is None:
        return None
    if chess.square_file(king_sq) != 4:
        return None
    if board_before.is_castling(move):
        return None
    # Check if center is open
    center_open = False
    for f in (3, 4):
        if is_file_open(board_before, f, color) != 'closed':
            center_open = True
    conf = 0.8 if center_open else 0.6
    return PositionalError(
        category='delayed_castling', subcategory='open_center' if center_open else 'closed_center',
        confidence=conf,
        explanation=f"King still in center at ply {ply}" +
                    (" with open center files" if center_open else "") +
                    " — missed chance to castle",
        details={'ply': ply, 'center_open': center_open, 'has_castling_rights': True}
    )


def detect_removing_key_defender(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    if eval_loss < 80:
        return None
    piece = board_before.piece_at(move.from_square)
    if not piece or piece.piece_type == chess.KING:
        return None
    # What friendly pieces was this piece defending?
    defended_before = []
    for sq in board_before.attacks(move.from_square):
        p = board_before.piece_at(sq)
        if p and p.color == color and p.piece_type != chess.KING:
            defended_before.append(sq)
    if not defended_before:
        return None
    # After the move, are any of those pieces now undefended and attacked?
    exposed = []
    for sq in defended_before:
        p = board_after.piece_at(sq)
        if not p or p.color != color:
            continue
        if board_after.is_attacked_by(not color, sq):
            defenders = board_after.attackers(color, sq)
            if not defenders:
                exposed.append((sq, p))
    if not exposed:
        return None
    worst = max(exposed, key=lambda x: PIECE_VALUES.get(x[1].piece_type, 0))
    wsq, wp = worst
    pname = PIECE_NAMES[piece.piece_type]
    wname = PIECE_NAMES[wp.piece_type]
    return PositionalError(
        category='removing_key_defender', subcategory=None,
        confidence=0.85,
        explanation=f"Moving {pname} left {wname} on {chess.square_name(wsq)} undefended and attacked",
        details={'moved_piece': pname, 'exposed_piece': wname,
                 'exposed_square': chess.square_name(wsq)}
    )


def detect_structure_damage(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    if eval_loss < 30:
        return None
    doubled_before = count_doubled(board_before, color)
    doubled_after = count_doubled(board_after, color)
    iso_before = len(get_isolated_pawns(board_before, color))
    iso_after = len(get_isolated_pawns(board_after, color))
    new_doubled = doubled_after - doubled_before
    new_isolated = iso_after - iso_before
    if new_doubled <= 0 and new_isolated <= 0:
        return None
    problems = []
    if new_doubled > 0:
        problems.append(f"{new_doubled} new doubled pawn(s)")
    if new_isolated > 0:
        problems.append(f"{new_isolated} new isolated pawn(s)")
    sub = 'doubled' if new_doubled > 0 else 'isolated'
    conf = 0.8 if eval_loss > 50 else 0.6
    return PositionalError(
        category='structure_damage', subcategory=sub,
        confidence=conf,
        explanation=f"Created {', '.join(problems)}",
        details={'new_doubled': new_doubled, 'new_isolated': new_isolated, 'eval_loss': eval_loss}
    )


def detect_weak_square_creation(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    piece = board_before.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.PAWN:
        return None
    if eval_loss < 40:
        return None
    # Squares that were pawn-defended before but not after
    direction = 1 if color == chess.WHITE else -1
    center_files = {2, 3, 4, 5}
    center_ranks = {2, 3, 4, 5}
    lost_defense = []
    from_file = chess.square_file(move.from_square)
    from_rank = chess.square_rank(move.from_square)
    # Pawn on from_square defended diagonals ahead
    for df in (-1, 1):
        def_file = from_file + df
        def_rank = from_rank + direction
        if 0 <= def_file <= 7 and 0 <= def_rank <= 7:
            def_sq = chess.square(def_file, def_rank)
            # Was it defended by this pawn? Now check if any other pawn still defends it
            still_defended = False
            for other_sq in board_after.pieces(chess.PAWN, color):
                other_file = chess.square_file(other_sq)
                other_rank = chess.square_rank(other_sq)
                if abs(other_file - def_file) == 1 and other_rank + direction == def_rank + direction:
                    # Actually check: pawn defends the square ahead diagonally
                    if other_rank == def_rank - direction:
                        still_defended = True
                        break
            if not still_defended and def_file in center_files and def_rank in center_ranks:
                lost_defense.append(chess.square_name(def_sq))
    if not lost_defense:
        return None
    conf = 0.75 if any(
        chess.SQUARE_NAMES.index(s) in (chess.D4, chess.D5, chess.E4, chess.E5)
        for s in lost_defense
    ) else 0.6
    return PositionalError(
        category='weak_square_creation', subcategory=None,
        confidence=conf,
        explanation=f"Pawn push left weak square(s): {', '.join(lost_defense)}",
        details={'weak_squares': lost_defense}
    )


def detect_undeveloped_army(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, ply: int = 0, **kw
) -> Optional[PositionalError]:
    if ply < 10:
        return None
    if eval_loss < 30:
        return None
    undeveloped = count_undeveloped_minors(board_before, color)
    if undeveloped < 2:
        return None
    # Is this move developing a new piece?
    piece = board_before.piece_at(move.from_square)
    if piece and piece.piece_type in (chess.KNIGHT, chess.BISHOP):
        if color == chess.WHITE:
            home_squares = {chess.B1, chess.G1, chess.C1, chess.F1}
        else:
            home_squares = {chess.B8, chess.G8, chess.C8, chess.F8}
        if move.from_square in home_squares:
            return None  # This IS a developing move
    conf = 0.8 if undeveloped >= 3 else 0.7
    return PositionalError(
        category='undeveloped_army', subcategory=None,
        confidence=conf,
        explanation=f"{undeveloped} minor pieces still undeveloped at ply {ply}",
        details={'undeveloped_count': undeveloped, 'ply': ply}
    )


def detect_rook_no_open_file(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, ply: int = 0, **kw
) -> Optional[PositionalError]:
    piece = board_before.piece_at(move.from_square)
    if not piece or piece.piece_type != chess.ROOK:
        return None
    if eval_loss < 40:
        return None
    dest_file = chess.square_file(move.to_square)
    dest_status = is_file_open(board_after, dest_file, color)
    if dest_status != 'closed':
        return None
    # Are there open/semi-open files available?
    open_files = []
    for f in range(8):
        s = is_file_open(board_after, f, color)
        if s in ('open', 'semi_open'):
            open_files.append(chess.FILE_NAMES[f])
    if not open_files:
        return None
    return PositionalError(
        category='rook_no_open_file', subcategory=None,
        confidence=0.75,
        explanation=f"Rook moved to closed {chess.FILE_NAMES[dest_file]}-file; open file(s) available: {', '.join(open_files)}",
        details={'dest_file': chess.FILE_NAMES[dest_file], 'open_files': open_files}
    )


def detect_blocking_own_pieces(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    if eval_loss < 50:
        return None
    # Check if any friendly sliding piece lost attack squares because of this move
    blocked_pieces = []
    for sq in chess.SQUARES:
        p = board_before.piece_at(sq)
        if not p or p.color != color:
            continue
        if p.piece_type not in (chess.BISHOP, chess.ROOK, chess.QUEEN):
            continue
        if sq == move.from_square:
            continue
        attacks_before = len(board_before.attacks(sq))
        p_after = board_after.piece_at(sq)
        if not p_after or p_after.color != color:
            continue
        attacks_after = len(board_after.attacks(sq))
        lost = attacks_before - attacks_after
        if lost >= 3:
            blocked_pieces.append((sq, p, lost))
    if not blocked_pieces:
        return None
    worst = max(blocked_pieces, key=lambda x: x[2])
    wsq, wp, lost = worst
    pname = PIECE_NAMES[wp.piece_type]
    return PositionalError(
        category='blocking_own_pieces', subcategory=None,
        confidence=0.7,
        explanation=f"Blocked {pname} on {chess.square_name(wsq)}, reducing its attack squares by {lost}",
        details={'blocked_piece': pname, 'blocked_square': chess.square_name(wsq), 'squares_lost': lost}
    )


def detect_bad_trades(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    if not board_before.is_capture(move):
        return None
    if eval_loss < 50:
        return None
    piece = board_before.piece_at(move.from_square)
    captured = board_before.piece_at(move.to_square)
    if not piece or not captured:
        return None
    pv = PIECE_VALUES.get(piece.piece_type, 0)
    cv = PIECE_VALUES.get(captured.piece_type, 0)
    # Only same-value trades (not outright blunders)
    if abs(pv - cv) > 50:
        return None
    # Compare activity: squares attacked
    own_attacks = len(board_before.attacks(move.from_square))
    enemy_attacks = len(board_before.attacks(move.to_square))
    if own_attacks <= enemy_attacks * 1.5:
        return None
    pname = PIECE_NAMES[piece.piece_type]
    cname = PIECE_NAMES[captured.piece_type]
    return PositionalError(
        category='bad_trades', subcategory=None,
        confidence=0.7,
        explanation=f"Traded active {pname} ({own_attacks} squares) for passive {cname} ({enemy_attacks} squares)",
        details={'own_piece': pname, 'own_activity': own_attacks,
                 'captured_piece': cname, 'captured_activity': enemy_attacks}
    )


def detect_ignoring_center(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, ply: int = 0, **kw
) -> Optional[PositionalError]:
    if eval_loss < 40:
        return None
    if ply > 30:
        return None
    # Count opponent central pawns
    center_squares = {chess.D4, chess.D5, chess.E4, chess.E5}
    enemy_center = 0
    for sq in center_squares:
        p = board_before.piece_at(sq)
        if p and p.color != color and p.piece_type == chess.PAWN:
            enemy_center += 1
    if enemy_center < 2:
        return None
    # Is our move on the wing and not challenging center?
    dest_file = chess.square_file(move.to_square)
    if dest_file in (2, 3, 4, 5):
        return None  # Move IS in the center area
    # Check if move attacks any center squares
    piece_attacks = board_after.attacks(move.to_square)
    challenges_center = any(sq in piece_attacks for sq in center_squares)
    if challenges_center:
        return None
    return PositionalError(
        category='ignoring_center', subcategory=None,
        confidence=0.65,
        explanation=f"Opponent has {enemy_center} central pawns; wing move doesn't challenge center",
        details={'enemy_center_pawns': enemy_center, 'dest_file': chess.FILE_NAMES[dest_file]}
    )


def detect_forced_bad_recapture(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    if eval_loss < 60:
        return None
    piece = board_before.piece_at(move.from_square)
    if not piece:
        return None
    # After our move, is our piece on a square attacked by opponent?
    if not board_after.is_attacked_by(not color, move.to_square):
        return None
    # If opponent captures there, would a pawn recapture create doubled pawns?
    for enemy_move in board_after.legal_moves:
        if enemy_move.to_square != move.to_square:
            continue
        if not board_after.is_capture(enemy_move):
            continue
        test_board = board_after.copy()
        test_board.push(enemy_move)
        # Can we recapture with a pawn?
        for recapture in test_board.legal_moves:
            if recapture.to_square != move.to_square:
                continue
            recap_piece = test_board.piece_at(recapture.from_square)
            if not recap_piece or recap_piece.piece_type != chess.PAWN:
                continue
            # Would this recapture create doubled pawns?
            recap_file = chess.square_file(recapture.to_square)
            recap_board = test_board.copy()
            recap_board.push(recapture)
            pf = get_pawn_files(recap_board, color)
            if recap_file in pf and len(pf[recap_file]) > 1:
                return PositionalError(
                    category='forced_bad_recapture', subcategory='doubled_pawns',
                    confidence=0.65,
                    explanation=f"Move allows exchange that forces pawn recapture creating doubled pawns on {chess.FILE_NAMES[recap_file]}-file",
                    details={'file': chess.FILE_NAMES[recap_file]}
                )
        break
    return None


def detect_passive_piece(
    board_before: chess.Board, move: chess.Move, board_after: chess.Board,
    color: chess.Color, eval_loss: int, **kw
) -> Optional[PositionalError]:
    piece = board_before.piece_at(move.from_square)
    if not piece or piece.piece_type in (chess.PAWN, chess.KING):
        return None
    if eval_loss < 50:
        return None
    # Piece retreated toward own back rank?
    direction = 1 if color == chess.WHITE else -1
    from_rank = chess.square_rank(move.from_square)
    to_rank = chess.square_rank(move.to_square)
    rank_diff = (to_rank - from_rank) * direction
    if rank_diff >= 0:
        return None  # Not retreating
    attacks_before = len(board_before.attacks(move.from_square))
    attacks_after = len(board_after.attacks(move.to_square))
    if attacks_before == 0 or attacks_after >= attacks_before * 0.6:
        return None
    pname = PIECE_NAMES[piece.piece_type]
    return PositionalError(
        category='passive_piece', subcategory=pname,
        confidence=0.7,
        explanation=f"{pname.capitalize()} retreated from {chess.square_name(move.from_square)} to {chess.square_name(move.to_square)}, "
                    f"losing activity ({attacks_before} → {attacks_after} squares)",
        details={'piece': pname, 'from': chess.square_name(move.from_square),
                 'to': chess.square_name(move.to_square),
                 'attacks_before': attacks_before, 'attacks_after': attacks_after}
    )


# ---------------------------------------------------------------------------
# Classifier orchestrator
# ---------------------------------------------------------------------------

DETECTORS = [
    detect_fianchetto_bishop_loss,
    detect_pawn_shield_damage,
    detect_king_on_open_file,
    detect_piece_trapped,
    detect_poisoned_pawn,
    detect_knight_on_rim,
    detect_queen_wandering,
    detect_delayed_castling,
    detect_removing_key_defender,
    detect_structure_damage,
    detect_weak_square_creation,
    detect_undeveloped_army,
    detect_rook_no_open_file,
    detect_blocking_own_pieces,
    detect_bad_trades,
    detect_forced_bad_recapture,
    detect_passive_piece,
    detect_ignoring_center,
]

MIN_CONFIDENCE = 0.5


def classify_move(
    fen_before: str, move_uci: str, eval_loss: int, ply: int, is_white: bool
) -> List[PositionalError]:
    """Classify a single move into positional error categories.
    Returns all matching categories above MIN_CONFIDENCE, sorted by confidence."""
    board_before = chess.Board(fen_before)
    move = chess.Move.from_uci(move_uci)
    board_after = board_before.copy()
    board_after.push(move)
    color = chess.WHITE if is_white else chess.BLACK

    results = []
    for detector in DETECTORS:
        try:
            r = detector(
                board_before=board_before, move=move, board_after=board_after,
                color=color, eval_loss=eval_loss, ply=ply,
            )
            if r and r.confidence >= MIN_CONFIDENCE:
                results.append(r)
        except Exception:
            continue

    results.sort(key=lambda x: x.confidence, reverse=True)
    return results


# ---------------------------------------------------------------------------
# Database runner
# ---------------------------------------------------------------------------

def connect_db():
    return psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'),
        port=int(os.getenv('SUPABASE_PORT', 6543)),
        dbname=os.getenv('SUPABASE_DB'),
        user=os.getenv('SUPABASE_USER'),
        password=os.getenv('SUPABASE_PASSWORD'),
        sslmode='require',
    )


def ensure_tables(conn):
    """Create tables if they don't exist."""
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS positional_errors (
            id SERIAL PRIMARY KEY,
            game_id UUID NOT NULL,
            move_ply INTEGER NOT NULL,
            category VARCHAR(50) NOT NULL,
            subcategory VARCHAR(50),
            confidence NUMERIC(3,2) NOT NULL,
            explanation TEXT,
            details JSONB,
            eval_loss INTEGER,
            opening_name VARCHAR(200),
            eco VARCHAR(10),
            phase VARCHAR(20),
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(game_id, move_ply, category)
        );

        CREATE INDEX IF NOT EXISTS idx_pos_errors_game ON positional_errors(game_id);
        CREATE INDEX IF NOT EXISTS idx_pos_errors_category ON positional_errors(category);

        CREATE TABLE IF NOT EXISTS positional_recurring_patterns (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) NOT NULL,
            category VARCHAR(50) NOT NULL,
            opening_name VARCHAR(200),
            eco VARCHAR(10),
            occurrence_count INTEGER DEFAULT 0,
            avg_eval_loss NUMERIC(10,2),
            total_eval_loss INTEGER DEFAULT 0,
            example_game_ids UUID[],
            example_fens TEXT[],
            example_explanations TEXT[],
            first_seen TIMESTAMPTZ,
            last_seen TIMESTAMPTZ,
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(username, category, eco, opening_name)
        );

        CREATE INDEX IF NOT EXISTS idx_pos_recurring_user ON positional_recurring_patterns(username);
    """)
    conn.commit()
    cur.close()


def get_moves_to_classify(conn, username: str, limit: Optional[int] = None, reanalyze: bool = False):
    """Fetch mistake/blunder moves with position data."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    query = """
        SELECT m.game_id, m.ply, m.move_uci, m.eval_before, m.eval_after,
               m.eval_delta, m.classification, m.phase,
               m.position_fen_before, m.piece_moved,
               g.opening_name, g.eco, g.white_player, g.played_at
        FROM moves m
        JOIN games g ON m.game_id = g.id
        WHERE g.username = %s
          AND m.classification IN ('inaccuracy', 'mistake', 'blunder')
          AND m.position_fen_before IS NOT NULL
          AND m.move_uci IS NOT NULL
    """
    params = [username]

    if not reanalyze:
        query += """
          AND NOT EXISTS (
              SELECT 1 FROM positional_errors pe
              WHERE pe.game_id = m.game_id AND pe.move_ply = m.ply
          )
        """

    query += " ORDER BY g.played_at DESC"
    if limit:
        query += " LIMIT %s"
        params.append(limit)

    cur.execute(query, params)
    rows = cur.fetchall()
    cur.close()
    return rows


def store_errors(conn, errors: List[Tuple[dict, PositionalError]]):
    """Batch insert positional errors."""
    if not errors:
        return
    cur = conn.cursor()
    for move_row, err in errors:
        try:
            cur.execute("""
                INSERT INTO positional_errors
                    (game_id, move_ply, category, subcategory, confidence,
                     explanation, details, eval_loss, opening_name, eco, phase)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (game_id, move_ply, category) DO UPDATE SET
                    confidence = EXCLUDED.confidence,
                    explanation = EXCLUDED.explanation,
                    details = EXCLUDED.details,
                    eval_loss = EXCLUDED.eval_loss
            """, (
                move_row['game_id'], move_row['ply'],
                err.category, err.subcategory, err.confidence,
                err.explanation, json.dumps(err.details),
                abs(move_row.get('eval_delta', 0) or 0),
                move_row.get('opening_name'), move_row.get('eco'),
                move_row.get('phase'),
            ))
        except Exception as e:
            print(f"  Error storing: {e}", flush=True)
            conn.rollback()
            continue
    conn.commit()
    cur.close()


def compute_recurring_patterns(conn, username: str, min_occurrences: int = 3):
    """Group positional errors by category + opening and flag recurring ones."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT pe.category, pe.eco, pe.opening_name,
               COUNT(*) as cnt,
               AVG(pe.eval_loss) as avg_loss,
               SUM(pe.eval_loss) as total_loss,
               MIN(g.played_at) as first_seen,
               MAX(g.played_at) as last_seen,
               array_agg(DISTINCT pe.game_id::text) as game_ids,
               array_agg(pe.explanation) as explanations
        FROM positional_errors pe
        JOIN games g ON pe.game_id = g.id
        WHERE g.username = %s
        GROUP BY pe.category, pe.eco, pe.opening_name
        HAVING COUNT(*) >= %s
        ORDER BY COUNT(*) DESC
    """, (username, min_occurrences))
    patterns = cur.fetchall()
    cur.close()

    if not patterns:
        print("No recurring patterns found.", flush=True)
        return

    cur = conn.cursor()
    for p in patterns:
        game_ids = list(set(str(g) for g in p['game_ids']))[:10]
        explanations = list(set(p['explanations']))[:5]
        try:
            cur.execute("""
                INSERT INTO positional_recurring_patterns
                    (username, category, opening_name, eco, occurrence_count,
                     avg_eval_loss, total_eval_loss, example_game_ids,
                     example_explanations, first_seen, last_seen, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s::uuid[], %s, %s, %s, NOW())
                ON CONFLICT (username, category, eco, opening_name)
                DO UPDATE SET
                    occurrence_count = EXCLUDED.occurrence_count,
                    avg_eval_loss = EXCLUDED.avg_eval_loss,
                    total_eval_loss = EXCLUDED.total_eval_loss,
                    example_game_ids = EXCLUDED.example_game_ids,
                    example_explanations = EXCLUDED.example_explanations,
                    first_seen = EXCLUDED.first_seen,
                    last_seen = EXCLUDED.last_seen,
                    updated_at = NOW()
            """, (
                username, p['category'], p['opening_name'], p['eco'],
                p['cnt'], p['avg_loss'], p['total_loss'],
                game_ids, explanations, p['first_seen'], p['last_seen'],
            ))
        except Exception as e:
            print(f"  Error storing pattern: {e}", flush=True)
            conn.rollback()
            continue
    conn.commit()
    cur.close()
    print(f"Found {len(patterns)} recurring patterns (>= {min_occurrences} occurrences)", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Classify positional errors in chess games")
    parser.add_argument("--username", default=USERNAME)
    parser.add_argument("--limit", type=int, help="Limit moves to process")
    parser.add_argument("--reanalyze", action="store_true", help="Re-classify already processed moves")
    parser.add_argument("--min-recurring", type=int, default=3, help="Min occurrences for recurring pattern")
    parser.add_argument("--dry-run", action="store_true", help="Print results without storing")
    args = parser.parse_args()

    conn = connect_db()
    ensure_tables(conn)

    print(f"Fetching moves for {args.username}...", flush=True)
    moves = get_moves_to_classify(conn, args.username, args.limit, args.reanalyze)
    print(f"Found {len(moves)} moves to classify", flush=True)

    if not moves:
        print("Nothing to do.", flush=True)
        conn.close()
        return

    total_errors = 0
    category_counts: Dict[str, int] = {}
    batch: List[Tuple[dict, PositionalError]] = []
    batch_size = 100

    for i, move_row in enumerate(moves):
        is_white = move_row['white_player'].lower() == args.username.lower()
        # Determine which color's move this is based on ply
        move_is_white = move_row['ply'] % 2 == 1
        # Only classify user's moves
        if is_white != move_is_white:
            continue

        eval_loss = abs(move_row.get('eval_delta', 0) or 0)
        results = classify_move(
            fen_before=move_row['position_fen_before'],
            move_uci=move_row['move_uci'],
            eval_loss=eval_loss,
            ply=move_row['ply'],
            is_white=is_white,
        )

        for err in results:
            total_errors += 1
            category_counts[err.category] = category_counts.get(err.category, 0) + 1
            if args.dry_run:
                print(f"  [{err.category}] {err.explanation} (conf={err.confidence:.2f})", flush=True)
            else:
                batch.append((move_row, err))

        if not args.dry_run and len(batch) >= batch_size:
            store_errors(conn, batch)
            batch = []

        if (i + 1) % 500 == 0:
            print(f"  Processed {i+1}/{len(moves)} moves, {total_errors} errors found", flush=True)

    if not args.dry_run and batch:
        store_errors(conn, batch)

    print(f"\nClassification complete:", flush=True)
    print(f"  Moves processed: {len(moves)}", flush=True)
    print(f"  Positional errors found: {total_errors}", flush=True)
    print(f"\n  By category:", flush=True)
    for cat, count in sorted(category_counts.items(), key=lambda x: -x[1]):
        print(f"    {cat}: {count}", flush=True)

    if not args.dry_run:
        print(f"\nComputing recurring patterns...", flush=True)
        compute_recurring_patterns(conn, args.username, args.min_recurring)

    conn.close()
    print("\nDone!", flush=True)


if __name__ == '__main__':
    main()
