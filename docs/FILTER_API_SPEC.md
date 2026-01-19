# Filter API Specification

## New Query Parameters

### GET /api/games

| Parameter | Type | Description |
|-----------|------|-------------|
| `username` | string | Filter by username |
| `time_control` | string | Filter by time control (e.g., "600", "180+2") |
| `eco` | string | Filter by ECO code (e.g., "B90" or "B" for all B codes) |
| `opening_name` | string | Filter by opening name (partial match) |
| `user_color` | string | **NEW**: Filter by user's color ("white" or "black") |
| `date_from` | ISO date | Games played on or after this date |
| `date_to` | ISO date | Games played on or before this date |
| `result` | string | Filter by result ("1-0", "0-1", "1/2-1/2") |

**Examples:**
```
GET /api/games?user_color=white&eco=B
GET /api/games?user_color=black&opening_name=Sicilian
GET /api/games?time_control=300&user_color=white
```

---

### GET /api/mistakes

| Parameter | Type | Description |
|-----------|------|-------------|
| `groupBy` | enum | Required: "piece", "opening", "phase", "time_control" |
| `piece` | string | **NEW**: Filter by piece ("P", "N", "B", "R", "Q", "K") |
| `phase` | enum | Filter by phase ("opening", "middlegame", "endgame") |
| `user_color` | string | **NEW**: Filter by user's color |
| `time_control` | string | Filter by time control |
| `eco` | string | **NEW**: Filter by opening ECO code |

**Examples:**
```
GET /api/mistakes?groupBy=piece&phase=endgame
GET /api/mistakes?groupBy=piece&user_color=black
GET /api/mistakes?groupBy=opening&user_color=white
GET /api/mistakes?groupBy=phase&eco=B90
```

---

### GET /api/mistakes/list (NEW)

Returns individual mistake moves with full filtering.

| Parameter | Type | Description |
|-----------|------|-------------|
| `piece` | string | Filter by piece moved |
| `phase` | enum | Filter by game phase |
| `user_color` | string | Filter by user's color |
| `time_control` | string | Filter by time control |
| `eco` | string | Filter by opening ECO code |
| `classification` | enum | "mistake" or "blunder" (default: both) |
| `limit` | number | Results per page (default: 100) |
| `offset` | number | Pagination offset |

**Examples:**
```
GET /api/mistakes/list?piece=N&classification=blunder
GET /api/mistakes/list?phase=endgame&piece=R
GET /api/mistakes/list?eco=B90&user_color=black
```

**Response:**
```json
{
  "mistakes": [
    {
      "move_id": "uuid",
      "game_id": "uuid",
      "ply": 34,
      "move_san": "Nd4??",
      "piece_moved": "N",
      "phase": "middlegame",
      "classification": "blunder",
      "eval_before": 150,
      "eval_after": -450,
      "eval_delta": -600,
      "position_fen": "rnbqkb1r/...",
      "played_at": "2024-01-15T...",
      "opening_name": "Sicilian Defense: Najdorf",
      "user_color": "white",
      "time_control": "600"
    }
  ],
  "total": 47,
  "filters_applied": {
    "piece": "N",
    "classification": "blunder"
  }
}
```

---

### GET /api/openings (NEW)

Returns opening statistics grouped by user color.

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_color` | string | "white", "black", or omit for both |
| `min_games` | number | Minimum games played (default: 1) |

**Examples:**
```
GET /api/openings?user_color=white
GET /api/openings?user_color=black&min_games=5
```

**Response:**
```json
{
  "openings": [
    {
      "eco": "B90",
      "opening_name": "Sicilian Defense: Najdorf Variation",
      "user_color": "white",
      "games_played": 12,
      "wins": 7,
      "losses": 3,
      "draws": 2,
      "win_rate": 58.3,
      "total_mistakes": 24,
      "mistake_rate": 4.2
    }
  ],
  "summary": {
    "total_openings": 15,
    "most_played": "B90",
    "best_win_rate": "C50",
    "worst_mistake_rate": "D30"
  }
}
```

---

### GET /api/filters (NEW)

Returns available filter values for UI dropdowns.

**Response:**
```json
{
  "pieces": ["P", "N", "B", "R", "Q", "K"],
  "phases": ["opening", "middlegame", "endgame"],
  "time_controls": ["60", "180", "300", "600", "900"],
  "user_colors": ["white", "black"],
  "openings": [
    {"eco": "B90", "name": "Sicilian Defense: Najdorf"},
    {"eco": "C50", "name": "Italian Game"}
  ]
}
```

---

## Database Functions

The schema provides these PostgreSQL functions for efficient filtered queries:

### `get_mistakes_by_piece()`
```sql
SELECT * FROM get_mistakes_by_piece(
    p_phase := 'endgame',
    p_user_color := 'white',
    p_time_control := NULL,
    p_eco := 'B'
);
```

### `get_filtered_mistakes()`
```sql
SELECT * FROM get_filtered_mistakes(
    p_piece_moved := 'N',
    p_phase := NULL,
    p_user_color := 'black',
    p_time_control := NULL,
    p_eco := 'B90',
    p_classification := 'blunder',
    p_limit := 50,
    p_offset := 0
);
```

---

## UI Filter Components Needed

### Mistake Explorer Page
```
┌─────────────────────────────────────────────────────┐
│  Filters:                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Piece ▼  │ │ Phase ▼  │ │ Opening ▼│ │ Color ▼│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                     │
│  ☑ Mistakes  ☑ Blunders                            │
├─────────────────────────────────────────────────────┤
│  Results: 47 mistakes found                         │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Nd4?? (-600cp) │ Sicilian │ Move 34 │ View  │   │
│  │ Bxf7?  (-320cp) │ Italian  │ Move 12 │ View  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Opening Repertoire Page
```
┌─────────────────────────────────────────────────────┐
│  [As White]  [As Black]                             │
├─────────────────────────────────────────────────────┤
│  My White Repertoire                                │
│  ┌─────────────────────────────────────────────┐   │
│  │ Opening         │ Games │ Win% │ Mistakes   │   │
│  │ Sicilian (B20+) │  45   │ 62%  │ 3.2/game   │   │
│  │ Italian (C50)   │  23   │ 70%  │ 2.1/game   │   │
│  │ Ruy Lopez (C60) │  18   │ 55%  │ 4.0/game   │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```
