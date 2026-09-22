"""Build the Italian-as-White review PDF from italian_30.py's analysis.

Renders board diagrams as inline SVG (red arrow = the move played, green =
what the engine wanted), plus inline SVG charts, then the companion node
script prints it to PDF via Chromium.
"""
import json
import os

import chess
import chess.svg

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'reports', 'italian30')
DATA = json.load(open(os.path.join(OUT, 'analysis.json')))
S = DATA['summary']
R = DATA['records']

RED = '#B3261E'     # the move you played
GREEN = '#1E7A46'   # the move the engine wanted
BLUE = '#1F5F8B'    # supporting idea

BOARD_COLORS = {
    'square light': '#EFEEE6', 'square dark': '#8CA06B',
    'square light lastmove': '#EFEEE6', 'square dark lastmove': '#8CA06B',
    'margin': '#3C4433', 'coord': '#DCDFD2',
    'inner border': '#3C4433', 'outer border': '#3C4433',
}


def rec(**kw):
    """First record matching every keyword, so examples are picked from data."""
    for r in R:
        if all(r.get(k) == v for k, v in kw.items()):
            return r
    return None


def board_svg(fen, played_uci, best_uci=None, extra=None, size=330):
    b = chess.Board(fen)
    arrows = []
    if best_uci:
        m = chess.Move.from_uci(best_uci)
        arrows.append(chess.svg.Arrow(m.from_square, m.to_square, color=GREEN))
    if played_uci:
        m = chess.Move.from_uci(played_uci)
        arrows.append(chess.svg.Arrow(m.from_square, m.to_square, color=RED))
    for a in (extra or []):
        arrows.append(chess.svg.Arrow(
            chess.parse_square(a[0]), chess.parse_square(a[1]), color=BLUE))
    return chess.svg.board(b, arrows=arrows, size=size, coordinates=True,
                           colors=BOARD_COLORS, borders=True)


def bars(rows, key, label_key, unit='%', accent=RED, width=520):
    """Horizontal bar chart as inline SVG — no chart library needed."""
    mx = max([r[key] for r in rows] + [1])
    rowh, pad = 26, 4
    h = len(rows) * rowh + 10
    out = [f'<svg viewBox="0 0 {width} {h}" width="100%" height="{h}" '
           f'role="img" class="chart">']
    for i, r in enumerate(rows):
        y = i * rowh + 6
        w = max(2, (r[key] / mx) * (width - 200))
        out.append(
            f'<text x="86" y="{y+14}" text-anchor="end" class="cl">{r[label_key]}</text>'
            f'<rect x="94" y="{y+3}" width="{w:.1f}" height="15" rx="2" fill="{accent}"/>'
            f'<text x="{94+w+7:.1f}" y="{y+15}" class="cv">{r[key]}{unit}</text>')
    out.append('</svg>')
    return ''.join(out)


def diagram(r, caption, why, extra=None):
    if not r:
        return ''
    svg = board_svg(r['fen'], r['uci'], r['best_uci'], extra)
    url = ''
    if r.get('url'):
        deep = r['url'].replace('/game/live/', '/analysis/game/live/')
        url = (f'<a class="src" href="{deep}?tab=review&amp;move={r["ply"]}">'
               f'open move {r["move_no"]} on chess.com</a>')
    ev = (f"{r['eval_before']/100:+.2f}" if abs(r['eval_before']) < 3000
          else ('mating' if r['eval_before'] > 0 else 'mated'))
    return f'''
<figure class="dia">
  <div class="bd">{svg}</div>
  <figcaption>
    <p class="cap">{caption}</p>
    <p class="mv"><b class="r">{r['move_no']}.{r['san']}</b>
       <span class="arrow">&rarr;</span>
       <b class="g">{r['best_san'] or '?'}</b>
       <span class="tag {r['cls']}">{r['cls']}</span>
       <span class="cp">&minus;{r['cp_lost']/100:.1f}</span></p>
    <p class="why">{why}</p>
    <p class="meta">vs {r['opp']} &middot; {r['date']} &middot; eval before {ev} {url}</p>
  </figcaption>
</figure>'''


T = S['themes']
pin, qn, cap = T['pinned_knight'], T['queen'], T['central_capture']

# examples, selected from the data rather than hand-picked FENs
pin_a = rec(move_no=8, san='a3')
pin_b = rec(move_no=8, san='O-O', knight_pinned=True)
pin_c = rec(move_no=8, san='Bd2')
q_early = rec(move_no=6, san='Qh5')
q_rep = rec(san='Qb3', is_queen_move=True)
q_worst = max((r for r in R if r['is_queen_move']), key=lambda r: r['cp_lost'])
c_early = rec(move_no=5, san='Nxd4')
c_cxd4 = rec(move_no=10, san='cxd4')
c_missed = rec(move_no=17, san='exd5')

html = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Italian as White — 30-game review</title>
<style>
@page {{ size: A4; margin: 14mm 13mm; }}
* {{ box-sizing: border-box; }}
body {{ margin:0; font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
  color:#1A1D16; font-size:10.5pt; line-height:1.5; background:#fff; }}
h1 {{ font-size:22pt; margin:0 0 2pt; letter-spacing:-.4pt; }}
h2 {{ font-size:13pt; margin:0 0 3pt; letter-spacing:-.2pt;
  border-top:2px solid #1A1D16; padding-top:7pt; }}
h3 {{ font-size:11pt; margin:14pt 0 5pt; }}
p {{ margin:0 0 7pt; }}
.sub {{ color:#5C6152; font-size:10pt; margin-bottom:12pt; }}
.lead {{ font-size:11pt; }}
.tiles {{ display:flex; gap:0; border:1px solid #D5D8CB; border-radius:5px;
  overflow:hidden; margin:10pt 0 14pt; }}
.tile {{ flex:1; padding:8pt 9pt; border-right:1px solid #D5D8CB; }}
.tile:last-child {{ border-right:0; }}
.tile .n {{ font-size:17pt; font-weight:700; line-height:1; }}
.tile .l {{ font-size:8pt; color:#5C6152; margin-top:2pt; }}
.bad {{ color:{RED}; }} .ok {{ color:{GREEN}; }}
.chart {{ margin:4pt 0 10pt; }}
text.cl {{ font-size:9px; fill:#5C6152; font-family:ui-monospace,Menlo,monospace; }}
text.cv {{ font-size:9px; fill:#1A1D16; font-weight:600;
  font-family:ui-monospace,Menlo,monospace; }}
.dia {{ display:flex; gap:13pt; margin:0 0 13pt; padding:9pt;
  border:1px solid #D5D8CB; border-radius:5px; break-inside:avoid; }}
.bd {{ flex:0 0 218pt; }}
.bd svg {{ width:100%; height:auto; display:block; }}
figcaption {{ flex:1; }}
.cap {{ font-weight:700; font-size:10.5pt; margin-bottom:4pt; }}
.mv {{ font-family:ui-monospace,Menlo,monospace; font-size:10pt; margin-bottom:5pt; }}
.mv .r {{ color:{RED}; }} .mv .g {{ color:{GREEN}; }}
.arrow {{ color:#9AA08C; margin:0 3pt; }}
.tag {{ font-size:7.5pt; text-transform:uppercase; letter-spacing:.4pt;
  border:1px solid currentColor; border-radius:3px; padding:0 3pt; margin-left:4pt; }}
.tag.inaccuracy {{ color:#A8751A; }} .tag.mistake {{ color:#C0621B; }}
.tag.blunder {{ color:{RED}; }}
.cp {{ color:#5C6152; margin-left:5pt; }}
.why {{ font-size:9.5pt; margin-bottom:5pt; }}
.meta {{ font-size:8pt; color:#777D6C; margin:0; }}
.src {{ color:{BLUE}; margin-left:5pt; }}
.key {{ display:flex; gap:14pt; font-size:8.5pt; color:#5C6152; margin:0 0 10pt; }}
.key i {{ display:inline-block; width:15px; height:3px; vertical-align:middle;
  margin-right:4pt; }}
.box {{ background:#F4F5EF; border-left:3px solid {GREEN}; padding:8pt 10pt;
  border-radius:0 4px 4px 0; margin:9pt 0; break-inside:avoid; }}
.box p:last-child {{ margin-bottom:0; }}
table {{ width:100%; border-collapse:collapse; font-size:9pt; margin:6pt 0 10pt; }}
th {{ text-align:left; font-size:8pt; text-transform:uppercase; letter-spacing:.4pt;
  color:#777D6C; border-bottom:1px solid #C9CDBD; padding:3pt 5pt; }}
td {{ padding:3.5pt 5pt; border-bottom:1px solid #E6E8DE; }}
td.m {{ font-family:ui-monospace,Menlo,monospace; }}
.page {{ break-before:page; }}
.foot {{ margin-top:14pt; padding-top:7pt; border-top:1px solid #D5D8CB;
  font-size:8pt; color:#777D6C; }}
</style></head><body>

<h1>The Italian as White</h1>
<p class="sub">Your last {S['games']} games &middot; {S['span'][0]} to {S['span'][1]}
 &middot; {S['record']['w']}W&ndash;{S['record']['l']}L&ndash;{S['record']['d']}D
 ({S['score_pct']}%) &middot; every inaccuracy counted, not just blunders</p>

<div class="tiles">
  <div class="tile"><div class="n">{S['errors']}</div>
    <div class="l">inaccuracies or worse<br>in {S['moves_analysed']} of your moves</div></div>
  <div class="tile"><div class="n bad">{S['error_rate']}%</div>
    <div class="l">of your moves<br>lose ground</div></div>
  <div class="tile"><div class="n">{S['by_class']['inaccuracy']}</div>
    <div class="l">inaccuracies<br>(the quiet majority)</div></div>
  <div class="tile"><div class="n bad">{S['by_class']['blunder']}</div>
    <div class="l">blunders</div></div>
  <div class="tile"><div class="n">{S['per_game']}</div>
    <div class="l">errors<br>per game</div></div>
</div>

<p class="lead">You named three suspicions. All three are real, but they are not
the same <em>kind</em> of problem, and that changes what to do about each.</p>

<table>
<tr><th>What you suspected</th><th>How often it goes wrong</th><th>What it costs</th><th>Verdict</th></tr>
<tr><td>Knight gets pinned</td>
    <td class="m">{pin['errors']}/{pin['positions_with_pin']} &nbsp;<b>{pin['error_rate']}%</b></td>
    <td class="m">&minus;{pin['avg_cp']/100:.1f} typical</td>
    <td>Most likely to go wrong, cheapest when it does</td></tr>
<tr><td>Queen development</td>
    <td class="m">{qn['errors']}/{qn['queen_moves']} &nbsp;<b>{qn['error_rate']}%</b></td>
    <td class="m">&minus;{qn['avg_cp']/100:.1f} typical</td>
    <td>Your single biggest source of lost ground</td></tr>
<tr><td>Captures in the centre</td>
    <td class="m">{cap['errors']}/{cap['central_captures']} &nbsp;<b>{cap['error_rate']}%</b></td>
    <td class="m">&minus;{cap['avg_cp']/100:.1f} typical</td>
    <td>Rarest, but by far the most expensive</td></tr>
</table>

<p>Your baseline error rate is <b>{S['error_rate']}%</b>, so a pinned knight
({pin['error_rate']}%) and a queen move ({qn['error_rate']}%) are both riskier
than an average move. Central captures at {cap['error_rate']}% are
<em>less</em> frequent than average &mdash; but they cost the most when they go
wrong, and {cap['mate_scale']} of the {cap['errors']} were severe enough that
the engine was reporting a forced mate rather than a material loss.</p>

<p class="meta">Costs are capped at ten pawns per move. A single allowed mate
scores in the thousands of centipawns, and averaging those in makes
&ldquo;typical cost&rdquo; read as material when it is not. Median values are
lower still: {pin['median_cp']/100:.1f}, {qn['median_cp']/100:.1f} and
{cap['median_cp']/100:.1f} pawns respectively.</p>

<div class="key">
  <span><i style="background:{RED}"></i>the move you played</span>
  <span><i style="background:{GREEN}"></i>what the engine wanted</span>
</div>

<h3>Where in the game it happens</h3>
{bars(S['by_move_band'], 'rate', 'band')}
<p class="meta">Share of your moves in each block of five that lose ground.
Moves 1&ndash;5 are book. The damage starts once you are out of it.</p>

<h3>Which piece</h3>
{bars(S['by_piece'], 'rate', 'piece', accent=BLUE)}
<p class="meta">Error rate by the piece you moved.</p>

<div class="page"></div>
<h2>1 &middot; The pinned knight</h2>
<p>This is the cleanest pattern in the whole set, because it is the
<em>same position</em> three times. A black bishop lands on b4, pinning your
knight on c3 against your king on e1 &mdash; and each time you answer with a
slow move instead of addressing it.</p>

{diagram(pin_a, 'Move 8: the pin appears, and you play a rook pawn',
   'a3 asks the bishop a question it is happy to answer. The knight on c3 is '
   'still pinned afterwards, so nothing has changed except that you have spent '
   'a tempo. Castling first removes the pin outright, because the king leaves '
   'the e1&ndash;a5 diagonal.')}

{diagram(pin_b, 'Move 8: castling is right here &mdash; but so was breaking with e5',
   'Castling does unpin the knight, so this is only an inaccuracy. The engine '
   'prefers e5 because it hits the f6 knight while your centre is still mobile. '
   'Worth seeing that the pin has two answers: move the king, or strike the centre.')}

{diagram(pin_c, 'Move 8: Bd2 offers a trade that helps Black',
   'Bd2 unpins, but it puts your bishop on a passive square and invites the '
   'exchange that repairs Black&rsquo;s structure. Castle instead and keep the '
   'bishop pointing at something.')}

<div class="box">
<p><b>The rule to take away.</b> When a bishop pins your c3 knight, you have
exactly three real answers: <b>castle</b> (the king leaves the diagonal),
<b>break with e5 or d5</b> (the pin stops mattering once the centre opens), or
<b>Bd2 only if you actually want the trade</b>. A move like a3 or h3 is not an
answer &mdash; the knight is still pinned when you have finished.</p>
</div>

<div class="page"></div>
<h2>2 &middot; The queen</h2>
<p>{qn['errors']} of your {qn['queen_moves']} queen moves lose ground &mdash;
<b>{qn['error_rate']}%</b>, against a {S['error_rate']}% baseline. It is your
most error-prone piece, at a typical cost of
&minus;{qn['avg_cp']/100:.1f} (median &minus;{qn['median_cp']/100:.1f}).
{qn['early']} of them happen in the first twelve moves.</p>

{diagram(q_early, 'Move 6: the queen goes hunting before the pieces are out',
   'Qh5 eyes f7 and h7, but nothing supports it. Black gains time by developing '
   'at the queen, and you end up moving her again. Castling first keeps every '
   'option and costs nothing.')}

{diagram(q_rep, 'The Qb3 / Qc4 shuffle',
   'You play Qb3 and then Qc4 repeatedly across these games. Each move is '
   'individually plausible and collectively they concede the initiative &mdash; '
   'the queen is doing the work that a developed rook or knight should be doing.')}

{diagram(q_worst, 'The most expensive queen move in the set',
   'Not a subtle one: the queen steps onto a square the opponent already covers. '
   'This is the pattern behind the biggest single losses &mdash; not where the '
   'queen goes strategically, but whether the destination square is attacked.')}

<div class="box">
<p><b>The rule to take away.</b> Before any queen move, ask the same two
questions: <em>is the square she is going to attacked?</em> and <em>can my
opponent develop a piece by hitting her there?</em> If you cannot answer both,
play a developing move instead &mdash; in these thirty games castling or a minor
piece move was the engine&rsquo;s preference far more often than a queen sortie.</p>
</div>

<div class="page"></div>
<h2>3 &middot; Captures in the centre</h2>
<p>These are your rarest errors and your most expensive:
{cap['errors']} of {cap['central_captures']} central captures lose ground, at a
typical cost of <b>&minus;{cap['avg_cp']/100:.1f}</b> &mdash; the highest of the
three themes. Two distinct things are happening here, and they need different
fixes.</p>

<h3>The real pattern: recapturing on autopilot</h3>

{diagram(c_early, 'Move 5: taking the pawn that was offered',
   'Nxd4 is the natural recapture, and it is wrong &mdash; Nxe5 first wins the '
   'tempo back. Whenever there are two ways to recapture, the order almost '
   'always matters.')}

{diagram(c_cxd4, 'Move 10: cxd4 releases the tension too early',
   'Resolving the centre hands Black a clear target and a clear plan. The engine '
   'prefers to keep the tension with a quiet move and let the opponent decide '
   'first. This is the same cxd4 habit that shows up across your Italian games.')}

<h3>The other half is not really about the capture</h3>

{diagram(c_missed, 'Move 17: the capture was not the mistake &mdash; missing mate was',
   'exd5 is a reasonable-looking move that happens to throw away a forced mate. '
   'Several of your largest &ldquo;central capture&rdquo; losses are this shape: '
   'you took something while a mate or a winning tactic was on the board. '
   'That is a calculation habit, not a capture habit.')}

<div class="box">
<p><b>The rule to take away.</b> Split these in two. For ordinary recaptures,
pause on the <em>order</em> &mdash; when two pieces can take, the wrong one
usually loses a tempo. For the expensive ones, the capture was incidental: you
took material while something stronger was available. Before any capture in a
sharp position, spend one look asking whether there is a check or a mate first.</p>
</div>

<div class="page"></div>
<h2>What to actually practise</h2>
<div class="box">
<p><b>1. The Bb4 pin, from the board.</b> Set up the move-8 position and play
through the three answers &mdash; castle, e5, Bd2. It recurs roughly every tenth
game and you have not yet settled on a reply.</p>
<p><b>2. One question before every queen move.</b> &ldquo;Is that square
attacked, and does this let him develop with tempo?&rdquo; This is the single
highest-value habit here: {qn['errors']} queen errors is more than any other
piece, and {qn['error_rate']}% of your queen moves lose ground.</p>
<p><b>3. One look for checks before any capture.</b> Your most expensive
mistakes are not bad captures, they are captures played while a mate was
available.</p>
</div>

<h3>Moves you repeated</h3>
<table>
<tr><th>Move</th><th>At move</th><th>Times</th></tr>
{''.join(f"<tr><td class='m'>{x['san']}</td><td class='m'>{x['move_no']}</td>"
         f"<td class='m'>{x['count']}</td></tr>" for x in S['recurring'][:8])}
</table>

<p class="foot">Generated from {S['moves_analysed']} of your own moves across
{S['games']} games, Stockfish depth 22. &ldquo;Error&rdquo; means the engine
evaluation fell &mdash; inaccuracies (&minus;0.5 to &minus;1.5), mistakes
(&minus;1.5 to &minus;3.0) and blunders (worse than &minus;3.0). Moves whose
evaluation improved are excluded, so forced-mate jumps are not counted as
errors, and per-move costs are capped at ten pawns so an allowed mate does not
distort an average. Positions are shown exactly as they occurred; red is your
move, green is the engine&rsquo;s.</p>

</body></html>'''

path = os.path.join(OUT, 'italian30.html')
open(path, 'w').write(html)
print('wrote', path)
