# Development Guide

This document provides detailed instructions for setting up and developing the Chess Analysis App locally.

## Prerequisites

- **Python 3.11+** - For the analysis worker
- **Node.js 18+** - For the Next.js web app
- **Supabase account** - For the PostgreSQL database

## Initial Setup

### 1. Clone and Navigate

```bash
cd chess-app
```

### 2. Environment Configuration

Copy the example environment file and fill in your credentials:

```bash
cp env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous (public) key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `SUPABASE_HOST` | Database host (e.g., `db.xxxx.supabase.co`) |
| `SUPABASE_PASSWORD` | Database password |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as SUPABASE_URL (for frontend) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as SUPABASE_ANON_KEY (for frontend) |

### 3. Database Setup

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Open the SQL Editor
3. Copy and paste the contents of `db/schema.sql`
4. Run the SQL to create tables, views, and indexes

### 4. Install Dependencies

Using Make (recommended):

```bash
make setup
```

Or manually:

```bash
# Python worker
cd worker
pip install -r requirements.txt
cd ..

# Web app
cd web
npm install
cd ..
```

## Running the Application

### Start the Web Dashboard

```bash
make dev
# or
cd web && npm run dev
```

Access the dashboard at [http://localhost:3000](http://localhost:3000)

### Analyze Chess Games

```bash
# Analyze a specific month
make analyze USERNAME=magnuscarlsen YEAR=2024 MONTH=1

# Quick demo with sample data
make seed USERNAME=magnuscarlsen YEAR=2024 MONTH=1
```

## Project Structure

```
chess-app/
├── db/
│   └── schema.sql          # PostgreSQL schema, views, indexes
├── worker/                  # Python analysis engine
│   ├── engine.py           # Stockfish wrapper
│   ├── ingest.py           # Chess.com API + analysis orchestration
│   ├── chess_insights.py   # Tactical/positional pattern detection
│   ├── fast_ingest.py      # Optimized bulk ingestion
│   └── tests/              # pytest test suite
├── web/                     # Next.js frontend
│   └── src/
│       ├── app/            # App Router pages and API routes
│       ├── components/     # React components
│       └── lib/            # Utilities, types, Supabase client
├── Makefile                # Build automation
├── env.example             # Environment template
└── README.md               # Project overview
```

## Development Workflows

### Adding a New API Endpoint

1. Create route file in `web/src/app/api/[endpoint]/route.ts`
2. Export async functions: `GET`, `POST`, etc.
3. Use the Supabase client from `@/lib/supabase`

### Adding a New Dashboard Page

1. Create page directory in `web/src/app/[page-name]/`
2. Add `page.tsx` with your React component
3. Update navigation if needed

### Modifying Analysis Logic

1. Edit `worker/ingest.py` for ingestion changes
2. Edit `worker/engine.py` for Stockfish configuration
3. Edit `worker/chess_insights.py` for pattern detection
4. Run tests: `make test`

### Database Schema Changes

1. Update `db/schema.sql` with new tables/views
2. Apply changes via Supabase SQL Editor
3. Update TypeScript types in `web/src/lib/types.ts`

## Testing

### Python Tests

```bash
make test
# or
cd worker && python -m pytest tests/ -v
```

### Manual Testing

```bash
# Test Stockfish engine setup
cd worker
python -c "from engine import ChessEngine; e = ChessEngine(); print('OK')"

# Test database connection
python -c "from ingest import ChessComIngester; i = ChessComIngester(); print('DB OK')"
```

## Stockfish Configuration

The analysis engine can be tuned via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `STOCKFISH_SKILL_LEVEL` | 20 | Engine strength (0-20, 20 = strongest) |
| `STOCKFISH_THREADS` | 4 | CPU threads for analysis |
| `STOCKFISH_HASH` | 512 | Hash table size in MB |
| `STOCKFISH_MOVE_TIME_MS` | 1000 | Time per move in milliseconds |
| `STOCKFISH_DEPTH` | 18 | Analysis depth (if using depth mode) |
| `STOCKFISH_USE_DEPTH` | true | Use depth instead of time |

Higher values = better analysis but slower processing.

## Troubleshooting

### "Stockfish not found"

The worker automatically downloads Stockfish for your platform. If it fails:

```bash
# Check if binary exists
ls -la worker/bin/

# Manual download (macOS ARM)
mkdir -p worker/bin
curl -L https://github.com/official-stockfish/Stockfish/releases/latest/download/stockfish-macos-m1-apple-silicon.tar -o sf.tar
tar -xf sf.tar -C worker/bin/
```

### Database Connection Errors

1. Verify credentials in `.env`
2. Check Supabase dashboard for connection pooler settings
3. Ensure your IP is allowed (if using connection restrictions)

### "No games found" for a User

- Chess.com username must be exact (case-insensitive)
- User must have public game archives
- Games must exist for the specified month

### Web App Won't Start

```bash
# Clear cache and reinstall
cd web
rm -rf node_modules .next
npm install
npm run dev
```

## Code Style

- **Python**: Black formatter (88 char lines), isort for imports
- **TypeScript**: ESLint with Next.js config, Prettier

Format Python code:

```bash
cd worker
black .
isort .
```

## Useful Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make dev` | Start development server |
| `make test` | Run Python tests |
| `make analyze USERNAME=x YEAR=y MONTH=z` | Analyze games |
| `make clean` | Remove build artifacts |
| `make build` | Production build |
