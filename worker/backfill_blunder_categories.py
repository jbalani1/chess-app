"""
Backfill blunder categories for existing analyzed moves.
This script classifies already-analyzed moves using eval data
WITHOUT re-running Stockfish or needing pre-move FEN.
"""

import os
import sys
import json
import argparse
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

load_dotenv()


class BlunderBackfiller:
    """Backfills blunder_category for existing moves"""

    def __init__(self):
        self.db_conn = self._connect_to_database()
        self.processed = 0
        self.classified = 0
        self.errors = 0

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

    def get_moves_to_backfill(self, limit: Optional[int] = None, username: Optional[str] = None):
        """Get moves that are mistakes/blunders but have no blunder_category"""
        cursor = self.db_conn.cursor(cursor_factory=RealDictCursor)
        try:
            query = """
                SELECT
                    m.id,
                    m.game_id,
                    m.ply,
                    m.move_san,
                    m.move_uci,
                    m.eval_before,
                    m.eval_after,
                    m.classification,
                    m.piece_moved,
                    m.phase,
                    m.position_fen,
                    m.tactical_motifs,
                    g.username
                FROM moves m
                JOIN games g ON m.game_id = g.id
                WHERE m.classification IN ('mistake', 'blunder')
                  AND m.blunder_category IS NULL
                  AND m.eval_before IS NOT NULL
                  AND m.eval_after IS NOT NULL
            """
            params = []

            if username:
                query += " AND g.username = %s"
                params.append(username)

            query += " ORDER BY g.played_at DESC"

            if limit:
                query += " LIMIT %s"
                params.append(limit)

            cursor.execute(query, params)
            return cursor.fetchall()
        finally:
            cursor.close()

    def classify_from_eval(self, move: dict) -> dict:
        """
        Classify blunder using available eval data.
        This is a simplified classifier that works without needing to replay moves.
        """
        eval_before = move['eval_before']
        eval_after = move['eval_after']
        eval_loss = abs(eval_after - eval_before)
        phase = move['phase']
        move_san = move.get('move_san', '')
        piece_moved = move.get('piece_moved', 'P')
        tactical_motifs = move.get('tactical_motifs')

        # Parse tactical motifs if it's a string
        if isinstance(tactical_motifs, str):
            try:
                tactical_motifs = json.loads(tactical_motifs)
            except:
                tactical_motifs = None

        # Check for specific patterns based on available data

        # 1. Back rank patterns (from tactical motifs)
        if tactical_motifs:
            motif_str = json.dumps(tactical_motifs).lower()
            if 'back_rank' in motif_str or 'back rank' in motif_str:
                return {
                    'category': 'back_rank',
                    'confidence': 0.8,
                    'explanation': 'Back rank weakness detected',
                    'details': {'eval_loss': eval_loss}
                }

        # 2. Opening principle violations
        if phase == 'opening':
            if piece_moved == 'Q':
                return {
                    'category': 'opening_principle',
                    'confidence': 0.7,
                    'explanation': 'Early queen move in opening',
                    'details': {'piece': 'Q', 'eval_loss': eval_loss}
                }
            if piece_moved == 'K' and eval_loss > 100:
                return {
                    'category': 'opening_principle',
                    'confidence': 0.7,
                    'explanation': 'King move in opening (likely missed castling)',
                    'details': {'piece': 'K', 'eval_loss': eval_loss}
                }

        # 3. Endgame technique errors
        if phase == 'endgame':
            return {
                'category': 'endgame_technique',
                'confidence': 0.6,
                'explanation': 'Endgame technique error',
                'details': {'eval_loss': eval_loss}
            }

        # 4. Greedy capture (capture that backfired)
        if 'x' in move_san and eval_loss > 200:
            return {
                'category': 'greedy_capture',
                'confidence': 0.75,
                'explanation': f'Capture lost {eval_loss}cp - possibly took bait',
                'details': {'eval_loss': eval_loss, 'was_capture': True}
            }

        # 5. Large eval swing = calculation error
        if eval_loss > 400:
            return {
                'category': 'calculation_error',
                'confidence': 0.7,
                'explanation': f'Large eval swing ({eval_loss}cp) suggests miscalculation',
                'details': {'eval_loss': eval_loss}
            }

        # 6. Missed tactic (if tactical motifs present)
        if tactical_motifs and len(tactical_motifs) > 0:
            return {
                'category': 'missed_tactic',
                'confidence': 0.65,
                'explanation': 'Tactical opportunity was present',
                'details': {'eval_loss': eval_loss, 'motifs': tactical_motifs}
            }

        # 7. Moderate eval loss = likely hanging piece
        if eval_loss > 150:
            return {
                'category': 'hanging_piece',
                'confidence': 0.6,
                'explanation': 'Material loss suggests piece left undefended',
                'details': {'eval_loss': eval_loss}
            }

        # 8. Default: positional collapse
        return {
            'category': 'positional_collapse',
            'confidence': 0.5,
            'explanation': 'Position deteriorated without clear tactical cause',
            'details': {'eval_loss': eval_loss}
        }

    def backfill_move(self, move: dict):
        """Classify and update a single move"""
        try:
            result = self.classify_from_eval(move)

            cursor = self.db_conn.cursor()
            try:
                cursor.execute(
                    """
                    UPDATE moves
                    SET blunder_category = %s,
                        blunder_details = %s
                    WHERE id = %s
                    """,
                    (
                        result['category'],
                        json.dumps({
                            'confidence': result['confidence'],
                            'explanation': result['explanation'],
                            **result['details']
                        }),
                        move['id'],
                    ),
                )
                self.db_conn.commit()
                self.classified += 1
            finally:
                cursor.close()

        except Exception as e:
            print(f"  Error classifying move {move['id']}: {e}")
            self.errors += 1

    def backfill(self, limit: Optional[int] = None, username: Optional[str] = None, batch_size: int = 100):
        """Run the backfill process"""
        print("Fetching moves to backfill...")
        moves = self.get_moves_to_backfill(limit, username)
        total = len(moves)

        if total == 0:
            print("No moves need backfilling!")
            return

        print(f"Found {total} moves to classify")
        print()

        start_time = datetime.now()

        for i, move in enumerate(moves):
            self.backfill_move(move)
            self.processed += 1

            # Progress update every batch_size moves
            if (i + 1) % batch_size == 0:
                elapsed = (datetime.now() - start_time).total_seconds()
                rate = self.processed / elapsed if elapsed > 0 else 0
                remaining = total - self.processed
                print(f"  Progress: {self.processed}/{total} ({rate:.1f} moves/sec, ~{remaining} remaining)")

        elapsed = (datetime.now() - start_time).total_seconds()
        rate = self.processed / elapsed if elapsed > 0 else 0

        print()
        print("=" * 50)
        print(f"Backfill complete!")
        print(f"  Processed: {self.processed}")
        print(f"  Classified: {self.classified}")
        print(f"  Errors: {self.errors}")
        print(f"  Rate: {rate:.1f} moves/sec")
        print("=" * 50)

    def count_pending(self, username: Optional[str] = None):
        """Count how many moves need backfilling"""
        cursor = self.db_conn.cursor()
        try:
            query = """
                SELECT COUNT(*)
                FROM moves m
                JOIN games g ON m.game_id = g.id
                WHERE m.classification IN ('mistake', 'blunder')
                  AND m.blunder_category IS NULL
                  AND m.eval_before IS NOT NULL
            """
            params = []
            if username:
                query += " AND g.username = %s"
                params.append(username)

            cursor.execute(query, params)
            return cursor.fetchone()[0]
        finally:
            cursor.close()

    def close(self):
        if self.db_conn:
            self.db_conn.close()


def main():
    parser = argparse.ArgumentParser(description="Backfill blunder categories for existing moves")
    parser.add_argument("--limit", type=int, help="Limit number of moves to process")
    parser.add_argument("--username", type=str, help="Only process moves for this user")
    parser.add_argument("--count-only", action="store_true", help="Only count pending moves, don't process")
    parser.add_argument("--batch-size", type=int, default=100, help="Progress update frequency")
    args = parser.parse_args()

    backfiller = BlunderBackfiller()

    try:
        if args.count_only:
            count = backfiller.count_pending(args.username)
            user_str = f" for {args.username}" if args.username else ""
            print(f"Moves pending backfill{user_str}: {count}")
        else:
            backfiller.backfill(
                limit=args.limit,
                username=args.username,
                batch_size=args.batch_size,
            )
    finally:
        backfiller.close()


if __name__ == "__main__":
    main()
