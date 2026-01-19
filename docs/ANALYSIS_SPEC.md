# Chess Analysis App - Complete Analysis Specification

## Overview

This document specifies all analyses the app enables, organized by category. Each analysis includes what data it uses, what insights it provides, and example queries/visualizations.

---

## 1. Aggregate Statistics

### 1.1 Overall Performance
| Metric | Description |
|--------|-------------|
| Total games analyzed | Count of all games in database |
| Total moves analyzed | Count of all moves |
| Accuracy percentage | % of moves classified as "good" |
| Mistake rate | % of moves that are mistakes or blunders |
| Average eval loss | Mean centipawn loss per move |

### 1.2 Win/Loss/Draw
| Metric | Description |
|--------|-------------|
| Win rate | % of games won |
| Loss rate | % of games lost |
| Draw rate | % of games drawn |
| Win rate as white | % wins when playing white |
| Win rate as black | % wins when playing black |

### 1.3 Performance by Color
| Metric | Description |
|--------|-------------|
| Games as white | Count |
| Games as black | Count |
| Accuracy as white | % good moves as white |
| Accuracy as black | % good moves as black |
| Mistake rate as white | |
| Mistake rate as black | |

---

## 2. Dimensional Breakdowns

### 2.1 By Piece
| Metric | Per Piece (P, N, B, R, Q, K) |
|--------|------------------------------|
| Total moves | How often each piece moved |
| Good moves | Count and % |
| Inaccuracies | Count and % |
| Mistakes | Count and % |
| Blunders | Count and % |
| Mistake rate | % mistakes+blunders |
| Avg eval loss | Mean centipawn loss |

**Insight:** Which pieces do you mishandle most?

### 2.2 By Opening (ECO)
| Metric | Per Opening |
|--------|-------------|
| Games played | Count |
| Win/loss/draw | Count and % |
| Total moves | In that opening's games |
| Mistakes | Count |
| Mistake rate | % |
| Avg eval loss | |

**Insight:** Which openings give you trouble?

### 2.3 By Phase
| Metric | Opening / Middlegame / Endgame |
|--------|--------------------------------|
| Total moves | Count per phase |
| Good moves | Count and % |
| Mistakes | Count and % |
| Blunders | Count and % |
| Mistake rate | % |
| Avg eval loss | |

**Insight:** Where in the game do you struggle most?

### 2.4 By Time Control
| Metric | Per Time Control |
|--------|------------------|
| Games played | Count |
| Win rate | % |
| Mistake rate | % |
| Blunder rate | % |
| Avg eval loss | |

**Insight:** Do you perform differently in bullet vs rapid vs classical?

---

## 3. Opening Repertoire Analysis

### 3.1 White Repertoire
| Metric | Description |
|--------|-------------|
| Openings played | List of ECO codes + names |
| Frequency | Games per opening |
| Win rate | % wins in each opening |
| Mistake rate | % mistakes in each opening |
| Best opening | Highest win rate |
| Worst opening | Lowest win rate or highest mistake rate |

### 3.2 Black Repertoire
Same metrics as White Repertoire, for games as black.

### 3.3 Opening Depth Analysis
| Metric | Description |
|--------|-------------|
| Average book depth | Move number where first mistake occurs |
| Preparation coverage | % of games staying in "book" past move 10 |
| Transition quality | Mistake rate in moves 10-20 |

### 3.4 Opening Category Performance
| Category | Description |
|----------|-------------|
| Open Games (1.e4 e5) | Aggregate stats for all C-codes |
| Semi-Open (1.e4, other) | Aggregate for B-codes (Sicilian, Caro-Kann, etc.) |
| Closed Games (1.d4 d5) | Aggregate for D-codes |
| Indian Defenses | Aggregate for E-codes |
| Flank Openings | Aggregate for A-codes |

---

## 4. Temporal Analysis

### 4.1 Move Number Heatmap
| Metric | Description |
|--------|-------------|
| Mistake distribution | Which move numbers have most mistakes |
| Critical ranges | Move ranges with >2x average mistake rate |
| Opening-to-middlegame transition | Mistakes in moves 10-20 |
| Endgame onset | Mistakes in moves 40-60 |

**Visualization:** Heatmap showing mistake frequency by move number.

### 4.2 Performance Over Time
| Metric | Description |
|--------|-------------|
| Monthly accuracy | Accuracy % per month |
| Monthly mistake rate | Mistake % per month |
| Trend direction | Improving, stable, or declining |
| Best month | Lowest mistake rate |
| Worst month | Highest mistake rate |

### 4.3 Day/Time Patterns (if timestamps available)
| Metric | Description |
|--------|-------------|
| Performance by day of week | Mistake rate per day |
| Performance by hour | Mistake rate by time of day |
| Fatigue detection | Mistake rate in game 5+ of a session |

---

## 5. Pattern Analysis

### 5.1 Recurring Mistake Patterns
```
Pattern {
  pattern_name: string          // e.g., "Missed knight forks"
  category: tactical | positional | strategic | endgame
  phase: opening | middlegame | endgame
  piece_involved: P | N | B | R | Q | K | null
  occurrences: number
  avg_eval_loss: number         // centipawns
  example_games: uuid[]         // up to 5 examples
  example_positions: FEN[]
  explanation: string
  suggested_training: string
}
```

### 5.2 Pattern Categories

#### Tactical Patterns
| Pattern | Description |
|---------|-------------|
| Missed forks | Failed to play or prevent forks |
| Missed pins | Failed to exploit or avoid pins |
| Missed skewers | Failed to play or prevent skewers |
| Missed discoveries | Missed discovered attacks |
| Back rank blindness | Back rank mate threats missed |
| Overloaded pieces | Failed to exploit overloaded defenders |

#### Positional Patterns
| Pattern | Description |
|---------|-------------|
| Weak square creation | Created chronic weaknesses |
| Passive piece placement | Pieces on poor squares |
| Pawn structure damage | Unnecessary pawn weaknesses |
| King safety neglect | Failed to address king safety |
| Piece coordination failure | Pieces not working together |

#### Strategic Patterns
| Pattern | Description |
|---------|-------------|
| Premature attack | Attacking without preparation |
| Passive defense | Defending without counterplay |
| Plan-less play | Random moves without purpose |
| Exchanging wrongly | Bad piece trades |
| Ignoring opponent threats | Missing opponent's ideas |

#### Endgame Patterns
| Pattern | Description |
|---------|-------------|
| King activity failure | King not activated in endgame |
| Pawn race miscalculation | Wrong calculation in pawn races |
| Wrong rook placement | Rook behind/in front of pawn errors |
| Stalemate blindness | Missing stalemate tricks |
| Opposition failure | Not using king opposition |

---

## 6. Blunder Classification Taxonomy

Every mistake/blunder is assigned exactly ONE category:

| Category | Description | Detection Logic |
|----------|-------------|-----------------|
| `hanging_piece` | Left piece undefended | Piece has attackers, no defenders |
| `missed_tactic` | Opponent had winning tactic | Best move was tactical, wasn't played |
| `overlooked_check` | Missed check or checkmate | Check/mate existed, wasn't seen |
| `greedy_capture` | Took bait, lost more | Captured but eval dropped more than captured value |
| `back_rank` | Back rank weakness | King trapped, back rank exploited |
| `opening_principle` | Violated opening rules | Early queen, same piece twice, no castling |
| `endgame_technique` | Poor endgame knowledge | Mistake in endgame phase |
| `time_pressure` | Clock < 60 seconds | Move made under time pressure |
| `positional_collapse` | Position deteriorated | No tactical cause, position just got worse |
| `calculation_error` | Miscounted or missed a move | Large eval swing (>400cp) |

### 6.1 Blunder Analysis Views
| View | Description |
|------|-------------|
| Blunders by category | Frequency of each blunder type |
| Blunders by category + phase | Where each type happens most |
| Blunders by category + piece | Which pieces involved in each type |
| Blunder priority ranking | Weighted by frequency × severity |
| Training recommendations | Study suggestions per category |

---

## 7. Psychological/Situational Analysis

### 7.1 Performance by Position Evaluation
| Situation | Metrics |
|-----------|---------|
| When winning (+200cp) | Mistake rate, conversion rate |
| When losing (-200cp) | Comeback rate, resignation point |
| When equal (±50cp) | Decision quality |
| When slightly better (+50 to +200cp) | Do you press or lose edge? |
| When slightly worse (-50 to -200cp) | Do you defend or collapse? |

### 7.2 Tilt Detection
| Metric | Description |
|--------|-------------|
| Mistake clustering | Do mistakes come in bunches? |
| Post-blunder performance | Mistake rate in 5 moves after a blunder |
| Recovery ability | How often position stabilizes after mistake |

### 7.3 Endurance
| Metric | Description |
|--------|-------------|
| Long game performance | Mistake rate in games >60 moves |
| Late-game accuracy | Accuracy in moves 40+ |
| Fatigue indicator | Accuracy decline over game length |

---

## 8. Tactical Awareness Profile

### 8.1 By Tactical Motif
| Motif | Executed | Missed | Net Score |
|-------|----------|--------|-----------|
| Fork | Count | Count | Executed - Missed |
| Pin | Count | Count | |
| Skewer | Count | Count | |
| Discovery | Count | Count | |
| Deflection | Count | Count | |
| Decoy | Count | Count | |
| Back rank | Count | Count | |
| Overloading | Count | Count | |

### 8.2 Tactical Complexity
| Metric | Description |
|--------|-------------|
| Avg tactic depth | Average depth of tactics you find |
| Simple tactic accuracy | 1-2 move tactics |
| Complex tactic accuracy | 3+ move tactics |
| Defensive tactic awareness | Spotting opponent's threats |

---

## 9. Endgame Proficiency

### 9.1 By Endgame Type
| Endgame | Games | Win Rate | Mistake Rate |
|---------|-------|----------|--------------|
| King + Pawn | | | |
| Rook endings | | | |
| Rook + Pawn | | | |
| Minor piece endings | | | |
| Queen endings | | | |
| Opposite color bishops | | | |

### 9.2 Endgame Metrics
| Metric | Description |
|--------|-------------|
| Conversion rate | % of winning endgames converted |
| Holdout rate | % of losing endgames held to draw |
| Technique score | Accuracy in theoretical positions |

---

## 10. Comparative Analysis

### 10.1 Opponent Strength
| Opponent Rating | Games | Win Rate | Mistake Rate |
|-----------------|-------|----------|--------------|
| Higher rated (+100) | | | |
| Similar rated (±100) | | | |
| Lower rated (-100) | | | |

### 10.2 Color Comparison
| Metric | As White | As Black | Delta |
|--------|----------|----------|-------|
| Win rate | | | |
| Accuracy | | | |
| Mistake rate | | | |
| Avg game length | | | |

### 10.3 Result Analysis
| Metric | Wins | Losses | Draws |
|--------|------|--------|-------|
| Avg accuracy | | | |
| Avg mistakes | | | |
| Common phase of decisive error | | | |

---

## 11. Improvement Tracking

### 11.1 Trend Metrics
| Metric | Description |
|--------|-------------|
| Accuracy trend | 3-month moving average |
| Mistake rate trend | 3-month moving average |
| Blunder frequency trend | Are blunders decreasing? |

### 11.2 Area-Specific Progress
| Area | Baseline | Current | Change |
|------|----------|---------|--------|
| Opening accuracy | | | |
| Middlegame accuracy | | | |
| Endgame accuracy | | | |
| Tactical awareness | | | |
| Time management | | | |

### 11.3 Persistent Weaknesses
| Weakness | Duration | Severity | Priority |
|----------|----------|----------|----------|
| Pattern that hasn't improved | Months | Avg eval loss | Rank |

---

## 12. Actionable Recommendations

### 12.1 Training Priority Queue
```
Recommendation {
  priority: 1-5
  area: string              // "Knight endgames"
  problem: string           // "42% mistake rate, 3x your average"
  evidence: string          // "Based on 23 games"
  suggested_study: string   // "Practice knight vs pawns"
  resource_link: string     // Optional external resource
  example_positions: FEN[]  // Positions to review
  estimated_impact: string  // "High" / "Medium" / "Low"
}
```

### 12.2 Weekly Focus Areas
Based on recent games, suggest 2-3 areas to focus on this week.

### 12.3 Progress Milestones
| Milestone | Status | Date Achieved |
|-----------|--------|---------------|
| < 5% blunder rate | | |
| < 10% mistake rate | | |
| 90%+ opening accuracy | | |
| 85%+ endgame accuracy | | |

---

## 13. Filtering & Segmentation

All analyses support filtering by:

| Filter | Values |
|--------|--------|
| `piece` | P, N, B, R, Q, K |
| `phase` | opening, middlegame, endgame |
| `user_color` | white, black |
| `time_control` | 60, 180, 300, 600, 900, etc. |
| `eco` | A00-E99 (supports prefix matching) |
| `opening_name` | Partial text match |
| `classification` | good, inaccuracy, mistake, blunder |
| `blunder_category` | hanging_piece, missed_tactic, etc. |
| `date_range` | from/to dates |
| `result` | 1-0, 0-1, 1/2-1/2 |

**Compound filters enabled:**
- "Knight blunders in the endgame"
- "Sicilian games as black where I made opening mistakes"
- "Blitz games where I hung a piece"

---

## 14. Visualizations Required

| Analysis | Visualization Type |
|----------|-------------------|
| Mistakes by piece | Bar chart |
| Mistakes by phase | Bar chart (ordered) |
| Mistakes by opening | Table with sparklines |
| Move number heatmap | Heatmap grid |
| Performance over time | Line chart |
| Blunder taxonomy | Pie chart / donut |
| Win rate by opening | Horizontal bar |
| Accuracy trend | Line chart with trendline |
| Tactical motifs | Radar chart |
| Endgame breakdown | Stacked bar |

---

## 15. Data Requirements

### Currently Available
- [x] Games: username, time_control, eco, opening_name, result, white/black player, played_at
- [x] Moves: ply, move_san, move_uci, eval_before, eval_after, eval_delta, classification, piece_moved, phase, position_fen
- [x] Tactical motifs (JSONB)
- [x] Positional patterns (JSONB)

### Needs Schema Addition
- [ ] `games.user_color` - computed column
- [ ] `moves.blunder_category` - taxonomy classification
- [ ] `moves.blunder_details` - JSONB with explanation
- [ ] `opening_categories` table - ECO taxonomy
- [ ] `blunder_patterns` table - aggregated patterns

### Would Require External Data
- [ ] Move timestamps (for time pressure analysis)
- [ ] Opponent rating (for comparative analysis)
- [ ] Opening book database (for book depth analysis)

---

## Notes / Questions

*Add your comments, modifications, or questions here:*

1.
2.
3.

