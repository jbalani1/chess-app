"""The analysis window for the dated report.

A daily ingest keeps adding games, so an unpinned "last 50" query silently
changes what the report is about. Everything that feeds reports/2026-08-20/
pins to this cutoff instead, which makes the numbers reproducible. Bump AS_OF
(and the report's date line) to re-cut the report against fresher games.
"""

USER = 'negrilmannings'
AS_OF = '2026-08-20'   # exclusive: include games played strictly before this
N_BLACK = 50

# SQL fragment + params for "the N most recent games as Black, as of the cutoff"
LAST_BLACK = """
    SELECT id, pgn, result, played_at, white_player, black_player, eco
    FROM games
    WHERE username = %(u)s
      AND LOWER(black_player) = %(u)s
      AND played_at < %(as_of)s
    ORDER BY played_at DESC
    LIMIT %(n)s
"""

PARAMS = {'u': USER, 'as_of': AS_OF, 'n': N_BLACK}
