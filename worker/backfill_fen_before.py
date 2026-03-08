"""
Backfill position_fen_before for existing moves by replaying games.
"""

import os
import io
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import chess
import chess.pgn

load_dotenv()


def get_connection():
    return psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'),
        database=os.getenv('SUPABASE_DB'),
        user=os.getenv('SUPABASE_USER'),
        password=os.getenv('SUPABASE_PASSWORD'),
        port=os.getenv('SUPABASE_PORT'),
    )


def backfill():
    conn = get_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    # Get games that need backfill (position_fen_before is NULL for at least one move)
    cursor.execute("""
        SELECT DISTINCT g.id, g.pgn, g.played_at
        FROM games g
        JOIN moves m ON m.game_id = g.id
        WHERE m.position_fen_before IS NULL
        ORDER BY g.played_at
    """)
    games = cursor.fetchall()
    cursor.close()
    conn.close()

    print(f"Processing {len(games)} games that need backfill...", flush=True)

    for i, game_row in enumerate(games):
        game_id = game_row['id']
        pgn_text = game_row['pgn']

        if not pgn_text:
            continue

        try:
            # Parse PGN
            pgn_io = io.StringIO(pgn_text)
            game = chess.pgn.read_game(pgn_io)
            if not game:
                continue

            board = game.board()
            ply = 1

            # Get fresh connection for each game to avoid timeout
            conn = get_connection()
            update_cursor = conn.cursor()

            for move in game.mainline_moves():
                fen_before = board.fen()
                board.push(move)

                # Update this move's position_fen_before
                update_cursor.execute("""
                    UPDATE moves
                    SET position_fen_before = %s
                    WHERE game_id = %s AND ply = %s AND position_fen_before IS NULL
                """, (fen_before, game_id, ply))

                ply += 1

            conn.commit()
            update_cursor.close()
            conn.close()

            if (i + 1) % 20 == 0:
                print(f"Processed {i + 1}/{len(games)} games", flush=True)

        except Exception as e:
            print(f"Error processing game {game_id}: {e}", flush=True)
            try:
                conn.close()
            except:
                pass
            continue

    print(f"Done! Processed {len(games)} games", flush=True)


if __name__ == "__main__":
    backfill()
