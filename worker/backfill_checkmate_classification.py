"""
Backfill script to fix checkmate moves that were incorrectly classified as mistakes/blunders.
"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()


def connect_to_database():
    """Connect to Supabase PostgreSQL database"""
    return psycopg2.connect(
        host=os.getenv('SUPABASE_HOST', 'db.your-project.supabase.co'),
        database=os.getenv('SUPABASE_DB', 'postgres'),
        user=os.getenv('SUPABASE_USER', 'postgres'),
        password=os.getenv('SUPABASE_PASSWORD'),
        port=os.getenv('SUPABASE_PORT', '5432'),
    )


def fix_checkmate_classifications():
    """Find and fix checkmate moves that were incorrectly classified."""
    conn = connect_to_database()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Find all moves that end with '#' (checkmate) but are classified as mistake/blunder/inaccuracy
        cursor.execute("""
            SELECT m.id, m.game_id, m.ply, m.move_san, m.classification,
                   m.eval_before, m.eval_after, m.eval_delta,
                   g.result, g.white_player, g.black_player, g.username
            FROM moves m
            JOIN games g ON m.game_id = g.id
            WHERE m.move_san LIKE '%#'
              AND m.classification IN ('mistake', 'blunder', 'inaccuracy')
        """)

        moves_to_fix = cursor.fetchall()
        print(f"Found {len(moves_to_fix)} checkmate moves with incorrect classification")

        fixed_count = 0
        for move in moves_to_fix:
            game_id = move['game_id']
            move_id = move['id']
            ply = move['ply']
            move_san = move['move_san']
            result = move['result']
            username = move['username'].lower()
            white_player = move['white_player'].lower()
            black_player = move['black_player'].lower()
            old_classification = move['classification']

            # Determine if user is White or Black
            is_white = username == white_player

            # Determine who delivered checkmate based on ply
            # Odd ply = White's move, Even ply = Black's move
            white_moved = (ply % 2 == 1)

            # Determine if the user delivered checkmate
            user_delivered_checkmate = (is_white and white_moved) or (not is_white and not white_moved)

            # Also verify by result: 1-0 means White won, 0-1 means Black won
            if result == '1-0':
                winner_is_white = True
            elif result == '0-1':
                winner_is_white = False
            else:
                # Draw or unknown result - skip
                print(f"  Skipping move {move_id} (game {game_id}): result is {result}")
                continue

            # If the move delivers checkmate and the user won, classification should be 'good'
            if user_delivered_checkmate and ((is_white and winner_is_white) or (not is_white and not winner_is_white)):
                # Calculate correct eval values
                # For a checkmate delivered by the user, eval_after should be very favorable
                if is_white:
                    new_eval_after = 10000  # White won
                    new_eval_delta = new_eval_after - (move['eval_before'] or 0)
                else:
                    new_eval_after = -10000  # Black won (negative from White's perspective)
                    new_eval_delta = (move['eval_before'] or 0) - new_eval_after

                cursor.execute("""
                    UPDATE moves
                    SET classification = 'good',
                        eval_after = %s,
                        eval_delta = %s,
                        blunder_category = NULL,
                        blunder_details = NULL
                    WHERE id = %s
                """, (new_eval_after, new_eval_delta, move_id))

                fixed_count += 1
                print(f"  Fixed move {move_id}: {move_san} ({old_classification} -> good)")
            else:
                print(f"  Skipping move {move_id}: {move_san} - user didn't deliver winning checkmate")

        conn.commit()
        print(f"\nFixed {fixed_count} checkmate moves")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    fix_checkmate_classifications()
