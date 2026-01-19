import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Helper to calculate date from range
function getDateFromRange(range: string): Date | null {
  const now = new Date()
  switch (range) {
    case '7d':
      return new Date(now.setDate(now.getDate() - 7))
    case '30d':
      return new Date(now.setDate(now.getDate() - 30))
    case '90d':
      return new Date(now.setDate(now.getDate() - 90))
    case '1y':
      return new Date(now.setFullYear(now.getFullYear() - 1))
    default:
      return null
  }
}

// Helper to map time control filter to actual time control patterns
function getTimeControlPattern(timeControl: string): string[] | null {
  switch (timeControl) {
    case 'bullet':
      return ['60', '60+0', '60+1', '120', '120+0', '120+1', '1+0', '1+1', '2+0', '2+1']
    case 'blitz':
      return ['180', '180+0', '180+2', '300', '300+0', '300+2', '300+3', '3+0', '3+2', '5+0', '5+3']
    case 'rapid':
      return ['600', '600+0', '600+5', '900', '900+0', '900+10', '10+0', '10+5', '15+0', '15+10']
    case 'classical':
      return ['1800', '1800+0', '1800+30', '30+0', '30+20', '45+45', '60+30', '90+30']
    default:
      return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin
    const { searchParams } = new URL(request.url)

    // Parse filter parameters
    const timeControl = searchParams.get('timeControl')
    const dateRange = searchParams.get('dateRange')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build query with filters
    let query = supabase
      .from('moves')
      .select(`
        blunder_category,
        blunder_details,
        classification,
        eval_delta,
        phase,
        piece_moved,
        ply,
        games!inner (
          username,
          white_player,
          black_player,
          time_control,
          played_at
        )
      `)
      .not('blunder_category', 'is', null)

    // Apply date filter
    if (dateRange) {
      const fromDate = getDateFromRange(dateRange)
      if (fromDate) {
        query = query.gte('games.played_at', fromDate.toISOString())
      }
    } else if (startDate) {
      query = query.gte('games.played_at', startDate)
      if (endDate) {
        query = query.lte('games.played_at', endDate)
      }
    }

    const { data: blunderCategories, error } = await query

    if (error) {
      console.error('Error fetching blunder categories:', error)
      return NextResponse.json({ error: 'Failed to fetch blunder categories' }, { status: 500 })
    }

    // Get time control patterns for filtering
    const timeControlPatterns = timeControl ? getTimeControlPattern(timeControl) : null

    // Aggregate the data - only count USER's blunders (not opponent's)
    const categoryStats: Record<string, {
      category: string
      count: number
      total_eval_loss: number
      avg_eval_loss: number
      by_phase: Record<string, number>
      by_piece: Record<string, number>
      examples: Array<{ explanation: string; eval_loss: number }>
    }> = {}

    for (const move of blunderCategories || []) {
      const category = move.blunder_category
      if (!category) continue

      // Filter: only include user's moves
      const game = move.games as any
      const username = game.username?.toLowerCase()
      const whitePlayer = game.white_player?.toLowerCase()
      const blackPlayer = game.black_player?.toLowerCase()

      // Filter by time control if specified
      if (timeControlPatterns) {
        const gameTimeControl = game.time_control || ''
        const matchesTimeControl = timeControlPatterns.some(pattern =>
          gameTimeControl.includes(pattern) || gameTimeControl.toLowerCase().includes(timeControl!)
        )
        if (!matchesTimeControl) continue
      }

      const userIsWhite = username === whitePlayer
      const userIsBlack = username === blackPlayer

      // Even ply = White's move, Odd ply = Black's move
      const isWhiteMove = move.ply % 2 === 1  // ply 1,3,5 = white's moves
      const isBlackMove = move.ply % 2 === 0  // ply 2,4,6 = black's moves

      const isUserMove = (userIsWhite && isWhiteMove) || (userIsBlack && isBlackMove)
      if (!isUserMove) continue

      if (!categoryStats[category]) {
        categoryStats[category] = {
          category,
          count: 0,
          total_eval_loss: 0,
          avg_eval_loss: 0,
          by_phase: {},
          by_piece: {},
          examples: []
        }
      }

      const stats = categoryStats[category]
      stats.count++
      const evalLoss = Math.abs(move.eval_delta || 0)
      stats.total_eval_loss += evalLoss

      // Track by phase
      const phase = move.phase || 'unknown'
      stats.by_phase[phase] = (stats.by_phase[phase] || 0) + 1

      // Track by piece
      const piece = move.piece_moved || 'unknown'
      stats.by_piece[piece] = (stats.by_piece[piece] || 0) + 1

      // Store a few examples
      if (stats.examples.length < 3 && move.blunder_details) {
        const details = typeof move.blunder_details === 'string'
          ? JSON.parse(move.blunder_details)
          : move.blunder_details
        stats.examples.push({
          explanation: details.explanation || 'No explanation available',
          eval_loss: evalLoss
        })
      }
    }

    // Calculate averages and convert to array
    const result = Object.values(categoryStats)
      .map(stats => ({
        ...stats,
        avg_eval_loss: Math.round(stats.total_eval_loss / stats.count)
      }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in blunder categories API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
