import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { DrillPosition, JoinedGameData } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const username = process.env.CHESS_COM_USERNAME || 'negrilmannings'

    // Fetch positions from the drill_positions_due view
    // Priority: 1) Due for review (past next_review_at), 2) Never drilled (sorted by worst eval_delta)
    let query = supabaseAdmin
      .from('moves')
      .select(`
        id,
        game_id,
        position_fen,
        position_fen_before,
        best_move_san,
        best_move_uci,
        blunder_category,
        blunder_details,
        eval_delta,
        phase,
        ply,
        games!inner (
          white_player,
          black_player,
          username,
          played_at
        )
      `)
      .in('classification', ['mistake', 'blunder'])
      .not('blunder_category', 'is', null)
      .not('best_move_uci', 'is', null)
      .not('position_fen_before', 'is', null)

    if (category) {
      query = query.eq('blunder_category', category)
    }

    const { data: moves, error } = await query.order('eval_delta', { ascending: true }).limit(200)

    if (error) {
      console.error('Error fetching drill positions:', error)
      return NextResponse.json({ error: 'Failed to fetch positions' }, { status: 500 })
    }

    if (!moves || moves.length === 0) {
      return NextResponse.json([])
    }

    // Get existing drill attempts to check what's due for review
    const moveIds = moves.map(m => m.id)
    const { data: attempts } = await supabaseAdmin
      .from('drill_attempts')
      .select('move_id, next_review_at, repetition_number, is_correct, created_at')
      .eq('username', username)
      .in('move_id', moveIds)
      .order('created_at', { ascending: false })

    // Create a map of latest attempt per move
    const latestAttempts = new Map<string, {
      next_review_at: string | null
      repetition_number: number
      is_correct: boolean
    }>()

    for (const attempt of attempts || []) {
      if (!latestAttempts.has(attempt.move_id)) {
        latestAttempts.set(attempt.move_id, {
          next_review_at: attempt.next_review_at,
          repetition_number: attempt.repetition_number,
          is_correct: attempt.is_correct
        })
      }
    }

    const now = new Date()

    // Transform and filter moves
    const positions: DrillPosition[] = moves
      .filter(move => {
        const game = move.games as unknown as JoinedGameData
        const gameUsername = game.username?.toLowerCase()
        const whitePlayer = game.white_player?.toLowerCase()
        const blackPlayer = game.black_player?.toLowerCase()

        // Determine if this was the user's move
        const userIsWhite = gameUsername === whitePlayer
        const userIsBlack = gameUsername === blackPlayer
        const isWhiteMove = move.ply % 2 === 1
        const isBlackMove = move.ply % 2 === 0
        const isUserMove = (userIsWhite && isWhiteMove) || (userIsBlack && isBlackMove)

        return isUserMove
      })
      .map(move => {
        const game = move.games as unknown as JoinedGameData
        const attempt = latestAttempts.get(move.id)
        const details = typeof move.blunder_details === 'string'
          ? JSON.parse(move.blunder_details)
          : move.blunder_details || {}

        return {
          move_id: move.id,
          game_id: move.game_id,
          position_fen: move.position_fen_before || move.position_fen,
          best_move_san: move.best_move_san,
          best_move_uci: move.best_move_uci,
          blunder_category: move.blunder_category,
          blunder_explanation: details.explanation || 'No explanation available',
          eval_delta: move.eval_delta,
          phase: move.phase,
          ply: move.ply,
          white_player: game.white_player,
          black_player: game.black_player,
          username: game.username,
          played_at: game.played_at,
          next_review_at: attempt?.next_review_at || null,
          repetition_number: attempt?.repetition_number || 0,
          last_attempt_correct: attempt?.is_correct ?? null
        } as DrillPosition
      })

    // Sort: due positions first (past next_review_at), then new positions (worst eval_delta)
    positions.sort((a, b) => {
      const aDue = a.next_review_at && new Date(a.next_review_at) <= now
      const bDue = b.next_review_at && new Date(b.next_review_at) <= now
      const aNew = !a.next_review_at
      const bNew = !b.next_review_at

      // Due positions come first
      if (aDue && !bDue) return -1
      if (!aDue && bDue) return 1

      // Then new positions
      if (aNew && !bNew) return -1
      if (!aNew && bNew) return 1

      // For due positions, sort by how overdue they are
      if (aDue && bDue) {
        return new Date(a.next_review_at!).getTime() - new Date(b.next_review_at!).getTime()
      }

      // For new positions, sort by worst eval_delta (most costly mistakes first)
      return a.eval_delta - b.eval_delta
    })

    return NextResponse.json(positions.slice(0, limit))
  } catch (error) {
    console.error('Error in drill positions API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
