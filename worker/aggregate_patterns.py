"""
Aggregate blunder patterns from analyzed moves into the blunder_patterns table.
Groups mistakes/blunders by (username, category, phase, piece) and computes
occurrence counts, eval loss stats, and example positions.

Usage:
    python aggregate_patterns.py <username>
    python aggregate_patterns.py <username> --since 2025-01-01
    python aggregate_patterns.py <username> --count-only
"""

import os
import argparse
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()


class PatternAggregator:
    """Aggregates move-level blunder data into the blunder_patterns table."""

    def __init__(self):
        self.db_conn = self._connect_to_database()
        self.patterns_upserted = 0
        self.patterns_deleted = 0

    def _connect_to_database(self):
        try:
            conn = psycopg2.connect(
                host=os.getenv("SUPABASE_HOST"),
                port=os.getenv("SUPABASE_PORT"),
                database=os.getenv("SUPABASE_DB"),
                user=os.getenv("SUPABASE_USER"),
                password=os.getenv("SUPABASE_PASSWORD"),
                sslmode=os.getenv("PGSSLMODE", "require"),
            )
            return conn
        except Exception as e:
            print(f"Error connecting to database: {e}")
            raise

    def aggregate(self, username: str, since: Optional[str] = None):
        """
        Aggregate blunder patterns for a user.
        Full recalculation: queries all matching moves, groups, and upserts.
        """
        print(f"Aggregating patterns for {username}...")
        start_time = datetime.now()

        cursor = self.db_conn.cursor(cursor_factory=RealDictCursor)
        try:
            # Query: group mistakes by (category, phase, piece_moved)
            # Filter to user's own moves using ply parity
            query = """
                SELECT
                    g.username,
                    m.blunder_category,
                    m.phase,
                    m.piece_moved,
                    COUNT(*) as occurrence_count,
                    SUM(ABS(m.eval_delta)) as total_eval_loss,
                    ROUND(AVG(ABS(m.eval_delta)), 2) as avg_eval_loss,
                    MIN(g.played_at) as first_seen,
                    MAX(g.played_at) as last_seen,
                    -- Collect game_ids and FENs ordered by severity (worst first)
                    array_agg(m.game_id ORDER BY ABS(m.eval_delta) DESC) as all_game_ids,
                    array_agg(m.position_fen ORDER BY ABS(m.eval_delta) DESC) as all_fens
                FROM moves m
                JOIN games g ON m.game_id = g.id
                WHERE m.classification IN ('mistake', 'blunder')
                  AND m.blunder_category IS NOT NULL
                  AND g.username = %s
                  AND (
                    (LOWER(g.username) = LOWER(g.white_player) AND m.ply %% 2 = 1)
                    OR (LOWER(g.username) = LOWER(g.black_player) AND m.ply %% 2 = 0)
                  )
            """
            params = [username]

            if since:
                query += " AND g.played_at >= %s"
                params.append(since)

            query += " GROUP BY g.username, m.blunder_category, m.phase, m.piece_moved"

            cursor.execute(query, params)
            rows = cursor.fetchall()

            if not rows:
                print("No blunder data found for this user.")
                return

            print(f"Found {len(rows)} distinct pattern groups")

            # If doing a full recalculation (no --since), clear stale patterns first
            if not since:
                delete_cursor = self.db_conn.cursor()
                try:
                    delete_cursor.execute(
                        "DELETE FROM blunder_patterns WHERE username = %s",
                        (username,),
                    )
                    self.patterns_deleted = delete_cursor.rowcount
                    self.db_conn.commit()
                finally:
                    delete_cursor.close()

            # Upsert each pattern group
            upsert_cursor = self.db_conn.cursor()
            try:
                for row in rows:
                    # Take top 5 examples by severity
                    # psycopg2 returns uuid[] as a raw string '{uuid1,uuid2,...}'
                    raw_ids = row["all_game_ids"]
                    if isinstance(raw_ids, str):
                        raw_ids = [x for x in raw_ids.strip('{}').split(',') if x]
                    example_game_ids = raw_ids[:5]
                    example_fens = row["all_fens"][:5]

                    upsert_cursor.execute(
                        """
                        INSERT INTO blunder_patterns (
                            username, category, phase, piece_involved,
                            occurrence_count, total_eval_loss, avg_eval_loss,
                            example_game_ids, example_fens,
                            first_seen, last_seen, updated_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::uuid[], %s, %s, %s, NOW())
                        ON CONFLICT (username, category, phase, piece_involved)
                        DO UPDATE SET
                            occurrence_count = EXCLUDED.occurrence_count,
                            total_eval_loss = EXCLUDED.total_eval_loss,
                            avg_eval_loss = EXCLUDED.avg_eval_loss,
                            example_game_ids = EXCLUDED.example_game_ids,
                            example_fens = EXCLUDED.example_fens,
                            first_seen = EXCLUDED.first_seen,
                            last_seen = EXCLUDED.last_seen,
                            updated_at = NOW()
                        """,
                        (
                            row["username"],
                            row["blunder_category"],
                            row["phase"],
                            row["piece_moved"],
                            row["occurrence_count"],
                            int(row["total_eval_loss"]),
                            float(row["avg_eval_loss"]),
                            example_game_ids,
                            example_fens,
                            row["first_seen"],
                            row["last_seen"],
                        ),
                    )
                    self.patterns_upserted += 1

                self.db_conn.commit()
            finally:
                upsert_cursor.close()

            elapsed = (datetime.now() - start_time).total_seconds()
            print()
            print("=" * 50)
            print("Aggregation complete!")
            if self.patterns_deleted:
                print(f"  Cleared: {self.patterns_deleted} stale patterns")
            print(f"  Upserted: {self.patterns_upserted} patterns")
            print(f"  Time: {elapsed:.1f}s")
            print("=" * 50)

        finally:
            cursor.close()

    def count_patterns(self, username: str):
        """Count existing patterns for a user."""
        cursor = self.db_conn.cursor()
        try:
            cursor.execute(
                "SELECT COUNT(*) FROM blunder_patterns WHERE username = %s",
                (username,),
            )
            return cursor.fetchone()[0]
        finally:
            cursor.close()

    def show_summary(self, username: str):
        """Show a summary of existing patterns."""
        cursor = self.db_conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute(
                """
                SELECT
                    category,
                    SUM(occurrence_count) as total_occurrences,
                    ROUND(AVG(avg_eval_loss), 0) as avg_loss,
                    COUNT(DISTINCT phase) as phases,
                    COUNT(DISTINCT piece_involved) as pieces
                FROM blunder_patterns
                WHERE username = %s
                GROUP BY category
                ORDER BY total_occurrences DESC
                """,
                (username,),
            )
            rows = cursor.fetchall()
            if not rows:
                print(f"No patterns found for {username}")
                return

            print(f"\nPattern Summary for {username}:")
            print("-" * 60)
            print(f"{'Category':<25} {'Count':>6} {'Avg Loss':>10} {'Phases':>7} {'Pieces':>7}")
            print("-" * 60)
            for row in rows:
                print(
                    f"{row['category']:<25} {row['total_occurrences']:>6} "
                    f"{row['avg_loss']:>8}cp {row['phases']:>7} {row['pieces']:>7}"
                )
        finally:
            cursor.close()

    def close(self):
        if self.db_conn:
            self.db_conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="Aggregate blunder patterns from analyzed moves"
    )
    parser.add_argument("username", type=str, help="Username to aggregate patterns for")
    parser.add_argument(
        "--since",
        type=str,
        help="Only include games played since this date (YYYY-MM-DD)",
    )
    parser.add_argument(
        "--count-only",
        action="store_true",
        help="Only count existing patterns, don't aggregate",
    )
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Show summary of existing patterns",
    )
    args = parser.parse_args()

    aggregator = PatternAggregator()

    try:
        if args.count_only:
            count = aggregator.count_patterns(args.username)
            print(f"Existing patterns for {args.username}: {count}")
        elif args.summary:
            aggregator.show_summary(args.username)
        else:
            aggregator.aggregate(args.username, since=args.since)
            aggregator.show_summary(args.username)
    finally:
        aggregator.close()


if __name__ == "__main__":
    main()
