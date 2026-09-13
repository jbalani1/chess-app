"""Static exchange evaluation.

python-chess has no SEE, so do the swap-off by hand: always recapture with the
least valuable attacker, and stop whenever continuing would lose material.
Shared by black_deepdive.py and make_diagrams.py so the counts quoted in the
report and the rows listed in it can never drift apart.
"""
import chess

PV = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}


def value(piece):
    if piece is None:
        return 0
    return 100 if piece.piece_type == chess.KING else PV.get(piece.piece_type, 0)


def _see_square(board, sq):
    """Net gain for the side to move from continuing the exchange on `sq`."""
    caps = [mv for mv in board.legal_moves if mv.to_square == sq and board.is_capture(mv)]
    if not caps:
        return 0
    mv = min(caps, key=lambda m: value(board.piece_at(m.from_square)))
    victim = value(board.piece_at(sq))
    board.push(mv)
    gain = max(0, victim - _see_square(board, sq))
    board.pop()
    return gain


def see_capture(board, move):
    """Material the capturing side nets, in pawns."""
    victim = 1 if board.is_en_passant(move) else value(board.piece_at(move.to_square))
    board.push(move)
    net = victim - _see_square(board, move.to_square)
    board.pop()
    return net


def best_free_capture(board):
    """The most material the side to move can win outright. Returns (pawns, san)."""
    best, best_san = 0, None
    for mv in board.legal_moves:
        if not board.is_capture(mv):
            continue
        gain = see_capture(board, mv)
        if gain > best:
            best, best_san = gain, board.san(mv)
    return best, best_san


def avoidable_drop(board, move):
    """How much material `move` gives away *that another legal move would have
    saved*.

    Asking only "what is hanging after the move" is not enough: a piece can
    already be lost before you move, in which case the move did not drop it.
    So compare the material available to the opponent after this move against
    the least available after any legal move.

    Returns (marginal_pawns, capture_san, gross_pawns, unavoidable_pawns).
    """
    after = board.copy(stack=False)
    after.push(move)
    gross, cap = best_free_capture(after)
    if gross == 0:
        return 0, None, 0, 0

    floor = gross
    for alt in board.legal_moves:
        if alt == move:
            continue
        probe = board.copy(stack=False)
        probe.push(alt)
        g, _ = best_free_capture(probe)
        if g < floor:
            floor = g
            if floor == 0:
                break
    return gross - floor, cap, gross, floor
