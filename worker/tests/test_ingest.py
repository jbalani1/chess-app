"""
Unit tests for the game ingestion module
"""

import unittest
import sys
import os
from unittest.mock import Mock, patch, MagicMock
import chess
import chess.pgn

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ingest import ChessComIngester


class TestChessComIngester(unittest.TestCase):
    """Test cases for ChessComIngester class"""
    
    def setUp(self):
        """Set up test fixtures"""
        # Mock the database connection
        with patch('ingest.psycopg2.connect'):
            with patch('ingest.get_engine'):
                self.ingester = ChessComIngester()
    
    def test_parse_pgn_game(self):
        """Test PGN parsing functionality"""
        pgn_text = """
[Event "Test Game"]
[Site "Test Site"]
[Date "2024.01.01"]
[Round "1"]
[White "Test White"]
[Black "Test Black"]
[Result "1-0"]
[ECO "C20"]
[Opening "King's Pawn Game"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d6 8. cxd4 Bb6 9. Nc3 Nf6 10. e5 dxe5 11. dxe5 Nxe5 12. Nxe5 Bxe5 13. Bxf7+ Kxf7 14. Qd5+ Kf8 15. Qxe5 1-0
"""
        
        game = self.ingester.parse_pgn_game(pgn_text)
        self.assertIsNotNone(game)
        self.assertEqual(game.headers['White'], 'Test White')
        self.assertEqual(game.headers['Black'], 'Test Black')
        self.assertEqual(game.headers['Result'], '1-0')
        self.assertEqual(game.headers['ECO'], 'C20')
    
    def test_extract_game_metadata(self):
        """Test game metadata extraction"""
        # Create a mock game with headers
        game = Mock()
        game.headers = {
            'TimeControl': '600+5',
            'ECO': 'C20',
            'Opening': "King's Pawn Game",
            'Result': '1-0',
            'White': 'Test White',
            'Black': 'Test Black',
            'Date': '2024.01.01',
            'UTCTime': '12:00:00'
        }
        
        metadata = self.ingester.extract_game_metadata(game)
        
        self.assertEqual(metadata['time_control'], '10+5')  # 600 seconds = 10 minutes
        self.assertEqual(metadata['eco'], 'C20')
        self.assertEqual(metadata['opening_name'], "King's Pawn Game")
        self.assertEqual(metadata['result'], '1-0')
        self.assertEqual(metadata['white_player'], 'Test White')
        self.assertEqual(metadata['black_player'], 'Test Black')
    
    def test_extract_game_metadata_no_increment(self):
        """Test game metadata extraction with no time increment"""
        game = Mock()
        game.headers = {
            'TimeControl': '600',
            'ECO': 'C20',
            'Opening': "King's Pawn Game",
            'Result': '1-0',
            'White': 'Test White',
            'Black': 'Test Black',
            'Date': '2024.01.01',
            'UTCTime': '12:00:00'
        }
        
        metadata = self.ingester.extract_game_metadata(game)
        self.assertEqual(metadata['time_control'], '10+0')
    
    def test_extract_game_metadata_unlimited_time(self):
        """Test game metadata extraction with unlimited time"""
        game = Mock()
        game.headers = {
            'TimeControl': '-',
            'ECO': 'C20',
            'Opening': "King's Pawn Game",
            'Result': '1-0',
            'White': 'Test White',
            'Black': 'Test Black',
            'Date': '2024.01.01',
            'UTCTime': '12:00:00'
        }
        
        metadata = self.ingester.extract_game_metadata(game)
        self.assertEqual(metadata['time_control'], '0+0')
    
    @patch('ingest.requests.get')
    def test_fetch_games_for_month(self, mock_get):
        """Test fetching games from Chess.com API"""
        # Mock the API response
        mock_response = Mock()
        mock_response.json.return_value = {
            'games': [
                {
                    'pgn': '1. e4 e5 1-0',
                    'time_control': '600+5',
                    'rules': 'chess'
                }
            ]
        }
        mock_response.raise_for_status.return_value = None
        mock_get.return_value = mock_response
        
        games = self.ingester.fetch_games_for_month('testuser', 2024, 1)
        
        self.assertEqual(len(games), 1)
        self.assertEqual(games[0]['pgn'], '1. e4 e5 1-0')
        mock_get.assert_called_once_with(
            'https://api.chess.com/pub/player/testuser/games/2024/01',
            timeout=30
        )
    
    @patch('ingest.requests.get')
    def test_fetch_games_for_month_error(self, mock_get):
        """Test error handling when fetching games"""
        mock_get.side_effect = Exception('Network error')
        
        games = self.ingester.fetch_games_for_month('testuser', 2024, 1)
        
        self.assertEqual(len(games), 0)
    
    def test_analyze_game_moves_white_player(self):
        """Test move analysis for white player"""
        # Create a simple game
        pgn_text = """
[Event "Test Game"]
[White "testuser"]
[Black "opponent"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0
"""
        
        game = self.ingester.parse_pgn_game(pgn_text)
        self.assertIsNotNone(game)
        
        # Mock the engine
        mock_engine = Mock()
        mock_engine.analyze_position.return_value = 50
        mock_engine.classify_move.return_value = 'good'
        mock_engine.get_phase.return_value = 'opening'
        mock_engine.get_piece_moved.return_value = 'P'
        self.ingester.engine = mock_engine
        
        moves_data = self.ingester.analyze_game_moves(game, 'testuser')
        
        # Should analyze moves for white player (moves 1, 3, 5...)
        self.assertGreater(len(moves_data), 0)
        
        # Check that engine methods were called
        self.assertTrue(mock_engine.analyze_position.called)
        self.assertTrue(mock_engine.classify_move.called)
        self.assertTrue(mock_engine.get_phase.called)
        self.assertTrue(mock_engine.get_piece_moved.called)
    
    def test_analyze_game_moves_black_player(self):
        """Test move analysis for black player"""
        # Create a simple game
        pgn_text = """
[Event "Test Game"]
[White "opponent"]
[Black "testuser"]
[Result "0-1"]

1. e4 e5 2. Nf3 Nc6 0-1
"""
        
        game = self.ingester.parse_pgn_game(pgn_text)
        self.assertIsNotNone(game)
        
        # Mock the engine
        mock_engine = Mock()
        mock_engine.analyze_position.return_value = 50
        mock_engine.classify_move.return_value = 'good'
        mock_engine.get_phase.return_value = 'opening'
        mock_engine.get_piece_moved.return_value = 'P'
        self.ingester.engine = mock_engine
        
        moves_data = self.ingester.analyze_game_moves(game, 'testuser')
        
        # Should analyze moves for black player (moves 2, 4, 6...)
        self.assertGreater(len(moves_data), 0)
    
    def test_piece_identification_from_san(self):
        """Test piece identification from SAN notation"""
        import chess
        
        # Create a board and make some moves
        board = chess.Board()
        
        # Test various piece moves
        test_cases = [
            ('e4', 'P'),      # Pawn
            ('Nf3', 'N'),     # Knight
            ('Bc4', 'B'),     # Bishop
            ('Rf1', 'R'),     # Rook
            ('Qd5', 'Q'),     # Queen
            ('O-O', 'K'),     # King (castling)
        ]
        
        for san_move, expected_piece in test_cases:
            try:
                move = board.parse_san(san_move)
                piece = board.piece_at(move.from_square)
                
                if piece is None:
                    # Handle special cases like castling
                    actual_piece = 'K' if 'O-O' in san_move else 'P'
                else:
                    piece_map = {
                        chess.PAWN: 'P',
                        chess.KNIGHT: 'N',
                        chess.BISHOP: 'B',
                        chess.ROOK: 'R',
                        chess.QUEEN: 'Q',
                        chess.KING: 'K'
                    }
                    actual_piece = piece_map.get(piece.piece_type, 'P')
                
                self.assertEqual(actual_piece, expected_piece, 
                               f"Expected {expected_piece} for {san_move}, got {actual_piece}")
                
                # Make the move to continue testing
                board.push(move)
                
            except chess.InvalidMoveError:
                # Skip invalid moves in the test position
                continue


class TestPGNParsing(unittest.TestCase):
    """Test PGN parsing functionality"""
    
    def test_simple_pgn_parsing(self):
        """Test parsing a simple PGN game"""
        pgn_text = """
[Event "Test Game"]
[Site "Test Site"]
[Date "2024.01.01"]
[White "Test White"]
[Black "Test Black"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0
"""
        
        pgn_io = chess.pgn.StringIO(pgn_text)
        game = chess.pgn.read_game(pgn_io)
        
        self.assertIsNotNone(game)
        self.assertEqual(game.headers['White'], 'Test White')
        self.assertEqual(game.headers['Black'], 'Test Black')
        self.assertEqual(game.headers['Result'], '1-0')
        
        # Count moves
        move_count = 0
        for move in game.mainline_moves():
            move_count += 1
        
        self.assertEqual(move_count, 6)  # 3 moves each side
    
    def test_pgn_with_comments(self):
        """Test parsing PGN with comments"""
        pgn_text = """
[Event "Test Game"]
[White "Test White"]
[Black "Test Black"]
[Result "1-0"]

1. e4 {This is a good opening move} e5 2. Nf3 Nc6 1-0
"""
        
        pgn_io = chess.pgn.StringIO(pgn_text)
        game = chess.pgn.read_game(pgn_io)
        
        self.assertIsNotNone(game)
        
        # Should still parse correctly despite comments
        move_count = 0
        for move in game.mainline_moves():
            move_count += 1
        
        self.assertEqual(move_count, 4)


if __name__ == '__main__':
    unittest.main()
