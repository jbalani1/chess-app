"""
Demo script to seed one month of games for a Chess.com username
"""

import sys
import os
from datetime import datetime, timedelta
from ingest import ChessComIngester

def main():
    """Seed one month of games for demonstration"""
    if len(sys.argv) < 2:
        print("Usage: python seed_one_month.py <username> [year] [month|all]")
        print("Examples:")
        print("  python seed_one_month.py magnuscarlsen 2024 1")
        print("  python seed_one_month.py magnuscarlsen all   # process all months")
        sys.exit(1)
    
    username = sys.argv[1]
    # Support 'all' to process every available archive
    if len(sys.argv) > 2 and sys.argv[2].lower() == 'all':
        mode_all = True
        year = None
        month = None
    else:
        mode_all = False
        year = int(sys.argv[2]) if len(sys.argv) > 2 else datetime.now().year
        month = int(sys.argv[3]) if len(sys.argv) > 3 else datetime.now().month
    
    if mode_all:
        print(f"Seeding all available games for {username}")
    else:
        print(f"Seeding games for {username} in {year}-{month:02d}")
    print("This may take several minutes depending on the number of games...")
    
    ingester = ChessComIngester()
    
    try:
        if mode_all:
            print(f"Processing all available archives for {username}")
            ingester.process_all_archives(username)
        else:
            # Process the specified month
            ingester.process_games_for_month(username, year, month)

        if mode_all:
            print(f"\n✅ Successfully seeded all available games for {username}")
        else:
            print(f"\n✅ Successfully seeded games for {username} in {year}-{month:02d}")
        print("You can now view the analysis in the web interface!")
        
    except KeyboardInterrupt:
        print("\n❌ Seeding interrupted by user")
    except Exception as e:
        print(f"\n❌ Error during seeding: {e}")
    finally:
        ingester.close()

if __name__ == "__main__":
    main()
