"""
Update existing games with new insight fields
This script adds tactical motifs, positional patterns, and recommendations to existing moves
"""

import os
import sys
import json
import chess
import chess.pgn
import io
from typing import List, Dict, Any
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import RealDictCursor

from chess_insights import ChessInsightsAnalyzer

# Load environment variables
load_dotenv()

class GameUpdater:
    """Updates existing games with new insight fields"""
    
    def __init__(self):
        """Initialize the updater"""
        self.insights_analyzer = ChessInsightsAnalyzer()
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

    def update_games(self, limit: int = 10):
        """Update existing games with new insight fields"""
        cursor = self.db_conn.cursor()
        
        try:
            # Get games that need updating (have moves but no tactical_motifs)
            cursor.execute("""
                SELECT DISTINCT g.id, g.pgn, g.white_player, g.black_player
                FROM games g
                JOIN moves m ON g.id = m.game_id
                WHERE m.tactical_motifs IS NULL
                LIMIT %s
            """, (limit,))
            
            games = cursor.fetchall()
            print(f"Found {len(games)} games to update")
            
            for i, (game_id, pgn, white_player, black_player) in enumerate(games):
                print(f"Updating game {i+1}/{len(games)} (ID: {game_id})")
                
                try:
                    # Parse PGN and analyze moves
                    moves_data = self._analyze_game_moves(pgn, white_player, black_player)
                    
                    if moves_data:
                        # Update moves with new insight data
                        self._update_moves(cursor, game_id, moves_data)
                        print(f"  ✅ Updated {len(moves_data)} moves")
                    else:
                        print(f"  ⚠️  No moves to update")
                        
                except Exception as e:
                    print(f"  ❌ Error updating game {game_id}: {e}")
                    continue
            
            self.db_conn.commit()
            print(f"\n✅ Successfully updated {len(games)} games!")
            
        except Exception as e:
            print(f"Error updating games: {e}")
            self.db_conn.rollback()
        finally:
            cursor.close()

    def _analyze_game_moves(self, pgn_string: str, white_player: str, black_player: str) -> List[Dict[str, Any]]:
        """Analyze moves in a game and return updated move data"""
        try:
            pgn_game = chess.pgn.read_game(io.StringIO(pgn_string))
            if pgn_game is None:
                return []
            
            board = pgn_game.board()
            moves_data = []
            ply = 0
            
            # Determine if we should analyze moves for white or black
            # For now, let's analyze both players' moves
            for move in pgn_game.mainline_moves():
                # Get SAN before pushing the move
                move_san = board.san(move)
                
                # Quick evaluation
                eval_before = self._quick_eval(board)
                board.push(move)
                eval_after = self._quick_eval(board)
                eval_delta = eval_after - eval_before
                
                # Flip evaluation for black
                if ply % 2 == 1:  # Black's move
                    eval_delta = -eval_delta
                
                # Analyze position for insights (simplified)
                insights = self._analyze_position_simple(board, move_san, eval_delta)
                
                move_data = {
                    'ply': ply,
                    'tactical_motifs': insights['tactical_motifs'],
                    'positional_patterns': insights['positional_patterns'],
                    'recommendations': insights['recommendations'],
                    'move_quality': insights['move_quality']
                }
                
                moves_data.append(move_data)
                ply += 1
            
            return moves_data
            
        except Exception as e:
            print(f"Error analyzing game moves: {e}")
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

    def _analyze_position_simple(self, board: chess.Board, move_san: str, eval_delta: int) -> Dict[str, Any]:
        """Simple position analysis without full Stockfish"""
        insights = {
            'tactical_motifs': [],
            'positional_patterns': [],
            'move_quality': self._assess_move_quality(eval_delta),
            'recommendations': []
        }
        
        # Simple tactical detection
        if self._has_pin(board):
            insights['tactical_motifs'].append({
                'motif_type': 'pin',
                'description': 'Piece is pinned',
                'severity': 'major',
                'piece_involved': 'P'
            })
        
        if self._has_fork_opportunity(board):
            insights['tactical_motifs'].append({
                'motif_type': 'fork',
                'description': 'Fork opportunity available',
                'severity': 'major',
                'piece_involved': 'N'
            })
        
        # Simple positional patterns
        if self._king_exposed(board):
            insights['positional_patterns'].append({
                'pattern_type': 'king_safety',
                'description': 'King is exposed',
                'severity': 'major',
                'recommendation': 'Improve king safety'
            })
        
        if self._has_isolated_pawns(board):
            insights['positional_patterns'].append({
                'pattern_type': 'pawn_structure',
                'description': 'Isolated pawns present',
                'severity': 'minor',
                'recommendation': 'Support isolated pawns'
            })
        
        # Generate recommendations
        if eval_delta < -300:
            insights['recommendations'].append("This was a blunder - take more time to calculate")
        elif eval_delta < -150:
            insights['recommendations'].append("This move was inaccurate - look for better alternatives")
        
        return insights

    def _has_pin(self, board: chess.Board) -> bool:
        """Check if there are any pinned pieces"""
        for square in chess.SQUARES:
            if board.is_pinned(board.turn, square):
                return True
        return False

    def _has_fork_opportunity(self, board: chess.Board) -> bool:
        """Check for knight fork opportunities"""
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.piece_type == chess.KNIGHT and piece.color == board.turn:
                attacks = board.attacks(square)
                valuable_targets = 0
                for target in attacks:
                    target_piece = board.piece_at(target)
                    if target_piece and target_piece.color != piece.color:
                        if target_piece.piece_type in [chess.QUEEN, chess.ROOK]:
                            valuable_targets += 1
                if valuable_targets >= 2:
                    return True
        return False

    def _king_exposed(self, board: chess.Board) -> bool:
        """Check if king is exposed"""
        king_square = board.king(board.turn)
        if king_square is not None:
            king_attacks = board.attacks(king_square)
            return len(king_attacks) > 3
        return False

    def _has_isolated_pawns(self, board: chess.Board) -> bool:
        """Check for isolated pawns"""
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.piece_type == chess.PAWN and piece.color == board.turn:
                if self._is_isolated_pawn(board, square):
                    return True
        return False

    def _is_isolated_pawn(self, board: chess.Board, pawn_square: int) -> bool:
        """Check if a pawn is isolated"""
        file = chess.square_file(pawn_square)
        
        # Check adjacent files for friendly pawns
        for adj_file in [file - 1, file + 1]:
            if 0 <= adj_file < 8:
                for rank in range(8):
                    square = chess.square(adj_file, rank)
                    piece = board.piece_at(square)
                    if piece and piece.piece_type == chess.PAWN and piece.color == board.piece_at(pawn_square).color:
                        return False
        
        return True

    def _assess_move_quality(self, eval_delta: int) -> str:
        """Assess the quality of a move based on evaluation change"""
        if eval_delta >= -50:
            return "excellent"
        elif eval_delta >= -150:
            return "good"
        elif eval_delta >= -300:
            return "questionable"
        else:
            return "poor"

    def _update_moves(self, cursor, game_id: str, moves_data: List[Dict[str, Any]]):
        """Update moves with new insight data"""
        for move_data in moves_data:
            cursor.execute("""
                UPDATE moves 
                SET tactical_motifs = %s,
                    positional_patterns = %s,
                    recommendations = %s,
                    move_quality = %s
                WHERE game_id = %s AND ply = %s
            """, (
                json.dumps(move_data['tactical_motifs']),
                json.dumps(move_data['positional_patterns']),
                move_data['recommendations'],
                move_data['move_quality'],
                game_id,
                move_data['ply']
            ))

    def close(self):
        """Close database connection"""
        if self.db_conn:
            self.db_conn.close()

def main():
    """Main function"""
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    
    print(f"🔄 Updating existing games with new insight fields")
    print(f"📊 Processing up to {limit} games")
    print("⚡ This will add tactical motifs, positional patterns, and recommendations")
    print()

    updater = GameUpdater()

    try:
        updater.update_games(limit)
        print("\n✅ Update completed!")
        print("📊 Check the web interface to see the new insights")

    except KeyboardInterrupt:
        print("\n❌ Update interrupted by user")
    except Exception as e:
        print(f"\n❌ Error during update: {e}")
    finally:
        updater.close()

if __name__ == "__main__":
    main()
