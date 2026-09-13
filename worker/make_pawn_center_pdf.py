"""Report: BAD PAWN CAPTURES IN THE CENTER over the past 2 weeks (28 Jun–11 Jul 2026).

Focus: central pawn captures (files c–f, ranks 3–6) that were mistakes/inaccuracies,
with an engine-checked explanation of why each was a bad capture, and the cross-game
pattern. Red arrow = the capture you played; green arrow = the engine's move.

Data source: Supabase moves/games (user negrilmannings), positions & lines verified
with Stockfish 16 at depth 24. See scratchpad analyze.py for the raw engine output.
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

USER = "negrilmannings"

SUMMARY = {
    "span": "28 Jun – 11 Jul 2026",
    "games": 28,
    "total_pawn_caps": 56,
    "central_pawn_caps": 40,
    "central_mistakes": 3,
    "central_inaccuracies": 2,
    "note": "Over the past two weeks you played <b>56 pawn captures</b>; <b>40 were in the center</b> "
            "(files c–f, ranks 3–6). Five of those central captures went wrong — <b>3 mistakes/blunders "
            "and 2 inaccuracies</b>. One mistake came in an already-lost endgame; the four below all "
            "happened while the game was still up for grabs. Different games, same reflex — and it "
            "cost you a won game against shyen_v.",
}

# --- The four instructive central pawn-capture errors ----------------------
# eval strings are shown from YOUR side of the board.
CARDS = [
    {
        "opp": "shyen_v", "date": "2026-07-09", "color": "White", "result": "Lost",
        "url": "https://www.chess.com/game/live/171364185486",
        "move": 10, "san": "cxd4", "played": "c3d4", "best_san": "g3", "best": "g2g3",
        "fen": "r1b1k1nr/ppp2ppp/3p4/4b3/2Bp3q/2PP4/PP3PPP/RNBQR1K1 w kq - 0 10",
        "eval": "+4.0  →  −4.4",
        "chips": ["GREEDY CENTRAL CAPTURE", "IGNORED KING SAFETY"],
        "why": "You're winning by four points — but Black has thrown everything at your king: queen on "
               "<b>h4</b>, bishop on <b>e5</b>, a battery aimed straight at h2. The only move that matters is "
               "<b>10.g3!</b>: the pawn blocks the bishop's e5–h2 diagonal <i>and</i> attacks the h4-queen, and "
               "you stay completely winning. Instead you snapped off the pawn with <b>10.cxd4??</b> — a capture "
               "in the dead center that grabs a pawn and ignores the attack entirely. <b>10…Qxh2+ 11.Kf1 Qh1+ "
               "12.Ke2 Qxg2</b> and your king is stripped bare. One greedy central pawn grab flipped +4 into −4, "
               "and you lost the game.",
        "fix": "When your king is under fire, a pawn capture in the center is still just a pawn capture — it does "
               "nothing to defend. Count the attackers on your king <i>before</i> you take. Here the winning move "
               "(g3) was also a pawn move — but one that defended instead of grabbing.",
    },
    {
        "opp": "Rex008", "date": "2026-07-02", "color": "White", "result": "Lost",
        "url": "https://www.chess.com/game/live/171041964222",
        "move": 6, "san": "dxc5", "played": "d4c5", "best_san": "cxd5", "best": "c4d5",
        "fen": "r2qkbnr/pp2pppp/2n5/2ppPb2/2PP4/5N2/PP3PPP/RNBQKB1R w KQkq - 1 6",
        "eval": "+3.3  →  +0.5",
        "chips": ["WRONG CAPTURE DIRECTION", "SURRENDERED THE CENTER"],
        "why": "The center is loaded with tension — your <b>c4/d4/e5</b> pawns against Black's <b>c5/d5</b>. The "
               "strong capture is <b>6.cxd5!</b>, taking <i>toward</i> the center: after 6…Nxd4 7.Nxd4 cxd4 "
               "8.Qxd4 you keep a big, mobile pawn center and a clear +3. You played <b>6.dxc5</b> instead — "
               "capturing <i>away</i> from the center, out to the rim. That releases the tension the wrong way; "
               "Black hits back with <b>6…d4!</b>, your center evaporates, and your edge collapses from +3.3 to "
               "+0.5.",
        "fix": "When two of your pawns can capture in the center, take with the one that keeps your center "
               "biggest and most mobile — usually toward the center (cxd5), not out toward the rim (dxc5). Ask "
               "“which recapture leaves me the stronger pawn on d4/e5?” before you commit.",
    },
    {
        "opp": "ahotmama89", "date": "2026-06-29", "color": "Black", "result": "Lost",
        "url": "https://www.chess.com/game/live/170897377762",
        "move": 8, "san": "cxd5", "played": "c6d5", "best_san": "Nf6", "best": "g8f6",
        "fen": "r1bqk1nr/p1p2ppp/2p5/3P4/8/4P3/PPP3PP/RN1QKB1R b KQkq - 0 8",
        "eval": "−0.3  →  −0.8",
        "chips": ["RECAPTURE REFLEX", "OPENED A DIAGONAL"],
        "why": "A natural-looking recapture — but taking back in the center with <b>8…cxd5</b> opens the a4–e8 "
               "diagonal straight at your king, and White gets <b>9.Bb5+!</b> with tempo. After <b>9…Kf8</b> "
               "you've lost the right to castle and White develops for free. The engine prefers finishing "
               "development with <b>8…Nf6</b> (or the zwischenzug <b>8…Qh4+</b> first), keeping the recapture in "
               "reserve until it's safe. Not a losing move — but a free tempo and your castling handed over on "
               "autopilot.",
        "fix": "Before you recapture in the center, look at what the newly opened file or diagonal exposes. A "
               "recapture that uncovers a check (here Bb5+) can wait — develop with tempo first, then take when "
               "it costs you nothing.",
    },
    {
        "opp": "emilio7", "date": "2026-07-07", "color": "Black", "result": "Won",
        "url": "https://www.chess.com/game/live/171257299454",
        "move": 18, "san": "gxf5", "played": "g6f5", "best_san": "dxc3", "best": "d4c3",
        "fen": "r4rk1/pp3p1p/3pb1p1/2p2P2/3pP1Pq/2PP3P/PP1QN3/R4RK1 b - - 0 18",
        "eval": "−1.0  →  −2.3",
        "chips": ["OPENED YOUR OWN KING", "MISSED THE CENTER CAPTURE"],
        "why": "White has just jabbed with f5. The disciplined reply is the central capture <b>18…dxc3!</b>, "
               "opening lines where <i>you're</i> strong and keeping your king covered. Instead <b>18…gxf5</b> "
               "rips open the g-file right in front of your own castled king; after <b>19.exf5</b> White's rooks "
               "and queen pour toward it and you slide from −1 to −2.3. You were already slightly worse — this "
               "capture, made toward your own king, made it clearly worse. (You escaped with the full point "
               "anyway, but the capture was a gift.)",
        "fix": "A pawn capture that opens a file next to your own king is a red flag, not a free tempo. On the "
               "defensive, prefer the capture that opens lines on the <i>other</i> side of the board (dxc3) and "
               "keeps your king's pawn cover intact.",
    },
]

PATTERNS = [
    ("Capturing is your default, not your decision",
     "In all four positions a central pawn capture was staring at you and you took it without a pause — "
     "cxd4, dxc5, cxd5, gxf5, each the “obvious” grab or recapture, and each either the wrong move or "
     "a free gift. A pawn capture is <b>permanent</b>: it can't be unmade and it re-shapes the whole center. "
     "Treat every central capture as a real decision, not a reflex."),
    ("You grab material before checking your king",
     "The worst one — <b>10.cxd4?? vs shyen_v</b> — is the whole leak in miniature: up +4, your opponent's "
     "queen and bishop aimed at h2, and you spent the move eating a pawn in the center. The saving move (g3) "
     "was <i>also</i> a pawn move — but one that defended. Material means nothing if the capture ignores an "
     "attack on your king."),
    ("When two pawns can take, you pick the wrong one",
     "vs <b>Rex008</b> the choice was cxd5 (toward the center, +3.3) or dxc5 (toward the rim, +0.5). You took "
     "toward the rim and handed back your center. Capture <i>direction</i> decides who owns the middle of the "
     "board — default to the recapture that leaves your strongest pawn on d4/e5."),
    ("You don't look at what the capture opens",
     "<b>cxd5</b> uncovered Bb5+; <b>gxf5</b> tore open the file next to your own king. Every capture opens a "
     "file or a diagonal. The habit that fixes it: before taking, ask “for whom does this open lines?” "
     "If the answer is your opponent, find another move."),
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
        if "IGNORED" in c or "OWN KING" in c or "GREEDY" in c:
            cls = "chip-danger"
        elif "MISSED" in c or "WRONG" in c or "REFLEX" in c:
            cls = "chip-take"
        else:
            cls = "chip-push"
        out += f'<span class="chip {cls}">{c}</span>'
    return out


def card_html(c, idx):
    svg = board_svg(c["fen"], c["played"], c["best"])
    res_class = c["result"].lower()
    return f"""
    <section class="card">
      <div class="board">{svg}
        <div class="legend">
          <span><i class="dot red"></i>You played <b>{c['san']}</b></span>
          <span><i class="dot green"></i>Engine: <b>{c['best_san']}</b></span>
        </div>
      </div>
      <div class="text">
        <div class="chiprow">{chips_html(c['chips'])}</div>
        <h3><span class="idx">{idx}</span>{c['date']} · vs {c['opp']}
            <span class="res {res_class}">{c['result']}</span> · move {c['move']} ({c['color']})</h3>
        <div class="eval">Eval, your side <b>{c['eval']}</b></div>
        <p><span class="lbl">Why it's a bad capture.</span> {c['why']}</p>
        <p class="fix"><span class="lbl">The fix.</span> {c['fix']}</p>
        <a class="play" href="{c['url']}">▶ Open on Chess.com — step to move {c['move']}</a>
      </div>
    </section>"""


cards_html = "".join(card_html(c, i + 1) for i, c in enumerate(CARDS))
patterns_html = "".join(f"<li><b>{t}</b><br><span>{d}</span></li>" for t, d in PATTERNS)

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
  @page {{ size: A4; margin: 13mm 13mm 15mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system,'Helvetica Neue',Arial,sans-serif; color:#1b1f24; margin:0; }}
  .cover {{ padding: 20mm 0 8mm; border-bottom:3px solid #1b1f24; margin-bottom:7mm; }}
  .cover .kicker {{ letter-spacing:.18em; text-transform:uppercase; font-size:11px; color:{BLUE}; font-weight:700; }}
  .cover h1 {{ font-size:27px; margin:6px 0 4px; }}
  .cover .sub {{ color:#52606d; margin:0; font-size:13px; }}
  .pawnnote {{ background:#fffaf0; border-left:3px solid {AMBER}; padding:11px 14px; border-radius:0 6px 6px 0; font-size:13px; line-height:1.55; margin:12px 0 4px; }}
  .stats {{ display:flex; gap:10px; margin:14px 0 2px; }}
  .stat {{ flex:1; background:#f5f7fa; border:1px solid #e3e8ee; border-radius:8px; padding:9px 12px; }}
  .stat .n {{ font-size:22px; font-weight:800; color:#1b1f24; font-variant-numeric:tabular-nums; }}
  .stat .l {{ font-size:10.5px; color:#8a97a4; text-transform:uppercase; letter-spacing:.05em; margin-top:2px; }}
  .stat.red .n {{ color:{RED}; }}
  .legend2 {{ font-size:12px; color:#52606d; margin:10px 0 0; }}
  .legend2 i {{ display:inline-block; width:16px; height:0; border-top:3px solid; vertical-align:middle; margin:0 4px 0 10px; }}
  h2.sec {{ font-size:19px; margin:16px 0 4px; border-bottom:2px solid #e3e8ee; padding-bottom:6px; }}
  h2.sec .lead {{ font-size:12px; color:#8a97a4; font-weight:400; }}
  .card {{ display:flex; gap:15px; page-break-inside:avoid; padding:10px 0 12px; border-bottom:1px solid #e3e8ee; margin-bottom:10px; }}
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
  .chip-danger {{ background:#fdecea; color:{RED}; }}
  h3 {{ font-size:14px; margin:4px 0 4px; }}
  h3 .idx {{ display:inline-block; background:#1b1f24; color:#fff; font-size:11px; font-weight:700; width:19px; height:19px; line-height:19px; text-align:center; border-radius:5px; margin-right:7px; }}
  .res {{ font-size:10px; font-weight:700; padding:1px 7px; border-radius:9px; }}
  .res.won {{ background:#e7f6ec; color:{GREEN}; }}
  .res.lost {{ background:#fdecea; color:{RED}; }}
  .eval {{ font-size:12px; color:{RED}; margin:6px 0 4px; font-weight:600; font-variant-numeric:tabular-nums; }}
  p {{ font-size:12.5px; line-height:1.5; margin:7px 0; }}
  .lbl {{ font-weight:700; }}
  .fix {{ background:#f3faf5; border-left:3px solid {GREEN}; padding:8px 12px; border-radius:0 5px 5px 0; }}
  a.play {{ display:inline-block; background:{BLUE}; color:#fff; text-decoration:none; font-size:12px; font-weight:700; padding:6px 12px; border-radius:5px; margin-top:5px; }}
  .patterns {{ page-break-before:always; }}
  .patterns h1 {{ font-size:23px; border-bottom:3px solid #1b1f24; padding-bottom:8px; }}
  .patterns ul {{ list-style:none; padding:0; }}
  .patterns li {{ padding:11px 0; border-bottom:1px solid #e3e8ee; font-size:13px; }}
  .patterns li span {{ color:#3b4754; line-height:1.5; }}
  .habit {{ margin-top:14px; background:#f3faf5; border:1px solid #cfe8d8; border-radius:8px; padding:13px 16px; }}
  .habit h2 {{ font-size:15px; margin:0 0 6px; color:{GREEN}; }}
  .habit ol {{ margin:6px 0 0; padding-left:18px; font-size:13px; line-height:1.6; }}
  .footer {{ margin-top:12px; font-size:11px; color:#8a97a4; }}
</style></head><body>
  <div class="cover">
    <div class="kicker">Chess Analysis · {USER}</div>
    <h1>Bad Pawn Captures in the Center</h1>
    <p class="sub">Past 2 weeks · {SUMMARY['span']} · {SUMMARY['games']} games · engine-reviewed (Stockfish, depth 24).</p>
    <div class="pawnnote">{SUMMARY['note']}</div>
    <div class="stats">
      <div class="stat"><div class="n">{SUMMARY['total_pawn_caps']}</div><div class="l">Pawn captures</div></div>
      <div class="stat"><div class="n">{SUMMARY['central_pawn_caps']}</div><div class="l">In the center</div></div>
      <div class="stat red"><div class="n">{SUMMARY['central_mistakes']}</div><div class="l">Central mistakes / blunders</div></div>
      <div class="stat"><div class="n">{SUMMARY['central_inaccuracies']}</div><div class="l">Central inaccuracies</div></div>
    </div>
    <p class="legend2">Each diagram is the position <b>before</b> your move.
      <i style="border-color:{RED};"></i>the capture you played
      <i style="border-color:{GREEN};"></i>the engine's move</p>
  </div>

  <h2 class="sec">The four captures <span class="lead">— central pawn captures that went wrong while the game was still alive</span></h2>
  {cards_html}

  <div class="patterns">
    <h1>The pattern — one reflex, four leaks</h1>
    <p style="font-size:13px;color:#52606d;">The games differ but the mistakes rhyme. Four threads connect them:</p>
    <ul>{patterns_html}</ul>
    <div class="habit">
      <h2>The one habit to drill</h2>
      Before <b>any</b> central pawn capture, run a three-second check:
      <ol>
        <li><b>King first.</b> Am I safe, or am I grabbing a pawn while my king is under attack? <span style="color:#8a97a4;">(cxd4 vs shyen_v)</span></li>
        <li><b>Which pawn?</b> If two pawns can take, which capture keeps <i>my</i> center strongest? <span style="color:#8a97a4;">(cxd5, not dxc5, vs Rex008)</span></li>
        <li><b>What opens?</b> What file or diagonal does this capture open — and for whom? <span style="color:#8a97a4;">(cxd5→Bb5+; gxf5→my own king)</span></li>
      </ol>
      <p style="margin:8px 0 0;font-size:12.5px;"><b>In one line:</b> capture last, capture toward the center, and check what it opens.</p>
    </div>
    <p class="footer">Positions and lines verified with Stockfish at depth 24. Evals shown from your side of the board.</p>
  </div>
</body></html>"""

html_path = os.path.join(OUT_DIR, 'pawn_center_mistakes.html')
with open(html_path, 'w') as f:
    f.write(HTML)
print("wrote", html_path)
