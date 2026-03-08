import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const categoryInfo: Record<string, { icon: string; label: string; recommendation: string }> = {
  hanging_piece: { icon: '👻', label: 'Hanging Piece', recommendation: 'Before each move, check: "Are all my pieces defended?"' },
  calculation_error: { icon: '🧮', label: 'Calculation Error', recommendation: 'Practice visualization - try to see 3-4 moves ahead' },
  greedy_capture: { icon: '🪤', label: 'Greedy Capture', recommendation: 'Ask yourself: "Why is this piece free?" before capturing' },
  endgame_technique: { icon: '👑', label: 'Endgame Technique', recommendation: 'Study basic endgames: King+Pawn, Rook endgames, Lucena/Philidor' },
  missed_tactic: { icon: '🎯', label: 'Missed Tactic', recommendation: 'Daily tactics training on Lichess or Chess.com' },
  opening_principle: { icon: '📖', label: 'Opening Principle', recommendation: 'Focus on development, center control, and early castling' },
  overlooked_check: { icon: '⚠️', label: 'Overlooked Check', recommendation: 'Always check for checks, captures, and threats (CCT)' },
  back_rank: { icon: '🏰', label: 'Back Rank', recommendation: 'Create "luft" (escape square) for your king early' },
  time_pressure: { icon: '⏱️', label: 'Time Pressure', recommendation: 'Practice faster time controls to improve time management' },
  positional_collapse: { icon: '📉', label: 'Positional Collapse', recommendation: 'Study strategic concepts and always have a plan' },
}

const phaseLabels: Record<string, string> = {
  opening: 'Opening',
  middlegame: 'Middlegame',
  endgame: 'Endgame',
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username') || process.env.CHESS_COM_USERNAME || ''
  const limit = parseInt(searchParams.get('limit') || '50')
  const dateFilter = searchParams.get('dateFilter') || 'all'
  const colorFilter = searchParams.get('color') || 'all'
  const phaseFilter = searchParams.get('phase') || 'all'
  const ecoFilter = searchParams.get('eco') || ''

  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 })
  }

  try {
    // Get all games for this user
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, played_at, eco, opening_name, white_player, black_player, username')
      .eq('username', username)

    if (gamesError) throw gamesError
    if (!games || games.length === 0) return NextResponse.json([])

    // Build game lookup
    const gameInfo: Record<string, {
      played_at: string
      eco: string
      opening_name: string
      user_color: 'white' | 'black'
    }> = {}

    for (const game of games) {
      const userColor = game.username.toLowerCase() === game.white_player.toLowerCase() ? 'white' : 'black'
      gameInfo[game.id] = {
        played_at: game.played_at,
        eco: game.eco || '',
        opening_name: game.opening_name || 'Unknown Opening',
        user_color: userColor
      }
    }

    const gameIds = games.map(g => g.id)

    interface MoveRecord {
      id: string
      game_id: string
      ply: number
      move_san: string
      classification: string
      eval_delta: number
      piece_moved: string
      phase: string
      position_fen: string
      best_move_san: string | null
      blunder_category: string | null
      blunder_details: { explanation?: string } | null
    }

    // Fetch all moves with pagination
    let allMoves: MoveRecord[] = []
    const pageSize = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data: pageMoves, error: movesError } = await supabase
        .from('moves')
        .select('id, game_id, ply, move_san, classification, eval_delta, piece_moved, phase, position_fen, best_move_san, blunder_category, blunder_details')
        .in('game_id', gameIds)
        .order('game_id')
        .order('ply')
        .range(offset, offset + pageSize - 1)

      if (movesError) throw movesError

      if (pageMoves && pageMoves.length > 0) {
        allMoves = allMoves.concat(pageMoves as MoveRecord[])
        offset += pageSize
        hasMore = pageMoves.length === pageSize
      } else {
        hasMore = false
      }
    }

    if (allMoves.length === 0) return NextResponse.json([])

    // Group moves by game for position-before calculation
    const movesByGame: Record<string, MoveRecord[]> = {}
    for (const move of allMoves) {
      if (!movesByGame[move.game_id]) movesByGame[move.game_id] = []
      movesByGame[move.game_id].push(move)
    }

    // Calculate date cutoffs
    const now = new Date()
    let dateCutoff: Date | null = null
    switch (dateFilter) {
      case '7days': dateCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
      case '30days': dateCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break
      case '90days': dateCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); break
    }

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    // Pattern key = blunder_category + phase
    interface PatternData {
      blunder_category: string
      phase: string
      moves: {
        id: string
        fen: string
        move_san: string
        best_move_san: string | null
        eval_delta: number
        explanation: string | null
        game_id: string
        played_at: string
        opening_name: string
        piece_moved: string
      }[]
      piece_counts: Record<string, number>
      recent_count: number // last 30 days
      older_count: number  // 30-60 days
      last_mistake_date: string | null
    }

    const patternData: Record<string, PatternData> = {}
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'

    for (const gameId of Object.keys(movesByGame)) {
      const gameMoves = movesByGame[gameId].sort((a, b) => a.ply - b.ply)
      const game = gameInfo[gameId]
      if (!game) continue

      // Apply color filter
      if (colorFilter !== 'all' && game.user_color !== colorFilter) continue
      // Apply ECO filter
      if (ecoFilter && !game.eco.startsWith(ecoFilter)) continue

      const gameDate = new Date(game.played_at)

      // Apply date filter
      if (dateCutoff && gameDate < dateCutoff) continue

      for (let i = 0; i < gameMoves.length; i++) {
        const move = gameMoves[i]

        // Only user's moves
        const isUserMove = (game.user_color === 'white' && move.ply % 2 === 1) ||
                          (game.user_color === 'black' && move.ply % 2 === 0)
        if (!isUserMove) continue

        // Only mistakes/blunders with a blunder_category
        if (!move.blunder_category) continue
        if (move.classification !== 'mistake' && move.classification !== 'blunder') continue

        // Apply phase filter
        if (phaseFilter !== 'all' && move.phase !== phaseFilter) continue

        const patternKey = `${move.blunder_category}|${move.phase}`

        // Get position FEN before this move
        let beforeFen: string
        if (move.ply === 1) {
          beforeFen = startingFen
        } else {
          const prevMove = gameMoves.find((m) => m.ply === move.ply - 1)
          if (!prevMove) continue
          beforeFen = prevMove.position_fen
        }

        if (!patternData[patternKey]) {
          patternData[patternKey] = {
            blunder_category: move.blunder_category,
            phase: move.phase,
            moves: [],
            piece_counts: {},
            recent_count: 0,
            older_count: 0,
            last_mistake_date: null,
          }
        }

        const pattern = patternData[patternKey]

        const explanation = move.blunder_details?.explanation || null

        pattern.moves.push({
          id: move.id,
          fen: beforeFen,
          move_san: move.move_san,
          best_move_san: move.best_move_san,
          eval_delta: move.eval_delta,
          explanation,
          game_id: move.game_id,
          played_at: game.played_at,
          opening_name: game.opening_name,
          piece_moved: move.piece_moved,
        })

        // Piece breakdown
        const piece = move.piece_moved || 'unknown'
        pattern.piece_counts[piece] = (pattern.piece_counts[piece] || 0) + 1

        // Recent vs older
        if (gameDate >= thirtyDaysAgo) {
          pattern.recent_count++
        } else if (gameDate >= sixtyDaysAgo) {
          pattern.older_count++
        }

        // Last mistake date
        if (!pattern.last_mistake_date || game.played_at > pattern.last_mistake_date) {
          pattern.last_mistake_date = game.played_at
        }
      }
    }

    // Convert to response format
    const results = Object.values(patternData)
      .filter(p => p.moves.length >= 2) // at least 2 occurrences
      .map(p => {
        const count = p.moves.length
        const avgEvalLoss = Math.round(
          p.moves.reduce((sum, m) => sum + Math.abs(m.eval_delta), 0) / count
        )

        // Trend: compare last-30d rate to prior-30d rate
        let trend: 'improving' | 'stable' | 'worsening' = 'stable'
        if (p.recent_count > 0 && p.older_count > 0) {
          const ratio = p.recent_count / p.older_count
          if (ratio < 0.7) trend = 'improving'
          else if (ratio > 1.3) trend = 'worsening'
        } else if (p.recent_count > 0 && p.older_count === 0) {
          trend = 'worsening'
        } else if (p.recent_count === 0 && p.older_count > 0) {
          trend = 'improving'
        }

        // Piece breakdown sorted by count
        const pieceBreakdown = Object.entries(p.piece_counts)
          .map(([piece, cnt]) => ({ piece, count: cnt }))
          .sort((a, b) => b.count - a.count)

        // Top 5 examples by worst eval_delta
        const examples = [...p.moves]
          .sort((a, b) => Math.abs(b.eval_delta) - Math.abs(a.eval_delta))
          .slice(0, 5)
          .map(m => ({
            fen: m.fen,
            move_san: m.move_san,
            best_move_san: m.best_move_san,
            eval_delta: m.eval_delta,
            explanation: m.explanation,
            game_id: m.game_id,
            move_id: m.id,
            played_at: m.played_at,
            opening_name: m.opening_name,
            piece_moved: m.piece_moved,
          }))

        // Recency score
        let recencyScore = 0
        if (p.last_mistake_date) {
          const daysSince = (now.getTime() - new Date(p.last_mistake_date).getTime()) / (1000 * 60 * 60 * 24)
          recencyScore = Math.max(0, 100 - daysSince)
        }

        const info = categoryInfo[p.blunder_category] || { icon: '❓', label: p.blunder_category, recommendation: '' }
        const phaseLabel = phaseLabels[p.phase] || p.phase

        return {
          blunder_category: p.blunder_category,
          phase: p.phase,
          count,
          avg_eval_loss: avgEvalLoss,
          recent_count: p.recent_count,
          older_count: p.older_count,
          trend,
          piece_breakdown: pieceBreakdown,
          examples,
          label: `${info.label} - ${phaseLabel}`,
          description: info.recommendation,
          icon: info.icon,
          recommendation: info.recommendation,
          recency_score: recencyScore,
        }
      })
      .sort((a, b) => (b.recency_score * b.count) - (a.recency_score * a.count))
      .slice(0, limit)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching pattern mistakes:', error)
    return NextResponse.json({ error: 'Failed to fetch pattern mistakes' }, { status: 500 })
  }
}
