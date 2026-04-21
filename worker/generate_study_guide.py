"""
Generate a PDF study guide of middlegame mistakes/blunders from the last 60 days.
Groups by opening family and blunder category with rendered board diagrams.
"""
import os
import io
import json
import textwrap
from datetime import datetime, date
from collections import defaultdict

import chess
import chess.svg
import psycopg2
from svglib.svglib import svg2rlg
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image as RLImage, PageBreak, KeepTogether, HRFlowable,
)
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

USERNAME = 'negrilmannings'
DAYS = 60
MAX_PER_SECTION = 7

# Opening family groupings
OPENING_FAMILIES = {
    'Italian Game': ['Italian Game', 'Giuoco Piano', 'Two Knights'],
    "Queen's Pawn": ['Queens Pawn', 'Zukertort', 'Colle System', 'London System'],
    'Sicilian Defense': ['Sicilian'],
    'Scandinavian Defense': ['Scandinavian'],
    'Caro-Kann Defense': ['Caro Kann'],
    "King's Indian Attack": ['Kings Indian Attack'],
    'Philidor Defense': ['Philidor'],
    'Scotch Game': ['Scotch'],
    'Ruy Lopez': ['Ruy Lopez'],
    'Center Game': ['Center Game'],
    "Owen's Defense": ['Owens Defense'],
}

CATEGORY_LABELS = {
    'hanging_piece': 'Hanging Piece',
    'positional_collapse': 'Positional Collapse',
    'calculation_error': 'Calculation Error',
    'overlooked_check': 'Overlooked Check',
    'back_rank': 'Back Rank Weakness',
    'greedy_capture': 'Greedy Capture',
    'missed_tactic': 'Missed Tactic',
    'opening_principle': 'Opening Principle Violation',
    'endgame_technique': 'Endgame Technique',
    'time_pressure': 'Time Pressure',
}


def get_connection():
    return psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'),
        port=int(os.getenv('SUPABASE_PORT', 6543)),
        dbname=os.getenv('SUPABASE_DB'),
        user=os.getenv('SUPABASE_USER'),
        password=os.getenv('SUPABASE_PASSWORD'),
        sslmode='require',
    )


def classify_opening_family(opening_name):
    for family, keywords in OPENING_FAMILIES.items():
        for kw in keywords:
            if kw.lower() in opening_name.lower():
                return family
    return opening_name


import tempfile

def fen_to_drawing(fen, last_move_uci=None, size=160):
    """Render a FEN position to a reportlab Drawing via SVG."""
    board = chess.Board(fen)
    lastmove = None
    if last_move_uci and len(last_move_uci) >= 4:
        try:
            lastmove = chess.Move.from_uci(last_move_uci)
        except ValueError:
            pass

    flipped = not board.turn

    svg_data = chess.svg.board(
        board,
        lastmove=lastmove,
        size=size,
        flipped=flipped,
        coordinates=True,
        colors={
            'square light': '#f0d9b5',
            'square dark': '#b58863',
            'square light lastmove': '#cdd16a',
            'square dark lastmove': '#aaa23a',
        },
    )
    # Write SVG to temp file, convert with svglib
    with tempfile.NamedTemporaryFile(suffix='.svg', mode='w', delete=False) as f:
        f.write(svg_data)
        tmp_path = f.name

    try:
        drawing = svg2rlg(tmp_path)
        # Scale to desired size
        scale = 1.4 * inch / drawing.width if drawing.width else 1
        drawing.width = 1.4 * inch
        drawing.height = 1.4 * inch
        drawing.scale(scale, scale)
        return drawing
    finally:
        os.unlink(tmp_path)


USER_MOVE_FILTER = """
    AND (
        (LOWER(g.white_player) = '{username}' AND m.ply % 2 = 1)
        OR (LOWER(g.black_player) = '{username}' AND m.ply % 2 = 0)
    )
""".format(username=USERNAME.lower())

BASE_WHERE = f"""
    WHERE g.username = '{USERNAME}'
      AND g.played_at >= NOW() - INTERVAL '{DAYS} days'
      AND m.phase = 'middlegame'
      AND m.classification IN ('mistake', 'blunder')
      {USER_MOVE_FILTER}
"""


def fetch_all_data(conn):
    cur = conn.cursor()
    data = {}

    # Summary
    cur.execute(f"""
        SELECT m.classification, COUNT(*), AVG(ABS(m.eval_delta))::int
        FROM moves m JOIN games g ON m.game_id=g.id {BASE_WHERE}
        GROUP BY m.classification
    """)
    data['summary'] = {row[0]: {'count': row[1], 'avg_loss': row[2]} for row in cur.fetchall()}

    # Total games
    cur.execute(f"""
        SELECT COUNT(DISTINCT g.id), MIN(g.played_at)::date, MAX(g.played_at)::date
        FROM games g WHERE g.username='{USERNAME}' AND g.played_at >= NOW() - INTERVAL '{DAYS} days'
    """)
    row = cur.fetchone()
    data['total_games'] = row[0]
    data['date_range'] = (row[1], row[2])

    # Category summary
    cur.execute(f"""
        SELECT m.blunder_category, COUNT(*) as cnt, AVG(ABS(m.eval_delta))::int
        FROM moves m JOIN games g ON m.game_id=g.id {BASE_WHERE}
        AND m.blunder_category IS NOT NULL
        GROUP BY m.blunder_category ORDER BY cnt DESC
    """)
    data['categories'] = [{'category': r[0], 'count': r[1], 'avg_loss': r[2]} for r in cur.fetchall()]

    # All mistake moves with details (for grouping)
    cur.execute(f"""
        SELECT
            g.opening_name, g.eco, m.classification, m.blunder_category,
            m.move_san, m.best_move_san, m.eval_before, m.eval_after,
            m.eval_delta, m.ply, m.position_fen, m.position_fen_before,
            m.move_uci, m.piece_moved,
            m.blunder_details::text,
            m.tactical_motifs::text,
            g.played_at::date,
            CASE WHEN LOWER(g.white_player)='{USERNAME.lower()}' THEN 'white' ELSE 'black' END as user_color,
            g.result
        FROM moves m JOIN games g ON m.game_id=g.id
        {BASE_WHERE}
        ORDER BY ABS(m.eval_delta) DESC
    """)
    cols = [desc[0] for desc in cur.description]
    data['moves'] = [dict(zip(cols, row)) for row in cur.fetchall()]

    # Opening x category cross-ref
    cur.execute(f"""
        SELECT g.opening_name, m.blunder_category, COUNT(*) as cnt
        FROM moves m JOIN games g ON m.game_id=g.id
        {BASE_WHERE} AND m.blunder_category IS NOT NULL
        GROUP BY g.opening_name, m.blunder_category
        ORDER BY cnt DESC
    """)
    data['cross_ref'] = [{'opening': r[0], 'category': r[1], 'count': r[2]} for r in cur.fetchall()]

    return data


def build_pdf(data, output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        topMargin=0.6*inch,
        bottomMargin=0.6*inch,
        leftMargin=0.7*inch,
        rightMargin=0.7*inch,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    styles.add(ParagraphStyle(
        'CoverTitle', parent=styles['Title'], fontSize=28,
        spaceAfter=6, textColor=colors.HexColor('#1a1a2e'),
    ))
    styles.add(ParagraphStyle(
        'CoverSubtitle', parent=styles['Normal'], fontSize=14,
        textColor=colors.HexColor('#555555'), alignment=TA_CENTER, spaceAfter=20,
    ))
    styles.add(ParagraphStyle(
        'SectionTitle', parent=styles['Heading1'], fontSize=18,
        textColor=colors.HexColor('#1a1a2e'), spaceBefore=16, spaceAfter=10,
        borderWidth=0, borderPadding=0,
    ))
    styles.add(ParagraphStyle(
        'SubSection', parent=styles['Heading2'], fontSize=14,
        textColor=colors.HexColor('#2d3436'), spaceBefore=12, spaceAfter=6,
    ))
    styles.add(ParagraphStyle(
        'MoveDetail', parent=styles['Normal'], fontSize=9,
        textColor=colors.HexColor('#333333'), leading=12,
    ))
    styles.add(ParagraphStyle(
        'StatText', parent=styles['Normal'], fontSize=10,
        textColor=colors.HexColor('#444444'), leading=13,
    ))
    styles.add(ParagraphStyle(
        'Insight', parent=styles['Normal'], fontSize=10,
        textColor=colors.HexColor('#2d3436'), leading=13,
        leftIndent=10, borderWidth=1, borderColor=colors.HexColor('#e17055'),
        borderPadding=6, backColor=colors.HexColor('#ffeaa7'),
    ))
    styles.add(ParagraphStyle(
        'SmallGray', parent=styles['Normal'], fontSize=8,
        textColor=colors.HexColor('#888888'),
    ))

    elements = []

    # ========== COVER PAGE ==========
    elements.append(Spacer(1, 1.5*inch))
    elements.append(Paragraph("Middlegame Study Guide", styles['CoverTitle']))
    elements.append(Paragraph(
        f"Mistakes & Blunders Analysis for <b>{USERNAME}</b>",
        styles['CoverSubtitle'],
    ))

    date_from = data['date_range'][0].strftime('%b %d, %Y')
    date_to = data['date_range'][1].strftime('%b %d, %Y')
    elements.append(Paragraph(
        f"{date_from} - {date_to} | {data['total_games']} games analyzed",
        styles['CoverSubtitle'],
    ))
    elements.append(Spacer(1, 0.5*inch))

    # Summary stats
    total_mistakes = sum(v['count'] for v in data['summary'].values())
    summary_data = [
        ['', 'Count', 'Avg Eval Loss'],
        ['Mistakes', str(data['summary'].get('mistake', {}).get('count', 0)),
         f"{data['summary'].get('mistake', {}).get('avg_loss', 0)} cp"],
        ['Blunders', str(data['summary'].get('blunder', {}).get('count', 0)),
         f"{data['summary'].get('blunder', {}).get('avg_loss', 0)} cp"],
        ['Total', str(total_mistakes), ''],
    ]
    t = Table(summary_data, colWidths=[1.8*inch, 1.2*inch, 1.5*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0f0f0')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f9f9f9')]),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3*inch))

    # Top 3 focus areas
    elements.append(Paragraph("Top Focus Areas", styles['SubSection']))
    for i, cat in enumerate(data['categories'][:3]):
        label = CATEGORY_LABELS.get(cat['category'], cat['category'])
        elements.append(Paragraph(
            f"<b>{i+1}. {label}</b> - {cat['count']} occurrences, avg loss {cat['avg_loss']} cp",
            styles['StatText'],
        ))
    elements.append(PageBreak())

    # ========== SECTION 1: BY BLUNDER CATEGORY ==========
    elements.append(Paragraph("Section 1: Mistakes by Category", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a1a2e')))
    elements.append(Spacer(1, 0.15*inch))

    # Group moves by category
    moves_by_cat = defaultdict(list)
    for mv in data['moves']:
        if mv['blunder_category']:
            moves_by_cat[mv['blunder_category']].append(mv)

    for cat_info in data['categories']:
        cat = cat_info['category']
        label = CATEGORY_LABELS.get(cat, cat)
        cat_moves = moves_by_cat.get(cat, [])
        if not cat_moves:
            continue

        elements.append(Paragraph(
            f"{label} ({cat_info['count']} occurrences, avg loss {cat_info['avg_loss']} cp)",
            styles['SubSection'],
        ))

        # Category description
        cat_descriptions = {
            'hanging_piece': 'Leaving a piece undefended or moving a piece to a square where it can be captured for free.',
            'positional_collapse': 'Gradual deterioration of position through small inaccuracies that compound.',
            'calculation_error': 'Miscalculating a tactical sequence, often in complex positions with multiple captures.',
            'overlooked_check': 'Missing that the opponent can deliver check, disrupting your plans.',
            'back_rank': 'Vulnerability on the back rank allowing checkmate or significant material loss.',
            'greedy_capture': 'Capturing material that looks free but leads to a worse position or tactic.',
        }
        if cat in cat_descriptions:
            elements.append(Paragraph(cat_descriptions[cat], styles['MoveDetail']))
            elements.append(Spacer(1, 0.1*inch))

        # Top examples (capped)
        for mv in cat_moves[:MAX_PER_SECTION]:
            elements.append(_build_position_block(mv, styles))

        elements.append(Spacer(1, 0.2*inch))

    elements.append(PageBreak())

    # ========== SECTION 2: BY OPENING FAMILY ==========
    elements.append(Paragraph("Section 2: Mistakes by Opening", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a1a2e')))
    elements.append(Spacer(1, 0.15*inch))

    # Group moves by opening family
    moves_by_opening = defaultdict(list)
    for mv in data['moves']:
        family = classify_opening_family(mv['opening_name'] or 'Unknown')
        moves_by_opening[family].append(mv)

    # Sort families by count
    sorted_families = sorted(moves_by_opening.items(), key=lambda x: -len(x[1]))

    for family, fam_moves in sorted_families:
        if len(fam_moves) < 3:
            continue

        # Category breakdown for this family
        cat_counts = defaultdict(int)
        for mv in fam_moves:
            if mv['blunder_category']:
                cat_counts[mv['blunder_category']] += 1

        top_cats = sorted(cat_counts.items(), key=lambda x: -x[1])[:3]
        cat_str = ", ".join(f"{CATEGORY_LABELS.get(c, c)} ({n})" for c, n in top_cats)

        elements.append(Paragraph(
            f"{family} ({len(fam_moves)} mistakes)",
            styles['SubSection'],
        ))
        elements.append(Paragraph(f"Most common issues: {cat_str}", styles['MoveDetail']))
        elements.append(Spacer(1, 0.08*inch))

        # Show top examples for this opening family
        for mv in fam_moves[:MAX_PER_SECTION]:
            elements.append(_build_position_block(mv, styles))

        elements.append(Spacer(1, 0.2*inch))

    elements.append(PageBreak())

    # ========== SECTION 3: CROSS-REFERENCE MATRIX ==========
    elements.append(Paragraph("Section 3: Opening x Category Matrix", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a1a2e')))
    elements.append(Spacer(1, 0.15*inch))
    elements.append(Paragraph(
        "This matrix shows where your weaknesses cluster - which mistake types appear most in which openings.",
        styles['MoveDetail'],
    ))
    elements.append(Spacer(1, 0.1*inch))

    # Build cross-ref by family
    family_cat_counts = defaultdict(lambda: defaultdict(int))
    for mv in data['moves']:
        if mv['blunder_category']:
            family = classify_opening_family(mv['opening_name'] or 'Unknown')
            family_cat_counts[family][mv['blunder_category']] += 1

    # Get top families and categories
    top_families = sorted(family_cat_counts.keys(), key=lambda f: -sum(family_cat_counts[f].values()))[:8]
    all_cats = sorted(set(c for f in top_families for c in family_cat_counts[f].keys()),
                      key=lambda c: -sum(family_cat_counts[f].get(c, 0) for f in top_families))[:6]

    # Build table
    header = ['Opening'] + [CATEGORY_LABELS.get(c, c)[:12] for c in all_cats]
    matrix_data = [header]
    for family in top_families:
        row = [family[:22]]
        for cat in all_cats:
            val = family_cat_counts[family].get(cat, 0)
            row.append(str(val) if val > 0 else '-')
        matrix_data.append(row)

    col_widths = [1.6*inch] + [0.85*inch] * len(all_cats)
    t = Table(matrix_data, colWidths=col_widths)

    # Color cells by intensity
    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
    ]

    # Highlight high-count cells
    for ri, row in enumerate(matrix_data[1:], 1):
        for ci, val in enumerate(row[1:], 1):
            if val != '-':
                n = int(val)
                if n >= 10:
                    table_style.append(('BACKGROUND', (ci, ri), (ci, ri), colors.HexColor('#ff7675')))
                    table_style.append(('TEXTCOLOR', (ci, ri), (ci, ri), colors.white))
                    table_style.append(('FONTNAME', (ci, ri), (ci, ri), 'Helvetica-Bold'))
                elif n >= 5:
                    table_style.append(('BACKGROUND', (ci, ri), (ci, ri), colors.HexColor('#ffeaa7')))

    t.setStyle(TableStyle(table_style))
    elements.append(t)
    elements.append(Spacer(1, 0.3*inch))

    # ========== SECTION 4: WORST BLUNDERS ==========
    elements.append(PageBreak())
    elements.append(Paragraph("Section 4: Top 10 Costliest Blunders", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a1a2e')))
    elements.append(Spacer(1, 0.15*inch))

    blunders_only = [mv for mv in data['moves'] if mv['classification'] == 'blunder']
    for i, mv in enumerate(blunders_only[:10]):
        elements.append(Paragraph(f"#{i+1}", styles['SmallGray']))
        elements.append(_build_position_block(mv, styles, show_opening=True))

    # ========== FOOTER ==========
    elements.append(Spacer(1, 0.5*inch))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cccccc')))
    elements.append(Paragraph(
        f"Generated {datetime.now().strftime('%B %d, %Y')} | {data['total_games']} games | {total_mistakes} middlegame mistakes",
        styles['SmallGray'],
    ))

    doc.build(elements)
    print(f"PDF generated: {output_path}")


def _build_position_block(mv, styles, show_opening=False):
    """Build a position block with board diagram and move details."""
    fen = mv.get('position_fen_before') or mv.get('position_fen')
    if not fen:
        return Spacer(1, 0)

    # Board image
    try:
        board_img = fen_to_drawing(fen, mv.get('move_uci'), size=160)
    except Exception as e:
        board_img = Paragraph(f"[board error: {e}]", styles['MoveDetail'])

    # Move info
    move_num = (mv['ply'] + 1) // 2
    is_white = mv['ply'] % 2 == 1
    move_prefix = f"{move_num}." if is_white else f"{move_num}..."

    eval_before = mv['eval_before'] or 0
    eval_after = mv['eval_after'] or 0
    eval_loss = abs(mv['eval_delta'] or 0)

    lines = []
    if show_opening:
        lines.append(f"<b>Opening:</b> {mv.get('opening_name', 'Unknown')} ({mv.get('eco', '')})")

    lines.append(f"<b>Played:</b> {move_prefix} {mv['move_san']}  |  <b>Best:</b> {mv.get('best_move_san', '?')}")
    lines.append(f"<b>Eval:</b> {eval_before/100:+.1f} -> {eval_after/100:+.1f}  ({eval_loss/100:.1f} pawns lost)")

    cat = mv.get('blunder_category')
    if cat:
        lines.append(f"<b>Type:</b> {CATEGORY_LABELS.get(cat, cat)}")

    # Extract explanation from blunder_details
    details = mv.get('blunder_details')
    if details:
        if isinstance(details, str):
            try:
                details = json.loads(details)
            except (json.JSONDecodeError, TypeError):
                details = None
        if isinstance(details, dict) and details.get('explanation'):
            explanation = details['explanation'][:120]
            lines.append(f"<i>{explanation}</i>")

    played_at = mv.get('played_at')
    color = mv.get('user_color', '')
    if played_at:
        lines.append(f"<font size=7 color='#999999'>Playing {color} | {played_at}</font>")

    detail_text = "<br/>".join(lines)
    detail_para = Paragraph(detail_text, styles['MoveDetail'])

    # Layout: board on left, details on right
    t = Table(
        [[board_img, detail_para]],
        colWidths=[1.6*inch, 4.8*inch],
    )
    t.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (0, 0), 0),
        ('LEFTPADDING', (1, 0), (1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, colors.HexColor('#e0e0e0')),
    ]))
    return t


if __name__ == '__main__':
    conn = get_connection()
    data = fetch_all_data(conn)
    conn.close()

    output_path = os.path.join(os.path.dirname(__file__), '..', 'study_guide.pdf')
    build_pdf(data, output_path)
