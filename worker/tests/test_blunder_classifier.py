"""
Unit tests for blunder categorisation.

Each position is a case the old attacked-and-undefended / is_check() heuristics
got wrong. Run from worker/: venv/bin/python -m unittest tests.test_blunder_classifier
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from blunder_classifier import classify_move_blunder


def classify(fen, uci):
    return classify_move_blunder(
        position_fen=fen,
        move_uci=uci,
        eval_before=0,
        eval_after=-300,
        best_move_uci=None,
        best_move_eval=None,
        phase='middlegame',
    )


class TestHangingPiece(unittest.TestCase):

    def test_defended_piece_that_still_loses_to_a_pawn_is_hanging(self):
        # Nd4 is defended by e3, but cxd4 exd4 still nets two pawns of material
        result = classify('4k3/8/8/2p5/8/4PN2/8/4K3 w - - 0 1', 'f3d4')
        self.assertEqual(result['category'], 'hanging_piece')
        self.assertEqual(result['details']['square'], 'd4')
        self.assertEqual(result['details']['material_dropped'], 2)
        self.assertEqual(result['details']['punished_by'], 'cxd4')

    def test_attack_by_a_pinned_piece_is_not_hanging(self):
        # Nd5 is "attacked" by Nc3, but Nc3 is pinned to the king and cannot take
        result = classify('4k3/7p/8/3n4/1b6/2N5/8/4K3 b - - 0 1', 'h7h6')
        self.assertNotEqual(result['category'], 'hanging_piece')

    def test_material_already_lost_is_not_blamed_on_the_move(self):
        # The knight on a1 is trapped: every Black move loses it, so h6 did not
        result = classify('7k/6pp/8/8/3B4/8/P2K4/n7 b - - 0 1', 'h7h6')
        self.assertNotEqual(result['category'], 'hanging_piece')


class TestOverlookedCheck(unittest.TestCase):

    def test_giving_a_safe_check_is_not_overlooked_check(self):
        result = classify('rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3', 'f1b5')
        self.assertNotEqual(result['category'], 'overlooked_check')

    def test_allowing_mate_in_one_is_overlooked_check(self):
        # Ra3 abandons the back rank and allows Re1#
        result = classify('4r1k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 'a1a3')
        self.assertEqual(result['category'], 'overlooked_check')
        self.assertEqual(result['details']['mating_move'], 'Re1#')

    def test_delivering_mate_is_not_overlooked_check(self):
        result = classify('6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', 'e1e8')
        self.assertNotEqual(result['category'], 'overlooked_check')


if __name__ == '__main__':
    unittest.main()
