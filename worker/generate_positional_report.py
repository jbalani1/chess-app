"""
Generate a PDF report of positional errors from the last 2 months.
Shows recurring patterns grouped by category and opening, with board diagrams.
"""
import os
import io
import json
import tempfile
from datetime import datetime
from collections import defaultdict

import chess
import chess.svg
import psycopg2
from psycopg2.extras import RealDictCursor
from svglib.svglib import svg2rlg
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether,
)
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

USERNAME = 'negrilmannings'
DAYS = 60

CATEGORY_LABELS = {
    'piece_trapped': 'Piece Trapped',
    'weak_square_creation': 'Weak Square Creation',
    'king_on_open_file': 'King on Open File',
    'delayed_castling': 'Delayed Castling',
    'poisoned_pawn': 'Poisoned Pawn',
    'undeveloped_army': 'Undeveloped Army',
    'blocking_own_pieces': 'Blocking Own Pieces',
    'rook_no_open_file': 'Rook on Closed File',
    'removing_key_defender': 'Removing Key Defender',
    'pawn_shield_damage': 'Pawn Shield Damage',
    'forced_bad_recapture': 'Forced Bad Recapture',
    'structure_damage': 'Pawn Structure Damage',
    'queen_wandering': 'Queen Wandering',
    'knight_on_rim': 'Knight on the Rim',
    'passive_piece': 'Passive Piece Retreat',
    'ignoring_center': 'Ignoring the Center',
    'bad_trades': 'Bad Trades',
    'fianchetto_bishop_loss': 'Fianchetto Bishop Loss',
}

CATEGORY_DESCRIPTIONS = {
    'piece_trapped': 'Placing a piece on a square with no safe retreat, leaving it stuck and vulnerable.',
    'weak_square_creation': 'Pushing pawns that leave permanent holes in your position that opponents can exploit.',
    'king_on_open_file': 'Leaving the king on a file with no pawn cover, exposed to enemy rooks and queens.',
    'delayed_castling': 'Missing the window to castle, leaving the king stuck in the center too long.',
    'poisoned_pawn': 'Grabbing a pawn that looks free but costs tempo, position, or material.',
    'undeveloped_army': 'Moving already-developed pieces while minor pieces still sit on their starting squares.',
    'blocking_own_pieces': 'Placing a piece where it obstructs your own rook, bishop, or queen.',
    'rook_no_open_file': 'Moving a rook to a closed file when open or semi-open files are available.',
    'removing_key_defender': 'Moving a piece that was protecting something critical, leaving it hanging.',
    'pawn_shield_damage': 'Pushing pawns in front of your castled king, weakening its shelter.',
    'forced_bad_recapture': 'Creating a situation where the only recapture damages your pawn structure.',
    'structure_damage': 'Creating doubled or isolated pawns without sufficient compensation.',
    'queen_wandering': 'Moving the queen multiple times early while minor pieces remain undeveloped.',
    'knight_on_rim': 'Placing a knight on the edge of the board where it controls fewer squares.',
    'passive_piece': 'Retreating an active piece to a less useful square, losing influence.',
    'ignoring_center': 'Playing on the wing while the opponent builds an unchallenged pawn center.',
    'bad_trades': 'Trading your active, well-placed piece for your opponent\'s passive one.',
    'fianchetto_bishop_loss': 'Losing the fianchettoed bishop that guards the castled king\'s diagonal.',
}

CATEGORY_TIPS = {
    'piece_trapped': 'Before placing a piece, ask: "Can I retreat it if attacked?" Check escape squares.',
    'weak_square_creation': 'Before pushing a pawn, ask: "What squares can I no longer defend with pawns?"',
    'king_on_open_file': 'Castle early. If you can\'t, keep the center pawns closed to shield your king.',
    'delayed_castling': 'Prioritize castling by move 8-10. Don\'t get distracted by attacks before king safety.',
    'poisoned_pawn': 'If a pawn is undefended, ask "why?" before grabbing it. Free pawns are often traps.',
    'undeveloped_army': 'Develop ALL minor pieces before starting middlegame plans. Knights and bishops first.',
    'blocking_own_pieces': 'Before placing a piece, check if it blocks a rook\'s file or bishop\'s diagonal.',
    'rook_no_open_file': 'Put rooks on open or semi-open files. They\'re useless behind your own pawns.',
    'removing_key_defender': 'Before moving a piece, check what it\'s currently defending.',
    'pawn_shield_damage': 'Don\'t push pawns in front of your castled king unless there\'s a concrete reason.',
    'forced_bad_recapture': 'Consider what happens if your opponent captures — will your recapture damage your structure?',
    'structure_damage': 'Avoid creating doubled/isolated pawns unless you get concrete compensation (open file, piece activity).',
    'queen_wandering': 'Develop minor pieces first. The queen comes out after knights and bishops.',
    'knight_on_rim': '"A knight on the rim is dim." Keep knights centralized where they control more squares.',
    'passive_piece': 'If you need to retreat, find the most active retreat square, not just the safest.',
    'ignoring_center': 'Challenge the opponent\'s center pawns with your own pawns or pieces.',
    'bad_trades': 'Don\'t trade pieces just because you can. Keep your active pieces, trade off passive ones.',
    'fianchetto_bishop_loss': 'Protect your fianchetto bishop — losing it creates permanent dark/light square holes.',
}

OPENING_FAMILIES = {
    'Italian Game': ['Italian Game', 'Giuoco Piano', 'Two Knights'],
    "Queen's Pawn": ['Queens Pawn', 'Zukertort', 'Colle System', 'London System'],
    'Sicilian Defense': ['Sicilian'],
    'Scandinavian Defense': ['Scandinavian'],
    'Caro-Kann Defense': ['Caro Kann'],
    'Philidor Defense': ['Philidor'],
    'Scotch Game': ['Scotch'],
    'Ruy Lopez': ['Ruy Lopez'],
    "King's Indian Attack": ['Kings Indian Attack'],
    "Four Knights": ['Four Knights'],
    "Vienna Game": ['Vienna'],
    "Bishop's Opening": ['Bishops Opening'],
    "Queen's Gambit": ['Queens Gambit'],
    "Pirc Defense": ['Pirc'],
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
            if kw.lower() in (opening_name or '').lower():
                return family
    return opening_name or 'Unknown'


def fen_to_drawing(fen, last_move_uci=None, size=160):
    board = chess.Board(fen)
    lastmove = None
    if last_move_uci and len(last_move_uci) >= 4:
        try:
            lastmove = chess.Move.from_uci(last_move_uci)
        except ValueError:
            pass
    svg_data = chess.svg.board(
        board, lastmove=lastmove, size=size, coordinates=True,
        colors={
            'square light': '#f0d9b5', 'square dark': '#b58863',
            'square light lastmove': '#cdd16a', 'square dark lastmove': '#aaa23a',
        },
    )
    with tempfile.NamedTemporaryFile(suffix='.svg', mode='w', delete=False) as f:
        f.write(svg_data)
        tmp_path = f.name
    try:
        drawing = svg2rlg(tmp_path)
        scale = 1.4 * inch / drawing.width if drawing.width else 1
        drawing.width = 1.4 * inch
        drawing.height = 1.4 * inch
        drawing.scale(scale, scale)
        return drawing
    finally:
        os.unlink(tmp_path)


def fetch_data(conn):
    cur = conn.cursor(cursor_factory=RealDictCursor)
    data = {}

    # Category summary - last 2 months
    cur.execute("""
        SELECT pe.category, COUNT(*) as cnt, ROUND(AVG(pe.eval_loss)::numeric) as avg_loss,
               SUM(pe.eval_loss) as total_loss
        FROM positional_errors pe
        JOIN games g ON pe.game_id = g.id
        WHERE g.username = %s AND g.played_at >= NOW() - INTERVAL '2 months'
        GROUP BY pe.category
        ORDER BY cnt DESC
    """, (USERNAME,))
    data['categories'] = cur.fetchall()

    # Total games in period
    cur.execute("""
        SELECT COUNT(DISTINCT g.id), MIN(g.played_at)::date, MAX(g.played_at)::date
        FROM games g WHERE g.username = %s AND g.played_at >= NOW() - INTERVAL '2 months'
    """, (USERNAME,))
    row = cur.fetchone()
    data['total_games'] = row['count']
    data['date_from'] = row['min']
    data['date_to'] = row['max']

    # Recurring patterns (category + opening, 3+ occurrences)
    cur.execute("""
        SELECT pe.category, g.opening_name, g.eco,
               COUNT(*) as cnt, ROUND(AVG(pe.eval_loss)::numeric) as avg_loss,
               SUM(pe.eval_loss) as total_loss
        FROM positional_errors pe
        JOIN games g ON pe.game_id = g.id
        WHERE g.username = %s AND g.played_at >= NOW() - INTERVAL '2 months'
        GROUP BY pe.category, g.opening_name, g.eco
        HAVING COUNT(*) >= 3
        ORDER BY COUNT(*) DESC
    """, (USERNAME,))
    data['recurring'] = cur.fetchall()

    # Example positions for top categories (worst eval loss examples)
    cur.execute("""
        SELECT pe.category, pe.explanation, pe.eval_loss, pe.details,
               m.move_san, m.best_move_san, m.move_uci, m.ply,
               m.eval_before, m.eval_after, m.position_fen_before,
               g.opening_name, g.eco, g.played_at::date as played_at,
               g.white_player, g.black_player,
               CASE WHEN LOWER(g.white_player) = %s THEN 'white' ELSE 'black' END as user_color
        FROM positional_errors pe
        JOIN moves m ON pe.game_id = m.game_id AND pe.move_ply = m.ply
        JOIN games g ON pe.game_id = g.id
        WHERE g.username = %s AND g.played_at >= NOW() - INTERVAL '2 months'
        ORDER BY pe.eval_loss DESC
    """, (USERNAME.lower(), USERNAME))
    data['examples'] = cur.fetchall()

    cur.close()
    return data


def build_pdf(data, output_path):
    doc = SimpleDocTemplate(
        output_path, pagesize=letter,
        topMargin=0.6*inch, bottomMargin=0.6*inch,
        leftMargin=0.7*inch, rightMargin=0.7*inch,
    )
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle('CoverTitle', parent=styles['Title'], fontSize=26,
                              spaceAfter=6, textColor=colors.HexColor('#1a1a2e')))
    styles.add(ParagraphStyle('CoverSubtitle', parent=styles['Normal'], fontSize=13,
                              textColor=colors.HexColor('#555555'), alignment=TA_CENTER, spaceAfter=16))
    styles.add(ParagraphStyle('SectionTitle', parent=styles['Heading1'], fontSize=18,
                              textColor=colors.HexColor('#1a1a2e'), spaceBefore=16, spaceAfter=10))
    styles.add(ParagraphStyle('SubSection', parent=styles['Heading2'], fontSize=14,
                              textColor=colors.HexColor('#2d3436'), spaceBefore=12, spaceAfter=6))
    styles.add(ParagraphStyle('MoveDetail', parent=styles['Normal'], fontSize=9,
                              textColor=colors.HexColor('#333333'), leading=12))
    styles.add(ParagraphStyle('StatText', parent=styles['Normal'], fontSize=10,
                              textColor=colors.HexColor('#444444'), leading=13))
    styles.add(ParagraphStyle('Tip', parent=styles['Normal'], fontSize=9,
                              textColor=colors.HexColor('#2d3436'), leading=12,
                              leftIndent=10, borderWidth=1, borderColor=colors.HexColor('#00b894'),
                              borderPadding=6, backColor=colors.HexColor('#dfe6e9')))
    styles.add(ParagraphStyle('Warning', parent=styles['Normal'], fontSize=9,
                              textColor=colors.HexColor('#2d3436'), leading=12,
                              leftIndent=10, borderWidth=1, borderColor=colors.HexColor('#e17055'),
                              borderPadding=6, backColor=colors.HexColor('#ffeaa7')))
    styles.add(ParagraphStyle('SmallGray', parent=styles['Normal'], fontSize=8,
                              textColor=colors.HexColor('#888888')))

    elements = []

    # ========== COVER PAGE ==========
    elements.append(Spacer(1, 1.2*inch))
    elements.append(Paragraph("Positional Error Report", styles['CoverTitle']))
    elements.append(Paragraph(
        f"Analysis for <b>{USERNAME}</b> | Last 2 Months",
        styles['CoverSubtitle'],
    ))
    if data['date_from'] and data['date_to']:
        elements.append(Paragraph(
            f"{data['date_from'].strftime('%b %d, %Y')} - {data['date_to'].strftime('%b %d, %Y')} | "
            f"{data['total_games']} games analyzed",
            styles['CoverSubtitle'],
        ))
    elements.append(Spacer(1, 0.4*inch))

    # Summary table
    total_errors = sum(c['cnt'] for c in data['categories'])
    summary_rows = [['Category', 'Count', 'Avg Loss', 'Total Loss']]
    for cat in data['categories'][:8]:
        label = CATEGORY_LABELS.get(cat['category'], cat['category'])
        summary_rows.append([
            label, str(cat['cnt']),
            f"{cat['avg_loss']}cp", f"{cat['total_loss']}cp",
        ])
    summary_rows.append(['Total', str(total_errors), '', ''])

    t = Table(summary_rows, colWidths=[2.2*inch, 0.8*inch, 1.0*inch, 1.2*inch])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f0f0f0')),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#f9f9f9')]),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.3*inch))

    # Top 3 focus areas
    elements.append(Paragraph("Your Top 3 Focus Areas", styles['SubSection']))
    for i, cat in enumerate(data['categories'][:3]):
        label = CATEGORY_LABELS.get(cat['category'], cat['category'])
        desc = CATEGORY_DESCRIPTIONS.get(cat['category'], '')
        elements.append(Paragraph(
            f"<b>{i+1}. {label}</b> ({cat['cnt']}x, avg loss {cat['avg_loss']}cp) — {desc}",
            styles['StatText'],
        ))
        tip = CATEGORY_TIPS.get(cat['category'], '')
        if tip:
            elements.append(Paragraph(f"<b>Tip:</b> {tip}", styles['Tip']))
        elements.append(Spacer(1, 0.08*inch))

    elements.append(PageBreak())

    # ========== SECTION 1: RECURRING PATTERNS ==========
    elements.append(Paragraph("Section 1: Recurring Patterns", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a1a2e')))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph(
        "These are mistakes you keep making in the same openings. "
        "Fixing these habits will have the biggest impact on your rating.",
        styles['MoveDetail'],
    ))
    elements.append(Spacer(1, 0.15*inch))

    # Group recurring by category
    recurring_by_cat = defaultdict(list)
    for r in data['recurring']:
        recurring_by_cat[r['category']].append(r)

    # Sort categories by total occurrences
    cat_order = sorted(recurring_by_cat.keys(),
                       key=lambda c: sum(r['cnt'] for r in recurring_by_cat[c]), reverse=True)

    for cat in cat_order[:10]:
        label = CATEGORY_LABELS.get(cat, cat)
        patterns = sorted(recurring_by_cat[cat], key=lambda r: -r['cnt'])
        total_in_cat = sum(r['cnt'] for r in patterns)

        elements.append(Paragraph(
            f"{label} ({total_in_cat} occurrences across {len(patterns)} openings)",
            styles['SubSection'],
        ))

        # Table of openings where this error recurs
        rows = [['Opening', 'ECO', 'Count', 'Avg Loss']]
        for p in patterns[:8]:
            opening = classify_opening_family(p['opening_name'])[:35]
            rows.append([opening, p['eco'] or '?', str(p['cnt']), f"{p['avg_loss']}cp"])

        t = Table(rows, colWidths=[2.8*inch, 0.6*inch, 0.7*inch, 0.9*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d3436')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(t)

        # Show worst example for this category
        cat_examples = [e for e in data['examples'] if e['category'] == cat]
        if cat_examples:
            worst = cat_examples[0]  # already sorted by eval_loss desc
            elements.append(Spacer(1, 0.08*inch))
            elements.append(Paragraph("Worst example:", styles['SmallGray']))
            elements.append(_build_position_block(worst, styles))

        tip = CATEGORY_TIPS.get(cat, '')
        if tip:
            elements.append(Paragraph(f"<b>Fix:</b> {tip}", styles['Tip']))

        elements.append(Spacer(1, 0.2*inch))

    elements.append(PageBreak())

    # ========== SECTION 2: BY OPENING ==========
    elements.append(Paragraph("Section 2: Errors by Opening", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a1a2e')))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph(
        "Which openings cause you the most positional trouble?",
        styles['MoveDetail'],
    ))
    elements.append(Spacer(1, 0.15*inch))

    # Group examples by opening family
    examples_by_opening = defaultdict(list)
    for ex in data['examples']:
        family = classify_opening_family(ex['opening_name'])
        examples_by_opening[family].append(ex)

    sorted_openings = sorted(examples_by_opening.items(), key=lambda x: -len(x[1]))

    for family, fam_examples in sorted_openings[:8]:
        # Category breakdown
        cat_counts = defaultdict(int)
        total_loss = 0
        for ex in fam_examples:
            cat_counts[ex['category']] += 1
            total_loss += (ex['eval_loss'] or 0)

        top_cats = sorted(cat_counts.items(), key=lambda x: -x[1])[:4]
        cat_str = ", ".join(f"{CATEGORY_LABELS.get(c, c)} ({n})" for c, n in top_cats)

        elements.append(Paragraph(
            f"{family} ({len(fam_examples)} errors, {total_loss}cp total loss)",
            styles['SubSection'],
        ))
        elements.append(Paragraph(f"Most common: {cat_str}", styles['MoveDetail']))
        elements.append(Spacer(1, 0.08*inch))

        # Show top 3 worst examples
        for ex in fam_examples[:3]:
            elements.append(_build_position_block(ex, styles))

        elements.append(Spacer(1, 0.15*inch))

    elements.append(PageBreak())

    # ========== SECTION 3: OPENING x CATEGORY MATRIX ==========
    elements.append(Paragraph("Section 3: Opening x Error Matrix", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a1a2e')))
    elements.append(Spacer(1, 0.1*inch))
    elements.append(Paragraph(
        "Red cells show where your weaknesses cluster. Focus your study where the heat is.",
        styles['MoveDetail'],
    ))
    elements.append(Spacer(1, 0.15*inch))

    # Build matrix
    family_cat = defaultdict(lambda: defaultdict(int))
    for ex in data['examples']:
        family = classify_opening_family(ex['opening_name'])
        family_cat[family][ex['category']] += 1

    top_families = sorted(family_cat.keys(), key=lambda f: -sum(family_cat[f].values()))[:8]
    top_cats = sorted(
        set(c for f in top_families for c in family_cat[f]),
        key=lambda c: -sum(family_cat[f].get(c, 0) for f in top_families)
    )[:7]

    header = ['Opening'] + [CATEGORY_LABELS.get(c, c)[:10] for c in top_cats]
    matrix_data = [header]
    for family in top_families:
        row = [family[:20]]
        for cat in top_cats:
            val = family_cat[family].get(cat, 0)
            row.append(str(val) if val > 0 else '-')
        matrix_data.append(row)

    col_widths = [1.5*inch] + [0.75*inch] * len(top_cats)
    t = Table(matrix_data, colWidths=col_widths)

    table_style = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a2e')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cccccc')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
    ]
    for ri, row in enumerate(matrix_data[1:], 1):
        for ci, val in enumerate(row[1:], 1):
            if val != '-':
                n = int(val)
                if n >= 15:
                    table_style.append(('BACKGROUND', (ci, ri), (ci, ri), colors.HexColor('#d63031')))
                    table_style.append(('TEXTCOLOR', (ci, ri), (ci, ri), colors.white))
                    table_style.append(('FONTNAME', (ci, ri), (ci, ri), 'Helvetica-Bold'))
                elif n >= 8:
                    table_style.append(('BACKGROUND', (ci, ri), (ci, ri), colors.HexColor('#ff7675')))
                    table_style.append(('TEXTCOLOR', (ci, ri), (ci, ri), colors.white))
                elif n >= 4:
                    table_style.append(('BACKGROUND', (ci, ri), (ci, ri), colors.HexColor('#ffeaa7')))
    t.setStyle(TableStyle(table_style))
    elements.append(t)
    elements.append(Spacer(1, 0.3*inch))

    # ========== SECTION 4: TOP 15 COSTLIEST POSITIONAL ERRORS ==========
    elements.append(PageBreak())
    elements.append(Paragraph("Section 4: Your 15 Costliest Positional Errors", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a1a2e')))
    elements.append(Spacer(1, 0.1*inch))

    for i, ex in enumerate(data['examples'][:15]):
        elements.append(Paragraph(f"#{i+1}", styles['SmallGray']))
        elements.append(_build_position_block(ex, styles, show_opening=True))

    # ========== SECTION 5: ACTION PLAN ==========
    elements.append(PageBreak())
    elements.append(Paragraph("Section 5: Action Plan", styles['SectionTitle']))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#1a1a2e')))
    elements.append(Spacer(1, 0.15*inch))

    elements.append(Paragraph(
        "Based on your error patterns, here are the top things to work on:",
        styles['StatText'],
    ))
    elements.append(Spacer(1, 0.1*inch))

    for i, cat in enumerate(data['categories'][:5]):
        label = CATEGORY_LABELS.get(cat['category'], cat['category'])
        tip = CATEGORY_TIPS.get(cat['category'], '')
        desc = CATEGORY_DESCRIPTIONS.get(cat['category'], '')

        elements.append(Paragraph(
            f"<b>{i+1}. {label}</b> ({cat['cnt']} errors, avg {cat['avg_loss']}cp loss)",
            styles['StatText'],
        ))
        if desc:
            elements.append(Paragraph(f"<i>{desc}</i>", styles['MoveDetail']))

        # Find which openings this is worst in
        cat_recurring = [r for r in data['recurring'] if r['category'] == cat['category']]
        if cat_recurring:
            worst_openings = sorted(cat_recurring, key=lambda r: -r['cnt'])[:3]
            opening_str = ", ".join(
                f"{classify_opening_family(r['opening_name'])} ({r['cnt']}x)"
                for r in worst_openings
            )
            elements.append(Paragraph(f"<b>Worst in:</b> {opening_str}", styles['MoveDetail']))

        if tip:
            elements.append(Paragraph(f"<b>Fix:</b> {tip}", styles['Tip']))
        elements.append(Spacer(1, 0.15*inch))

    # Footer
    elements.append(Spacer(1, 0.5*inch))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cccccc')))
    elements.append(Paragraph(
        f"Generated {datetime.now().strftime('%B %d, %Y')} | {data['total_games']} games | "
        f"{total_errors} positional errors classified across 18 categories",
        styles['SmallGray'],
    ))

    doc.build(elements)
    print(f"PDF generated: {output_path}", flush=True)


def _build_position_block(mv, styles, show_opening=False):
    fen = mv.get('position_fen_before')
    if not fen:
        return Spacer(1, 0)

    try:
        board_img = fen_to_drawing(fen, mv.get('move_uci'), size=160)
    except Exception as e:
        board_img = Paragraph(f"[board error: {e}]", styles['MoveDetail'])

    move_num = (mv['ply'] + 1) // 2
    is_white = mv['ply'] % 2 == 1
    move_prefix = f"{move_num}." if is_white else f"{move_num}..."

    eval_before = mv.get('eval_before') or 0
    eval_after = mv.get('eval_after') or 0
    eval_loss = mv.get('eval_loss') or abs(eval_before - eval_after)

    lines = []
    if show_opening:
        lines.append(f"<b>Opening:</b> {mv.get('opening_name', 'Unknown')} ({mv.get('eco', '')})")

    cat_label = CATEGORY_LABELS.get(mv.get('category', ''), mv.get('category', ''))
    lines.append(f"<b>Error:</b> {cat_label}")
    lines.append(f"<b>Played:</b> {move_prefix} {mv['move_san']}  |  <b>Best:</b> {mv.get('best_move_san', '?')}")
    lines.append(f"<b>Eval:</b> {eval_before/100:+.1f} -> {eval_after/100:+.1f}  ({eval_loss/100:.1f} pawns lost)")

    explanation = mv.get('explanation', '')
    if explanation:
        lines.append(f"<i>{explanation[:140]}</i>")

    played_at = mv.get('played_at')
    user_color = mv.get('user_color', '')
    if played_at:
        lines.append(f"<font size=7 color='#999999'>Playing {user_color} | {played_at}</font>")

    detail_text = "<br/>".join(lines)
    detail_para = Paragraph(detail_text, styles['MoveDetail'])

    t = Table([[board_img, detail_para]], colWidths=[1.6*inch, 4.8*inch])
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
    print("Fetching data...", flush=True)
    data = fetch_data(conn)
    conn.close()

    output_path = os.path.join(os.path.dirname(__file__), '..', 'positional_errors_report.pdf')
    print("Building PDF...", flush=True)
    build_pdf(data, output_path)
