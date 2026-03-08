"""
Backfill opening_name for games currently marked as 'Unknown Opening'.
Parses the ECOUrl header from the stored PGN to extract the real opening name.
Falls back to ECO code lookup if ECOUrl is not available.
"""
import os
import re
import io
import chess.pgn
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

ECO_MAP = {
    'A00': 'Uncommon Opening', 'A10': 'English Opening', 'A20': 'English Opening',
    'A30': 'English Opening', 'A40': 'Queen Pawn Game', 'A45': 'Trompowsky Attack',
    'A50': 'Indian Defense', 'A80': 'Dutch Defense',
    'B00': 'Uncommon King Pawn', 'B01': 'Scandinavian Defense',
    'B06': 'Modern Defense', 'B07': 'Pirc Defense',
    'B10': 'Caro-Kann Defense', 'B12': 'Caro-Kann Defense',
    'B20': 'Sicilian Defense', 'B30': 'Sicilian Defense',
    'B40': 'Sicilian Defense', 'B50': 'Sicilian Defense',
    'B60': 'Sicilian Najdorf', 'B70': 'Sicilian Dragon',
    'B80': 'Sicilian Scheveningen', 'B90': 'Sicilian Najdorf',
    'C00': 'French Defense', 'C20': 'King Pawn Game',
    'C28': 'Vienna Game', 'C40': 'King Knight Opening',
    'C41': 'Philidor Defense', 'C42': 'Petrov Defense',
    'C44': 'Scotch Game', 'C45': 'Scotch Game',
    'C47': 'Four Knights Game', 'C50': 'Italian Game',
    'C53': 'Italian Game', 'C54': 'Italian Game', 'C55': 'Italian Game',
    'C60': 'Ruy Lopez', 'C68': 'Ruy Lopez',
    'D00': 'Queen Pawn Game', 'D02': 'London System',
    'D10': 'Slav Defense', 'D30': "Queen's Gambit Declined",
    'D50': "Queen's Gambit Declined", 'D70': 'Grunfeld Defense',
    'D80': 'Grunfeld Defense',
    'E00': 'Catalan Opening', 'E10': 'Indian Defense',
    'E20': 'Nimzo-Indian Defense', 'E60': "King's Indian Defense",
    'E70': "King's Indian Defense", 'E90': "King's Indian Defense",
}


def opening_from_eco(eco):
    for length in (len(eco), 2, 1):
        prefix = eco[:length]
        if prefix in ECO_MAP:
            return ECO_MAP[prefix]
    return None


def opening_from_eco_url(eco_url):
    if not eco_url:
        return None
    path = eco_url.rstrip('/').split('/')[-1]
    path = re.split(r'-\d+\.', path)[0]
    name = path.replace('-', ' ').strip()
    return name if name else None


def main():
    conn = psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'),
        database=os.getenv('SUPABASE_DB', 'postgres'),
        user=os.getenv('SUPABASE_USER', 'postgres'),
        password=os.getenv('SUPABASE_PASSWORD'),
        port=os.getenv('SUPABASE_PORT', '5432'),
    )

    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, eco, pgn FROM games WHERE opening_name = 'Unknown Opening' OR opening_name IS NULL")
    rows = cur.fetchall()
    print(f"Found {len(rows)} games to backfill")

    updated = 0
    for row in rows:
        game_id = row['id']
        eco = row.get('eco', '')
        pgn_text = row.get('pgn', '')

        # Try to extract ECOUrl from stored PGN
        opening = None
        if pgn_text:
            game = chess.pgn.read_game(io.StringIO(pgn_text))
            if game:
                eco_url = game.headers.get('ECOUrl', '')
                opening = opening_from_eco_url(eco_url)

        # Fallback to ECO lookup
        if not opening and eco:
            opening = opening_from_eco(eco)

        if opening and opening != 'Unknown Opening':
            cur.execute("UPDATE games SET opening_name = %s WHERE id = %s", (opening, game_id))
            updated += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"Updated {updated}/{len(rows)} games")


if __name__ == '__main__':
    main()
