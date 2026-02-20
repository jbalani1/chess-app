import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const TRAINING_RECOMMENDATIONS: Record<string, { recommendation: string; resource_link: string | null }> = {
  hanging_piece: {
    recommendation: "Practice 'Checks, Captures, Threats' before every move",
    resource_link: 'https://lichess.org/practice/checkmates/piece-checkmates',
  },
  missed_tactic: {
    recommendation: 'Daily tactics puzzles on Chess.com or Lichess',
    resource_link: 'https://lichess.org/training',
  },
  overlooked_check: {
    recommendation: 'Practice checkmate patterns and king safety awareness',
    resource_link: 'https://lichess.org/practice/checkmates',
  },
  greedy_capture: {
    recommendation: 'Ask "Why is this free?" before capturing material',
    resource_link: null,
  },
  back_rank: {
    recommendation: 'Create "luft" (escape square) for your king early',
    resource_link: 'https://lichess.org/practice/checkmates/back-rank-mate',
  },
  opening_principle: {
    recommendation: 'Focus on development, center control, and early castling',
    resource_link: null,
  },
  endgame_technique: {
    recommendation: 'Study basic endgames: King+Pawn, Rook endgames, Lucena/Philidor',
    resource_link: 'https://lichess.org/practice/basic-endgames',
  },
  time_pressure: {
    recommendation: 'Practice faster time controls to improve time management',
    resource_link: null,
  },
  positional_collapse: {
    recommendation: 'Study strategic planning and prophylaxis concepts',
    resource_link: null,
  },
  calculation_error: {
    recommendation: 'Practice calculation: visualize 3-4 moves ahead consistently',
    resource_link: null,
  },
}

const PIECE_NAMES: Record<string, string> = {
  P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get('username') || process.env.CHESS_USERNAME

    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('blunder_patterns')
      .select('*')
      .eq('username', username)
      .order('occurrence_count', { ascending: false })

    if (error) {
      console.error('Error fetching recurring patterns:', error)
      return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ patterns: [], focus_areas: [] })
    }

    // Enrich with training recommendations and priority scores
    const patterns = data.map(row => {
      const training = TRAINING_RECOMMENDATIONS[row.category] || {
        recommendation: 'Review these positions carefully',
        resource_link: null,
      }
      const priorityScore = Math.round(
        (row.occurrence_count * Number(row.avg_eval_loss)) / 100
      )

      return {
        id: row.id,
        category: row.category,
        phase: row.phase,
        piece_involved: row.piece_involved,
        piece_name: PIECE_NAMES[row.piece_involved] || row.piece_involved,
        occurrence_count: row.occurrence_count,
        total_eval_loss: row.total_eval_loss,
        avg_eval_loss: Math.round(Number(row.avg_eval_loss)),
        example_game_ids: row.example_game_ids || [],
        example_fens: row.example_fens || [],
        first_seen: row.first_seen,
        last_seen: row.last_seen,
        priority_score: priorityScore,
        training_recommendation: training.recommendation,
        resource_link: training.resource_link,
      }
    }).sort((a, b) => b.priority_score - a.priority_score)

    // Compute top focus areas: aggregate by category across phases/pieces
    const categoryAgg: Record<string, { category: string; total_count: number; total_loss: number; phases: Set<string>; pieces: Set<string> }> = {}
    for (const p of patterns) {
      if (!categoryAgg[p.category]) {
        categoryAgg[p.category] = { category: p.category, total_count: 0, total_loss: 0, phases: new Set(), pieces: new Set() }
      }
      const agg = categoryAgg[p.category]
      agg.total_count += p.occurrence_count
      agg.total_loss += p.total_eval_loss
      agg.phases.add(p.phase)
      agg.pieces.add(p.piece_involved)
    }

    const focusAreas = Object.values(categoryAgg)
      .map(agg => ({
        category: agg.category,
        total_count: agg.total_count,
        avg_eval_loss: Math.round(agg.total_loss / agg.total_count),
        priority_score: Math.round((agg.total_count * agg.total_loss / agg.total_count) / 100),
        phases: Array.from(agg.phases),
        pieces: Array.from(agg.pieces),
        training: TRAINING_RECOMMENDATIONS[agg.category] || { recommendation: 'Review these positions', resource_link: null },
      }))
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, 3)

    return NextResponse.json({ patterns, focus_areas: focusAreas })
  } catch (error) {
    console.error('Error in recurring patterns API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
