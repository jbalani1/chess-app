"""
Unit tests for the nightly ingester's move classification
"""

import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ingest_recent import classify_move, classify_blunder


class TestClassifyMove(unittest.TestCase):
    """eval_delta is from the mover's side: negative is a loss"""

    def test_losses_are_graded(self):
        self.assertEqual(classify_move(-10), 'good')
        self.assertEqual(classify_move(-100), 'inaccuracy')
        self.assertEqual(classify_move(-200), 'mistake')
        self.assertEqual(classify_move(-500), 'blunder')

    def test_improvements_are_never_errors(self):
        self.assertEqual(classify_move(0), 'good')
        self.assertEqual(classify_move(120), 'good')
        self.assertEqual(classify_move(400), 'good')

    def test_finding_a_forced_mate_is_not_a_blunder(self):
        # +8.00 before, engine finds mate in 3 after: a jump of ~9200cp
        self.assertEqual(classify_move(9997 - 800), 'good')

    def test_classify_blunder_ignores_improvements(self):
        import chess
        board = chess.Board()
        move = chess.Move.from_uci('e2e4')
        self.assertEqual(
            classify_blunder(9000, board, move, move, 800, 9800), (None, None))


if __name__ == '__main__':
    unittest.main()
