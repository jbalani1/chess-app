"""
Apply blunder taxonomy schema migration.
Safe to run multiple times - checks for existing objects.
"""

import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()


def apply_migration():
    conn = psycopg2.connect(
        host=os.getenv("SUPABASE_HOST"),
        port=os.getenv("SUPABASE_PORT"),
        database=os.getenv("SUPABASE_DB"),
        user=os.getenv("SUPABASE_USER"),
        password=os.getenv("SUPABASE_PASSWORD"),
        sslmode=os.getenv("PGSSLMODE", "require"),
    )
    cursor = conn.cursor()

    try:
        # 1. Create ENUM type if it doesn't exist
        print("Checking blunder_category ENUM type...")
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 FROM pg_type WHERE typname = 'blunder_category'
            )
        """)
        if not cursor.fetchone()[0]:
            print("  Creating blunder_category ENUM...")
            cursor.execute("""
                CREATE TYPE blunder_category AS ENUM (
                    'hanging_piece',
                    'missed_tactic',
                    'overlooked_check',
                    'greedy_capture',
                    'back_rank',
                    'opening_principle',
                    'endgame_technique',
                    'time_pressure',
                    'positional_collapse',
                    'calculation_error'
                )
            """)
            print("  Created!")
        else:
            print("  Already exists.")

        # 2. Add blunder_category column if it doesn't exist
        print("Checking moves.blunder_category column...")
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'moves' AND column_name = 'blunder_category'
            )
        """)
        if not cursor.fetchone()[0]:
            print("  Adding blunder_category column...")
            cursor.execute("""
                ALTER TABLE moves ADD COLUMN blunder_category blunder_category
            """)
            print("  Added!")
        else:
            print("  Already exists.")

        # 3. Add blunder_details column if it doesn't exist
        print("Checking moves.blunder_details column...")
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'moves' AND column_name = 'blunder_details'
            )
        """)
        if not cursor.fetchone()[0]:
            print("  Adding blunder_details column...")
            cursor.execute("""
                ALTER TABLE moves ADD COLUMN blunder_details JSONB
            """)
            print("  Added!")
        else:
            print("  Already exists.")

        # 4. Create index if it doesn't exist
        print("Checking blunder_category index...")
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 FROM pg_indexes
                WHERE indexname = 'idx_moves_blunder_category'
            )
        """)
        if not cursor.fetchone()[0]:
            print("  Creating index...")
            cursor.execute("""
                CREATE INDEX idx_moves_blunder_category ON moves(blunder_category)
                WHERE blunder_category IS NOT NULL
            """)
            print("  Created!")
        else:
            print("  Already exists.")

        # 5. Create blunder_patterns table if it doesn't exist
        print("Checking blunder_patterns table...")
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_name = 'blunder_patterns'
            )
        """)
        if not cursor.fetchone()[0]:
            print("  Creating blunder_patterns table...")
            cursor.execute("""
                CREATE TABLE blunder_patterns (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    username VARCHAR(50) NOT NULL,
                    category blunder_category NOT NULL,
                    phase VARCHAR(20) NOT NULL,
                    piece_involved VARCHAR(10),
                    occurrence_count INTEGER DEFAULT 0,
                    total_eval_loss INTEGER DEFAULT 0,
                    avg_eval_loss NUMERIC(10,2),
                    example_game_ids UUID[],
                    example_fens TEXT[],
                    first_seen TIMESTAMP WITH TIME ZONE,
                    last_seen TIMESTAMP WITH TIME ZONE,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    UNIQUE(username, category, phase, piece_involved)
                )
            """)
            cursor.execute("""
                CREATE INDEX idx_blunder_patterns_username ON blunder_patterns(username)
            """)
            cursor.execute("""
                CREATE INDEX idx_blunder_patterns_category ON blunder_patterns(category)
            """)
            print("  Created!")
        else:
            print("  Already exists.")

        conn.commit()
        print()
        print("=" * 50)
        print("Migration complete!")
        print("=" * 50)

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    apply_migration()
