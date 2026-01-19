"""
Backfill best moves for existing mistake/blunder positions.
Only analyzes positions where user made a mistake/blunder and best_move is not yet populated.
"""

import os
import sys
import chess
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from engine import get_engine, close_engine

load_dotenv()

STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'


def get_db_connection():
    """Connect to Supabase PostgreSQL database"""
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


def get_position_before_move(conn, game_id: str, ply: int) -> str:
    """Get the FEN position before a move was made."""
    if ply == 1:
        return STARTING_FEN

    # Get the position_fen from the previous move (which is the position AFTER that move)
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("""
            SELECT position_fen FROM moves
            WHERE game_id = %s AND ply = %s
        """, (game_id, ply - 1))
        result = cursor.fetchone()
        if result:
            return result['position_fen']

    return STARTING_FEN


def backfill_best_moves(limit: int = None, batch_size: int = 100):
    """
    Backfill best moves for mistakes and blunders.

    Args:
        limit: Maximum number of moves to process (None for all)
        batch_size: Number of moves to commit at once
    """
    conn = get_db_connection()
    engine = get_engine()

    try:
        # Count total moves to process
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT COUNT(*) FROM moves
                WHERE classification IN ('mistake', 'blunder')
                AND best_move_san IS NULL
            """)
            total = cursor.fetchone()[0]
            print(f"Found {total} mistakes/blunders without best move")

        if total == 0:
            print("Nothing to backfill!")
            return

        # Query moves that need backfilling
        query = """
            SELECT id, game_id, ply, move_san, classification, eval_delta
            FROM moves
            WHERE classification IN ('mistake', 'blunder')
            AND best_move_san IS NULL
            ORDER BY game_id, ply
        """
        if limit:
            query += f" LIMIT {limit}"

        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query)
            moves = cursor.fetchall()

        print(f"Processing {len(moves)} moves...")

        processed = 0
        updated = 0
        errors = 0

        for i, move in enumerate(moves):
            try:
                # Get position before this move
                fen_before = get_position_before_move(conn, move['game_id'], move['ply'])

                # Analyze to get best move
                analysis = engine.analyze_position_with_best_move(fen_before)
                best_move_uci = analysis.get('best_move')

                if best_move_uci:
                    # Convert UCI to SAN
                    try:
                        board = chess.Board(fen_before)
                        best_move_obj = chess.Move.from_uci(best_move_uci)
                        if best_move_obj in board.legal_moves:
                            best_move_san = board.san(best_move_obj)
                        else:
                            best_move_san = None
                    except:
                        best_move_san = None

                    if best_move_san:
                        # Update the move record
                        with conn.cursor() as update_cursor:
                            update_cursor.execute("""
                                UPDATE moves
                                SET best_move_san = %s, best_move_uci = %s
                                WHERE id = %s
                            """, (best_move_san, best_move_uci, move['id']))
                        updated += 1

                processed += 1

                # Commit in batches
                if processed % batch_size == 0:
                    conn.commit()
                    print(f"Progress: {processed}/{len(moves)} ({updated} updated, {errors} errors)")

            except Exception as e:
                errors += 1
                print(f"Error processing move {move['id']}: {e}")
                continue

        # Final commit
        conn.commit()
        print(f"\nBackfill complete!")
        print(f"  Processed: {processed}")
        print(f"  Updated: {updated}")
        print(f"  Errors: {errors}")

    finally:
        conn.close()
        close_engine()


def show_stats():
    """Show current stats on best move population."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("""
                SELECT
                    classification,
                    COUNT(*) as total,
                    COUNT(best_move_san) as with_best_move,
                    COUNT(*) - COUNT(best_move_san) as missing_best_move
                FROM moves
                WHERE classification IN ('mistake', 'blunder', 'inaccuracy')
                GROUP BY classification
                ORDER BY classification
            """)
            rows = cursor.fetchall()

            print("\nBest Move Population Stats:")
            print("-" * 60)
            print(f"{'Classification':<15} {'Total':<10} {'Has Best':<12} {'Missing':<10}")
            print("-" * 60)
            for row in rows:
                print(f"{row['classification']:<15} {row['total']:<10} {row['with_best_move']:<12} {row['missing_best_move']:<10}")
    finally:
        conn.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Backfill best moves for mistakes/blunders")
    parser.add_argument("--limit", type=int, help="Limit number of moves to process")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size for commits")
    parser.add_argument("--stats", action="store_true", help="Show stats only, don't backfill")
    args = parser.parse_args()

    if args.stats:
        show_stats()
    else:
        backfill_best_moves(limit=args.limit, batch_size=args.batch_size)
