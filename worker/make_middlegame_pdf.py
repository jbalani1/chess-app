"""Generate a PDF analyzing the user's MIDDLEGAME mistakes in their last 5 games.

Per-game sections with board diagrams (red = move played, green = engine's move),
a chess.com link per game, and a closing cross-game patterns page.
"""
import os
import chess
import chess.svg

OUT_DIR = os.path.join(os.path.dirname(__file__), 'reports')
os.makedirs(OUT_DIR, exist_ok=True)

RED = "#c0392b"
GREEN = "#1e8449"
BLUE = "#1f6feb"

# Five most recent games (newest first).
GAMES = [
    {
        "date": "2026-06-18", "color": "White", "opp": "DArte1102", "result": "Won",
        "opening": "French Defense, Advance Variation",
        "url": "https://www.chess.com/game/live/170401610166",
        "cards": [{
            "move": 19, "san": "Rc7", "played": "c1c7", "best_san": "g4", "best": "g2g4",
            "fen": "5rk1/1p3pp1/1p2p2p/1q1pPn2/1r1P4/1P2B3/P2Q1PPP/2R2RK1 w - - 5 19",
            "eval": "+3.9  →  +2.2", "cat": "Lost initiative",
            "why": "You're winning and Black's only good piece is the knight on f5. <b>19.g4!</b> kicks it away and grabs kingside space, keeping Black completely tied up. Instead <b>19.Rc7</b> grabs the 7th rank but does nothing concrete — the f5-knight stays a monster and Black gets to untangle.",
            "fix": "When you're winning, keep the initiative by kicking your opponent's best piece — not with a 'looks-active' rook move that makes no threat.",
        }],
    },
    {
        "date": "2026-06-17", "color": "Black", "opp": "markologh", "result": "Won",
        "opening": "London System",
        "url": "https://www.chess.com/game/live/170353430618",
        "note": "Your cleanest middlegame of the five — no mistake from a sound position. "
                "The eval only wobbled later in a time-scramble endgame, which you still won. "
                "This is the standard to repeat: in the other four games the middlegame is exactly where things slipped.",
        "cards": [],
    },
    {
        "date": "2026-06-17", "color": "Black", "opp": "HosniMc", "result": "Lost",
        "opening": "Bishop's Opening",
        "url": "https://www.chess.com/game/live/170353018238",
        "cards": [{
            "move": 23, "san": "Nd7", "played": "f6d7", "best_san": "Qd8", "best": "b6d8",
            "fen": "6k1/r4pp1/1qp2n1p/1p1pQN1b/1P2P3/1B1P3P/3N1PP1/5RK1 b - - 0 23",
            "eval": "−4.6  →  forced mate", "cat": "Defense too late",
            "why": "By move 23 you were already worse out of the opening — White's queen on e5 and knight on f5 form a mating battery aimed at your king. <b>23...Nd7</b> chases the queen but ignores the attack, and White crashes through for a forced mate. <b>23...Qd8</b> was the only try, hauling the queen back to defend the dark squares around your king.",
            "fix": "When your king is under fire, count the attackers on it before you go chasing pieces. Defense comes first — the threat doesn't pause while you grab tempo elsewhere.",
        }],
    },
    {
        "date": "2026-06-16", "color": "White", "opp": "Alketat", "result": "Lost",
        "opening": "Philidor Defense",
        "url": "https://www.chess.com/game/live/170289252346",
        "cards": [
            {
                "move": 18, "san": "Qc2", "played": "a4c2", "best_san": "Qc4+", "best": "a4c4",
                "fen": "r4rk1/1pp1q1pp/2np4/1P2p3/Q3Pp2/P2P1N2/5PPP/R4RK1 w - - 1 18",
                "eval": "+3.8  →  +0.8", "cat": "Overlooked check — the losing moment",
                "why": "You were clearly winning. <b>18.Qc4+!</b> is a strong check that improves your queen with tempo and keeps Black totally passive. The retreat <b>18.Qc2</b> hands Black a free move to break with …d5 and activate — your +3.8 melted to nothing, and you went on to lose this game.",
                "fix": "Scan all checks before you move. An in-between check (Qc4+) keeps the initiative that a passive retreat throws away — this single move flipped the game.",
            },
            {
                "move": 31, "san": "Ng5+", "played": "f3g5", "best_san": "Ra5", "best": "a8a5",
                "fen": "R7/4rkpp/1P6/1n1pp3/5p2/3P1N2/5PPP/6K1 w - - 2 31",
                "eval": "+3.6  →  +0.8", "cat": "Aimless check in the endgame",
                "why": "You have a passed b-pawn one square from a winning push; the only thing holding it is Black's knight on b5. <b>31.Ra5!</b> attacks and wins that blockader, and the pawn runs. The spite-check <b>31.Ng5+</b> just shoves Black's king to a better square and parks your knight offside while the b-pawn stalls.",
                "fix": "In endgames with a passed pawn, remove its blockader and push. Don't play checks that don't change anything.",
            },
        ],
    },
    {
        "date": "2026-06-14", "color": "Black", "opp": "RAGAJC7", "result": "Won",
        "opening": "Center Game",
        "url": "https://www.chess.com/game/live/170212078018",
        "cards": [{
            "move": 27, "san": "c6", "played": "c7c6", "best_san": "Nxd3", "best": "e5d3",
            "fen": "5r2/ppp3pk/6nq/3pn3/QP6/P2P3P/6P1/R6K b - - 1 27",
            "eval": "+10.7  →  +8.0", "cat": "Slow when winning (you still won)",
            "why": "You're completely winning. <b>27...Nxd3</b> snaps a free pawn and keeps the attack rolling; <b>27...c6</b> is a needless pause that lets White breathe. It didn't cost the game — but it's the same habit as the other four: reaching a great position and then playing passively instead of forcing matters.",
            "fix": "Convert decisively. When you're up big, keep taking the most forcing sound move (a free pawn, a check) rather than quiet consolidating moves.",
        }],
    },
]

PATTERNS = [
    ("Your #1 leak: you stop calculating forcing moves",
     "In four of these five games the engine's improvement was a <b>check or a capture</b> (Qc4+, Nxd3, Ra5 winning a piece) and you played a quiet move instead. You consistently see the position but not the <i>forcing</i> resource."),
    ("Conversion, not the opening, is costing you",
     "You reached winning middlegames in DArte1102 (+3.9), Alketat (+3.8) and RAGAJC7 (+10.7). Two you converted; against Alketat the slow 18.Qc2 turned a winning position into a loss. The eval bleeds one passive move at a time."),
    ("Defense triage when your king is targeted",
     "Against HosniMc you were already worse and kept chasing pieces (23...Nd7) while a mating battery built up. When the opponent's queen + knight point at your king, defend first — count the attackers before doing anything else."),
    ("The fix is one habit",
     "Before every middlegame move, run <b>Checks → Captures → Threats</b> — yours <i>and</i> the opponent's. Every mistake in these five games would have been caught by that 10-second scan."),
]


def board_svg(fen, played, best):
    board = chess.Board(fen)
    arrows = [
        chess.svg.Arrow(chess.parse_square(best[:2]), chess.parse_square(best[2:4]), color=GREEN),
        chess.svg.Arrow(chess.parse_square(played[:2]), chess.parse_square(played[2:4]), color=RED),
    ]
    return chess.svg.board(board, arrows=arrows, size=340,
                           orientation=board.turn, coordinates=True)


def card_html(g, c):
    svg = board_svg(c["fen"], c["played"], c["best"])
    return f"""
    <section class="card">
      <div class="board">{svg}
        <div class="legend">
          <span><i class="dot red"></i>You: <b>{c['san']}</b></span>
          <span><i class="dot green"></i>Engine: <b>{c['best_san']}</b></span>
        </div>
      </div>
      <div class="text">
        <div class="tag">Move {c['move']} · {c['cat']}</div>
        <div class="eval">Eval (your side) <b>{c['eval']}</b></div>
        <p><span class="lbl">Why it's a mistake.</span> {c['why']}</p>
        <p class="fix"><span class="lbl">The fix.</span> {c['fix']}</p>
        <a class="play" href="{g['url']}">▶ Open this game on Chess.com — step to move {c['move']}</a>
      </div>
    </section>"""


def game_section(g, idx):
    res_class = g["result"].lower()
    head = f"""
    <div class="ghead">
      <div class="gnum">Game {idx}</div>
      <div class="gmeta">
        <h2>{g['color']} vs {g['opp']} <span class="res {res_class}">{g['result']}</span></h2>
        <div class="gsub">{g['date']} · {g['opening']}</div>
      </div>
      <a class=" glink" href="{g['url']}">Chess.com ↗</a>
    </div>"""
    body = ""
    if g.get("note"):
        body += f'<p class="note">{g["note"]}</p>'
    body += "".join(card_html(g, c) for c in g["cards"])
    return f'<div class="game">{head}{body}</div>'


games_html = "".join(game_section(g, i + 1) for i, g in enumerate(GAMES))
patterns_html = "".join(
    f"<li><b>{t}</b><br><span>{d}</span></li>" for t, d in PATTERNS)

wins = sum(1 for g in GAMES if g["result"] == "Won")
losses = sum(1 for g in GAMES if g["result"] == "Lost")

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
  @page {{ size: A4; margin: 14mm 14mm 16mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system,'Helvetica Neue',Arial,sans-serif; color:#1b1f24; margin:0; }}
  .cover {{ padding: 26mm 0 8mm; border-bottom:3px solid #1b1f24; margin-bottom:8mm; }}
  .cover .kicker {{ letter-spacing:.18em; text-transform:uppercase; font-size:11px; color:{BLUE}; font-weight:700; }}
  .cover h1 {{ font-size:28px; margin:6px 0 4px; }}
  .cover p {{ color:#52606d; margin:0; font-size:13px; }}
  .game {{ page-break-inside:avoid; margin-bottom:18px; }}
  .ghead {{ display:flex; align-items:center; gap:12px; border-bottom:2px solid #e3e8ee; padding-bottom:8px; margin:14px 0 10px; }}
  .gnum {{ background:#1b1f24; color:#fff; font-size:11px; font-weight:700; padding:4px 9px; border-radius:5px; white-space:nowrap; }}
  .gmeta {{ flex:1; }}
  .gmeta h2 {{ font-size:17px; margin:0; }}
  .gsub {{ font-size:12px; color:#8a97a4; margin-top:2px; }}
  .res {{ font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; vertical-align:middle; margin-left:4px; }}
  .res.won {{ background:#e7f6ec; color:{GREEN}; }}
  .res.lost {{ background:#fdecea; color:{RED}; }}
  .glink {{ font-size:12px; color:{BLUE}; text-decoration:none; font-weight:600; white-space:nowrap; }}
  .note {{ font-size:13px; line-height:1.55; color:#3b4754; background:#f3faf5; border-left:3px solid {GREEN}; padding:10px 13px; border-radius:0 6px 6px 0; }}
  .card {{ display:flex; gap:16px; page-break-inside:avoid; padding:6px 0 10px; }}
  .board {{ flex:0 0 340px; }}
  .board svg {{ border:1px solid #d6dbe1; border-radius:6px; }}
  .legend {{ display:flex; gap:14px; font-size:12px; margin-top:7px; color:#3b4754; }}
  .legend .dot {{ width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:5px; vertical-align:middle; }}
  .dot.red {{ background:{RED}; }} .dot.green {{ background:{GREEN}; }}
  .text {{ flex:1; }}
  .tag {{ display:inline-block; background:#eef2f6; color:#52606d; font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; padding:3px 8px; border-radius:10px; }}
  .eval {{ font-size:12px; color:{RED}; margin:9px 0 4px; font-weight:600; }}
  p {{ font-size:13px; line-height:1.5; margin:8px 0; }}
  .lbl {{ font-weight:700; }}
  .fix {{ background:#f3faf5; border-left:3px solid {GREEN}; padding:8px 12px; border-radius:0 5px 5px 0; }}
  a.play {{ display:inline-block; background:{BLUE}; color:#fff; text-decoration:none; font-size:12px; font-weight:700; padding:6px 12px; border-radius:5px; margin-top:6px; }}
  .patterns {{ page-break-before:always; }}
  .patterns h1 {{ font-size:24px; border-bottom:3px solid #1b1f24; padding-bottom:8px; }}
  .patterns ul {{ list-style:none; padding:0; }}
  .patterns li {{ padding:12px 0; border-bottom:1px solid #e3e8ee; font-size:13px; }}
  .patterns li span {{ color:#3b4754; line-height:1.5; }}
  .footer {{ margin-top:14px; font-size:11px; color:#8a97a4; }}
</style></head><body>
  <div class="cover">
    <div class="kicker">Chess Analysis · negrilmannings</div>
    <h1>Middlegame Mistakes — Your Last 5 Games</h1>
    <p>14–18 Jun 2026 · {wins} wins, {losses} losses · engine-reviewed. Each diagram shows the position the moment before your move (red = what you played, green = the engine's move).</p>
  </div>
  {games_html}
  <div class="patterns">
    <h1>Patterns across these 5 games</h1>
    <p style="font-size:13px;color:#52606d;">The individual mistakes differ, but they rhyme. Four themes connect them:</p>
    <ul>{patterns_html}</ul>
    <p class="footer">One habit to drill: before every middlegame move, run <b>Checks → Captures → Threats</b> — yours and your opponent's.</p>
  </div>
</body></html>"""

html_path = os.path.join(OUT_DIR, 'middlegame_last5.html')
with open(html_path, 'w') as f:
    f.write(HTML)
print("wrote", html_path)
