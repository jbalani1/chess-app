"""
Fast Chess.com Game Ingester
Optimized for speed with minimal Stockfish analysis
"""

import os
import sys
import json
import time
import requests
import io
import chess
import chess.pgn
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

from engine import get_engine, close_engine

# Load environment variables
load_dotenv()

class FastChessComIngester:
    """Fast version of Chess.com game ingester with minimal analysis"""
    
    def __init__(self):
        """Initialize the ingester with database connection"""
        self.engine = get_engine()
        self.db_conn = self._connect_to_database()
        
    def _connect_to_database(self):
        """Connect to Supabase PostgreSQL database"""
        try:
            conn = psycopg2.connect(
                host=os.getenv("SUPABASE_HOST"),
                port=os.getenv("SUPABASE_PORT"),
                database=os.getenv("SUPABASE_DB"),
                user=os.getenv("SUPABASE_USER"),
                password=os.getenv("SUPABASE_PASSWORD"),
                sslmode=os.getenv("PGSSLMODE", "require")
            )
            print("Successfully connected to Supabase database.")
            return conn
        except Exception as e:
            print(f"Error connecting to database: {e}")
            raise

    def process_month_archive(self, username: str, year: int, month: int):
        """Process all games from a specific month archive"""
        print(f"Processing {username} games for {year}-{month:02d}")
        
        try:
            # Fetch games from Chess.com API
            url = f"https://api.chess.com/pub/player/{username}/games/{year}/{month:02d}"
            response = requests.get(url)
            response.raise_for_status()
            
            data = response.json()
            games = data.get('games', [])
            
            if not games:
                print(f"No games found for {username} in {year}-{month:02d}")
                return
            
            print(f"Found {len(games)} games for {username} in {year}-{month:02d}")
            
            # Process each game
            for i, game_data in enumerate(games):
                try:
                    print(f"Processing game {i+1}/{len(games)}...")
                    self._process_single_game(game_data, username)
                except Exception as e:
                    print(f"Error processing game {i+1}: {e}")
                    continue
            
            print(f"✅ Successfully processed {len(games)} games for {username} in {year}-{month:02d}")
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                print(f"No games found for {username} in {year}-{month:02d}")
            else:
                print(f"Error fetching games: {e}")
        except Exception as e:
            print(f"Error processing archive: {e}")

    def _process_single_game(self, game_data: Dict[str, Any], username: str):
        """Process a single game with minimal analysis"""
        try:
            # Parse game metadata
            game_metadata = self._parse_game_metadata(game_data, username)
            
            # Parse moves with minimal analysis
            moves_data = self._parse_moves_fast(game_data.get('pgn', ''), username)
            
            if moves_data:
                # Store game and moves
                self._store_game_fast(game_metadata, moves_data, username)
                print(f"  ✅ Stored game with {len(moves_data)} moves")
            else:
                print(f"  ⚠️  No moves to store")
                
        except Exception as e:
            print(f"  ❌ Error processing game: {e}")

    def _parse_game_metadata(self, game_data: Dict[str, Any], username: str) -> Dict[str, Any]:
        """Parse game metadata quickly"""
        headers = game_data.get('pgn', '').split('\n')
        header_dict = {}
        
        for line in headers:
            if line.startswith('[') and line.endswith(']'):
                try:
                    key, value = line[1:-1].split(' ', 1)
                    header_dict[key] = value.strip('"')
                except:
                    continue
        
        # Extract basic info
        time_control = game_data.get('time_control', '0+0')
        if '+' in time_control:
            parts = time_control.split('+')
            base_time = int(parts[0]) if parts[0] != '-' else 0
            increment = int(parts[1]) if len(parts) > 1 else 0
            time_control = f"{base_time//60}+{increment}"
        
        eco = header_dict.get('ECO', '')
        opening = header_dict.get('Opening', '') or header_dict.get('Variation', '') or 'Unknown Opening'
        result = header_dict.get('Result', '*')
        
        return {
            'time_control': time_control,
            'eco': eco,
            'opening_name': opening,
            'result': result,
            'white_player': header_dict.get('White', 'Unknown'),
            'black_player': header_dict.get('Black', 'Unknown'),
            'played_at': datetime.fromtimestamp(game_data.get('end_time', 0)),
            'pgn': game_data.get('pgn', '')
        }

    def _parse_moves_fast(self, pgn_string: str, username: str) -> List[Dict[str, Any]]:
        """Parse moves with minimal Stockfish analysis"""
        try:
            pgn_game = chess.pgn.read_game(io.StringIO(pgn_string))
            if pgn_game is None:
                return []
            
            board = pgn_game.board()
            moves_data = []
            ply = 0
            
            # Determine if user is white or black
            is_white = pgn_game.headers.get('White', '').lower() == username.lower()
            
            for move in pgn_game.mainline_moves():
                # Only analyze moves for the specified user
                if (is_white and ply % 2 == 0) or (not is_white and ply % 2 == 1):
                    # Quick evaluation (no deep analysis)
                    eval_before = self._quick_eval(board)
                    board.push(move)
                    eval_after = self._quick_eval(board)
                    eval_delta = eval_after - eval_before
                    
                    # Flip evaluation for black
                    if not is_white:
                        eval_delta = -eval_delta
                    
                    # Simple classification
                    classification = self._classify_move_simple(eval_delta)
                    
                    # Determine phase
                    phase = self._get_phase_simple(ply)
                    
                    move_data = {
                        'ply': ply,
                        'move_san': board.san(move),
                        'move_uci': move.uci(),
                        'eval_before': eval_before,
                        'eval_after': eval_after,
                        'eval_delta': eval_delta,
                        'classification': classification,
                        'piece_moved': board.piece_at(move.to_square).symbol().upper() if board.piece_at(move.to_square) else 'P',
                        'phase': phase,
                        'position_fen': board.fen(),
                        'tactical_motifs': [],  # Skip detailed analysis
                        'positional_patterns': [],  # Skip detailed analysis
                        'recommendations': [],  # Skip detailed analysis
                        'move_quality': 'good' if abs(eval_delta) < 100 else 'questionable',
                        'blunder_category': None,  # Fast mode skips blunder classification
                        'blunder_details': None
                    }
                    
                    moves_data.append(move_data)
                else:
                    board.push(move)
                
                ply += 1
            
            return moves_data
            
        except Exception as e:
            print(f"Error parsing moves: {e}")
            return []

    def _quick_eval(self, board: chess.Board) -> int:
        """Quick evaluation without Stockfish"""
        # Simple material count evaluation
        material = 0
        piece_values = {chess.PAWN: 100, chess.KNIGHT: 320, chess.BISHOP: 330, 
                       chess.ROOK: 500, chess.QUEEN: 900, chess.KING: 0}
        
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece:
                value = piece_values.get(piece.piece_type, 0)
                if piece.color == chess.WHITE:
                    material += value
                else:
                    material -= value
        
        return material

    def _classify_move_simple(self, eval_delta: int) -> str:
        """Simple move classification without Stockfish"""
        if eval_delta >= -50:
            return 'good'
        elif eval_delta >= -150:
            return 'inaccuracy'
        elif eval_delta >= -300:
            return 'mistake'
        else:
            return 'blunder'

    def _get_phase_simple(self, ply: int) -> str:
        """Simple phase determination"""
        if ply < 20:
            return 'opening'
        elif ply < 40:
            return 'middlegame'
        else:
            return 'endgame'

    def _store_game_fast(self, game_data: Dict[str, Any], moves_data: List[Dict[str, Any]], username: str):
        """Store game and moves quickly"""
        cursor = self.db_conn.cursor()
        
        try:
            # Generate a unique game ID
            chess_com_game_id = f"{username}_{game_data['played_at'].strftime('%Y%m%d_%H%M%S')}"
            
            # Insert game
            cursor.execute("""
                INSERT INTO games (username, chess_com_game_id, pgn, time_control, eco, opening_name, 
                                 result, white_player, black_player, played_at, engine_config_hash)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (chess_com_game_id) DO NOTHING
                RETURNING id
            """, (
                username,
                chess_com_game_id,
                str(game_data.get('pgn', '')),
                game_data['time_control'],
                game_data['eco'],
                game_data['opening_name'],
                game_data['result'],
                game_data['white_player'],
                game_data['black_player'],
                game_data['played_at'],
                self.engine.config_hash
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
                        json.dumps(move_data['tactical_motifs']),
                        json.dumps(move_data['positional_patterns']),
                        move_data['recommendations'],
                        move_data['move_quality'],
                        self.engine.config_hash,
                        move_data.get('blunder_category'),
                        json.dumps(move_data['blunder_details']) if move_data.get('blunder_details') else None
                    ))
                
                self.db_conn.commit()
            else:
                print(f"Game {chess_com_game_id} already exists, skipping")
                
        except Exception as e:
            print(f"Error storing game: {e}")
            self.db_conn.rollback()
        finally:
            cursor.close()

    def close(self):
        """Close database connection"""
        if self.db_conn:
            self.db_conn.close()
        close_engine()

def main():
    """Main function for fast analysis"""
    if len(sys.argv) < 2:
        print("Usage: python fast_ingest.py <username> [year] [month]")
        print("Examples:")
        print("  python fast_ingest.py magnuscarlsen 2024 1")
        print("  python fast_ingest.py magnuscarlsen 2024 all")
        sys.exit(1)

    username = sys.argv[1]
    year = int(sys.argv[2]) if len(sys.argv) > 2 else datetime.now().year
    month = int(sys.argv[3]) if len(sys.argv) > 3 else datetime.now().month

    print(f"🚀 Fast analysis mode for {username}")
    if isinstance(month, int):
        print(f"📅 Processing {year}-{month:02d}")
    else:
        print(f"📅 Processing {year}-{month}")
    print("⚡ This will be much faster but with basic analysis only")
    print()

    ingester = FastChessComIngester()

    try:
        if month == 'all':
            # Process all available months
            current_date = datetime.now()
            for year in range(2020, current_date.year + 1):
                for month in range(1, 13):
                    if year == current_date.year and month > current_date.month:
                        break
                    ingester.process_month_archive(username, year, month)
        else:
            ingester.process_month_archive(username, year, month)

        print(f"\n✅ Fast analysis completed for {username}!")
        print("📊 Check the web interface to see your games")

    except KeyboardInterrupt:
        print("\n❌ Analysis interrupted by user")
    except Exception as e:
        print(f"\n❌ Error during analysis: {e}")
    finally:
        ingester.close()

if __name__ == "__main__":
    main()
