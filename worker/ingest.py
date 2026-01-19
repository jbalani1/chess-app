"""
Chess.com Game Ingestion Module
Fetches games from Chess.com API and analyzes them with Stockfish
"""

import os
import sys
import json
import time
import requests
import io
import argparse
import chess
import chess.pgn
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

from engine import get_engine, close_engine
from chess_insights import ChessInsightsAnalyzer
from blunder_classifier import classify_move_blunder

# Load environment variables
load_dotenv()

class ChessComIngester:
    """Handles fetching and analyzing Chess.com games"""
    
    def __init__(self):
        """Initialize the ingester with database connection"""
        self.engine = get_engine()
        self.insights_analyzer = ChessInsightsAnalyzer()
        self.db_conn = self._connect_to_database()

    def _ensure_connection(self):
        """Reconnect if the DB connection was closed."""
        if not self.db_conn or self.db_conn.closed:
            self.db_conn = self._connect_to_database()
        
    def _connect_to_database(self):
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
    
    def fetch_games_for_month(self, username: str, year: int, month: int) -> List[Dict[str, Any]]:
        """
        Fetch all games for a user for a specific month
        
        Args:
            username: Chess.com username
            year: Year (e.g., 2024)
            month: Month (1-12)
            
        Returns:
            List of game data dictionaries
        """
        url = f"https://api.chess.com/pub/player/{username}/games/{year:04d}/{month:02d}"
        
        try:
            headers = {
                'User-Agent': os.getenv('CHESSCOM_USER_AGENT', 'chess-analysis-app/1.0 (+https://github.com/)')
            }
            response = requests.get(url, timeout=30, headers=headers)
            response.raise_for_status()
            data = response.json()
            
            games = data.get('games', [])
            print(f"Fetched {len(games)} games for {username} in {year}-{month:02d}")
            return games
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching games from Chess.com: {e}")
            return []

    def fetch_archives(self, username: str) -> List[str]:
        """Fetch monthly archive URLs for a user."""
        url = f"https://api.chess.com/pub/player/{username}/games/archives"
        try:
            headers = {
                'User-Agent': os.getenv('CHESSCOM_USER_AGENT', 'chess-analysis-app/1.0 (+https://github.com/)')
            }
            response = requests.get(url, timeout=30, headers=headers)
            response.raise_for_status()
            data = response.json()
            archives = data.get('archives', [])
            return archives
        except requests.exceptions.RequestException as e:
            print(f"Error fetching archives from Chess.com: {e}")
            return []

    def _build_game_id(self, username: str, played_at: datetime) -> str:
        """Generate deterministic game id for Chess.com game."""
        safe_time = played_at or datetime.now()
        return f"{username}_{safe_time.strftime('%Y%m%d_%H%M%S')}"

    def game_exists(self, chess_com_game_id: str) -> bool:
        """Check if a game is already stored."""
        self._ensure_connection()
        with self.db_conn.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM games WHERE chess_com_game_id = %s",
                (chess_com_game_id,),
            )
            return cursor.fetchone() is not None

    def store_raw_game(self, username: str, chess_com_game_id: str, metadata: Dict[str, Any]):
        """Upsert raw downloaded game."""
        self._ensure_connection()
        cursor = self.db_conn.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO raw_games (chess_com_game_id, username, pgn, time_control, eco, opening_name, result,
                                       white_player, black_player, played_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (chess_com_game_id) DO UPDATE
                SET pgn = EXCLUDED.pgn,
                    time_control = EXCLUDED.time_control,
                    eco = EXCLUDED.eco,
                    opening_name = EXCLUDED.opening_name,
                    result = EXCLUDED.result,
                    white_player = EXCLUDED.white_player,
                    black_player = EXCLUDED.black_player,
                    played_at = EXCLUDED.played_at,
                    downloaded_at = NOW()
                """,
                (
                    chess_com_game_id,
                    username,
                    metadata.get("pgn", ""),
                    metadata.get("time_control"),
                    metadata.get("eco"),
                    metadata.get("opening_name"),
                    metadata.get("result"),
                    metadata.get("white_player"),
                    metadata.get("black_player"),
                    metadata.get("played_at"),
                ),
            )
            self.db_conn.commit()
        finally:
            cursor.close()

    def mark_raw_analyzed(self, chess_com_game_id: str):
        """Mark raw game as analyzed."""
        self._ensure_connection()
        with self.db_conn.cursor() as cursor:
            cursor.execute(
                "UPDATE raw_games SET analyzed_at = NOW() WHERE chess_com_game_id = %s",
                (chess_com_game_id,),
            )
            self.db_conn.commit()

    def get_unanalyzed_raw_games(self, username: str, year: int, month: int, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Return unanalyzed staged games for a month."""
        self._ensure_connection()
        cursor = self.db_conn.cursor(cursor_factory=RealDictCursor)
        try:
            query = """
                SELECT * FROM raw_games
                WHERE username = %s
                  AND analyzed_at IS NULL
                  AND EXTRACT(YEAR FROM played_at) = %s
                  AND EXTRACT(MONTH FROM played_at) = %s
                ORDER BY played_at
            """
            params = [username, year, month]
            if limit:
                query += " LIMIT %s"
                params.append(limit)
            cursor.execute(query, params)
            return cursor.fetchall()
        finally:
            cursor.close()
    
    def get_all_raw_games(self, username: str, year: int, month: int, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Return all staged games for a month (including already analyzed ones)."""
        self._ensure_connection()
        cursor = self.db_conn.cursor(cursor_factory=RealDictCursor)
        try:
            query = """
                SELECT * FROM raw_games
                WHERE username = %s
                  AND EXTRACT(YEAR FROM played_at) = %s
                  AND EXTRACT(MONTH FROM played_at) = %s
                ORDER BY played_at
            """
            params = [username, year, month]
            if limit:
                query += " LIMIT %s"
                params.append(limit)
            cursor.execute(query, params)
            return cursor.fetchall()
        finally:
            cursor.close()
    
    def parse_pgn_game(self, pgn_text: str) -> Optional[chess.pgn.Game]:
        """
        Parse a PGN string into a chess.pgn.Game object
        
        Args:
            pgn_text: PGN string
            
        Returns:
            Parsed game object or None if parsing fails
        """
        try:
            pgn_io = io.StringIO(pgn_text)
            game = chess.pgn.read_game(pgn_io)
            return game
        except Exception as e:
            print(f"Error parsing PGN: {e}")
            return None
    
    def extract_game_metadata(self, game: chess.pgn.Game) -> Dict[str, Any]:
        """
        Extract metadata from a parsed game
        
        Args:
            game: Parsed chess.pgn.Game object
            
        Returns:
            Dictionary with game metadata
        """
        headers = game.headers
        
        # Parse time control
        time_control = headers.get('TimeControl', '')
        if '+' in time_control:
            # Format: "600+5" (10 min + 5 sec increment)
            parts = time_control.split('+')
            base_time = int(parts[0]) if parts[0] != '-' else 0
            increment = int(parts[1]) if len(parts) > 1 else 0
            time_control = f"{base_time//60}+{increment}"
        
        # Parse ECO and opening
        eco = headers.get('ECO', '')
        opening = headers.get('Opening', '')
        
        # If opening is empty, try to extract from PGN or use a default
        if not opening:
            # Try to get opening from other headers
            opening = headers.get('Variation', '') or headers.get('SubVariation', '')
            if not opening:
                opening = 'Unknown Opening'
        
        # Parse result
        result = headers.get('Result', '*')
        
        # Parse players
        white_player = headers.get('White', '')
        black_player = headers.get('Black', '')
        
        # Parse date
        date_str = headers.get('Date', '')
        time_str = headers.get('UTCTime', '')
        
        played_at = None
        if date_str and time_str:
            try:
                datetime_str = f"{date_str} {time_str}"
                played_at = datetime.strptime(datetime_str, '%Y.%m.%d %H:%M:%S')
            except ValueError:
                try:
                    played_at = datetime.strptime(date_str, '%Y.%m.%d')
                except ValueError:
                    played_at = datetime.now()
        else:
            played_at = datetime.now()
        
        return {
            'time_control': time_control,
            'eco': eco,
            'opening_name': opening,
            'result': result,
            'white_player': white_player,
            'black_player': black_player,
            'played_at': played_at
        }
    
    def analyze_game_moves(self, game: chess.pgn.Game, username: str) -> List[Dict[str, Any]]:
        """
        Analyze all moves in a game and return move data
        
        Args:
            game: Parsed chess.pgn.Game object
            username: Username to analyze moves for
            
        Returns:
            List of move analysis dictionaries
        """
        moves_data = []
        board = game.board()
        
        # Determine if user is playing as White or Black
        is_white = game.headers.get('White', '').lower() == username.lower()
        
        ply = 1
        for move in game.mainline_moves():
            # Get position before move
            fen_before = board.fen()
            # eval_before is White-centric from engine
            # Use deeper analysis for critical positions (like Chess.com)
            eval_before = self.engine.analyze_position(fen_before)

            # Convert move to SAN (must be before pushing)
            move_san = board.san(move)
            # Determine piece moved before pushing
            piece_moved = self.engine.get_piece_moved(move_san, board)

            # Make the move
            board.push(move)
            fen_after = board.fen()
            
            # Check if this move delivered checkmate
            # After a move, if is_checkmate() is True, the opponent is in checkmate
            # So if user is White and board.turn is now Black and is_checkmate is True, White delivered checkmate
            is_checkmate = board.is_checkmate()
            if is_checkmate:
                # Check if the user delivered checkmate (opponent is in checkmate)
                if is_white:
                    # User is White - if Black is in checkmate (board.turn would be Black), White delivered it
                    delivers_checkmate = board.turn == chess.BLACK
                else:
                    # User is Black - if White is in checkmate (board.turn would be White), Black delivered it
                    delivers_checkmate = board.turn == chess.WHITE
            else:
                delivers_checkmate = False
            
            # Analyze position after move with best move (like Chess.com)
            # This gives us better evaluation and helps detect mate threats
            analysis_result = self.engine.analyze_position_with_best_move(fen_after)
            eval_after = analysis_result.get('eval', 0)
            
            # Check if the move allows the opponent to deliver checkmate
            # Use deeper analysis to find mate threats (like Chess.com)
            allows_opponent_mate = False
            if not is_checkmate and not board.is_game_over():
                # Check if the best move leads to mate
                if analysis_result.get('best_move'):
                    # Make the best move and check if it's mate
                    try:
                        test_board = chess.Board(fen_after)
                        best_move_uci = analysis_result['best_move']
                        best_move_obj = chess.Move.from_uci(best_move_uci)
                        if best_move_obj in test_board.legal_moves:
                            test_board.push(best_move_obj)
                            if test_board.is_checkmate():
                                allows_opponent_mate = True
                    except:
                        pass
                
                # Also check if evaluation suggests forced mate
                # Very high positive eval (from White's perspective) after Black's move = Black allows mate
                # Very low negative eval (from White's perspective) after White's move = White allows mate
                if is_white:
                    # If eval is very negative after White's move, White might be allowing mate
                    if eval_after < -5000:
                        allows_opponent_mate = True
                else:
                    # If eval is very positive after Black's move, Black might be allowing mate
                    if eval_after > 5000:
                        allows_opponent_mate = True

            # UCI can be read any time
            move_uci = move.uci()
            
            # Calculate eval_delta from user's perspective
            # Both eval_before and eval_after are White-centric
            if is_white:
                # User is White: positive delta = improvement for White
                eval_delta = eval_after - eval_before
            else:
                # User is Black: flip perspective (positive delta = improvement for Black)
                eval_delta = eval_before - eval_after
            
            # Classify the move - checkmate moves are always good!
            if delivers_checkmate:
                # If the user delivered checkmate - always good!
                classification = 'good'
            elif allows_opponent_mate:
                # If the move allows opponent to deliver checkmate, it's a blunder
                classification = 'blunder'
            elif is_checkmate:
                # Position is checkmate, but check if it's in favor of the user
                # For White: eval_after should be very positive (mate in favor)
                # For Black: eval_after should be very negative from White's perspective
                if is_white:
                    # White delivered checkmate - eval should be very positive
                    if eval_after > 5000:
                        classification = 'good'
                    else:
                        # White got checkmated - classify based on eval_delta
                        classification = self.engine.classify_move(eval_delta)
                else:
                    # Black delivered checkmate - eval from White's perspective should be very negative
                    # But from Black's perspective (after flipping), it should be very positive
                    if eval_after < -5000:  # Very negative from White's perspective
                        classification = 'good'
                    else:
                        # Black got checkmated - classify based on eval_delta
                        classification = self.engine.classify_move(eval_delta)
            else:
                # Check if evaluation suggests a forced mate (very high eval advantage for opponent)
                # If opponent has a huge advantage (>5000 centipawns), it might indicate forced mate
                if is_white:
                    # If eval_after is very negative, White is in trouble
                    if eval_after < -5000:
                        classification = 'blunder'
                    else:
                        classification = self.engine.classify_move(eval_delta)
                else:
                    # If eval_after is very positive (from White's perspective), Black is in trouble
                    if eval_after > 5000:
                        classification = 'blunder'
                    else:
                        classification = self.engine.classify_move(eval_delta)
            
            # Determine phase
            phase = self.engine.get_phase(ply)
            
            # Analyze position for insights
            insights = self.insights_analyzer.analyze_position(board, move_san, eval_delta)

            # Classify blunder category for mistakes and blunders
            blunder_category = None
            blunder_details = None
            if classification in ('mistake', 'blunder'):
                try:
                    blunder_result = classify_move_blunder(
                        position_fen=fen_before,
                        move_uci=move_uci,
                        eval_before=eval_before,
                        eval_after=eval_after,
                        best_move_uci=analysis_result.get('best_move'),
                        best_move_eval=analysis_result.get('eval'),
                        phase=phase,
                        clock_seconds=None  # Clock data not available from PGN
                    )
                    blunder_category = blunder_result['category']
                    blunder_details = {
                        'confidence': blunder_result['confidence'],
                        'explanation': blunder_result['explanation'],
                        **blunder_result['details']
                    }
                except Exception as e:
                    print(f"Error classifying blunder at ply {ply}: {e}")

            move_data = {
                'ply': ply,
                'move_san': move_san,
                'move_uci': move_uci,
                'eval_before': eval_before,
                'eval_after': eval_after,
                'eval_delta': eval_delta,
                'classification': classification,
                'piece_moved': piece_moved,
                'phase': phase,
                'position_fen': fen_after,
                'tactical_motifs': insights['tactical_motifs'],
                'positional_patterns': insights['positional_patterns'],
                'recommendations': insights['recommendations'],
                'move_quality': insights['move_quality'],
                'blunder_category': blunder_category,
                'blunder_details': blunder_details
            }
            
            moves_data.append(move_data)
            ply += 1
            
            # Only analyze moves for the specified user
            if (is_white and ply % 2 == 0) or (not is_white and ply % 2 == 1):
                continue
        
        return moves_data
    
    def store_game(self, game_data: Dict[str, Any], moves_data: List[Dict[str, Any]], username: str, chess_com_game_id: Optional[str] = None):
        """
        Store game and moves data in the database
        
        Args:
            game_data: Game metadata
            moves_data: List of move analysis data
            username: Username
            chess_com_game_id: Optional precomputed game id
        """
        self._ensure_connection()
        cursor = self.db_conn.cursor()
        
        try:
            # First, ensure engine config exists
            config_hash = self.engine.config_hash
            cursor.execute("""
                INSERT INTO engine_configs (config_hash, skill_level, threads, hash_mb, multi_pv, move_time_ms, stockfish_version)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (config_hash) DO NOTHING
            """, (
                config_hash,
                self.engine.config['skill_level'],
                self.engine.config['threads'],
                self.engine.config['hash_mb'],
                self.engine.config['multi_pv'],
                self.engine.config['move_time_ms'],
                '16'  # Stockfish version
            ))
            
            chess_id = chess_com_game_id or self._build_game_id(username, game_data['played_at'])
            
            # Insert game
            cursor.execute("""
                INSERT INTO games (username, chess_com_game_id, pgn, time_control, eco, opening_name, 
                                 result, white_player, black_player, played_at, engine_config_hash)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (chess_com_game_id) DO NOTHING
                RETURNING id
            """, (
                username,
                chess_id,
                str(game_data.get('pgn', '')),
                game_data['time_control'],
                game_data['eco'],
                game_data['opening_name'],
                game_data['result'],
                game_data['white_player'],
                game_data['black_player'],
                game_data['played_at'],
                config_hash
            ))
            
            result = cursor.fetchone()
            if result:
                game_id = result[0]
                
                # Insert moves
                for move_data in moves_data:
                    cursor.execute("""
                        INSERT INTO moves (game_id, ply, move_san, move_uci, eval_before, eval_after,
                                         eval_delta, classification, piece_moved, phase, position_fen,
                                         tactical_motifs, positional_patterns, recommendations, move_quality,
                                         engine_config_hash, blunder_category, blunder_details)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (game_id, ply, engine_config_hash) DO NOTHING
                    """, (
                        game_id,
                        move_data['ply'],
                        move_data['move_san'],
                        move_data['move_uci'],
                        move_data['eval_before'],
                        move_data['eval_after'],
                        move_data['eval_delta'],
                        move_data['classification'],
                        move_data['piece_moved'],
                        move_data['phase'],
                        move_data['position_fen'],
                        json.dumps(move_data['tactical_motifs']) if move_data['tactical_motifs'] else None,
                        json.dumps(move_data['positional_patterns']) if move_data['positional_patterns'] else None,
                        move_data['recommendations'],
                        move_data['move_quality'],
                        config_hash,
                        move_data.get('blunder_category'),
                        json.dumps(move_data['blunder_details']) if move_data.get('blunder_details') else None
                    ))
                
                self.db_conn.commit()
                print(f"Stored game {game_id} with {len(moves_data)} moves")
            else:
                print(f"Game {chess_id} already exists, skipping")
                
        except Exception as e:
            self.db_conn.rollback()
            print(f"Error storing game: {e}")
            raise
        finally:
            cursor.close()
    
    def stage_games_for_month(self, username: str, year: int, month: int) -> int:
        """Download games and store raw PGNs for later analysis."""
        print(f"Fetching games for {username} in {year}-{month:02d}")
        games = self.fetch_games_for_month(username, year, month)
        if not games:
            print("No games found")
            return 0
        staged = 0
        for game_data in games:
            try:
                pgn_text = game_data.get('pgn', '')
                if not pgn_text:
                    continue
                game = self.parse_pgn_game(pgn_text)
                if not game:
                    continue
                metadata = self.extract_game_metadata(game)
                metadata['pgn'] = pgn_text
                chess_id = self._build_game_id(username, metadata['played_at'])
                self.store_raw_game(username, chess_id, metadata)
                staged += 1
            except Exception as e:
                print(f"Error staging game: {e}")
                continue
        print(f"Staged {staged}/{len(games)} games for {username} in {year}-{month:02d}")
        return staged

    def analyze_staged_games_for_month(self, username: str, year: int, month: int, limit: Optional[int] = None) -> int:
        """Analyze staged games for a given month."""
        staged_games = self.get_unanalyzed_raw_games(username, year, month, limit)
        if not staged_games:
            print("No staged games to analyze")
            return 0
        analyzed = 0
        for raw in staged_games:
            chess_id = raw['chess_com_game_id']
            try:
                if self.game_exists(chess_id):
                    self.mark_raw_analyzed(chess_id)
                    continue
                game = self.parse_pgn_game(raw.get('pgn', ''))
                if not game:
                    self.mark_raw_analyzed(chess_id)
                    continue
                metadata = self.extract_game_metadata(game)
                metadata['pgn'] = raw.get('pgn', '')
                moves_data = self.analyze_game_moves(game, username)
                if moves_data:
                    self.store_game(metadata, moves_data, username, chess_id)
                    analyzed += 1
                self.mark_raw_analyzed(chess_id)
            except Exception as e:
                print(f"Error analyzing staged game {chess_id}: {e}")
                continue
        print(f"Analyzed {analyzed}/{len(staged_games)} staged games for {username} in {year}-{month:02d}")
        return analyzed

    def process_games_for_month(self, username: str, year: int, month: int, fetch: bool = True, analyze: bool = True, analyze_limit: Optional[int] = None):
        """
        Process all games for a user for a specific month with optional fetch/analyze steps.
        """
        if fetch:
            self.stage_games_for_month(username, year, month)
        if analyze:
            self.analyze_staged_games_for_month(username, year, month, analyze_limit)

    def process_all_archives(self, username: str):
        """Process all available monthly archives for a user."""
        archives = self.fetch_archives(username)
        if not archives:
            print("No archives found")
            return
        total_processed = 0
        for archive_url in archives:
            try:
                parts = archive_url.rstrip('/').split('/')
                year = int(parts[-2])
                month = int(parts[-1])
                self.process_games_for_month(username, year, month)
                total_processed += 1
                time.sleep(0.2)
            except Exception as e:
                print(f"Error processing archive {archive_url}: {e}")
                continue
        print(f"Processed {total_processed} archive months for {username}")
    
    def close(self):
        """Close database connection and engine"""
        if self.db_conn:
            self.db_conn.close()
        close_engine()


def main():
    """Main entry point for the ingester"""
    parser = argparse.ArgumentParser(description="Chess.com ingester (fetch + analyze)")
    parser.add_argument("username", help="Chess.com username")
    parser.add_argument("year", nargs="?", type=int, default=datetime.now().year, help="Year, e.g. 2024")
    parser.add_argument("month", nargs="?", type=int, default=datetime.now().month, help="Month number 1-12")
    parser.add_argument("--fetch-only", action="store_true", help="Only download and stage PGNs, skip analysis")
    parser.add_argument("--analyze-only", action="store_true", help="Only analyze already staged games")
    parser.add_argument("--limit", type=int, help="Limit number of staged games to analyze")
    args = parser.parse_args()

    if args.fetch_only and args.analyze_only:
        print("Choose either --fetch-only or --analyze-only, not both.")
        sys.exit(1)

    fetch = not args.analyze_only
    analyze = not args.fetch_only
    
    ingester = ChessComIngester()
    
    try:
        ingester.process_games_for_month(
            args.username,
            args.year,
            args.month,
            fetch=fetch,
            analyze=analyze,
            analyze_limit=args.limit,
        )
    finally:
        ingester.close()


if __name__ == "__main__":
    main()
