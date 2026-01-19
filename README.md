# Chess.com Game Analysis App

A full-stack application that analyzes Chess.com games using Stockfish engine to identify mistakes, blunders, and patterns in your chess play.

## Features

- **Game Analysis**: Fetches games from Chess.com public API and analyzes every move with Stockfish
- **Move Classification**: Categorizes moves as Good, Inaccuracy, Mistake, or Blunder based on evaluation loss
- **Pattern Analysis**: Identifies mistakes by piece, opening, game phase, and time control
- **Interactive Dashboard**: Modern web interface to explore your chess performance
- **Detailed Game View**: Drill down into individual games with move-by-move analysis

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Chess.com     │    │   Python        │    │   Supabase      │
│   Public API    │───▶│   Worker        │───▶│   PostgreSQL    │
│                 │    │   (Stockfish)   │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Next.js 14    │
                       │   Web App       │
                       │   (Dashboard)   │
                       └─────────────────┘
```

## Tech Stack

- **Backend**: Python 3.11 with python-chess, Stockfish engine
- **Database**: Supabase (PostgreSQL) with optimized schema and views
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Charts**: Recharts for data visualization
- **Chess Board**: react-chessboard for interactive board display

## Move Classification

Moves are classified based on evaluation delta (centipawns):

- **Good**: Δeval ≥ -50 cp
- **Inaccuracy**: -50 > Δeval ≥ -150 cp  
- **Mistake**: -150 > Δeval ≥ -300 cp
- **Blunder**: Δeval < -300 cp

## Quick Start

### 1. Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the SQL schema from `db/schema.sql` in your Supabase SQL editor
3. Note your project URL and API keys

### 2. Environment Configuration

1. Copy `env.example` to `.env` in the project root
2. Fill in your Supabase credentials and Stockfish settings

```bash
cp env.example .env
```

### 3. Python Worker Setup

```bash
cd worker
pip install -r requirements.txt

# Test the setup
python -c "from engine import ChessEngine; print('Engine setup successful')"
```

### 4. Web App Setup

```bash
cd web
npm install
npm run dev
```

The web app will be available at `http://localhost:3000`

### 5. Analyze Games

```bash
cd worker

# Analyze one month of games for a user
python seed_one_month.py magnuscarlsen 2024 1

# Or analyze specific games
python ingest.py your_username 2024 1
```

## Usage

### Analyzing Games

The Python worker fetches games from Chess.com and analyzes them:

```bash
# Analyze all games for a user in a specific month
python ingest.py username 2024 1

# Use the demo script for quick testing
python seed_one_month.py username 2024 1
```

### Web Dashboard

Navigate to `http://localhost:3000` to access the dashboard:

- **Overview**: Total statistics and recent games
- **Mistakes by Piece**: See which pieces cause most mistakes
- **Mistakes by Opening**: Analyze opening performance
- **Game Details**: Drill down into individual games

### API Endpoints

The web app exposes REST APIs:

- `GET /api/games` - List games with filters
- `GET /api/mistakes?groupBy=piece` - Get mistake statistics
- `GET /api/analysis/[gameId]` - Get detailed game analysis

## Configuration

### Stockfish Settings

Configure engine strength and performance in `.env`:

```env
STOCKFISH_SKILL_LEVEL=20    # 0-20 (20 = strongest)
STOCKFISH_THREADS=4         # CPU threads to use
STOCKFISH_HASH=512          # Memory in MB
STOCKFISH_MOVE_TIME_MS=1000 # Time per move in milliseconds
```

### Database Views

The app uses several PostgreSQL views for efficient queries:

- `mistakes_by_piece` - Aggregated mistakes by piece type
- `mistakes_by_opening` - Mistakes grouped by ECO code and opening
- `mistakes_by_phase` - Mistakes by game phase (opening/middlegame/endgame)
- `game_statistics` - Overall performance statistics

## Development

### Running Tests

```bash
cd worker
python -m pytest tests/
```

### Project Structure

```
chess-analysis-app/
├── db/
│   └── schema.sql              # Database schema and views
├── worker/
│   ├── engine.py               # Stockfish integration
│   ├── ingest.py               # Chess.com API and analysis
│   ├── seed_one_month.py       # Demo script
│   ├── requirements.txt        # Python dependencies
│   └── tests/                  # Unit tests
├── web/
│   ├── src/
│   │   ├── app/                # Next.js app router pages
│   │   ├── components/         # React components
│   │   └── lib/                # Utilities and types
│   └── package.json            # Node.js dependencies
├── env.example                 # Environment variables template
└── README.md                   # This file
```

## Performance Considerations

- **Caching**: Analysis results are cached by engine configuration hash
- **Rate Limiting**: Built-in delays to respect Chess.com API limits
- **Database Indexes**: Optimized indexes for common query patterns
- **Deterministic Analysis**: Fixed depth/time for consistent results

## Security

- No Chess.com authentication required (uses public archives)
- Supabase RLS can be enabled for multi-user scenarios
- Environment variables for sensitive configuration
- No API keys stored in client-side code

## Troubleshooting

### Common Issues

1. **Stockfish not found**: The worker will automatically download Stockfish for your platform
2. **Database connection errors**: Verify Supabase credentials in `.env`
3. **No games found**: Check that the username exists and has public games
4. **Analysis taking too long**: Reduce `STOCKFISH_MOVE_TIME_MS` or `STOCKFISH_SKILL_LEVEL`

### Debug Mode

Enable debug logging:

```bash
export PYTHONPATH=.
python -c "import logging; logging.basicConfig(level=logging.DEBUG)"
python ingest.py username 2024 1
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [Chess.com](https://chess.com) for the public API
- [Stockfish](https://stockfishchess.org) for the chess engine
- [python-chess](https://python-chess.readthedocs.io) for PGN parsing
- [Supabase](https://supabase.com) for the database platform
