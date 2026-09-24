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
from engine import ChessEngine


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
        mock_engine.analyze_position_with_best_move.return_value = {'eval': 50, 'best_move': None}
        mock_engine.classify_move.return_value = 'good'
        mock_engine.get_phase.return_value = 'opening'
        mock_engine.get_piece_moved.return_value = 'P'
        self.ingester.engine = mock_engine

        moves_data = self.ingester.analyze_game_moves(game, 'testuser')

        # Every ply is stored, both sides
        self.assertEqual(len(moves_data), 4)

        # Check that engine methods were called
        self.assertTrue(mock_engine.analyze_position_with_best_move.called)
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
        mock_engine.analyze_position_with_best_move.return_value = {'eval': 50, 'best_move': None}
        mock_engine.classify_move.return_value = 'good'
        mock_engine.get_phase.return_value = 'opening'
        mock_engine.get_piece_moved.return_value = 'P'
        self.ingester.engine = mock_engine

        moves_data = self.ingester.analyze_game_moves(game, 'testuser')

        # Every ply is stored, both sides
        self.assertEqual(len(moves_data), 4)
    
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


class TestMoverPerspective(unittest.TestCase):
    """analyze_game_moves stores every ply, but used to judge each one from the
    user's side: opponent errors came out 'good', an opponent's mating attack
    came out 'blunder', and any move from an already mate-lost position was
    forced to 'blunder'. Each move is now judged from the side that played it,
    matching ingest_recent.py."""

    # 1. e4 e5 2. Nf3 Nc6 — ply 1 and 3 are White's, 2 and 4 Black's
    SANS = ['e4', 'e5', 'Nf3', 'Nc6']

    def setUp(self):
        with patch('ingest.psycopg2.connect'):
            with patch('ingest.get_engine'):
                self.ingester = ChessComIngester()

    def run_game(self, evals_after, user_color='white'):
        """evals_after[i] is the White-centric eval after ply i+1; the start
        position is +30. The engine's best move is never the played move, so
        the best-move override cannot mask the classification under test."""
        board = chess.Board()
        evals = {board.fen(): 30}
        for san, ev in zip(self.SANS, evals_after):
            board.push_san(san)
            evals[board.fen()] = ev

        def analyze(fen, *args, **kwargs):
            return {'eval': evals[fen], 'best_move': None}

        engine = Mock()
        engine.analyze_position_with_best_move.side_effect = analyze
        engine.classify_move.side_effect = lambda delta: ChessEngine.classify_move(None, delta)
        engine.get_phase.return_value = 'opening'
        engine.get_piece_moved.return_value = 'P'
        self.ingester.engine = engine

        white, black = ('testuser', 'opponent') if user_color == 'white' else ('opponent', 'testuser')
        pgn = f'[White "{white}"]\n[Black "{black}"]\n\n1. e4 e5 2. Nf3 Nc6 *\n'
        game = self.ingester.parse_pgn_game(pgn)
        with patch('ingest.classify_move_blunder') as classify:
            classify.return_value = {'category': 'x', 'confidence': 0, 'explanation': '', 'details': {}}
            return self.ingester.analyze_game_moves(game, 'testuser')

    def test_opponent_error_is_graded_from_the_opponents_side(self):
        # Black's 1...e5 hands White +400: a 370cp loss for Black
        moves = self.run_game([30, 400, 400, 400])
        self.assertEqual(moves[1]['eval_delta'], -370)
        self.assertEqual(moves[1]['classification'], 'blunder')

    def test_opponent_mating_attack_is_not_a_blunder(self):
        # User (White) allows mate on ply 3; Black keeps the mate on ply 4
        moves = self.run_game([30, 30, -9990, -9992])
        self.assertEqual(moves[2]['classification'], 'blunder')
        self.assertEqual(moves[3]['classification'], 'good')

    def test_move_from_already_mate_lost_position_is_not_forced_to_blunder(self):
        # White is already being mated after ply 2; ply 3 changes nothing
        moves = self.run_game([30, -9990, -9992, -9992])
        self.assertEqual(moves[2]['eval_delta'], -2)
        self.assertEqual(moves[2]['classification'], 'good')

    def test_move_that_allows_mate_is_still_a_blunder(self):
        moves = self.run_game([30, 30, -9990, -9990], user_color='white')
        self.assertEqual(moves[2]['classification'], 'blunder')

    def test_black_user_moves_are_graded_the_same_way(self):
        # Black user's 1...e5 loses 370; perspective must not depend on user colour
        moves = self.run_game([30, 400, 400, 400], user_color='black')
        self.assertEqual(moves[1]['eval_delta'], -370)
        self.assertEqual(moves[1]['classification'], 'blunder')


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
