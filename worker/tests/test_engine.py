"""
Unit tests for the chess engine module
"""

import unittest
import sys
import os
from unittest.mock import Mock, patch

# Add the parent directory to the path so we can import our modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine import ChessEngine


class TestChessEngine(unittest.TestCase):
    """Test cases for ChessEngine class"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.config = {
            'skill_level': 20,
            'threads': 4,
            'hash_mb': 512,
            'multi_pv': 1,
            'move_time_ms': 1000,
        }
    
    def test_classify_move(self):
        """Test move classification based on eval delta"""
        engine = ChessEngine(self.config)
        
        # Test good moves
        self.assertEqual(engine.classify_move(-30), 'good')
        self.assertEqual(engine.classify_move(0), 'good')
        self.assertEqual(engine.classify_move(50), 'good')
        
        # Test inaccuracies
        self.assertEqual(engine.classify_move(-100), 'inaccuracy')
        self.assertEqual(engine.classify_move(-149), 'inaccuracy')
        
        # Test mistakes
        self.assertEqual(engine.classify_move(-200), 'mistake')
        self.assertEqual(engine.classify_move(-299), 'mistake')
        
        # Test blunders
        self.assertEqual(engine.classify_move(-400), 'blunder')
        self.assertEqual(engine.classify_move(-1000), 'blunder')
    
    def test_get_phase(self):
        """Test phase determination from ply number"""
        engine = ChessEngine(self.config)
        
        # Test opening phase (moves 1-15, plies 1-30)
        self.assertEqual(engine.get_phase(1), 'opening')
        self.assertEqual(engine.get_phase(15), 'opening')
        self.assertEqual(engine.get_phase(30), 'opening')
        
        # Test middlegame phase (moves 16-40, plies 31-80)
        self.assertEqual(engine.get_phase(31), 'middlegame')
        self.assertEqual(engine.get_phase(50), 'middlegame')
        self.assertEqual(engine.get_phase(80), 'middlegame')
        
        # Test endgame phase (moves 41+, plies 81+)
        self.assertEqual(engine.get_phase(81), 'endgame')
        self.assertEqual(engine.get_phase(100), 'endgame')
    
    def test_config_hash_generation(self):
        """Test that config hash is generated correctly"""
        engine1 = ChessEngine(self.config)
        engine2 = ChessEngine(self.config)
        
        # Same config should generate same hash
        self.assertEqual(engine1.config_hash, engine2.config_hash)
        
        # Different config should generate different hash
        different_config = self.config.copy()
        different_config['skill_level'] = 10
        engine3 = ChessEngine(different_config)
        
        self.assertNotEqual(engine1.config_hash, engine3.config_hash)
    
    def test_get_piece_moved(self):
        """Test piece extraction from SAN notation"""
        import chess
        
        engine = ChessEngine(self.config)
        board = chess.Board()
        
        # Test pawn moves
        self.assertEqual(engine.get_piece_moved('e4', board), 'P')
        self.assertEqual(engine.get_piece_moved('d5', board), 'P')
        
        # Test knight moves
        board.push_san('e4')
        board.push_san('e5')
        self.assertEqual(engine.get_piece_moved('Nf3', board), 'N')
        
        # Test invalid move (should default to pawn)
        self.assertEqual(engine.get_piece_moved('invalid', board), 'P')
    
    @patch('engine.Stockfish')
    def test_analyze_position_mock(self, mock_stockfish):
        """Test position analysis with mocked Stockfish"""
        # Mock the Stockfish instance
        mock_engine = Mock()
        mock_engine.get_evaluation.return_value = {'type': 'cp', 'value': 50}
        mock_stockfish.return_value = mock_engine
        
        engine = ChessEngine(self.config)
        engine.engine = mock_engine
        
        # Test normal evaluation
        result = engine.analyze_position('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
        self.assertEqual(result, 50)
        
        # Test mate evaluation
        mock_engine.get_evaluation.return_value = {'type': 'mate', 'value': 3}
        result = engine.analyze_position('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
        self.assertEqual(result, 9997)  # 10000 - 3
    
    @patch('engine.Stockfish')
    def test_get_best_move_mock(self, mock_stockfish):
        """Test best move retrieval with mocked Stockfish"""
        # Mock the Stockfish instance
        mock_engine = Mock()
        mock_engine.get_best_move.return_value = 'e2e4'
        mock_stockfish.return_value = mock_engine
        
        engine = ChessEngine(self.config)
        engine.engine = mock_engine
        
        result = engine.get_best_move('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
        self.assertEqual(result, 'e2e4')


class TestMoveClassificationThresholds(unittest.TestCase):
    """Test the specific classification thresholds as specified in requirements"""
    
    def test_classification_thresholds(self):
        """Test that classification thresholds match the specification exactly"""
        engine = ChessEngine()
        
        # Good: Δeval ≥ −50 cp
        self.assertEqual(engine.classify_move(-50), 'good')
        self.assertEqual(engine.classify_move(-49), 'good')
        self.assertEqual(engine.classify_move(0), 'good')
        self.assertEqual(engine.classify_move(100), 'good')
        
        # Inaccuracy: −50 > Δeval ≥ −150
        self.assertEqual(engine.classify_move(-51), 'inaccuracy')
        self.assertEqual(engine.classify_move(-100), 'inaccuracy')
        self.assertEqual(engine.classify_move(-150), 'inaccuracy')
        
        # Mistake: −150 > Δeval ≥ −300
        self.assertEqual(engine.classify_move(-151), 'mistake')
        self.assertEqual(engine.classify_move(-200), 'mistake')
        self.assertEqual(engine.classify_move(-300), 'mistake')
        
        # Blunder: Δeval < −300
        self.assertEqual(engine.classify_move(-301), 'blunder')
        self.assertEqual(engine.classify_move(-500), 'blunder')
        self.assertEqual(engine.classify_move(-1000), 'blunder')


if __name__ == '__main__':
    unittest.main()
