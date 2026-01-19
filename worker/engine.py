"""
Chess Engine Analysis Module
Handles Stockfish integration for position evaluation and move analysis
"""

import os
import hashlib
import platform
import requests
import zipfile
from pathlib import Path
from typing import Optional, Dict, Any
import chess
import chess.engine
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class ChessEngine:
    """Wrapper around Stockfish for chess position analysis"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the chess engine with configuration
        
        Args:
            config: Dictionary with engine configuration
        """
        self.config = config or self._get_default_config()
        self.config_hash = self._generate_config_hash()
        self.stockfish_path = self._get_stockfish_binary()
        self.engine = None
        self.uci_engine = None
        self._initialize_engine()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default engine configuration from environment variables
        
        Chess.com uses:
        - Full strength (skill level 20)
        - Depth-based analysis (15-20+ depth)
        - Multi-PV for finding best alternatives
        - Longer analysis for critical positions
        """
        return {
            'skill_level': int(os.getenv('STOCKFISH_SKILL_LEVEL', '20')),  # Full strength like Chess.com
            'threads': int(os.getenv('STOCKFISH_THREADS', '4')),  # More threads for better performance
            'hash_mb': int(os.getenv('STOCKFISH_HASH', '512')),  # More hash for better analysis
            'multi_pv': int(os.getenv('STOCKFISH_MULTI_PV', '3')),  # Find top 3 moves like Chess.com
            'move_time_ms': int(os.getenv('STOCKFISH_MOVE_TIME_MS', '1000')),  # 1 second default
            'depth': int(os.getenv('STOCKFISH_DEPTH', '18')),  # Depth-based analysis (Chess.com uses 15-20+)
            'use_depth': os.getenv('STOCKFISH_USE_DEPTH', 'true').lower() == 'true',  # Use depth instead of time
        }
    
    def _generate_config_hash(self) -> str:
        """Generate a hash of the current engine configuration for caching"""
        config_str = f"{self.config['skill_level']}-{self.config['threads']}-{self.config['hash_mb']}-{self.config['multi_pv']}-{self.config['move_time_ms']}-{self.config.get('depth', 0)}-{self.config.get('use_depth', False)}"
        return hashlib.sha256(config_str.encode()).hexdigest()[:16]
    
    def _get_stockfish_binary(self) -> str:
        """Resolve Stockfish binary path.

        Priority:
        1) STOCKFISH_PATH env var points to an executable
        2) 'stockfish' available on PATH (e.g., installed via Homebrew)
        3) If neither is available, raise an instructive error.
        """
        # 1) Explicit path via env
        env_path = os.getenv('STOCKFISH_PATH')
        if env_path and Path(env_path).exists():
            return env_path

        # 2) Try to find on PATH
        import shutil

        which = shutil.which('stockfish')
        if which:
            return which

        # 3) Provide platform-specific install guidance
        system = platform.system().lower()
        if system == 'darwin':
            guidance = (
                "Stockfish not found. Install via Homebrew: 'brew install stockfish' "
                "or set STOCKFISH_PATH to the binary."
            )
        elif system == 'linux':
            guidance = (
                "Stockfish not found. Install via your package manager (e.g., "
                "'sudo apt-get install stockfish') or set STOCKFISH_PATH."
            )
        else:
            guidance = "Stockfish not found. Please install Stockfish and set STOCKFISH_PATH."

        raise RuntimeError(guidance)
    
    def _download_stockfish(self, url: str, target_path: Path):
        """Download and extract Stockfish binary"""
        response = requests.get(url)
        response.raise_for_status()
        
        zip_path = target_path.parent / 'stockfish.zip'
        with open(zip_path, 'wb') as f:
            f.write(response.content)
        
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Extract the binary (usually the only file in the zip)
            for file_info in zip_ref.filelist:
                if file_info.filename.endswith(('stockfish', 'stockfish.exe')):
                    with zip_ref.open(file_info) as source, open(target_path, 'wb') as target:
                        target.write(source.read())
                    break
        
        zip_path.unlink()  # Clean up zip file
    
    def _initialize_engine(self):
        """Initialize the Stockfish engine with configuration"""
        try:
            self.uci_engine = chess.engine.SimpleEngine.popen_uci(self.stockfish_path)
            config_dict = {
                "Threads": self.config['threads'],
                "Hash": self.config['hash_mb'],
                "Skill Level": self.config['skill_level'],
                # Note: MultiPV cannot be set in engine config, must be set per analysis
            }
            self.uci_engine.configure(config_dict)
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Stockfish: {e}")
    
    def analyze_position(self, fen: str, depth: Optional[int] = None) -> int:
        """
        Analyze a position and return evaluation in centipawns
        
        Args:
            fen: FEN string of the position
            depth: Optional depth override (uses config depth if not provided)
            
        Returns:
            Evaluation in centipawns from White's perspective (positive = White advantage, negative = Black advantage)
        """
        if not self.uci_engine:
            raise RuntimeError("Engine not initialized")
        
        try:
            board = chess.Board(fen)
            
            # Use depth-based analysis if configured (like Chess.com)
            if self.config.get('use_depth', False):
                analysis_depth = depth or self.config.get('depth', 18)
                limit = chess.engine.Limit(depth=analysis_depth)
            else:
                # Fallback to time-based analysis
                limit = chess.engine.Limit(time=self.config['move_time_ms'] / 1000)
            
            # MultiPV must be set per analysis, not in engine config
            # When multipv > 1, analyse() returns a list of results
            multi_pv = self.config.get('multi_pv', 1)
            result = self.uci_engine.analyse(board, limit, multipv=multi_pv)
            
            # Handle both single result and list of results
            if isinstance(result, list):
                info = result[0]  # Get the best move (first in list)
            else:
                info = result
            
            score = info.get("score")
            if not score:
                return 0
            
            # Get evaluation - handle mate scores properly
            cp = score.pov(chess.WHITE).score(mate_score=10000)
            return cp if cp is not None else 0
        except Exception as e:
            print(f"Error analyzing position {fen}: {e}")
            return 0
    
    def analyze_position_with_best_move(self, fen: str, depth: Optional[int] = None) -> Dict[str, Any]:
        """
        Analyze a position and return evaluation plus best move (like Chess.com)
        
        Args:
            fen: FEN string of the position
            depth: Optional depth override
            
        Returns:
            Dictionary with 'eval', 'best_move', and 'pv' (principal variation)
        """
        if not self.uci_engine:
            raise RuntimeError("Engine not initialized")
        
        try:
            board = chess.Board(fen)
            
            # Use depth-based analysis if configured
            if self.config.get('use_depth', False):
                analysis_depth = depth or self.config.get('depth', 18)
                limit = chess.engine.Limit(depth=analysis_depth)
            else:
                limit = chess.engine.Limit(time=self.config['move_time_ms'] / 1000)
            
            # MultiPV must be set per analysis, not in engine config
            # When multipv > 1, analyse() returns a list of results
            multi_pv = self.config.get('multi_pv', 1)
            result = self.uci_engine.analyse(board, limit, multipv=multi_pv)
            
            # Handle both single result and list of results
            if isinstance(result, list):
                info = result[0]  # Get the best move (first in list)
            else:
                info = result
            
            score = info.get("score")
            best_move = info.get("pv", [])
            
            if not score:
                return {'eval': 0, 'best_move': None, 'pv': []}
            
            cp = score.pov(chess.WHITE).score(mate_score=10000)
            eval_value = cp if cp is not None else 0
            
            # Get best move from principal variation
            best_move_uci = best_move[0].uci() if best_move else None
            
            return {
                'eval': eval_value,
                'best_move': best_move_uci,
                'pv': [move.uci() for move in best_move[:5]]  # First 5 moves of PV
            }
        except Exception as e:
            print(f"Error analyzing position with best move {fen}: {e}")
            return {'eval': 0, 'best_move': None, 'pv': []}
    
    def get_best_move(self, fen: str) -> str:
        """
        Get the best move for a position
        
        Args:
            fen: FEN string of the position
            
        Returns:
            UCI move string (e.g., 'e2e4')
        """
        if not self.uci_engine:
            raise RuntimeError("Engine not initialized")
        
        try:
            board = chess.Board(fen)
            result = self.uci_engine.play(board, chess.engine.Limit(time=self.config['move_time_ms'] / 1000))
            return result.move.uci() if result and result.move else ""
        except Exception as e:
            print(f"Error getting best move for {fen}: {e}")
            return ""
    
    def get_best_move_time(self, fen: str) -> str:
        """
        Get the best move with time limit
        
        Args:
            fen: FEN string of the position
            
        Returns:
            UCI move string
        """
        if not self.uci_engine:
            raise RuntimeError("Engine not initialized")
        
        try:
            board = chess.Board(fen)
            result = self.uci_engine.play(board, chess.engine.Limit(time=self.config['move_time_ms'] / 1000))
            return result.move.uci() if result and result.move else ""
        except Exception as e:
            print(f"Error getting best move with time for {fen}: {e}")
            return ""
    
    def classify_move(self, eval_delta: int, is_checkmate: bool = False) -> str:
        """
        Classify a move based on evaluation delta
        
        Args:
            eval_delta: Change in evaluation (eval_after - eval_before)
            is_checkmate: Whether this move results in checkmate
            
        Returns:
            Classification: 'good', 'inaccuracy', 'mistake', or 'blunder'
        """
        # Checkmate moves are always good (if delivering checkmate, not receiving it)
        if is_checkmate and eval_delta > 5000:
            return 'good'
        
        if eval_delta >= -50:
            return 'good'
        elif eval_delta >= -150:
            return 'inaccuracy'
        elif eval_delta >= -300:
            return 'mistake'
        else:
            return 'blunder'
    
    def get_phase(self, ply: int) -> str:
        """
        Determine game phase from ply number
        
        Args:
            ply: Ply number (1-based)
            
        Returns:
            Phase: 'opening', 'middlegame', or 'endgame'
        """
        if ply <= 30:  # moves 1-15 (2 plies per move)
            return 'opening'
        elif ply <= 80:  # moves 16-40
            return 'middlegame'
        else:
            return 'endgame'
    
    def get_piece_moved(self, move_san: str, board: chess.Board) -> str:
        """
        Extract the piece that was moved from SAN notation
        
        Args:
            move_san: Standard Algebraic Notation move
            board: Chess board object
            
        Returns:
            Piece symbol (P, N, B, R, Q, K)
        """
        try:
            # Parse the move
            move = board.parse_san(move_san)
            piece = board.piece_at(move.from_square)
            
            if piece is None:
                return 'P'  # Default to pawn if piece not found
            
            # Map piece types to symbols
            piece_map = {
                chess.PAWN: 'P',
                chess.KNIGHT: 'N',
                chess.BISHOP: 'B',
                chess.ROOK: 'R',
                chess.QUEEN: 'Q',
                chess.KING: 'K'
            }
            
            return piece_map.get(piece.piece_type, 'P')
            
        except Exception as e:
            print(f"Error extracting piece from move {move_san}: {e}")
            return 'P'  # Default to pawn
    
    def close(self):
        """Close the engine connection"""
        if self.uci_engine:
            try:
                self.uci_engine.close()
            except Exception:
                pass
            self.uci_engine = None


# Global engine instance for reuse
_engine_instance = None

def get_engine() -> ChessEngine:
    """Get or create a global engine instance"""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = ChessEngine()
    return _engine_instance

def close_engine():
    """Close the global engine instance"""
    global _engine_instance
    if _engine_instance:
        _engine_instance.close()
        _engine_instance = None
