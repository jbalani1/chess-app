"""
Re-analyze all games with updated Stockfish settings.

Steps:
1. Fetch any new games from Chess.com into raw_games
2. Delete all analyzed data (games + moves cascade)
3. Reset analyzed_at on all raw_games
4. Re-analyze all games, most recent first
"""

import os
import sys
import json
import time
import io
from datetime import datetime
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor
import chess
import chess.pgn

from engine import get_engine, close_engine
from chess_insights import ChessInsightsAnalyzer
from ingest import ChessComIngester

load_dotenv()


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--resume", action="store_true",
                        help="Resume from where we left off (skip fetch and clear)")
    args = parser.parse_args()

    username = os.getenv("CHESS_COM_USERNAME", "negrilmannings")

    ingester = ChessComIngester()

    try:
        if not args.resume:
            # --- Step 1: Fetch any new games from Chess.com ---
            print("=" * 60)
            print("STEP 1: Fetching new games from Chess.com")
            print("=" * 60)

            archives = ingester.fetch_archives(username)
            if archives:
                # Stage games from all archive months (upserts, so safe to re-run)
                for archive_url in archives:
                    try:
                        parts = archive_url.rstrip("/").split("/")
                        year = int(parts[-2])
                        month = int(parts[-1])
                        ingester.stage_games_for_month(username, year, month)
                        time.sleep(0.2)  # Rate limit
                    except Exception as e:
                        print(f"Error staging {archive_url}: {e}")
                        continue
            else:
                print("No archives found, continuing with existing raw_games")

            # --- Step 2: Clear all analyzed data ---
            print()
            print("=" * 60)
            print("STEP 2: Clearing old analysis data")
            print("=" * 60)

            ingester._ensure_connection()
            cursor = ingester.db_conn.cursor()

            # Count existing games
            cursor.execute("SELECT COUNT(*) FROM games WHERE username = %s", (username,))
            game_count = cursor.fetchone()[0]
            print(f"Deleting {game_count} existing games (moves will cascade)")

            # Delete all games (moves cascade automatically)
            cursor.execute("DELETE FROM games WHERE username = %s", (username,))
            ingester.db_conn.commit()

            # Reset analyzed_at on all raw_games
            cursor.execute(
                "UPDATE raw_games SET analyzed_at = NULL WHERE username = %s",
                (username,),
            )
            ingester.db_conn.commit()
            cursor.close()

            print("Old analysis cleared")
        else:
            print("Resuming - skipping fetch and clear steps")

        # --- Step 3: Re-analyze all games, most recent first ---
        print()
        print("=" * 60)
        print("STEP 3: Re-analyzing all games (depth 22, multi-PV 3)")
        print("=" * 60)

        cursor = ingester.db_conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute(
            """
            SELECT * FROM raw_games
            WHERE username = %s AND analyzed_at IS NULL
            ORDER BY played_at DESC
            """,
            (username,),
        )
        raw_games = cursor.fetchall()
        cursor.close()

        total = len(raw_games)
        print(f"Found {total} games to analyze")
        print()

        analyzed = 0
        failed = 0
        for i, raw in enumerate(raw_games, 1):
            chess_id = raw["chess_com_game_id"]
            played = raw.get("played_at", "unknown")
            print(f"[{i}/{total}] Analyzing {chess_id} (played {played})...")

            try:
                # Force a fresh DB connection before each game to avoid timeouts
                try:
                    ingester.db_conn.close()
                except Exception:
                    pass
                ingester.db_conn = ingester._connect_to_database()

                game = ingester.parse_pgn_game(raw.get("pgn", ""))
                if not game:
                    print(f"  Skipping - could not parse PGN")
                    ingester.mark_raw_analyzed(chess_id)
                    continue

                metadata = ingester.extract_game_metadata(game)
                metadata["pgn"] = raw.get("pgn", "")

                moves_data = ingester.analyze_game_moves(game, username)
                if moves_data:
                    ingester.store_game(metadata, moves_data, username, chess_id)
                    analyzed += 1
                    print(f"  Done - {len(moves_data)} moves analyzed")
                else:
                    print(f"  Skipping - no moves to analyze")

                ingester.mark_raw_analyzed(chess_id)

            except Exception as e:
                print(f"  ERROR: {e}")
                failed += 1
                continue

        print()
        print("=" * 60)
        print(f"COMPLETE: {analyzed} games analyzed, {failed} failed, {total - analyzed - failed} skipped")
        print(f"Engine config: depth={ingester.engine.config['depth']}, "
              f"multi_pv={ingester.engine.config['multi_pv']}, "
              f"threads={ingester.engine.config['threads']}, "
              f"hash={ingester.engine.config['hash_mb']}MB")
        print("=" * 60)

    finally:
        ingester.close()


if __name__ == "__main__":
    main()
