"""Weekly mistake report (last 7 days), highlighting PAWN decisions:
pawn pushes, pawn captures, and failures-to-capture-with-a-pawn.

Red arrow = move you played; green arrow = engine's move.
"""
import os
import chess
import chess.svg

OUT_DIR = os.path.join(os.path.dirname(__file__), 'reports')
os.makedirs(OUT_DIR, exist_ok=True)

RED = "#c0392b"
GREEN = "#1e8449"
BLUE = "#1f6feb"
AMBER = "#b9770e"

# ---- Pawn mistakes (the highlighted focus) -------------------------------
PAWN = [
    {
        "opp": "JayceeAgodilos", "date": "2026-06-21", "result": "Won", "url": "https://www.chess.com/game/live/170541307970",
        "move": 14, "san": "f4", "played": "f2f4", "best_san": "Na5", "best": "b3a5",
        "fen": "2kr1b1r/pppq1p2/3p1n1p/3Pn1p1/2B1P3/1NQ5/PP3PPP/R1B1R1K1 w - - 0 14",
        "eval": "+3.4  →  +1.6", "chips": ["PAWN PUSH"],
        "why": "You're winning and Black's king sits on c8. <b>14.Na5</b> piles onto that exposed king (eyeing b7/c6) and keeps everything under control. The push <b>14.f4?!</b> lashes out — it opens lines in front of <i>your own</i> king and frees Black's strong e5-knight (…Nxc4), and your edge nearly halves.",
        "fix": "When you're up and the opponent's king is the weak one, march pieces toward it — don't open the position with a committal pawn push.",
    },
    {
        "opp": "Alketat", "date": "2026-06-16", "result": "Lost", "url": "https://www.chess.com/game/live/170289252346",
        "move": 27, "san": "a6", "played": "a5a6", "best_san": "Rc5", "best": "c7c5",
        "fen": "4r1k1/1pR1r1pp/1P1n4/P2pp3/5p2/3P1N2/5PPP/R5K1 w - - 2 27",
        "eval": "+1.8  →  +0.2", "chips": ["PAWN PUSH"],
        "why": "<b>27.Rc5</b> piles on Black's weak d5-pawn and keeps your rooks dominant. Pushing <b>27.a6?!</b> advances a pawn that isn't ready to promote and releases all the pressure — Black consolidates and your advantage nearly vanishes. (This is the game you went on to lose.)",
        "fix": "Don't push a passed pawn before it's supported. Keep improving your active pieces until the pawn can actually run.",
    },
    {
        "opp": "QuinnvL1902", "date": "2026-06-20", "result": "Won", "url": "https://www.chess.com/game/live/170472611562",
        "move": 6, "san": "h3", "played": "h2h3", "best_san": "dxc5", "best": "d4c5",
        "fen": "r2qkbnr/pp2pppp/2n5/2ppP3/3P2b1/2P2N2/PP3PPP/RNBQKB1R w KQkq - 1 6",
        "eval": "+0.6  →  -1.0", "chips": ["PAWN PUSH", "SHOULD HAVE TAKEN"],
        "why": "Black has just struck the center with …c5. <b>6.dxc5!</b> grabs the pawn and keeps your strong e5-pawn and a clear edge. Instead <b>6.h3</b> pokes the bishop and ignores the center — Black resolves it with …cxd4 / …c4 and seizes the initiative. You went from better to worse with one routine flank push.",
        "fix": "Resolve the center first. When a central capture (dxc5) wins a pawn, that beats a routine flank poke (h3).",
    },
    {
        "opp": "HosniMc", "date": "2026-06-17", "result": "Lost", "url": "https://www.chess.com/game/live/170353018238",
        "move": 11, "san": "c6", "played": "c7c6", "best_san": "bxa3", "best": "b4a3",
        "fen": "r1bq1rk1/1ppp1ppp/5n2/4p3/1pB1P3/P2P4/3N1PPP/R2QK1NR b KQ - 2 11",
        "eval": "-0.9  →  -2.8", "chips": ["PAWN PUSH", "SHOULD HAVE TAKEN"],
        "why": "White's a3 attacks your b4-pawn. <b>11...bxa3</b> captures first and keeps material level. The quiet <b>11...c6</b> just leaves the b4-pawn hanging — White plays axb4 and you're a clean pawn down for nothing, dropping from slightly worse to clearly worse.",
        "fix": "When your pawn is attacked and you can take instead of being taken, take. Don't leave a pawn en prise to play a slow move.",
    },
    {
        "opp": "Alketat", "date": "2026-06-16", "result": "Lost", "url": "https://www.chess.com/game/live/170289252346",
        "move": 41, "san": "Rd4", "played": "d5d4", "best_san": "dxe4", "best": "d3e4",
        "fen": "8/5npk/7p/3R4/4pN1P/3P2P1/5P1K/3r4 w - - 1 41",
        "eval": "+4.3  →  +0.4", "chips": ["DIDN'T TAKE WITH PAWN"],
        "why": "A winning endgame, an extra pawn, and Black's e4-pawn is just hanging to your d3-pawn. <b>41.dxe4!</b> takes it and the win is trivial. <b>41.Rd4?</b> declines the capture; Black answers …exd3 and the passed d-pawn plus activity let the whole win slip away. This 'pawn not taken' cost you the full point.",
        "fix": "In winning endgames, take the free pawn. If a capture keeps your material up and creates no problems, just play it.",
    },
]

# ---- Single worst non-pawn blunder (rest-of-week section) -----------------
WORST = {
    "opp": "SkYYYsan", "date": "2026-06-20", "result": "Lost", "url": "https://www.chess.com/game/live/170472474726",
    "move": 6, "san": "Nxd4", "played": "c6d4", "best_san": "d5", "best": "d7d5",
    "fen": "r1bqkb1r/pppp1ppp/2n5/8/2BNn3/5Q2/PPP2PPP/RNB1K2R b KQkq - 1 6",
    "eval": "+1.6  →  forced mate", "chips": ["GREEDY CAPTURE"],
    "why": "A Scotch Gambit trap. Grabbing the knight with <b>6...Nxd4??</b> ignores the battery on f7 — White crashes through with Bxf7+ and a forced mating attack. The clean move was the pawn push <b>6...d5!</b>, hitting the c4-bishop with tempo and untangling. (Note: here the <i>pawn</i> move was right and the capture was the blunder — the mirror image of the errors above.)",
    "fix": "Before any capture, check what you're ignoring. A free piece means nothing if your king gets mated two moves later.",
}

# weekly numbers
SUMMARY = {
    "games": 10, "record": "6 wins – 4 losses", "span": "14–21 Jun 2026",
    "total_mistakes": 38,
    "by_cat": [("Hanging piece", 30), ("Greedy capture", 4),
               ("Overlooked check", 2), ("Positional collapse", 2)],
    "by_phase": [("Opening", 11), ("Middlegame", 24), ("Endgame", 3)],
    "pawn_note": "Of your 38 mistakes this week, <b>none were bad pawn captures</b> — your problem is "
                 "<b>pawn pushes</b> (4 cost real eval) and <b>not capturing with a pawn</b> when you should "
                 "(3 times, including the move that lost the Alketat game). Pawn decisions, not piece play, "
                 "are this week's standout leak.",
}

OTHER_BLUNDERS = [
    ("HosniMc", "Lost", 23, "Nd7", "Qd8", "−4.6 → mate", "let the mating attack land"),
    ("Alketat", "Lost", 56, "Ng6+", "Nf5", "0.0 → −5+", "blundered a drawn endgame"),
    ("QuinnvL1902", "Won", 14, "Qd4", "Bb5+", "+5.2 → −1.4", "missed a zwischenzug check"),
    ("youretcetera", "Lost", 18, "Nc5", "Nb3", "−0.6 → −4.7", "hung a piece"),
]

PATTERNS = [
    ("Pawn pushes are reflexive, not calculated",
     "f4, a6, h3 were all played in <b>better or winning</b> positions and each threw away most of the edge. A pawn push is permanent — it can't move back. Treat every push as a committal decision, not a default."),
    ("You skip pawn captures that keep material",
     "Three times (dxc5, bxa3, dxe4) the simple pawn capture was best and you played a quiet move instead — leaving a pawn hanging or declining a free one. The dxe4 miss cost you a won endgame."),
    ("…but sometimes the pawn move IS the answer",
     "vs SkYYYsan the correct move was the push <b>…d5</b> and the capture (Nxd4) was the blunder. The skill isn't 'push' or 'capture' — it's pausing to check what each does to the center and to king safety."),
    ("Underneath it all: hanging pieces (30 of 38)",
     "The dominant category is still leaving things en prise. The one habit that fixes pushes, captures, and hangs alike: before every move run <b>Checks → Captures → Threats</b>, yours and your opponent's."),
]


def board_svg(fen, played, best):
    board = chess.Board(fen)
    arrows = [
        chess.svg.Arrow(chess.parse_square(best[:2]), chess.parse_square(best[2:4]), color=GREEN),
        chess.svg.Arrow(chess.parse_square(played[:2]), chess.parse_square(played[2:4]), color=RED),
    ]
    return chess.svg.board(board, arrows=arrows, size=330,
                           orientation=board.turn, coordinates=True)


def chips_html(chips):
    out = ""
    for c in chips:
        cls = "chip-take" if "TAKEN" in c or "TAKE" in c else ("chip-greedy" if "GREEDY" in c else "chip-push")
        out += f'<span class="chip {cls}">{c}</span>'
    return out


def card_html(c):
    svg = board_svg(c["fen"], c["played"], c["best"])
    res_class = c["result"].lower()
    return f"""
    <section class="card">
      <div class="board">{svg}
        <div class="legend">
          <span><i class="dot red"></i>You: <b>{c['san']}</b></span>
          <span><i class="dot green"></i>Engine: <b>{c['best_san']}</b></span>
        </div>
      </div>
      <div class="text">
        <div class="chiprow">{chips_html(c['chips'])}</div>
        <h3>{c['date']} · vs {c['opp']} <span class="res {res_class}">{c['result']}</span> · move {c['move']}</h3>
        <div class="eval">Eval (your side) <b>{c['eval']}</b></div>
        <p><span class="lbl">Why it's a mistake.</span> {c['why']}</p>
        <p class="fix"><span class="lbl">The fix.</span> {c['fix']}</p>
        <a class="play" href="{c['url']}">▶ Open on Chess.com — step to move {c['move']}</a>
      </div>
    </section>"""


pawn_html = "".join(card_html(c) for c in PAWN)
worst_html = card_html(WORST)
cat_rows = "".join(f"<tr><td>{n}</td><td class='num'>{v}</td></tr>" for n, v in SUMMARY["by_cat"])
phase_rows = "".join(f"<tr><td>{n}</td><td class='num'>{v}</td></tr>" for n, v in SUMMARY["by_phase"])
other_rows = "".join(
    f"<tr><td>{o}</td><td><span class='res {r.lower()}'>{r}</span></td><td>{mv}. {s} <span class='muted'>(better: {b})</span></td><td class='num'>{e}</td><td class='muted'>{note}</td></tr>"
    for o, r, mv, s, b, e, note in OTHER_BLUNDERS)
patterns_html = "".join(f"<li><b>{t}</b><br><span>{d}</span></li>" for t, d in PATTERNS)

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
  @page {{ size: A4; margin: 13mm 13mm 15mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system,'Helvetica Neue',Arial,sans-serif; color:#1b1f24; margin:0; }}
  .cover {{ padding: 22mm 0 8mm; border-bottom:3px solid #1b1f24; margin-bottom:7mm; }}
  .cover .kicker {{ letter-spacing:.18em; text-transform:uppercase; font-size:11px; color:{BLUE}; font-weight:700; }}
  .cover h1 {{ font-size:27px; margin:6px 0 4px; }}
  .cover p {{ color:#52606d; margin:0; font-size:13px; }}
  .pawnnote {{ background:#fffaf0; border-left:3px solid {AMBER}; padding:11px 14px; border-radius:0 6px 6px 0; font-size:13px; line-height:1.55; margin:12px 0 4px; }}
  .summary {{ display:flex; gap:24px; margin:14px 0 4px; }}
  .summary > div {{ flex:1; }}
  h2.sec {{ font-size:19px; margin:18px 0 4px; border-bottom:2px solid #e3e8ee; padding-bottom:6px; }}
  h2.sec .lead {{ font-size:12px; color:#8a97a4; font-weight:400; }}
  table {{ width:100%; border-collapse:collapse; font-size:12.5px; }}
  th {{ text-align:left; color:#8a97a4; font-weight:600; font-size:11px; text-transform:uppercase; border-bottom:2px solid #e3e8ee; padding:5px 6px; }}
  td {{ padding:5px 6px; border-bottom:1px solid #eef2f6; }}
  td.num, th.num {{ text-align:right; font-variant-numeric:tabular-nums; }}
  .muted {{ color:#8a97a4; }}
  .card {{ display:flex; gap:15px; page-break-inside:avoid; padding:8px 0 12px; border-bottom:1px solid #e3e8ee; margin-bottom:10px; }}
  .board {{ flex:0 0 330px; }}
  .board svg {{ border:1px solid #d6dbe1; border-radius:6px; }}
  .legend {{ display:flex; gap:14px; font-size:12px; margin-top:7px; color:#3b4754; }}
  .legend .dot {{ width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:5px; vertical-align:middle; }}
  .dot.red {{ background:{RED}; }} .dot.green {{ background:{GREEN}; }}
  .text {{ flex:1; }}
  .chiprow {{ margin-bottom:5px; }}
  .chip {{ display:inline-block; font-size:10px; font-weight:700; letter-spacing:.04em; padding:3px 8px; border-radius:10px; margin:0 5px 4px 0; }}
  .chip-push {{ background:#eaf1fb; color:{BLUE}; }}
  .chip-take {{ background:#fff3da; color:{AMBER}; }}
  .chip-greedy {{ background:#fdecea; color:{RED}; }}
  h3 {{ font-size:14px; margin:4px 0 4px; }}
  .res {{ font-size:10px; font-weight:700; padding:1px 7px; border-radius:9px; }}
  .res.won {{ background:#e7f6ec; color:{GREEN}; }}
  .res.lost {{ background:#fdecea; color:{RED}; }}
  .eval {{ font-size:12px; color:{RED}; margin:6px 0 4px; font-weight:600; }}
  p {{ font-size:12.5px; line-height:1.5; margin:7px 0; }}
  .lbl {{ font-weight:700; }}
  .fix {{ background:#f3faf5; border-left:3px solid {GREEN}; padding:8px 12px; border-radius:0 5px 5px 0; }}
  a.play {{ display:inline-block; background:{BLUE}; color:#fff; text-decoration:none; font-size:12px; font-weight:700; padding:6px 12px; border-radius:5px; margin-top:5px; }}
  .rest {{ page-break-before:always; }}
  .patterns {{ page-break-before:always; }}
  .patterns h1 {{ font-size:23px; border-bottom:3px solid #1b1f24; padding-bottom:8px; }}
  .patterns ul {{ list-style:none; padding:0; }}
  .patterns li {{ padding:11px 0; border-bottom:1px solid #e3e8ee; font-size:13px; }}
  .patterns li span {{ color:#3b4754; line-height:1.5; }}
  .footer {{ margin-top:12px; font-size:11px; color:#8a97a4; }}
</style></head><body>
  <div class="cover">
    <div class="kicker">Chess Analysis · negrilmannings</div>
    <h1>Your Mistakes This Week</h1>
    <p>{SUMMARY['span']} · {SUMMARY['games']} games · {SUMMARY['record']} · {SUMMARY['total_mistakes']} mistakes &amp; blunders · engine-reviewed.</p>
    <div class="pawnnote">{SUMMARY['pawn_note']}</div>
    <div class="summary">
      <div><h2 class="sec" style="margin-top:4px;">By type</h2><table><tbody>{cat_rows}</tbody></table></div>
      <div><h2 class="sec" style="margin-top:4px;">By phase</h2><table><tbody>{phase_rows}</tbody></table></div>
    </div>
  </div>

  <h2 class="sec">Pawn decisions <span class="lead">— pushes, captures &amp; missed captures (your focus)</span></h2>
  {pawn_html}

  <div class="rest">
    <h2 class="sec">The rest of the week</h2>
    <p style="font-size:13px;color:#52606d;">Your biggest non-pawn blunder was a clean opening trap — and tellingly, the right move there was a <i>pawn push</i>:</p>
    {worst_html}
    <h2 class="sec" style="font-size:15px;">Other notable blunders</h2>
    <table>
      <thead><tr><th>Opponent</th><th>Result</th><th>Move (better)</th><th class="num">Eval</th><th>What happened</th></tr></thead>
      <tbody>{other_rows}</tbody>
    </table>
  </div>

  <div class="patterns">
    <h1>Patterns &amp; the one habit to fix</h1>
    <ul>{patterns_html}</ul>
    <p class="footer">Before every move, especially with pawns: ask "what does this <b>permanently</b> change?" and run Checks → Captures → Threats.</p>
  </div>
</body></html>"""

html_path = os.path.join(OUT_DIR, 'week_mistakes.html')
with open(html_path, 'w') as f:
    f.write(HTML)
print("wrote", html_path)
