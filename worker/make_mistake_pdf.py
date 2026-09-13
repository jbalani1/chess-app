"""Generate an HTML report of recurring Italian-Opening mistakes with board diagrams.

Renders each position (the moment BEFORE the mistake) as an inline SVG board:
  red arrow  = the move you played (the mistake)
  green arrow = the move the engine prefers
Then the companion node script prints the HTML to PDF via Chromium.
"""
import os
import chess
import chess.svg

OUT_DIR = os.path.join(os.path.dirname(__file__), 'reports')
os.makedirs(OUT_DIR, exist_ok=True)

RED = "#c0392b"
GREEN = "#1e8449"
BLUE = "#1f6feb"

# One real game per position (matched by exact position-before-move FEN).
# url = chess.com game link; open it and step to the listed move.
GAME_LINKS = {
    "cxd4":  {"url": "https://www.chess.com/game/live/166484589110", "vs": "Ssonic2",          "date": "2026-03-27", "move": 6,  "result": "won"},
    "dxe5":  {"url": "https://www.chess.com/game/live/147262115482", "vs": "Rhett66",           "date": "2025-12-28", "move": 6,  "result": "lost"},
    "exf5":  {"url": "https://www.chess.com/game/live/169345797320", "vs": "iq_bhav",           "date": "2026-05-27", "move": 4,  "result": "lost"},
    "Bxf7+": {"url": "https://www.chess.com/game/live/165649518244", "vs": "jordan_2_3",        "date": "2026-03-07", "move": 6,  "result": "lost"},
    "Nd5":   {"url": "https://www.chess.com/game/live/168022462502", "vs": "JohannRaw",         "date": "2026-04-29", "move": 9,  "result": "lost"},
    "Re1":   {"url": "https://www.chess.com/game/live/167586190724", "vs": "dipeshshrestha29",  "date": "2026-04-20", "move": 9,  "result": "lost"},
    "f4":    {"url": "https://www.chess.com/game/live/165703043820", "vs": "Milleragua",        "date": "2026-03-09", "move": 15, "result": "won"},
    "hxg4":  {"url": "https://www.chess.com/game/live/164258460116", "vs": "Danilka968",        "date": "2026-02-05", "move": 16, "result": "lost"},
}

# Curated recurring mistakes. fen is the position BEFORE the user's move.
# played = the mistake (UCI), best = engine's move (UCI).
MISTAKES = [
    {
        "tag": "Central exchange",
        "title": "cxd4 — releasing the center on autopilot",
        "line": "1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Qf6 5.d4 exd4 6.cxd4?!",
        "fen": "r1b1k1nr/pppp1ppp/2n2q2/2b5/2BpP3/2P2N2/PP3PPP/RNBQK2R w KQkq - 0 6",
        "played": "c3d4", "played_san": "cxd4",
        "best": "e4e5", "best_san": "e5",
        "eval": "+0.9  →  -0.7",
        "freq": "Played as a mistake 4+ times — your single most common opening error.",
        "why": "Recapturing with the c-pawn restores material symmetry but throws away the entire point of the c3+d4 center. Instead <b>6.e5!</b> hits the f6-queen <i>and</i> plants a big space-gaining pawn, kicking Black's pieces around with tempo. By playing cxd4 you hand Black free, comfortable development and turn a clear edge into a worse position.",
        "fix": "In the c3/d4 Giuoco Piano, when you can push <b>e5</b> with tempo, push it — don't reflexively recapture the pawn.",
    },
    {
        "tag": "Central exchange",
        "title": "dxe5 — grabbing a pawn while your pieces hang",
        "line": "1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.c3 Nxe4 5.d4 Nd6 6.dxe5?!",
        "fen": "r1bqkb1r/pppp1ppp/2nn4/4p3/2BP4/2P2N2/PP3PPP/RNBQK2R w KQkq - 1 6",
        "played": "d4e5", "played_san": "dxe5",
        "best": "c4d5", "best_san": "Bd5",
        "eval": "0.0  →  -4.3",
        "freq": "Recurring central-capture error (≈ -3 to -4 each time).",
        "why": "Black has just played 5...Nd6 attacking your bishop. The natural-looking 6.dxe5 runs into <b>6...Nxc4</b> and Black is comfortably better — you've ripped open the center with your own king still in the middle. <b>6.Bd5!</b> saves the bishop, keeps the central tension, and keeps pressure on c6/e4.",
        "fix": "Don't release central tension to 'win' a pawn when your own pieces are under attack — deal with the threat first.",
    },
    {
        "tag": "Central exchange",
        "title": "exf5 — taking the bait instead of striking the center",
        "line": "1.e4 e5 2.Nf3 Nc6 3.Bc4 f5 4.exf5?!",
        "fen": "r1bqkbnr/pppp2pp/2n5/4pp2/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
        "played": "e4f5", "played_san": "exf5",
        "best": "d2d4", "best_san": "d4",
        "eval": "+1.3  →  -0.3",
        "freq": "Your most-repeated pawn-capture mistake (4×).",
        "why": "Black's 3...f5 (the Rousseau Gambit) is a bluff — you don't have to take it. <b>4.d4!</b> blows open the center while Black's king is exposed and underdeveloped, keeping a clear edge. Grabbing <b>4.exf5</b> instead opens the e-file for Black and hands the gambit exactly the open lines it wants.",
        "fix": "When you're offered a wing pawn (…f5) in the opening, the refutation is almost always a central strike (d4) — not the greedy capture.",
    },
    {
        "tag": "Unsound sacrifice",
        "title": "Bxf7+ — the hope sacrifice that never works",
        "line": "1.e4 e5 2.Nf3 Nc6 3.Bc4 h6 4.d4 exd4 5.Nxd4 Ne5 6.Bxf7+?",
        "fen": "r1bqkbnr/pppp1pp1/7p/4n3/2BNP3/8/PPP2PPP/RNBQK2R w KQkq - 1 6",
        "played": "c4f7", "played_san": "Bxf7+",
        "best": "c4e2", "best_san": "Be2",
        "eval": "+0.8  →  -3.0",
        "freq": "Played 7 times (mostly outright blunders) on moves 6 and 9.",
        "why": "<b>6.Bxf7+ Kxf7</b> simply gives away a bishop for a pawn. There is no follow-up: your queen and pieces aren't coordinated for a king hunt, so Black's king strolls to safety a clean piece up. This is a 'hope' sac. <b>6.Be2</b> keeps your extra space and sound position where you're already better.",
        "fix": "A sac on f7 only works with concrete forced follow-up (Ng5 + Qh5 ideas, etc.). If you can't calculate the win, retreat the bishop and stay better.",
    },
    {
        "tag": "Premature piece move",
        "title": "Nd5 — a lunge that just gets traded off",
        "line": "Giuoco Piano middlegame … 9.Nd5?!",
        "fen": "r3k2r/1ppbqppp/2np1n2/pBb1p3/P3P3/2NP1N2/1PP2PPP/R1BQ1RK1 w kq - 4 9",
        "played": "c3d5", "played_san": "Nd5",
        "best": "c1g5", "best_san": "Bg5",
        "eval": "+1.4  →  -0.3",
        "freq": "Played as a mistake 4 times.",
        "why": "9.Nd5 looks active but it can be challenged immediately: <b>9...Nxd5</b> 10.Bxd5 trades off your best-placed piece and relieves Black's cramped position. <b>9.Bg5!</b> instead develops with a threat (pin on f6, pressure on the center) and keeps your full advantage.",
        "fix": "Before jumping a knight to d5, ask 'can it just be taken or chased?' If trading it helps your opponent, develop a different piece with purpose.",
    },
    {
        "tag": "Autopilot developing move",
        "title": "Re1 — a 'useful' move that misses the moment",
        "line": "Italian middlegame … 9.Re1?!",
        "fen": "r2qkb1r/p1p2pp1/2ppbn1p/8/P1B1P3/8/1PP2PPP/RNBQ1RK1 w kq - 0 9",
        "played": "f1e1", "played_san": "Re1",
        "best": "c4e6", "best_san": "Bxe6",
        "eval": "+0.9  →  -3.3",
        "freq": "Played as a mistake 5 times — your most-repeated rook error.",
        "why": "The e-file is closed, so the rook on e1 does nothing yet. The concrete move is <b>9.Bxe6!</b> fxe6, wrecking Black's pawn structure while you're better. Playing the slow Re1 lets Black untangle with …Bxc4 on their own terms and seize the initiative.",
        "fix": "Look for forcing moves (captures, checks, threats) <i>before</i> slow 'improving' moves. Don't develop on autopilot when a favorable trade is on the board.",
    },
    {
        "tag": "King-safety pawn push",
        "title": "f4 — loosening your own king for no reason",
        "line": "Italian middlegame … 15.f4?!",
        "fen": "r1b1r1k1/2pp1pp1/p6p/1p2b3/4P3/2NB4/PPP2PPP/R3R1K1 w - - 2 15",
        "played": "f2f4", "played_san": "f4",
        "best": "a2a4", "best_san": "a4",
        "eval": "0.0  →  -2.0",
        "freq": "Played as a mistake 4× — a recurring 'looks active' push.",
        "why": "With your king on g1 and no attack prepared, <b>15.f4</b> shoves a pawn forward and tears open the diagonal and f-file toward your <i>own</i> king — Black's e5-bishop and rooks get free play. The position was dead level; <b>15.a4</b> keeps it solid. f4 is a committal push with no concrete follow-up that mainly weakens you.",
        "fix": "Don't push f4 to 'look active' — it loosens your king. Advance the f-pawn only when you have a real, calculated attack.",
    },
    {
        "tag": "King-safety pawn push",
        "title": "hxg4 — recapturing into your own king",
        "line": "Giuoco Piano … 16.hxg4?!",
        "fen": "r3k2r/bppq2p1/p1npp3/P3p1Bp/1P2P1n1/1QPP1N1P/5PP1/RN1R2K1 w kq - 3 16",
        "played": "h3g4", "played_san": "hxg4",
        "best": "g5h4", "best_san": "Bh4",
        "eval": "+1.2  →  -1.4",
        "freq": "Recurring (4×) — capturing toward your own king.",
        "why": "Taking the knight with <b>16.hxg4</b> rips open the h-file directly in front of your king and gives Black's heavy pieces an attacking highway. You were clearly better; <b>16.Bh4</b> calmly repositions the bishop and keeps your king's cover intact. The recapture felt forced, but it's the losing decision.",
        "fix": "When a piece attacks near your king, prefer repositioning over a pawn-capture that shreds your own shelter.",
    },
]

# Hard numbers shared in analysis (Italian games, user's moves only).
STATS = {
    "categories": [
        ("Hanging piece (left en prise)", 506, "−15.4"),
        ("Positional collapse (no clear plan)", 224, "−1.9"),
        ("Greedy capture (took the bait)", 120, "−23.3"),
        ("Overlooked check / in-between move", 105, "−30.0"),
        ("Calculation error", 82, "−37.4"),
        ("Endgame technique", 42, "−13.0"),
        ("Back-rank weakness", 25, "−18.9"),
        ("Opening-principle violation", 19, "−7.2"),
    ],
    "pieces": [("Rook", 245), ("Queen", 198), ("Pawn", 190),
               ("Bishop", 184), ("King", 161), ("Knight", 145)],
    "timing": [
        ("Moves 1–10 (opening)", 149, False),
        ("Moves 11–20 (opening/early mid)", 370, False),
        ("Moves 21–30 (middlegame)", 315, True),
        ("Moves 31–40 (middlegame)", 171, False),
        ("Move 41+ (endgame)", 118, False),
    ],
    "captures": [("exf5", 4), ("cxd4", 4), ("hxg4", 4),
                 ("dxc6", 3), ("dxe5", 3), ("gxh3", 2), ("fxg4", 2)],
    "motifs": "Pins (124) and skewers (74) recur — most often the unaddressed "
              "<b>…Bg4</b> pin on your f3-knight. Positionally, <b>king-safety</b> (624 flags) "
              "and <b>pawn-structure</b> (508 flags) damage dominate, confirming the "
              "f4 / hxg4 / exf5 self-weakening theme above.",
}

THEMES = [
    ("Hanging pieces — your #1 leak (506 instances)",
     "Pieces left en prise, most often your <b>rook or queen</b>. Run a silent 'is anything of mine attacked / undefended?' check before every move."),
    ("Greedy captures (120 instances, avg −2.3)",
     "Taking material that loses more — the Bxf7+ family and stray pawn-grabs. Ask 'why is this offered to me?' before you take."),
    ("King-safety pawn captures (624 flags)",
     "Moves like <b>f4, hxg4, exf5, gxh3</b> that rip open the shelter around <i>your own</i> king. Keep your king's pawns intact unless you've calculated the attack."),
    ("Getting pinned & skewered (≈200 flags)",
     "You don't neutralize the recurring <b>…Bg4</b> pin on your f3-knight — calmly play <b>h3</b> to break it instead of lashing out."),
    ("Overlooked checks (105 instances, avg −3.0)",
     "You miss the opponent's check / in-between move. Scan all checks (yours and theirs) every move."),
]


def board_svg(fen, played, best):
    board = chess.Board(fen)
    arrows = [
        chess.svg.Arrow(chess.parse_square(best[:2]), chess.parse_square(best[2:4]), color=GREEN),
        chess.svg.Arrow(chess.parse_square(played[:2]), chess.parse_square(played[2:4]), color=RED),
    ]
    return chess.svg.board(board, arrows=arrows, size=360,
                           orientation=board.turn, coordinates=True)


def game_link(m):
    g = GAME_LINKS.get(m["played_san"])
    if not g:
        return ""
    res = ("you won" if g["result"] == "won" else "you lost")
    return (f'<a class="play" href="{g["url"]}">▶ Play it out on Chess.com</a>'
            f'<span class="play-meta">vs {g["vs"]} · {g["date"]} · {res} · '
            f'open and step to move {g["move"]}</span>')


def card(i, m):
    svg = board_svg(m["fen"], m["played"], m["best"])
    return f"""
    <section class="card">
      <div class="board">{svg}
        <div class="legend">
          <span><i class="dot red"></i>Your move: <b>{m['played_san']}</b></span>
          <span><i class="dot green"></i>Engine: <b>{m['best_san']}</b></span>
        </div>
      </div>
      <div class="text">
        <div class="tag">{m['tag']}</div>
        <h2>{i}. {m['title']}</h2>
        <div class="line">{m['line']}</div>
        <div class="eval">Eval swing <b>{m['eval']}</b></div>
        <p class="freq">{m['freq']}</p>
        <p><span class="lbl">Why it's a mistake.</span> {m['why']}</p>
        <p class="fix"><span class="lbl">The fix.</span> {m['fix']}</p>
        <div class="playrow">{game_link(m)}</div>
      </div>
    </section>"""


themes_html = "".join(
    f"<li><b>{t}</b><br><span>{d}</span></li>" for t, d in THEMES
)
cards_html = "".join(card(i + 1, m) for i, m in enumerate(MISTAKES))

cat_rows = "".join(
    f"<tr><td>{n}</td><td class='num'>{c}</td><td class='num'>{avg}</td></tr>"
    for n, c, avg in STATS["categories"])
piece_rows = "".join(
    f"<tr><td>{n}</td><td class='num'>{c}</td></tr>" for n, c in STATS["pieces"])
timing_rows = "".join(
    f"<tr class='{'hot' if hot else ''}'><td>{n}</td><td class='num'>{c}{' ◀ worst' if hot else ''}</td></tr>"
    for n, c, hot in STATS["timing"])
cap_rows = "".join(
    f"<span class='chip'>{san} <b>×{c}</b></span>" for san, c in STATS["captures"])

stats_html = f"""
  <div class="stats">
    <h1>By the numbers</h1>
    <div class="callout">
      <b>The hidden link.</b> Your two worst opening errors — <b>cxd4</b> and <b>Bxf7+</b> —
      come from the <i>same</i> position: the c3/d4 Giuoco Piano where Black pins your
      knight with …Bg4. You mishandle that one tabiya two different ways (releasing the
      center, or an unsound sac) instead of the calm <b>h3</b>. Fix that single position
      and a big share of these mistakes disappear.
    </div>
    <div class="grid2">
      <div>
        <h3>Where the eval bleeds — by mistake type</h3>
        <table><thead><tr><th>Category</th><th class='num'>Count</th><th class='num'>Avg loss</th></tr></thead>
        <tbody>{cat_rows}</tbody></table>
      </div>
      <div>
        <h3>Which pieces you blunder</h3>
        <table><thead><tr><th>Piece</th><th class='num'>Mistakes</th></tr></thead>
        <tbody>{piece_rows}</tbody></table>
        <h3 style="margin-top:16px;">When mistakes happen</h3>
        <table><thead><tr><th>Game phase</th><th class='num'>Mistakes</th></tr></thead>
        <tbody>{timing_rows}</tbody></table>
      </div>
    </div>
    <h3>Recurring pawn-capture mistakes (same move, repeated)</h3>
    <div class="chips">{cap_rows}</div>
    <p style="font-size:13px;line-height:1.5;color:#3b4754;">{STATS['motifs']}</p>
  </div>
"""

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
  @page {{ size: A4; margin: 14mm 14mm 16mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system,'Helvetica Neue',Arial,sans-serif; color:#1b1f24; margin:0; }}
  .cover {{ padding: 30mm 0 8mm; border-bottom:3px solid #1b1f24; margin-bottom:10mm; }}
  .cover .kicker {{ letter-spacing:.18em; text-transform:uppercase; font-size:11px; color:#c0392b; font-weight:700; }}
  .cover h1 {{ font-size:30px; margin:6px 0 4px; }}
  .cover p {{ color:#52606d; margin:0; font-size:13px; }}
  .card {{ display:flex; gap:16px; page-break-inside:avoid; padding:10px 0 18px; border-bottom:1px solid #e3e8ee; margin-bottom:14px; }}
  .board {{ flex:0 0 360px; }}
  .board svg {{ border:1px solid #d6dbe1; border-radius:6px; }}
  .legend {{ display:flex; gap:14px; font-size:12px; margin-top:8px; color:#3b4754; }}
  .legend .dot {{ width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:5px; vertical-align:middle; }}
  .dot.red {{ background:{RED}; }} .dot.green {{ background:{GREEN}; }}
  .text {{ flex:1; }}
  .tag {{ display:inline-block; background:#eef2f6; color:#52606d; font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; padding:3px 8px; border-radius:10px; }}
  h2 {{ font-size:18px; margin:8px 0 6px; }}
  .line {{ font-family:'SF Mono',Menlo,monospace; font-size:12px; background:#f6f8fa; padding:6px 9px; border-radius:5px; color:#24292e; }}
  .eval {{ font-size:12px; color:#c0392b; margin:8px 0; font-weight:600; }}
  .freq {{ font-size:12px; color:#52606d; font-style:italic; margin:4px 0 10px; }}
  p {{ font-size:13px; line-height:1.5; margin:8px 0; }}
  .lbl {{ font-weight:700; }}
  .fix {{ background:#f3faf5; border-left:3px solid {GREEN}; padding:8px 12px; border-radius:0 5px 5px 0; }}
  .playrow {{ margin-top:10px; }}
  a.play {{ display:inline-block; background:{BLUE}; color:#fff; text-decoration:none; font-size:12px; font-weight:700; padding:6px 12px; border-radius:5px; }}
  .play-meta {{ display:block; font-size:11px; color:#8a97a4; margin-top:5px; }}
  .stats {{ page-break-before:always; }}
  .stats h1 {{ font-size:24px; border-bottom:3px solid #1b1f24; padding-bottom:8px; }}
  .stats h3 {{ font-size:13px; text-transform:uppercase; letter-spacing:.06em; color:#52606d; margin:18px 0 6px; }}
  .callout {{ background:#fef6f5; border-left:3px solid {RED}; padding:12px 14px; border-radius:0 6px 6px 0; font-size:13px; line-height:1.55; margin:12px 0 4px; }}
  .grid2 {{ display:flex; gap:24px; }}
  .grid2 > div {{ flex:1; }}
  table {{ width:100%; border-collapse:collapse; font-size:12.5px; }}
  th {{ text-align:left; color:#8a97a4; font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.05em; border-bottom:2px solid #e3e8ee; padding:5px 6px; }}
  td {{ padding:5px 6px; border-bottom:1px solid #eef2f6; }}
  td.num, th.num {{ text-align:right; font-variant-numeric:tabular-nums; }}
  tr.hot td {{ background:#fef6f5; font-weight:700; color:{RED}; }}
  .chips {{ margin:4px 0 10px; }}
  .chip {{ display:inline-block; background:#f6f8fa; border:1px solid #e3e8ee; border-radius:14px; padding:4px 11px; font-size:12px; font-family:'SF Mono',Menlo,monospace; margin:0 6px 6px 0; }}
  .themes {{ page-break-before:always; }}
  .themes h1 {{ font-size:24px; border-bottom:3px solid #1b1f24; padding-bottom:8px; }}
  .themes ul {{ list-style:none; padding:0; }}
  .themes li {{ padding:12px 0; border-bottom:1px solid #e3e8ee; font-size:13px; }}
  .themes li span {{ color:#3b4754; line-height:1.5; }}
  .footer {{ margin-top:14px; font-size:11px; color:#8a97a4; }}
</style></head><body>
  <div class="cover">
    <div class="kicker">Chess Analysis · negrilmannings</div>
    <h1>Your Recurring Mistakes in the Italian Opening</h1>
    <p>Based on 233 Italian games (164 White / 69 Black), Aug 2025 – Jun 2026. Each diagram shows the position just before your move.</p>
  </div>
  {cards_html}
  {stats_html}
  <div class="themes">
    <h1>Broader thematic patterns</h1>
    <p style="font-size:13px;color:#52606d;">The exact moves above are symptoms. Underneath, the same five habits recur across all your Italian games:</p>
    <ul>{themes_html}</ul>
    <p class="footer">The one habit to drill: when the center gets tense or your knight is pinned, look for the quiet improving move (e5, h3, Be2) <b>before</b> you capture or sacrifice.</p>
  </div>
</body></html>"""

html_path = os.path.join(OUT_DIR, 'italian_mistakes.html')
with open(html_path, 'w') as f:
    f.write(HTML)
print("wrote", html_path)
