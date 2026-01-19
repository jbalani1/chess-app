"""
Chess Insights Module
Analyzes moves for tactical motifs and positional patterns
"""

import chess
import chess.pgn
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict


@dataclass
class TacticalMotif:
    """Represents a tactical motif found in a position"""
    motif_type: str  # 'pin', 'fork', 'skewer', 'discovered_attack', 'deflection', 'decoy'
    description: str
    severity: str  # 'minor', 'major', 'critical'
    piece_involved: str
    fen: str  # FEN string of the position where this motif was detected


@dataclass
class PositionalPattern:
    """Represents a positional pattern or mistake"""
    pattern_type: str  # 'pawn_structure', 'piece_placement', 'king_safety', 'space'
    description: str
    severity: str
    recommendation: str


class ChessInsightsAnalyzer:
    """Analyzes chess positions for tactical and positional insights"""
    
    def __init__(self):
        self.motif_patterns = {
            'pin': self._detect_pins,
            'fork': self._detect_forks,
            'skewer': self._detect_skewers,
            'discovered_attack': self._detect_discovered_attacks,
            'weak_square': self._detect_weak_squares,
            'pawn_structure': self._analyze_pawn_structure,
            'piece_activity': self._analyze_piece_activity,
        }
    
    def analyze_position(self, board: chess.Board, move_san: str, eval_delta: int) -> Dict[str, Any]:
        """
        Analyze a position for tactical motifs and positional patterns
        
        Args:
            board: Current board position
            move_san: The move that was played
            eval_delta: Evaluation change from this move
            
        Returns:
            Dictionary with insights and recommendations
        """
        insights = {
            'tactical_motifs': [],
            'positional_patterns': [],
            'move_quality': self._assess_move_quality(eval_delta),
            'recommendations': []
        }
        
        # Detect tactical motifs
        for motif_type, detector in self.motif_patterns.items():
            if motif_type in ['pin', 'fork', 'skewer', 'discovered_attack']:
                motifs = detector(board)
                # Convert TacticalMotif objects to dictionaries for JSON serialization
                insights['tactical_motifs'].extend([asdict(motif) for motif in motifs])
        
        # Analyze positional patterns
        for pattern_type, analyzer in self.motif_patterns.items():
            if pattern_type in ['weak_square', 'pawn_structure', 'piece_activity']:
                patterns = analyzer(board)
                # Convert PositionalPattern objects to dictionaries for JSON serialization
                insights['positional_patterns'].extend([asdict(pattern) for pattern in patterns])
        
        # Generate recommendations
        insights['recommendations'] = self._generate_recommendations(insights, eval_delta)
        
        return insights
    
    def _detect_pins(self, board: chess.Board) -> List[TacticalMotif]:
        """Detect pinned pieces"""
        pins = []
        
        # Check for pins of opponent pieces
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece is None or piece.color == board.turn:
                continue  # Skip empty squares and own pieces
            
            # Check if this piece is pinned to its king
            if board.is_pinned(piece.color, square):
                pin_ray = board.pin(piece.color, square)
                if pin_ray:
                    pins.append(TacticalMotif(
                        motif_type='pin',
                        description=f"{piece.symbol().upper()} on {chess.square_name(square)} is pinned to its king",
                        severity='major' if piece.piece_type == chess.QUEEN else 'minor',
                        piece_involved=piece.symbol().upper(),
                        fen=board.fen()
                    ))
        
        return pins
    
    def _detect_forks(self, board: chess.Board) -> List[TacticalMotif]:
        """Detect fork opportunities"""
        forks = []
        
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece is None or piece.color != board.turn:
                continue
            
            # Check for fork patterns
            if piece.piece_type == chess.KNIGHT:
                attacks = board.attacks(square)
                valuable_targets = []
                
                for target in attacks:
                    target_piece = board.piece_at(target)
                    if target_piece and target_piece.color != piece.color:
                        # Count piece values for fork detection
                        piece_value = self._get_piece_value(target_piece.piece_type)
                        if piece_value >= 300:  # Rook, Queen, King
                            valuable_targets.append(chess.square_name(target))
                
                if len(valuable_targets) >= 2:
                    forks.append(TacticalMotif(
                        motif_type='fork',
                        description=f"Knight fork opportunity on {chess.square_name(square)} attacking {len(valuable_targets)} pieces",
                        severity='major',
                        piece_involved='N',
                        fen=board.fen()
                    ))
        
        return forks
    
    def _get_piece_value(self, piece_type: chess.PieceType) -> int:
        """Get piece value for evaluation"""
        values = {
            chess.PAWN: 100,
            chess.KNIGHT: 300,
            chess.BISHOP: 325,
            chess.ROOK: 500,
            chess.QUEEN: 900,
            chess.KING: 10000
        }
        return values.get(piece_type, 0)
    
    def _detect_skewers(self, board: chess.Board) -> List[TacticalMotif]:
        """Detect skewer opportunities"""
        skewers = []
        
        # Check for skewers along ranks, files, and diagonals
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece is None or piece.color != board.turn:
                continue
            
            if piece.piece_type in [chess.QUEEN, chess.ROOK, chess.BISHOP]:
                # Check for skewer patterns
                attacks = board.attacks(square)
                for target in attacks:
                    target_piece = board.piece_at(target)
                    if target_piece and target_piece.color != piece.color:
                        # Check if there's a more valuable piece behind
                        direction = target - square
                        behind_square = target + direction
                        if 0 <= behind_square < 64:
                            behind_piece = board.piece_at(behind_square)
                            if behind_piece and behind_piece.color != piece.color:
                                if self._get_piece_value(behind_piece.piece_type) > self._get_piece_value(target_piece.piece_type):
                                    skewers.append(TacticalMotif(
                                        motif_type='skewer',
                                        description=f"Skewer opportunity with {piece.symbol().upper()} from {chess.square_name(square)}",
                                        severity='major',
                                        piece_involved=piece.symbol().upper(),
                                        fen=board.fen()
                                    ))
        
        return skewers
    
    def _detect_discovered_attacks(self, board: chess.Board) -> List[TacticalMotif]:
        """Detect discovered attack opportunities"""
        discovered = []
        
        # Look for pieces that can move to reveal attacks
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece is None or piece.color != board.turn:
                continue
            
            # Check if moving this piece would reveal an attack
            for move in board.legal_moves:
                if move.from_square == square:
                    # Simulate the move
                    board.push(move)
                    # Check if this reveals an attack
                    for other_square in chess.SQUARES:
                        other_piece = board.piece_at(other_square)
                        if other_piece and other_piece.color == board.turn:
                            attacks = board.attacks(other_square)
                            for target in attacks:
                                target_piece = board.piece_at(target)
                                if target_piece and target_piece.color != board.turn:
                                    if self._get_piece_value(target_piece.piece_type) >= 500:  # Rook or higher
                                        discovered.append(TacticalMotif(
                                            motif_type='discovered_attack',
                                            description=f"Discovered attack with {piece.symbol().upper()} on {chess.square_name(square)}",
                                            severity='major',
                                            piece_involved=piece.symbol().upper(),
                                            fen=board.fen()
                                        ))
                    board.pop()
                    break
        
        return discovered
    
    def _detect_weak_squares(self, board: chess.Board) -> List[PositionalPattern]:
        """Detect weak squares and positional issues"""
        patterns = []
        
        # Check for weak squares around the king
        king_square = board.king(board.turn)
        if king_square is not None:
            king_attacks = board.attacks(king_square)
            if len(king_attacks) > 3:  # King is exposed
                patterns.append(PositionalPattern(
                    pattern_type='king_safety',
                    description=f"King on {chess.square_name(king_square)} is exposed",
                    severity='major',
                    recommendation="Castle or improve king safety with pawn moves"
                ))
        
        # Check for isolated pawns
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.piece_type == chess.PAWN and piece.color == board.turn:
                if self._is_isolated_pawn(board, square):
                    patterns.append(PositionalPattern(
                        pattern_type='pawn_structure',
                        description=f"Isolated pawn on {chess.square_name(square)}",
                        severity='minor',
                        recommendation="Support with pieces or advance to create passed pawn"
                    ))
        
        return patterns
    
    def _analyze_pawn_structure(self, board: chess.Board) -> List[PositionalPattern]:
        """Analyze pawn structure issues"""
        patterns = []
        
        # Check for doubled pawns
        for file in range(8):
            pawns_in_file = []
            for rank in range(8):
                square = chess.square(file, rank)
                piece = board.piece_at(square)
                if piece and piece.piece_type == chess.PAWN and piece.color == board.turn:
                    pawns_in_file.append(square)
            
            if len(pawns_in_file) > 1:
                patterns.append(PositionalPattern(
                    pattern_type='pawn_structure',
                    description=f"Doubled pawns on {chess.FILE_NAMES[file]}-file",
                    severity='minor',
                    recommendation="Try to break the doubling or use the extra pawn for attack"
                ))
        
        return patterns
    
    def _analyze_piece_activity(self, board: chess.Board) -> List[PositionalPattern]:
        """Analyze piece activity and placement"""
        patterns = []
        
        # Check for inactive pieces
        for square in chess.SQUARES:
            piece = board.piece_at(square)
            if piece and piece.color == board.turn:
                attacks = board.attacks(square)
                if len(attacks) == 0 and piece.piece_type != chess.KING:
                    patterns.append(PositionalPattern(
                        pattern_type='piece_placement',
                        description=f"{piece.symbol().upper()} on {chess.square_name(square)} is inactive",
                        severity='minor',
                        recommendation=f"Improve {piece.symbol().upper()} activity by moving to a better square"
                    ))
        
        return patterns
    
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
    
    def _generate_recommendations(self, insights: Dict[str, Any], eval_delta: int) -> List[str]:
        """Generate actionable recommendations based on insights"""
        recommendations = []
        
        # Tactical recommendations
        for motif in insights['tactical_motifs']:
            if motif['motif_type'] == 'pin':
                recommendations.append("Look for ways to break the pin or exploit it")
            elif motif['motif_type'] == 'fork':
                recommendations.append("Consider knight forks - they can win material")
            elif motif['motif_type'] == 'skewer':
                recommendations.append("Skewers can win material by attacking valuable pieces")
        
        # Positional recommendations
        for pattern in insights['positional_patterns']:
            if pattern['pattern_type'] == 'king_safety':
                recommendations.append("Improve king safety - castle or move king to safety")
            elif pattern['pattern_type'] == 'pawn_structure':
                recommendations.append("Work on pawn structure - avoid weaknesses")
            elif pattern['pattern_type'] == 'piece_placement':
                recommendations.append("Improve piece activity - find better squares")
        
        # General recommendations based on move quality
        if eval_delta < -300:
            recommendations.append("This was a blunder - take more time to calculate")
        elif eval_delta < -150:
            recommendations.append("This move was inaccurate - look for better alternatives")
        
        return list(set(recommendations))  # Remove duplicates
