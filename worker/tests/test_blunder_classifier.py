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


def classify_with_best(fen, uci, best_uci, eval_before, eval_after):
    """Evals are White-centric, the same convention ingest.py passes."""
    return classify_move_blunder(
        position_fen=fen,
        move_uci=uci,
        eval_before=eval_before,
        eval_after=eval_after,
        best_move_uci=best_uci,
        best_move_eval=eval_before,
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


class TestMissedTactic(unittest.TestCase):
    """The category could not fire at all until ingest.py stopped handing the
    classifier the opponent's reply. These pin down what it should mean now."""

    # h6 instead of Nc2+, which forks Ke1 and Ra1.
    BLACK_FORK = ('6k1/7p/8/8/1n6/8/8/R3K3 b - - 0 1', 'h7h6', 'b4c2')
    # The same shape with the colours swapped: h3 instead of Nc7+.
    WHITE_FORK = ('r3k3/8/8/1N6/8/8/7P/6K1 w - - 0 1', 'h2h3', 'b5c7')

    def test_black_missing_a_fork_is_a_missed_tactic(self):
        # Evals are White-centric, so a Black error moves them up, not down.
        # Comparing them unflipped made this test the one case that could never
        # fire — and Black is the side most of the analysed games were played as.
        fen, played, best = self.BLACK_FORK
        result = classify_with_best(fen, played, best, eval_before=0, eval_after=300)
        self.assertEqual(result['category'], 'missed_tactic')
        self.assertEqual(result['details']['tactic_type'], 'fork_with_check')
        self.assertEqual(result['details']['forked_squares'], ['a1'])

    def test_white_missing_a_fork_is_a_missed_tactic(self):
        fen, played, best = self.WHITE_FORK
        result = classify_with_best(fen, played, best, eval_before=0, eval_after=-300)
        self.assertEqual(result['category'], 'missed_tactic')
        self.assertEqual(result['details']['tactic_type'], 'fork_with_check')

    def test_leaving_a_free_piece_on_the_board_is_a_missed_tactic(self):
        # Bxa4 wins an undefended knight; h6 ignores it.
        result = classify_with_best(
            '6k1/7p/2b5/8/N7/8/8/4K3 b - - 0 1', 'h7h6', 'c6a4',
            eval_before=0, eval_after=300,
        )
        self.assertEqual(result['category'], 'missed_tactic')
        self.assertEqual(result['details']['tactic_type'], 'free_material')
        self.assertEqual(result['details']['material_won'], 3)

    def test_a_best_move_that_is_only_a_check_is_not_a_missed_tactic(self):
        # Re8+ is the engine's move but wins nothing, so there is no tactic to
        # name. The old code called every check a "check_tactic".
        result = classify_with_best(
            '3r2k1/7p/8/8/8/8/8/4K3 b - - 0 1', 'h7h6', 'd8e8',
            eval_before=0, eval_after=300,
        )
        self.assertNotEqual(result['category'], 'missed_tactic')

    def test_an_unnameable_tactic_does_not_become_a_missed_tactic(self):
        # The old fallback was {"tactic_type": "unknown"}, which made the
        # category mean "a better move existed" — true of nearly every error.
        result = classify_with_best(
            '3r2k1/7p/8/8/8/8/8/4K3 b - - 0 1', 'h7h6', None,
            eval_before=0, eval_after=300,
        )
        self.assertNotEqual(result['category'], 'missed_tactic')
        self.assertNotIn('unknown', str(result['details'].values()))

    def test_a_dead_level_position_still_gets_compared(self):
        # `if best_move_eval and ...` treated an eval of exactly 0 as "no eval",
        # so a position assessed at dead level skipped the check entirely.
        fen, played, best = self.WHITE_FORK
        result = classify_with_best(fen, played, best, eval_before=0, eval_after=-300)
        self.assertEqual(result['category'], 'missed_tactic')


if __name__ == '__main__':
    unittest.main()
