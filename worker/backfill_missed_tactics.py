#!/usr/bin/env python3
"""
Backfill Missed Tactics Script
Analyzes existing moves to detect missed tactical opportunities.

For each move classified as inaccuracy/mistake/blunder, analyzes the engine's
best move to determine what tactic was missed.
"""

import os
import sys
import json
import argparse
from typing import Optional
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

from tactic_analyzer import analyze_best_move_tactic

# Load environment variables
load_dotenv()


def connect_to_database():
    """Connect to Supabase PostgreSQL database"""
    try:
        conn = psycopg2.connect(
            host=os.getenv('SUPABASE_HOST', 'db.your-project.supabase.co'),
            database=os.getenv('SUPABASE_DB', 'postgres'),
            user=os.getenv('SUPABASE_USER', 'postgres'),
            password=os.getenv('SUPABASE_PASSWORD'),
            port=os.getenv('SUPABASE_PORT', '5432'),
            keepalives=1,
            keepalives_idle=30,
            keepalives_interval=10,
            keepalives_count=5,
        )
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        raise


def get_moves_to_analyze(conn, limit: Optional[int] = None, offset: int = 0, reanalyze: bool = False):
    """
    Fetch moves that need tactic analysis.

    Returns moves where:
    - classification is inaccuracy, mistake, or blunder
    - best_move_uci is available
    - position_fen_before is available
    - missed_tactic_type hasn't been set yet (unless reanalyze=True)
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    if reanalyze:
        # Re-analyze ALL moves, including already-processed ones
        query = """
            SELECT m.id, m.position_fen_before, m.best_move_uci, m.blunder_details,
                   m.classification, m.eval_delta, m.ply, m.game_id
            FROM moves m
            WHERE m.classification IN ('inaccuracy', 'mistake', 'blunder')
              AND m.best_move_uci IS NOT NULL
              AND m.position_fen_before IS NOT NULL
            ORDER BY m.id
            OFFSET %s
        """
    else:
        query = """
            SELECT m.id, m.position_fen_before, m.best_move_uci, m.blunder_details,
                   m.classification, m.eval_delta, m.ply, m.game_id
            FROM moves m
            WHERE m.classification IN ('inaccuracy', 'mistake', 'blunder')
              AND m.best_move_uci IS NOT NULL
              AND m.position_fen_before IS NOT NULL
              AND (
                  m.blunder_details IS NULL
                  OR m.blunder_details->>'missed_tactic_type' IS NULL
              )
            ORDER BY m.id
            OFFSET %s
        """

    params = [offset]
    if limit:
        query += " LIMIT %s"
        params.append(limit)

    cursor.execute(query, params)
    moves = cursor.fetchall()
    cursor.close()

    return moves


def update_move_tactic(conn, move_id: str, tactic_info: dict, existing_details: Optional[dict]):
    """Update move with missed tactic information."""
    cursor = conn.cursor()

    # Merge with existing blunder_details
    if existing_details:
        if isinstance(existing_details, str):
            existing_details = json.loads(existing_details)
        updated_details = {**existing_details}
    else:
        updated_details = {}

    # Add tactic information
    updated_details['missed_tactic_type'] = tactic_info['tactic_type']
    updated_details['missed_tactic_description'] = tactic_info['description']
    updated_details['missed_tactic_squares'] = tactic_info['squares_involved']
    if tactic_info.get('piece_sacrificed'):
        updated_details['missed_tactic_sacrifice'] = tactic_info['piece_sacrificed']

    cursor.execute("""
        UPDATE moves
        SET blunder_details = %s
        WHERE id = %s
    """, (json.dumps(updated_details), move_id))

    cursor.close()


def backfill_missed_tactics(limit: Optional[int] = None, batch_size: int = 100, dry_run: bool = False, reanalyze: bool = False):
    """
    Main backfill function.

    Args:
        limit: Maximum number of moves to process (None for all)
        batch_size: Number of moves to process before committing
        dry_run: If True, don't actually update the database
        reanalyze: If True, re-analyze all moves including already-processed ones
    """
    conn = connect_to_database()

    processed = 0
    tactics_found = 0
    offset = 0

    tactic_counts = {}

    print("Starting missed tactics backfill...")
    print(f"  Batch size: {batch_size}")
    print(f"  Limit: {limit or 'No limit'}")
    print(f"  Dry run: {dry_run}")
    print(f"  Reanalyze: {reanalyze}")
    print()

    try:
        while True:
            # Fetch a batch of moves
            moves = get_moves_to_analyze(conn, limit=batch_size, offset=offset, reanalyze=reanalyze)

            if not moves:
                break

            for move in moves:
                if limit and processed >= limit:
                    break

                move_id = move['id']
                fen_before = move['position_fen_before']
                best_move_uci = move['best_move_uci']
                existing_details = move['blunder_details']

                # Analyze the best move for tactics
                tactic_info = analyze_best_move_tactic(fen_before, best_move_uci)

                if tactic_info:
                    tactic_type = tactic_info['tactic_type']
                    tactic_counts[tactic_type] = tactic_counts.get(tactic_type, 0) + 1
                    tactics_found += 1

                    if not dry_run:
                        update_move_tactic(conn, move_id, tactic_info, existing_details)

                    if processed < 10 or processed % 100 == 0:
                        print(f"  Move {move_id}: Found {tactic_type} - {tactic_info['description'][:50]}...")

                processed += 1

                if processed % batch_size == 0:
                    if not dry_run:
                        conn.commit()
                    print(f"Progress: {processed} moves processed, {tactics_found} tactics found")

            if limit and processed >= limit:
                break

            offset += batch_size

        # Final commit
        if not dry_run:
            conn.commit()

        print()
        print("=" * 50)
        print("Backfill complete!")
        print(f"  Total moves processed: {processed}")
        print(f"  Tactics found: {tactics_found}")
        if processed > 0:
            print(f"  Detection rate: {tactics_found / processed * 100:.1f}%")
        print()
        print("Tactics by type:")
        for tactic_type, count in sorted(tactic_counts.items(), key=lambda x: -x[1]):
            print(f"  {tactic_type}: {count}")

    except Exception as e:
        print(f"Error during backfill: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Backfill missed tactics for existing moves")
    parser.add_argument("--limit", type=int, help="Maximum number of moves to process")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size for commits")
    parser.add_argument("--dry-run", action="store_true", help="Don't update database, just show what would be done")
    parser.add_argument("--reanalyze", action="store_true", help="Re-analyze all moves, including already-processed ones")

    args = parser.parse_args()

    backfill_missed_tactics(
        limit=args.limit,
        batch_size=args.batch_size,
        dry_run=args.dry_run,
        reanalyze=args.reanalyze
    )


if __name__ == "__main__":
    main()
