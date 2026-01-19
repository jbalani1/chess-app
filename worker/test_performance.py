#!/usr/bin/env python3
"""
Performance test script for chess analysis
Analyzes a subset of games and reports timing information
"""

import sys
import time
import argparse
from datetime import datetime
from ingest import ChessComIngester


def format_time(seconds):
    """Format seconds into human-readable time"""
    if seconds < 60:
        return f"{seconds:.2f}s"
    elif seconds < 3600:
        mins = int(seconds // 60)
        secs = seconds % 60
        return f"{mins}m {secs:.2f}s"
    else:
        hours = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = seconds % 60
        return f"{hours}h {mins}m {secs:.2f}s"


def test_analysis_performance(username: str, year: int, month: int, 
                               num_games: int, fetch_first: bool = False, force: bool = False):
    """
    Test analysis performance on a subset of games
    
    Args:
        username: Chess.com username
        year: Year to analyze
        month: Month to analyze
        num_games: Number of games to analyze
        fetch_first: Whether to fetch games first (if not already staged)
    """
    print("=" * 60)
    print(f"Performance Test: Analyzing {num_games} games")
    print(f"User: {username}, Period: {year}-{month:02d}")
    print("=" * 60)
    print()
    
    ingester = ChessComIngester()
    
    try:
        # Step 1: Fetch games if needed
        if fetch_first:
            print("📥 Step 1: Fetching games from Chess.com...")
            fetch_start = time.time()
            staged = ingester.stage_games_for_month(username, year, month)
            fetch_time = time.time() - fetch_start
            print(f"   ✅ Staged {staged} games in {format_time(fetch_time)}")
            print()
        
        # Step 2: Check how many games are available
        print("📊 Step 2: Checking available games...")
        if force:
            # Get all games (including already analyzed ones) for re-analysis
            available_games = ingester.get_all_raw_games(username, year, month)
            print(f"   Found {len(available_games)} total games (including already analyzed)")
        else:
            # Only get unanalyzed games
            available_games = ingester.get_unanalyzed_raw_games(username, year, month)
            print(f"   Found {len(available_games)} unanalyzed games")
        
        if len(available_games) == 0:
            print("   ⚠️  No games found!")
            if not fetch_first:
                print("   💡 Try running with --fetch-first to download games")
            if not force:
                print("   💡 Or use --force to re-analyze already analyzed games")
            return
        
        # Limit to requested number
        games_to_analyze = min(num_games, len(available_games))
        print(f"   Will analyze {games_to_analyze} games")
        print()
        
        # Step 3: Analyze games with timing
        print("🔍 Step 3: Analyzing games...")
        print("-" * 60)
        
        analysis_start = time.time()
        analyzed = 0
        game_times = []
        
        for i, raw_game in enumerate(available_games[:games_to_analyze], 1):
            chess_id = raw_game['chess_com_game_id']
            game_start = time.time()
            
            try:
                # Check if already analyzed (skip only if not forcing re-analysis)
                if not force and ingester.game_exists(chess_id):
                    ingester.mark_raw_analyzed(chess_id)
                    print(f"   Game {i}/{games_to_analyze}: {chess_id[:20]}... (already exists, skipped)")
                    continue
                
                # If forcing re-analysis and game exists, we'll update it
                if force and ingester.game_exists(chess_id):
                    print(f"   Game {i}/{games_to_analyze}: {chess_id[:20]}... (re-analyzing existing game)")
                
                # Parse and analyze
                game = ingester.parse_pgn_game(raw_game.get('pgn', ''))
                if not game:
                    ingester.mark_raw_analyzed(chess_id)
                    print(f"   Game {i}/{games_to_analyze}: {chess_id[:20]}... (parse failed, skipped)")
                    continue
                
                metadata = ingester.extract_game_metadata(game)
                metadata['pgn'] = raw_game.get('pgn', '')
                moves_data = ingester.analyze_game_moves(game, username)
                
                if moves_data:
                    ingester.store_game(metadata, moves_data, username, chess_id)
                    analyzed += 1
                
                ingester.mark_raw_analyzed(chess_id)
                
                game_time = time.time() - game_start
                game_times.append(game_time)
                num_moves = len(moves_data) if moves_data else 0
                
                print(f"   Game {i}/{games_to_analyze}: {chess_id[:20]}... "
                      f"✅ {num_moves} moves in {format_time(game_time)}")
                
            except Exception as e:
                game_time = time.time() - game_start
                print(f"   Game {i}/{games_to_analyze}: {chess_id[:20]}... "
                      f"❌ Error: {e} ({format_time(game_time)})")
                continue
        
        total_analysis_time = time.time() - analysis_start
        
        # Step 4: Report results
        print()
        print("=" * 60)
        print("📈 Performance Results")
        print("=" * 60)
        print(f"Games analyzed:     {analyzed}/{games_to_analyze}")
        print(f"Total time:         {format_time(total_analysis_time)}")
        if analyzed > 0:
            avg_time = total_analysis_time / analyzed
            print(f"Average per game:   {format_time(avg_time)}")
            if game_times:
                min_time = min(game_times)
                max_time = max(game_times)
                print(f"Fastest game:       {format_time(min_time)}")
                print(f"Slowest game:       {format_time(max_time)}")
            
            # Estimate for full month
            total_available = len(available_games)
            if total_available > games_to_analyze:
                estimated_full = avg_time * total_available
                print()
                print(f"📊 Projection for all {total_available} games:")
                print(f"   Estimated time:  {format_time(estimated_full)}")
                print(f"   (~{estimated_full / 3600:.1f} hours)")
        
        print("=" * 60)
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Analysis interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Error during analysis: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ingester.close()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Test chess analysis performance on a subset of games",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Analyze 5 games from January 2024 (must be already staged)
  python test_performance.py magnuscarlsen 2024 1 --num-games 5
  
  # Fetch and analyze 10 games
  python test_performance.py magnuscarlsen 2024 1 --num-games 10 --fetch-first
  
  # Quick test with 3 games
  python test_performance.py magnuscarlsen 2024 1 -n 3 -f
        """
    )
    
    parser.add_argument("username", help="Chess.com username")
    parser.add_argument("year", type=int, help="Year (e.g., 2024)")
    parser.add_argument("month", type=int, help="Month (1-12)")
    parser.add_argument("-n", "--num-games", type=int, default=5,
                       help="Number of games to analyze (default: 5)")
    parser.add_argument("-f", "--fetch-first", action="store_true",
                       help="Fetch games from Chess.com first (if not already staged)")
    parser.add_argument("--force", action="store_true",
                       help="Re-analyze games even if they're already analyzed")
    
    args = parser.parse_args()
    
    if args.num_games < 1:
        print("Error: --num-games must be at least 1")
        sys.exit(1)
    
    test_analysis_performance(
        args.username,
        args.year,
        args.month,
        args.num_games,
        args.fetch_first,
        args.force
    )


if __name__ == "__main__":
    main()

