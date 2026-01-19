# Stockfish Analysis Improvements

## Changes Made to Match Chess.com Quality

### 1. **Enhanced Configuration**
- **Skill Level**: Increased from 15 → **20** (full strength, like Chess.com)
- **Threads**: Increased from 2 → **4** (better parallel processing)
- **Hash**: Increased from 128MB → **512MB** (better position caching)
- **Multi-PV**: Increased from 1 → **3** (finds top 3 alternative moves)
- **Analysis Time**: Increased from 200ms → **1000ms** (1 second default)
- **Depth-Based Analysis**: Added **depth 18** option (Chess.com uses 15-20+)

### 2. **Depth-Based Analysis** (New)
- Uses depth instead of time for more consistent analysis
- Configurable via `STOCKFISH_USE_DEPTH=true` and `STOCKFISH_DEPTH=18`
- More reliable than time-based analysis

### 3. **Best Move Detection** (New)
- New `analyze_position_with_best_move()` method
- Finds the best move and principal variation (like Chess.com)
- Helps detect mate threats by checking if best move leads to checkmate

### 4. **Improved Mate Detection**
- Checks if opponent's best move leads to checkmate
- Detects forced mate positions (eval > 5000 centipawns)
- Better classification of moves that allow checkmate

## Environment Variables

You can configure these in your `.env` file:

```bash
# Full strength analysis (like Chess.com)
STOCKFISH_SKILL_LEVEL=20
STOCKFISH_THREADS=4
STOCKFISH_HASH=512
STOCKFISH_MULTI_PV=3
STOCKFISH_MOVE_TIME_MS=1000

# Use depth-based analysis (recommended)
STOCKFISH_USE_DEPTH=true
STOCKFISH_DEPTH=18
```

## Performance vs Quality Trade-off

- **Faster (lower quality)**: Use time-based with 200-500ms
- **Balanced**: Use depth 15-18 (recommended)
- **Highest quality**: Use depth 20+ (slower but most accurate)

## What This Fixes

1. ✅ Better detection of checkmate threats
2. ✅ More accurate move classifications
3. ✅ Finds alternative best moves (Multi-PV)
4. ✅ More consistent analysis (depth-based)
5. ✅ Better evaluation of complex positions

## Note

These improvements will apply to **newly analyzed games**. Existing games analyzed with old settings will need to be re-analyzed to benefit from these improvements.

