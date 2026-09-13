"""Render the board diagrams for the mistake report and inject them into
report.html at <!--DIAGRAM:id--> markers.

Every position is a real one from the database (FEN + the move actually played +
the engine's move); nothing here is constructed by hand except the two opening
positions in the d3/d4 comparison, which are built by pushing the moves.
"""
import io
import os
import re
import chess
import chess.pgn
import chess.svg

HERE = os.path.dirname(os.path.abspath(__file__))
REPORT = os.path.join(HERE, 'reports', '2026-08-20', 'report.html')

# Board is a fixed object, like a photograph — the same in either page theme.
BOARD_COLORS = {
    'square light': '#E9EADC',
    'square dark': '#7D8C5F',
    # the move actually played, tinted toward the "played" rust
    'square light lastmove': '#E4B79B',
    'square dark lastmove': '#B07B55',
    'margin': '#3A4230',
    'coord': '#D8DAC8',
    'inner border': '#3A4230',
    'outer border': '#3A4230',
}
PLAYED = '#C2410C'    # the move you played
ENGINE = '#0B72AE'    # the move the engine wanted
DANGER = '#C2410CAA'  # square where the material actually goes
ENGINE_SQ = '#0B72AEAA'


def sq(name):
    return chess.parse_square(name)


def line_to_fen(moves_san):
    b = chess.Board()
    for s in moves_san.split():
        b.push_san(s)
    return b.fen()


def render(fen, played=None, engine=None, danger=None, flipped=False, arrows_ok=True):
    """A one-square move draws as an ugly stub arrow, so short moves are shown
    by highlighting squares instead: the played move via lastmove, the engine's
    via a blue wash on its destination."""
    board = chess.Board(fen)
    arrows, fill, lastmove = [], {}, None

    if played:
        mv = chess.Move.from_uci(played)
        lastmove = mv
        if arrows_ok and chess.square_distance(mv.from_square, mv.to_square) > 1:
            arrows.append(chess.svg.Arrow(mv.from_square, mv.to_square, color=PLAYED))
    if engine:
        ev = chess.Move.from_uci(engine)
        if chess.square_distance(ev.from_square, ev.to_square) > 1:
            arrows.append(chess.svg.Arrow(ev.from_square, ev.to_square, color=ENGINE))
        else:
            fill[ev.to_square] = ENGINE_SQ
    if danger:
        fill[sq(danger)] = DANGER

    svg = chess.svg.board(
        board, arrows=arrows, fill=fill, lastmove=lastmove, flipped=flipped,
        coordinates=True, colors=BOARD_COLORS, borders=True, size=400,
    )
    # let CSS size it; keep the viewBox
    svg = re.sub(r'\swidth="\d+"', '', svg, count=1)
    svg = re.sub(r'\sheight="\d+"', '', svg, count=1)
    svg = svg.replace('<svg ', '<svg class="board" role="img" ', 1)
    return svg


# Which real game each diagram came from: diagram id -> (games.id, ply).
# ply is 1-based (ply 1 = White's first move), matching the moves table.
SOURCE = {
    'b1': ('dd55265d-8583-461e-88b7-7b56a400b2f2', 56),
    'b2': ('eb94604a-a328-489a-9442-48471996d4eb', 34),
    'b3': ('474dc054-af64-4bf4-958b-afd9821d83bf', 74),
    'b4': ('f212b73a-eb96-4c97-b37e-6eff0d9fdedf', 90),
    'b5': ('80fc2e97-1016-4fd4-b061-8090725d94e8', 30),
    'w1': ('30642652-62ab-48f8-84e7-85483d80faa0', 17),
    'w2': ('04e4acda-8a29-431e-914d-67565c130488', 19),
    'w3': ('7b53f5b8-2a66-4ebb-9dd3-4bc4cac81c89', 21),
    'w4': ('a30e402b-2f95-47d5-bb6c-50e79e8d338f', 17),
}

# --------------------------------------------------------------------------
# id, title, fen, played uci, engine uci, danger square, flipped, eval, caption
# --------------------------------------------------------------------------
DIAGRAMS = [
    dict(
        id='b1', side='Black to move', mv='28…Rg8',
        fen='r7/1q6/3p1k1p/1Pb1pp2/6b1/1B1P1P2/1P3PKB/3QR3 b - - 3 28',
        played='a8g8', engine='a8a1', danger=None, flipped=True,
        before='+4.92', after='−4.35',
        title='A won game, and the rook walks onto a diagonal',
        body='You are up nearly five pawns. <b>Ra8–g8</b> steps onto the long light diagonal '
             'that the bishop on b3 already owns — c4, d5, e6 and f7 are all empty, so '
             '<b>Bxg8</b> simply takes it. <b>Ra1</b> kept the win. This is leak 2 and leak 3 '
             'in one move: a rook, played from a winning position, onto a covered square.',
    ),
    dict(
        id='b2', side='Black to move', mv='17…Qxf3',
        fen='r4rk1/ppp2p1p/1n4p1/3P4/2B1Pq2/2Q2P2/PP3PRP/1K1R4 b - - 5 17',
        played='f4f3', engine='b6c4', danger=None, flipped=True,
        before='+0.03', after='−5.95',
        title='Taking a pawn that is guarded by a queen',
        body='The f3 pawn is defended along the third rank by the queen on c3. '
             '<b>Qxf3 Qxf3</b> and the queen is gone for a pawn. <b>Nxc4</b> was equal. '
             'Twenty-nine of your error moves are this shape — a capture that wins '
             'material and loses more.',
    ),
    dict(
        id='b3', side='Black to move', mv='37…Rxd4',
        fen='3r3k/pp3p1p/8/2K2P2/2PR4/1P4r1/P7/5R2 b - - 0 37',
        played='d8d4', engine='b7b6', danger=None, flipped=True,
        before='+5.35', after='−0.14',
        title='A rook takes a rook the king is guarding',
        body='<b>Rxd4</b> looks like a trade. The white king on c5 is defending d4, so it '
             'is <b>Kxd4</b> and you are simply a rook down. <b>b6+</b> first was winning. '
             'Rook moves are 21% of your errors — the highest of any piece.',
    ),
    dict(
        id='b4', side='Black to move', mv='45…Nxc5',
        fen='5r1k/8/6pN/p1R1p1P1/4n1K1/7P/P7/8 b - - 2 45',
        played='e4c5', engine='f8f4', danger=None, flipped=True,
        before='mate in 1', after='+7.14',
        title='Mate in one, and you took the rook',
        body='<b>Rf4</b> is checkmate: f3, f5 and h4 are covered by the rook, g3 and g5 by '
             'your knight, h5 by the g6 pawn, and Kxf4 is illegal because the e5 pawn '
             'guards f4. You played <b>Nxc5</b>, winning a rook, and the game ran another '
             'thirty moves. Twenty-one of your 44 endgame errors were played from '
             'already-winning positions.',
    ),
    dict(
        id='b5', side='Black to move', mv='15…exd4',
        fen='r7/pppq1kp1/3p3p/3np3/3PP1b1/3P4/PP3PPP/R3QRK1 b - - 0 15',
        played='e5d4', engine='g4f3', danger=None, flipped=True,
        before='+5.55', after='−2.95',
        title='The automatic central capture',
        body='<b>exd4</b> is the reflex — a pawn is there, so you take it. It releases all '
             'the pressure and hands back a winning position. <b>Bf3</b>, hitting g2, kept '
             'the attack. <span class="mv">exd4</span> shows up twice in the last fifty '
             'games as a mistake at exactly this move number.',
    ),
    dict(
        id='w1', side='White to move', mv='9.Bxf7+',
        fen='r2qk1nr/ppp2ppp/3p4/n7/1bBPP1b1/2N1BN2/PP3PPP/R2QK2R w KQkq - 5 9',
        played='c4f7', engine='d1a4', danger=None, flipped=False,
        before='+2.62', after='−1.07',
        title='The position that triggers Bxf7+',
        body='This is the recurring one. Black\'s knight has just landed on a5, attacking '
             'your bishop, and rather than move it you cash it in on f7. But <b>Qa4+</b> '
             'is check and forks both the a5 knight and the b4 bishop. You reach a '
             'position of this family in six games from <span class="mv">4.c3 d6 5.d4 exd4 '
             '6.cxd4 Bb4+</span> alone.',
    ),
    dict(
        id='w2', side='White to move', mv='10.Bxf7+',
        fen='r1b1kbnr/pppp1pp1/7p/4P3/1qBQ4/8/PPP2PPP/RNB1R1K1 w kq - 5 10',
        played='c4f7', engine='b1c3', danger=None, flipped=False,
        before='+5.01', after='−0.99',
        title='Winning by five pawns, and sacrificing anyway',
        body='Nothing here needs a sacrifice. <b>Nc3</b> develops with tempo against the '
             'loose queen on b4 and the game plays itself. <b>Bxf7+</b> gives back the '
             'entire advantage. You won this one regardless — which is exactly why the '
             'habit survives.',
    ),
    dict(
        id='w3', side='White to move', mv='11.Kf1',
        fen='r1bqk1nr/pppp1ppp/8/4P3/2B3Q1/8/PPnN1PPP/RN2K2R w KQkq - 3 11',
        played='e1f1', engine='e1d1', danger='a1',
        flipped=False, before='0.00', after='−2.54',
        title='Stepping the wrong way from a knight fork',
        body='The knight on c2 is forking the king and the a1 rook. <b>Kf1</b> abandons the '
             'rook — <b>…Nxa1</b> and it is gone. <b>Kd1</b> attacks the knight instead and '
             'wins it. You dropped the a1 rook to <span class="mv">…Nxa1</span> twice, both '
             'times out of the <span class="mv">6.cxd4 Bb4+</span> line.',
    ),
    dict(
        id='w4', side='White to move', mv='9.Re1',
        fen='r2qkb1r/p1p2pp1/2ppbn1p/8/P1B1P3/8/1PP2PPP/RNBQ1RK1 w kq - 0 9',
        played='f1e1', engine='c4e6', danger=None, flipped=False,
        before='+0.88', after='−3.29',
        title='Re1, when the position asked a question',
        body='Your bishop on c4 and Black\'s on e6 are staring at each other through an '
             'empty d5. The position wants a decision: <b>Bxe6</b>. <b>Re1</b> is a '
             'developing move played on autopilot, and Black answers <b>…Bxc4</b>. '
             '<span class="mv">Re1</span> is a mistake or blunder 22 times across your '
             'Italian games, seven of them on move 9.',
    ),
]

# the two opening positions in the d3-vs-d4 comparison, built by pushing moves
FORK = [
    dict(
        id='w5a', side='After 3…Nf6 4.d3', mv='4.d3',
        line='e4 e5 Nf3 Nc6 Bc4 Nf6 d3',
        fen=line_to_fen('e4 e5 Nf3 Nc6 Bc4 Nf6 d3'),
        played='d2d3', engine=None, danger=None, flipped=False,
        before='54 games', after='72.2%',
        title='Against 3…Nf6 you play d3, and it works',
        body='The centre stays closed, both sides finish developing, and the game is '
             'decided by plans rather than by a melee on move 11. This is your single '
             'best-scoring position as White: <b>72.2% across 54 games</b>. You already '
             'know how to play it.',
    ),
    dict(
        id='w5b', side='After 6…Bb4+', mv='6…Bb4+',
        line='e4 e5 Nf3 Nc6 Bc4 Bc5 c3 d6 d4 exd4 cxd4 Bb4',
        fen=line_to_fen('e4 e5 Nf3 Nc6 Bc4 Bc5 c3 d6 d4 exd4 cxd4 Bb4'),
        played='f8b4', engine=None, danger=None, flipped=False,
        before='13 games', after='38.5%',
        title='Against 3…Bc5 you play c3, and this is where it goes',
        body='Twenty-one times Black meets your <span class="mv">c3</span>/<span class="mv">d4</span> '
             'centre with <span class="mv">…Bb4</span> on move 6, and thirteen games reach '
             'exactly this position. You are <em>not</em> stuck for a reply — you play '
             '<b>Nc3</b> in twelve of the thirteen. It scores <b>41.7%</b>. '
             'The line is the problem, not your answer to it.',
    ),
]


def fetch_sources():
    """Pull each source game's chess.com link and verify, by replaying the PGN,
    that the recorded ply really is the position and move the diagram shows.

    chess.com's analysis view indexes half-moves from 0 at the starting
    position, so the position *before* our 1-based ply P is ?move=P-1 and the
    position with that move played is ?move=P.
    """
    import psycopg2
    from dotenv import load_dotenv
    load_dotenv(os.path.join(HERE, '.env'))
    conn = psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
        dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
        password=os.getenv('SUPABASE_PASSWORD'), sslmode='require')
    cur = conn.cursor()
    cur.execute("""
        SELECT id::text, pgn, white_player, black_player, result, played_at::date
        FROM games WHERE id = ANY(%s::uuid[])
    """, ([g for g, _ in SOURCE.values()],))
    raw = {r[0]: r[1:] for r in cur.fetchall()}
    conn.close()

    by_diagram, problems = {}, []
    spec = {d['id']: d for d in DIAGRAMS}
    for did, (gid, ply) in SOURCE.items():
        if gid not in raw:
            problems.append(f'{did}: game {gid} not found')
            continue
        pgn, white, black, result, date = raw[gid]
        link = re.search(r'\[Link "([^"]+)"\]', pgn)
        if not link:
            problems.append(f'{did}: no Link header')
            continue
        url = link.group(1)

        # replay to the position the diagram shows, and check it matches
        game = chess.pgn.read_game(io.StringIO(pgn))
        board = game.board()
        node, i, played_san = game, 0, None
        while node.variations:
            node = node.variation(0)
            i += 1
            if i == ply:
                played_san = board.san(node.move)
                break
            board.push(node.move)
        if played_san is None:
            problems.append(f'{did}: game has fewer than {ply} plies')
            continue
        want = spec[did]['fen'].split()[:4]
        got = board.fen().split()[:4]
        if want != got:
            problems.append(f'{did}: FEN mismatch at ply {ply}\n'
                            f'       spec {" ".join(want)}\n       pgn  {" ".join(got)}')
        expect_uci = spec[did]['played']
        if board.parse_san(played_san).uci() != expect_uci:
            problems.append(f'{did}: move at ply {ply} is {played_san}, spec says {expect_uci}')

        analysis = url.replace('/game/live/', '/analysis/game/live/')
        by_diagram[did] = dict(
            url=f'{analysis}?tab=review&amp;move={ply}',
            game_url=url,
            label=f'{white} vs {black}',
            date=str(date),
            result=result,
            moveno=(ply + 1) // 2,
            side='White' if ply % 2 else 'Black',
        )

    if problems:
        raise SystemExit('source verification failed:\n  ' + '\n  '.join(problems))
    print(f'verified {len(by_diagram)} source positions against their PGNs')
    return by_diagram


def find_examples():
    """The two fork positions are opening positions, not one specific game, so
    each links to a real game that went down that road — found by matching the
    move sequence, not hand-picked."""
    import psycopg2
    from dotenv import load_dotenv
    load_dotenv(os.path.join(HERE, '.env'))
    conn = psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
        dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
        password=os.getenv('SUPABASE_PASSWORD'), sslmode='require')
    cur = conn.cursor()
    cur.execute("""
        SELECT pgn, white_player, black_player, result, played_at::date
        FROM games
        WHERE username=%s AND LOWER(white_player)=%s
        ORDER BY played_at DESC
    """, ('negrilmannings', 'negrilmannings'))
    games = cur.fetchall()
    conn.close()

    wanted = {d['id']: d['line'] for d in FORK}
    out = {}
    for pgn, white, black, result, date in games:
        g = chess.pgn.read_game(io.StringIO(pgn))
        if g is None:
            continue
        sans, node = [], g
        while node.variations and len(sans) < 14:
            node = node.variation(0)
            sans.append(node.san())
        bare = [s.rstrip('+#') for s in sans]
        for did, line in wanted.items():
            need = [s.rstrip('+#') for s in line.split()]
            if did not in out and bare[:len(need)] == need:
                link = re.search(r'\[Link "([^"]+)"\]', pgn)
                if not link:
                    continue
                url = link.group(1).replace('/game/live/', '/analysis/game/live/')
                out[did] = dict(
                    url=f'{url}?tab=review&amp;move={len(need)}',
                    label=f'{white} vs {black}', date=str(date),
                    result=result, moveno=(len(need) + 1) // 2,
                )
        if len(out) == len(wanted):
            break
    missing = set(wanted) - set(out)
    if missing:
        raise SystemExit(f'no example game found for: {sorted(missing)}')
    print(f'found example games for {len(out)} fork positions')
    return out


SOURCES = {}
EXAMPLES = {}


def source_link(did, mv):
    s = SOURCES.get(did)
    if not s:
        return ''
    return (f'<p class="src"><a href="{s["url"]}" target="_blank" rel="noopener">'
            f'Open at {mv} on chess.com</a>'
            f'<span class="src-meta">{s["label"]} &middot; {s["date"]} &middot; {s["result"]}</span></p>')


def example_link(did, mv):
    s = EXAMPLES.get(did)
    if not s:
        return ''
    return (f'<p class="src"><a href="{s["url"]}" target="_blank" rel="noopener">'
            f'Open an example game at {mv}</a>'
            f'<span class="src-meta">{s["label"]} &middot; {s["date"]} &middot; {s["result"]}</span></p>')


def drops_table():
    """Every SEE-verified material drop in the last 50 games as Black, listed
    with a deep link so each one can be replayed. Same computation as
    black_deepdive.py (shared see.py), so the counts cannot drift."""
    import psycopg2
    from dotenv import load_dotenv
    from see import avoidable_drop
    load_dotenv(os.path.join(HERE, '.env'))
    conn = psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
        dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
        password=os.getenv('SUPABASE_PASSWORD'), sslmode='require')
    cur = conn.cursor()
    import scope
    cur.execute("""
        WITH last50 AS (""" + scope.LAST_BLACK + """)
        SELECT l.id::text, l.pgn, l.result, l.played_at::date, l.white_player,
               m.ply, m.move_san, m.move_uci, m.position_fen_before,
               m.best_move_san, -m.eval_before
        FROM last50 l JOIN moves m ON m.game_id=l.id
        WHERE m.classification IN ('mistake','blunder')
          -- the pipeline forces 'blunder' in some mate-score branches; a real
          -- error must actually lose ground
          AND m.eval_delta < 0
          AND m.ply %% 2 = 0
          AND m.position_fen_before IS NOT NULL
        ORDER BY m.ply
    """, scope.PARAMS)
    errs = cur.fetchall()
    conn.close()

    # opponent's actual reply, per game
    replies, links = {}, {}
    for gid, pgn, *_ in errs:
        if gid in links:
            continue
        link = re.search(r'\[Link "([^"]+)"\]', pgn)
        links[gid] = link.group(1) if link else None
        g = chess.pgn.read_game(io.StringIO(pgn))
        node, i = g, 0
        while g and node.variations:
            node = node.variation(0)
            i += 1
            replies[(gid, i)] = node.san()

    rows, onepawn = [], 0
    for (gid, pgn, result, date, white, ply, san, uci, fen, best, before) in errs:
        try:
            b = chess.Board(fen)
            mv = chess.Move.from_uci(uci)
        except Exception:
            continue
        # material this move gave away that another legal move would have saved
        gain, cap, gross, floor = avoidable_drop(b, mv)
        if gain == 1:
            onepawn += 1
            continue
        if gain < 2:
            continue
        rows.append(dict(
            gid=gid, ply=ply, moveno=(ply + 1) // 2, san=san, cap=cap, gain=gain,
            gross=gross, floor=floor,
            took=replies.get((gid, ply + 1)) == cap, best=best, before=before,
            opp=white, date=str(date), result=result, link=links.get(gid),
        ))

    rows.sort(key=lambda r: (-r['gain'], r['moveno']))
    punished = sum(1 for r in rows if r['took'])
    from_better = sum(1 for r in rows if (r['before'] or 0) > 100)
    print(f'drops table: {len(rows)} drops of >=2 pawns, {onepawn} single pawns, '
          f'{punished} punished ({punished/max(len(rows),1)*100:.0f}%), '
          f'{from_better} played from a better position')

    out = []
    for r in rows:
        mv = f'{r["moveno"]}…{r["san"]}'
        if r['link']:
            url = (r['link'].replace('/game/live/', '/analysis/game/live/')
                   + f'?tab=review&amp;move={r["ply"]}')
            cell = f'<a href="{url}" target="_blank" rel="noopener">{mv}</a>'
        else:
            cell = mv
        # beyond ±30 pawns the engine is reporting a forced mate, not a number
        cp = r['before']
        if cp is None:
            ev = ''
        elif cp > 3000:
            ev = 'mating'
        elif cp < -3000:
            ev = 'mated'
        else:
            ev = f'{cp/100:+.2f}'
        evcls = ' class="num pos"' if (cp or 0) > 100 else ' class="num"'
        # the engine's move is only worth showing when it differs from yours
        best = '&mdash;' if (r['best'] or '') == r['san'] else (r['best'] or '?')
        out.append(
            f'<tr><td class="san">{cell}</td><td class="san">{r["cap"]}</td>'
            f'<td class="num">{r["gain"]}</td>'
            f'<td>{"taken" if r["took"] else "missed"}</td>'
            f'<td{evcls}>{ev}</td><td class="san">{best}</td>'
            f'<td class="line">{r["opp"]} &middot; {r["date"]}</td></tr>')

    return f'''<div class="scroll">
  <table class="drops">
    <caption>All {len(rows)} moves that gave away two or more pawns another legal move would have saved &mdash; click a move to open it on chess.com</caption>
    <thead>
      <tr><th>Your move</th><th>Free capture</th><th class="num">Pawns lost</th><th>Punished</th>
          <th class="num">Eval before</th><th>Engine wanted</th><th>Opponent &amp; date</th></tr>
    </thead>
    <tbody>{''.join(out)}</tbody>
  </table>
</div>'''


def figure(d):
    svg = render(d['fen'], d.get('played'), d.get('engine'),
                 d.get('danger'), d.get('flipped', False))
    legend = []
    if d.get('played'):
        legend.append(f'<span><i class="dot" style="background:{PLAYED}"></i> '
                      f'{d["mv"]} — played</span>')
    if d.get('engine'):
        legend.append(f'<span><i class="dot" style="background:{ENGINE}"></i> '
                      f'engine&rsquo;s move</span>')
    if d.get('danger'):
        legend.append(f'<span><i class="dot" style="background:{PLAYED};opacity:.7"></i> '
                      f'where the material goes</span>')
    return f'''<figure class="diagram" id="{d['id']}">
  <div class="board-wrap">{svg}</div>
  <div class="diagram-body">
    <p class="diagram-meta"><span>{d['side']}</span><span class="ev">{d['before']}
      <span aria-hidden="true">&rarr;</span> {d['after']}</span></p>
    <h4 class="diagram-title">{d['title']}</h4>
    <p>{d['body']}</p>
    <div class="seg-key">{''.join(legend)}</div>
    {source_link(d['id'], d['mv'])}
  </div>
</figure>'''


def fork_block():
    cards = []
    for d in FORK:
        svg = render(d['fen'], d.get('played'), None, None, False, arrows_ok=False)
        cards.append(f'''<figure class="fork-card" id="{d['id']}">
  <div class="board-wrap">{svg}</div>
  <p class="diagram-meta"><span>{d['side']}</span><span class="ev">{d['before']} &middot; {d['after']}</span></p>
  <h4 class="diagram-title">{d['title']}</h4>
  <p>{d['body']}</p>
  {example_link(d['id'], d['mv'])}
</figure>''')
    return '<div class="fork">' + ''.join(cards) + '</div>'


def main():
    global SOURCES, EXAMPLES
    SOURCES = fetch_sources()
    EXAMPLES = find_examples()

    with open(REPORT, encoding='utf-8') as f:
        html = f.read()

    blocks = {d['id']: figure(d) for d in DIAGRAMS}
    blocks['w5'] = fork_block()
    blocks['drops'] = drops_table()

    # Injection is re-runnable: each block is wrapped in its own open/close
    # markers, so a second run replaces the previous render rather than failing.
    missing = []
    for key, block in blocks.items():
        kind = 'TABLE' if key == 'drops' else 'DIAGRAM'
        open_m, close_m = f'<!--{kind}:{key}-->', f'<!--/{kind}:{key}-->'
        wrapped = f'{open_m}{block}{close_m}'
        region = re.compile(re.escape(open_m) + r'.*?' + re.escape(close_m), re.S)
        if region.search(html):
            html = region.sub(lambda _: wrapped, html, count=1)
        elif open_m in html:
            html = html.replace(open_m, wrapped, 1)
        else:
            missing.append(key)

    if missing:
        raise SystemExit(f'markers not found in report.html: {missing}')

    with open(REPORT, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'injected {len(blocks)} diagram blocks into {REPORT}')


if __name__ == '__main__':
    main()
