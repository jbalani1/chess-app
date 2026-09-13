"""Report: RECURRING MISTAKE THEMES — last 4 weeks (17 Jun – 13 Jul 2026).

Setting aside plain hanging pieces (at the user's request), the remaining mistakes
cluster into three themes that share ONE root cause — failing to calculate forcing
moves (checks & captures) to a concrete end:
  1. Greedy captures — grab material without checking the reply.
  2. Unsound sacrifices — throw a piece at f7 with no follow-up.
  3. Overlooked checks — miss the winning check / walk into the opponent's.

Data: Supabase moves/games (negrilmannings); positions & lines verified with
Stockfish at depth 22–24 (see scratchpad analyze2.py / analyze4.py).
Red arrow = the move you played; green arrow = the engine's move.
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
PURPLE = "#7c3aed"
USER = "negrilmannings"

SUMMARY = {
    "span": "17 Jun – 13 Jul 2026",
    "games": 52,
    "total": 258,
    "hanging": 192,
    "greedy": 34,
    "checks": 23,
    "drift": 9,
    "intro": "You asked to look past the obvious hanging pieces. Once those are set aside, your remaining "
             "mistakes aren't random — they fall into <b>three recurring themes</b>, and all three are the "
             "same habit in different clothes: <b>you don't calculate forcing moves — checks and captures — "
             "all the way to a quiet position before you commit.</b>",
}

THEMES = [
    {
        "key": "greedy",
        "n": 34,
        "title": "You grab material without checking the reply",
        "lead": "Greedy captures — 34 flagged in 4 weeks",
        "blurb": "The commonest of the three. A pawn or piece is there to be taken, you take it — and you "
                 "haven't asked what recaptures, or what comes crashing in once your piece leaves its post. "
                 "The material was never the point.",
        "cards": [
            {
                "opp": "DanW1287", "date": "2026-07-13", "color": "White", "result": "Lost",
                "url": "https://www.chess.com/game/live/171547471402",
                "move": 20, "san": "Nxe4", "played": "d2e4", "best_san": "Rad1", "best": "a1d1",
                "fen": "4r2r/pp4k1/6pp/2p2b2/2N1pb2/8/PPPN1PPP/R3R1K1 w - - 8 20",
                "eval": "0.0  →  −4.4",
                "chips": [("“FREE” PAWN?", "take"), ("DROPPED A PIECE", "danger")],
                "why": "The position is dead level. Your knight jumps in to grab the e4-pawn with <b>20.Nxe4??</b> "
                       "— but that pawn wasn't free: your knight is the only thing that can take on e4, and it's "
                       "needed elsewhere. After <b>20…Bxe4</b> you simply can't win it back, and you're a clean "
                       "piece down for one pawn. The quiet <b>20.Rad1</b> holds everything at 0.00.",
                "fix": "Before you take a pawn, ask the one question that matters: “after I capture, what "
                       "recaptures — and can I take back?” If nothing of yours can retake, the pawn isn't free, "
                       "it's bait.",
            },
            {
                "opp": "HosniMc", "date": "2026-06-17", "color": "Black", "result": "Lost",
                "url": "https://www.chess.com/game/live/170353018238",
                "move": 6, "san": "Nxb4", "played": "c6b4", "best_san": "d5", "best": "d7d5",
                "fen": "r1bqkb1r/pppp1ppp/2n2n2/4p3/1PB1P3/2PPB3/P4PPP/RN1QK1NR b KQkq - 0 6",
                "eval": "+0.4  →  −2.6",
                "chips": [("GRABBED THE GAMBIT PAWN", "take"), ("DOWN A PIECE", "danger")],
                "why": "White dangles the b4-pawn. You snatch it with <b>6…Nxb4??</b>, but after <b>7.cxb4 "
                       "Bxb4+</b> you've handed over a whole knight for two pawns with no attack to show for it — "
                       "White is simply up material with a big center. Developing with <b>6…d5</b> or "
                       "<b>6…Be7</b> keeps the game level.",
                "fix": "A pawn offered in the opening is usually a lure. If grabbing it costs you a piece or your "
                       "development, decline it and finish getting your army out.",
            },
            {
                "opp": "Rex008", "date": "2026-07-02", "color": "White", "result": "Lost",
                "url": "https://www.chess.com/game/live/171041964222",
                "move": 24, "san": "Nxb7", "played": "d6b7", "best_san": "Bxc6", "best": "b5c6",
                "fen": "5rk1/pp3ppp/2nNp3/1BPr4/1bR4P/4P3/4K1P1/7R w - - 0 24",
                "eval": "+2.5  →  −3.7",
                "chips": [("RIM KNIGHT PAWN-GRAB", "take"), ("LET THE ROOKS IN", "danger")],
                "why": "You're winning — the clean path is <b>24.Bxc6</b>, trading into a won position (+2.5). "
                       "Instead you grabbed the b7-pawn with <b>24.Nxb7??</b>, sending your knight to the rim and "
                       "off the defense. Black crashes through: <b>24…Rd2+ 25.Kf1 Rd1+ 26.Kf2 Rxh1</b> wins the "
                       "exchange and flips the game to −3.7. The pawn never mattered.",
                "fix": "When you're already winning, don't send a piece pawn-hunting to the edge of the board. "
                       "Keep your pieces coordinated and convert — a rim knight eating a b-pawn is exactly how a "
                       "won game slips away.",
            },
        ],
    },
    {
        "key": "sac",
        "n": None,
        "title": "You sacrifice on f7 without a follow-up",
        "lead": "Unsound sacrifices — the same shot, twice in 4 weeks",
        "blurb": "The mirror image of grabbing. Here you <i>give</i> material — a bishop crashes onto f7 — hoping "
                 "the attack is there. Twice this month it wasn't. A sacrifice you can't calculate to a concrete "
                 "payoff is just a gift.",
        "cards": [
            {
                "opp": "Chess197512", "date": "2026-07-07", "color": "White", "result": "Won",
                "url": "https://www.chess.com/game/live/171272824936",
                "move": 10, "san": "Bxf7+", "played": "c4f7", "best_san": "Nc3", "best": "b1c3",
                "fen": "r1b1kbnr/pppp1pp1/7p/4P3/1qBQ4/8/PPP2PPP/RNB1R1K1 w kq - 5 10",
                "eval": "+5.3  →  −1.0",
                "chips": [("UNSOUND SAC", "danger"), ("THREW AWAY A WIN", "danger")],
                "why": "You're winning by five — Black's queen is stranded on b4 and you just need to develop "
                       "(<b>10.Nc3</b>) and bank the extra material. Instead you threw a bishop at f7 with "
                       "<b>10.Bxf7+??</b>. After <b>10…Kxf7 11.Qd5+ Ke8 12.Nc3</b> the checks run out, you've "
                       "given a whole piece, and there's no attack to justify it — +5.3 collapses to −1.0. "
                       "(You still won — but you handed the game back first.)",
                "fix": "A sac on f7 has to lead to something concrete — a forced mate, a fork, material regained. "
                       "If you can't name the payoff before you play it, you're not sacrificing, you're donating. "
                       "When you're already winning, consolidate — don't gamble.",
            },
            {
                "opp": "nash_mng", "date": "2026-07-05", "color": "White", "result": "Lost",
                "url": "https://www.chess.com/game/live/171167287300",
                "move": 17, "san": "Bxf7", "played": "b3f7", "best_san": "Qf3", "best": "e2f3",
                "fen": "2k1rb1r/1ppb1p2/p2p1p1p/7q/4NPn1/1B4PP/PPP1Q3/R1B1K1NR w KQ - 0 17",
                "eval": "+2.0  →  −4.9",
                "chips": [("SAC WITH NO FOLLOW-UP", "danger"), ("LOST A PIECE", "danger")],
                "why": "A calm <b>17.Qf3</b> keeps you comfortably better (+2.0), fighting Black's active queen. "
                       "Instead <b>17.Bxf7??</b> grabs the f7-pawn with the bishop — but it isn't even a check, "
                       "and after <b>17…Qxf7</b> you've simply donated a bishop for a pawn. No combination behind "
                       "it; the eval craters to −4.9 and you lost.",
                "fix": "Same discipline: no forcing follow-up, no sacrifice. If a capture on f7 doesn't come with "
                       "check-check-win, the only question is “is it defended?” — here Black's king covered f7.",
            },
        ],
    },
    {
        "key": "checks",
        "n": 23,
        "title": "You miss the check — yours and your opponent's",
        "lead": "Overlooked checks — 23 flagged in 4 weeks",
        "blurb": "The most expensive theme by average cost. Sometimes it's the winning check you didn't play; "
                 "sometimes it's the opponent's check you walked into. Both come from the same blind spot: "
                 "you don't look at the forcing checks before you move.",
        "cards": [
            {
                "opp": "QuinnvL1902", "date": "2026-06-20", "color": "White", "result": "Won",
                "url": "https://www.chess.com/game/live/170472611562",
                "move": 14, "san": "Qd4", "played": "g7d4", "best_san": "Bb5+", "best": "e2b5",
                "fen": "r2qk1nr/pp3pQp/3bp1n1/3p4/8/2N4P/PP2BPP1/R1B1K2R w KQkq - 1 14",
                "eval": "+5.2  →  −1.3",
                "chips": [("MISSED A WINNING CHECK", "take"), ("PASSIVE QUEEN RETREAT", "danger")],
                "why": "You're winning — but there's a knockout: <b>14.Bb5+!</b>. Black has nothing to interpose "
                       "but the queen (<b>14…Qd7</b>), and <b>15.Bxd7+ Kxd7</b> wins the queen outright. Instead "
                       "you played the passive <b>14.Qd4?</b>, retreating and handing Black time to untangle — "
                       "+5.2 shrank to −1.3. The winning move was a check staring right at the enemy king.",
                "fix": "Look at your checks <i>first</i>, before any quiet retreat. A check that wins the queen "
                       "beats every “safe” regrouping move. Checks → captures → threats, in that order.",
            },
            {
                "opp": "ahotmama89", "date": "2026-06-29", "color": "Black", "result": "Lost",
                "url": "https://www.chess.com/game/live/170897377762",
                "move": 19, "san": "Qxg4", "played": "d4g4", "best_san": "g5", "best": "g6g5",
                "fen": "5k1r/p1Q2p1p/5np1/8/1r1q2P1/3P4/P5P1/RN3R1K b - - 0 19",
                "eval": "+3.2  →  −4.1",
                "chips": [("WALKED INTO A CHECK", "danger"), ("GREEDY QUEEN GRAB", "take")],
                "why": "You're winning — up material and attacking. But instead of a safe move like <b>19…g5</b>, "
                       "you reached out with <b>19…Qxg4??</b> to grab a pawn, straight into <b>20.Qd6+!</b>. That "
                       "one check flips everything — it hits your king and forces the queens off into a lost "
                       "ending; +3.2 becomes −4.1. You saw the free pawn; you never counted the check that "
                       "answered it.",
                "fix": "Before any capture, look at your opponent's checks in reply — a capture that allows a "
                       "strong check is no capture at all. The g4-pawn wasn't going anywhere; the check was the "
                       "only thing that mattered.",
            },
        ],
    },
]

CLOSING = [
    ("When you capture, you see the material — not the reply.",
     "<b>Nxe4, Nxb4, Nxb7</b>: each grabbed a pawn without asking what recaptures or what crashes in once the "
     "piece left its post. Three won-or-level positions, three pieces dropped for pawns."),
    ("When you attack, you start a forcing line you can't finish.",
     "<b>Two Bxf7 sacrifices in four weeks</b>, both from better or winning positions, neither with a real "
     "follow-up. A sacrifice you can't calculate to a payoff is just a gift to your opponent."),
    ("When you should attack, you don't look for the check.",
     "<b>Bb5+</b> won a queen and you retreated instead; <b>Qd6+</b> beat you because you never counted it. "
     "The forcing move decides the game — and it cuts in both directions."),
]


def board_svg(fen, played, best):
    board = chess.Board(fen)
    arrows = [
        chess.svg.Arrow(chess.parse_square(best[:2]), chess.parse_square(best[2:4]), color=GREEN),
        chess.svg.Arrow(chess.parse_square(played[:2]), chess.parse_square(played[2:4]), color=RED),
    ]
    return chess.svg.board(board, arrows=arrows, size=300,
                           orientation=board.turn, coordinates=True)


def chips_html(chips):
    out = ""
    for text, kind in chips:
        out += f'<span class="chip chip-{kind}">{text}</span>'
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
        <h3>{c['date']} · vs {c['opp']} <span class="res {res_class}">{c['result']}</span>
            · move {c['move']} ({c['color']})</h3>
        <div class="eval">Eval, your side <b>{c['eval']}</b></div>
        <p><span class="lbl">What went wrong.</span> {c['why']}</p>
        <p class="fix"><span class="lbl">The fix.</span> {c['fix']}</p>
        <a class="play" href="{c['url']}">▶ Open on Chess.com — step to move {c['move']}</a>
      </div>
    </section>"""


def theme_html(t, idx):
    n_badge = f'<span class="tcount">{t["n"]} flagged</span>' if t["n"] else ""
    cards = "".join(card_html(c) for c in t["cards"])
    brk = ' style="page-break-before:always;"' if idx > 0 else ""
    return f"""
    <div class="theme"{brk}>
      <div class="thead">
        <div class="tnum">Theme {idx+1}</div>
        <div class="tmeta">
          <h2>{t['title']} {n_badge}</h2>
          <div class="tlead">{t['lead']}</div>
        </div>
      </div>
      <p class="blurb">{t['blurb']}</p>
      {cards}
    </div>"""


themes_html = "".join(theme_html(t, i) for i, t in enumerate(THEMES))
closing_html = "".join(f"<li><b>{a}</b><br><span>{b}</span></li>" for a, b in CLOSING)

HTML = f"""<!doctype html><html><head><meta charset="utf-8"><style>
  @page {{ size: A4; margin: 13mm 13mm 15mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: -apple-system,'Helvetica Neue',Arial,sans-serif; color:#1b1f24; margin:0; }}
  .cover {{ padding: 18mm 0 8mm; border-bottom:3px solid #1b1f24; margin-bottom:6mm; }}
  .cover .kicker {{ letter-spacing:.18em; text-transform:uppercase; font-size:11px; color:{BLUE}; font-weight:700; }}
  .cover h1 {{ font-size:27px; margin:6px 0 4px; }}
  .cover .sub {{ color:#52606d; margin:0; font-size:13px; }}
  .intro {{ background:#fffaf0; border-left:3px solid {AMBER}; padding:11px 14px; border-radius:0 6px 6px 0; font-size:13px; line-height:1.55; margin:12px 0 4px; }}
  .stats {{ display:flex; gap:8px; margin:14px 0 2px; }}
  .stat {{ flex:1; background:#f5f7fa; border:1px solid #e3e8ee; border-radius:8px; padding:8px 11px; }}
  .stat .n {{ font-size:20px; font-weight:800; font-variant-numeric:tabular-nums; }}
  .stat .l {{ font-size:10px; color:#8a97a4; text-transform:uppercase; letter-spacing:.04em; margin-top:2px; line-height:1.25; }}
  .stat.muted .n {{ color:#8a97a4; }}
  .stat.hot .n {{ color:{RED}; }}
  .legend2 {{ font-size:12px; color:#52606d; margin:10px 0 0; }}
  .legend2 i {{ display:inline-block; width:16px; height:0; border-top:3px solid; vertical-align:middle; margin:0 4px 0 10px; }}
  .theme {{ }}
  .thead {{ display:flex; align-items:center; gap:12px; border-bottom:2px solid #1b1f24; padding-bottom:8px; margin:16px 0 6px; }}
  .tnum {{ background:{PURPLE}; color:#fff; font-size:11px; font-weight:700; padding:4px 9px; border-radius:5px; white-space:nowrap; }}
  .tmeta {{ flex:1; }}
  .tmeta h2 {{ font-size:18px; margin:0; }}
  .tcount {{ font-size:11px; font-weight:700; color:{RED}; background:#fdecea; padding:2px 8px; border-radius:10px; vertical-align:middle; margin-left:6px; }}
  .tlead {{ font-size:12px; color:#8a97a4; margin-top:2px; }}
  .blurb {{ font-size:13px; line-height:1.55; color:#3b4754; margin:4px 0 8px; }}
  .card {{ display:flex; gap:15px; page-break-inside:avoid; padding:9px 0 11px; border-bottom:1px solid #e3e8ee; margin-bottom:8px; }}
  .board {{ flex:0 0 300px; }}
  .board svg {{ border:1px solid #d6dbe1; border-radius:6px; }}
  .legend {{ display:flex; gap:14px; font-size:12px; margin-top:7px; color:#3b4754; }}
  .legend .dot {{ width:10px; height:10px; border-radius:50%; display:inline-block; margin-right:5px; vertical-align:middle; }}
  .dot.red {{ background:{RED}; }} .dot.green {{ background:{GREEN}; }}
  .text {{ flex:1; }}
  .chiprow {{ margin-bottom:5px; }}
  .chip {{ display:inline-block; font-size:10px; font-weight:700; letter-spacing:.04em; padding:3px 8px; border-radius:10px; margin:0 5px 4px 0; }}
  .chip-take {{ background:#fff3da; color:{AMBER}; }}
  .chip-danger {{ background:#fdecea; color:{RED}; }}
  h3 {{ font-size:14px; margin:4px 0 4px; }}
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
  .patterns .thesis {{ font-size:13px; color:#3b4754; line-height:1.6; margin:8px 0 4px; }}
  .patterns ul {{ list-style:none; padding:0; }}
  .patterns li {{ padding:11px 0; border-bottom:1px solid #e3e8ee; font-size:13px; }}
  .patterns li span {{ color:#3b4754; line-height:1.5; }}
  .habit {{ margin-top:14px; background:#f3faf5; border:1px solid #cfe8d8; border-radius:8px; padding:13px 16px; }}
  .habit h2 {{ font-size:15px; margin:0 0 6px; color:{GREEN}; }}
  .habit ol {{ margin:6px 0 0; padding-left:18px; font-size:13px; line-height:1.6; }}
  .footer {{ margin-top:12px; font-size:11px; color:#8a97a4; line-height:1.5; }}
</style></head><body>
  <div class="cover">
    <div class="kicker">Chess Analysis · {USER}</div>
    <h1>Your Recurring Mistake Themes</h1>
    <p class="sub">Past 4 weeks · {SUMMARY['span']} · {SUMMARY['games']} games · engine-reviewed (Stockfish, depth 22–24).</p>
    <div class="intro">{SUMMARY['intro']}</div>
    <div class="stats">
      <div class="stat muted"><div class="n">{SUMMARY['hanging']}</div><div class="l">Hanging pieces (set aside)</div></div>
      <div class="stat hot"><div class="n">{SUMMARY['greedy']}</div><div class="l">Greedy captures</div></div>
      <div class="stat hot"><div class="n">{SUMMARY['checks']}</div><div class="l">Overlooked checks</div></div>
      <div class="stat"><div class="n">{SUMMARY['drift']}</div><div class="l">Positional drift</div></div>
    </div>
    <p class="legend2">Each diagram is the position <b>before</b> your move.
      <i style="border-color:{RED};"></i>the move you played
      <i style="border-color:{GREEN};"></i>the engine's move</p>
  </div>

  {themes_html}

  <div class="patterns">
    <h1>The through-line — one habit behind all three</h1>
    <p class="thesis">These aren't three separate weaknesses. They're one, wearing three masks. Every theme in
      this report is a failure to calculate the <b>forcing moves — checks and captures</b> — all the way to a
      quiet position before committing:</p>
    <ul>{closing_html}</ul>
    <div class="habit">
      <h2>The one habit to drill</h2>
      Make forcing moves the <b>first</b> thing you calculate every move — not the last:
      <ol>
        <li><b>List them.</b> Before you choose, name every check and capture — yours <i>and</i> your opponent's.</li>
        <li><b>Follow the capture through.</b> For the one you want, calculate the opponent's forcing replies
            (checks first) to a quiet position. Play it only if you still like where it lands.</li>
        <li><b>Prove the sac.</b> For any sacrifice, name the concrete payoff — mate, fork, or material back —
            before you commit. No payoff, no sac.</li>
      </ol>
      <p style="margin:8px 0 0;font-size:12.5px;"><b>In one line:</b> grab only what you can keep, sac only what
        you can prove, and always look for the check that wins.</p>
    </div>
    <p class="footer">{SUMMARY['games']} games, {SUMMARY['span']}. Categories among {SUMMARY['total']} mistakes &amp; blunders:
      hanging pieces {SUMMARY['hanging']} (set aside at your request), greedy captures {SUMMARY['greedy']},
      overlooked checks {SUMMARY['checks']}, positional drift {SUMMARY['drift']}. Positions and lines verified
      with Stockfish at depth 22–24; evals shown from your side of the board.</p>
  </div>
</body></html>"""

html_path = os.path.join(OUT_DIR, 'mistake_themes_4wk.html')
with open(html_path, 'w') as f:
    f.write(HTML)
print("wrote", html_path)
