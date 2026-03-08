"""
Backfill captured_piece for all capture moves.
Determines what piece was captured by looking at the position before the move.
"""

import os
import re
import chess
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

PIECE_NAMES = {
    'P': 'pawn',
    'N': 'knight',
    'B': 'bishop',
    'R': 'rook',
    'Q': 'queen',
    'K': 'king',
    'p': 'pawn',
    'n': 'knight',
    'b': 'bishop',
    'r': 'rook',
    'q': 'queen',
    'k': 'king',
}


def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'),
        database=os.getenv('SUPABASE_DB'),
        user=os.getenv('SUPABASE_USER'),
        password=os.getenv('SUPABASE_PASSWORD'),
        port=os.getenv('SUPABASE_PORT'),
        sslmode='require',
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5,
    )


def get_captured_piece(fen_before: str, move_san: str, move_uci: str):
    """Determine what piece was captured in a move."""
    if 'x' not in move_san:
        return None

    try:
        board = chess.Board(fen_before)
        move = chess.Move.from_uci(move_uci)

        # Get the destination square
        to_square = move.to_square

        # Check for en passant
        if board.is_en_passant(move):
            return 'pawn'

        # Get the piece on the destination square
        captured = board.piece_at(to_square)
        if captured:
            return PIECE_NAMES.get(captured.symbol(), None)

        return None
    except Exception as e:
        print(f"Error determining captured piece: {e}")
        return None


def backfill_captured_pieces(batch_size: int = 500):
    """Backfill captured_piece for all capture moves."""
    conn = get_db_connection()

    try:
        # Get all capture moves that don't have captured_piece set
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT COUNT(*) FROM moves
                WHERE move_san LIKE '%x%'
                AND captured_piece IS NULL
            """)
            total = cursor.fetchone()['count']
            print(f"Found {total} capture moves without captured_piece")

        if total == 0:
            print("Nothing to backfill!")
            return

        # Process in batches by game
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT DISTINCT game_id FROM moves
                WHERE move_san LIKE '%x%'
                AND captured_piece IS NULL
            """)
            game_ids = [row['game_id'] for row in cursor.fetchall()]

        print(f"Processing {len(game_ids)} games...")

        processed = 0
        updated = 0

        for game_id in game_ids:
            # Get all moves for this game ordered by ply
            with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT id, ply, move_san, move_uci, position_fen, captured_piece
                    FROM moves
                    WHERE game_id = %s
                    ORDER BY ply
                """, (game_id,))
                moves = cursor.fetchall()

            # Build position before each move
            updates = []
            for i, move in enumerate(moves):
                if 'x' not in move['move_san'] or move['captured_piece']:
                    continue

                # Get position before this move
                if move['ply'] == 1:
                    fen_before = STARTING_FEN
                else:
                    # Find previous move
                    prev_move = next((m for m in moves if m['ply'] == move['ply'] - 1), None)
                    if not prev_move:
                        continue
                    fen_before = prev_move['position_fen']

                captured = get_captured_piece(fen_before, move['move_san'], move['move_uci'])
                if captured:
                    updates.append((captured, move['id']))

            # Batch update
            if updates:
                with conn.cursor() as cursor:
                    cursor.executemany(
                        "UPDATE moves SET captured_piece = %s WHERE id = %s",
                        updates
                    )
                conn.commit()
                updated += len(updates)

            processed += 1
            if processed % 50 == 0:
                print(f"Progress: {processed}/{len(game_ids)} games ({updated} moves updated)")

        print(f"\nBackfill complete!")
        print(f"  Games processed: {processed}")
        print(f"  Moves updated: {updated}")

    finally:
        conn.close()


def show_stats():
    """Show current stats on captured_piece population."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT
                    COUNT(*) FILTER (WHERE move_san LIKE '%x%') as total_captures,
                    COUNT(*) FILTER (WHERE move_san LIKE '%x%' AND captured_piece IS NOT NULL) as with_captured,
                    COUNT(*) FILTER (WHERE move_san LIKE '%x%' AND captured_piece IS NULL) as missing
                FROM moves
            """)
            row = cursor.fetchone()
            print(f"\nCapture Move Stats:")
            print(f"  Total captures: {row['total_captures']}")
            print(f"  With captured_piece: {row['with_captured']}")
            print(f"  Missing: {row['missing']}")
    finally:
        conn.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Backfill captured_piece for capture moves")
    parser.add_argument("--stats", action="store_true", help="Show stats only")
    parser.add_argument("--batch-size", type=int, default=500, help="Batch size")
    args = parser.parse_args()

    if args.stats:
        show_stats()
    else:
        backfill_captured_pieces(batch_size=args.batch_size)
