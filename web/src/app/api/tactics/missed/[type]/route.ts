import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { TacticType, MissedTactic } from '../route'

const VALID_TACTIC_TYPES = [
  'fork',
  'pin',
  'skewer',
  'discovered_attack',
  'back_rank',
  'removal_of_defender',
  'zwischenzug',
  'deflection'
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type } = await params
    const supabase = supabaseAdmin
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '50')

    // Filter parameters
    const dateFilter = searchParams.get('dateFilter') || 'all'
    const colorFilter = searchParams.get('color') || 'all'
    const phaseFilter = searchParams.get('phase') || 'all'
    const ecoFilter = searchParams.get('eco') || ''

    // Validate tactic type
    if (!VALID_TACTIC_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid tactic type. Valid types: ${VALID_TACTIC_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Calculate date cutoff
    let dateCutoff: Date | null = null
    const now = new Date()
    switch (dateFilter) {
      case '7days':
        dateCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30days':
        dateCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90days':
        dateCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
    }

    // Fetch missed tactics for this specific type
    let query = supabase
      .from('moves')
      .select(`
        id,
        game_id,
        ply,
        move_san,
        move_uci,
        best_move_san,
        best_move_uci,
        eval_before,
        eval_after,
        eval_delta,
        classification,
        piece_moved,
        phase,
        position_fen,
        position_fen_before,
        blunder_details,
        games!inner (
          id,
          white_player,
          black_player,
          result,
          opening_name,
          eco,
          time_control,
          played_at,
          username
        )
      `)
      .in('classification', ['inaccuracy', 'mistake', 'blunder'])
      .not('blunder_details->missed_tactic_type', 'is', null)
      .order('eval_delta', { ascending: true })

    // Apply phase filter
    if (phaseFilter !== 'all') {
      query = query.eq('phase', phaseFilter)
    }

    // Apply ECO filter
    if (ecoFilter) {
      if (ecoFilter.length === 1) {
        query = query.like('games.eco', `${ecoFilter}%`)
      } else {
        query = query.eq('games.eco', ecoFilter)
      }
    }

    // Apply date filter
    if (dateCutoff) {
      query = query.gte('games.played_at', dateCutoff.toISOString())
    }

    const { data: moves, error } = await query.limit(200) // Fetch more to filter

    if (error) {
      console.error('Error fetching missed tactics by type:', error)
      return NextResponse.json({ error: 'Failed to fetch missed tactics' }, { status: 500 })
    }

    // Define game type for type safety
    interface GameData {
      id: string
      white_player: string
      black_player: string
      result: string
      opening_name: string
      eco: string
      time_control: string
      played_at: string
      username: string
    }

    // Filter to the specific tactic type and user's moves only
    const filteredMoves = (moves || []).filter(move => {
      const details = typeof move.blunder_details === 'string'
        ? JSON.parse(move.blunder_details)
        : move.blunder_details

      if (details?.missed_tactic_type !== type) {
        return false
      }

      const game = move.games as unknown as GameData
      const username = game.username?.toLowerCase()
      const whitePlayer = game.white_player?.toLowerCase()
      const blackPlayer = game.black_player?.toLowerCase()

      const userIsWhite = username === whitePlayer
      const userIsBlack = username === blackPlayer

      const isWhiteMove = move.ply % 2 === 1
      const isBlackMove = move.ply % 2 === 0

      const isUserMove = (userIsWhite && isWhiteMove) || (userIsBlack && isBlackMove)
      if (!isUserMove) return false

      // Apply color filter
      if (colorFilter !== 'all') {
        const userColor = userIsWhite ? 'white' : 'black'
        if (userColor !== colorFilter) return false
      }

      return true
    }).slice(0, limit)

    const tactics: MissedTactic[] = filteredMoves.map(move => {
      const game = move.games as unknown as GameData
      const details = typeof move.blunder_details === 'string'
        ? JSON.parse(move.blunder_details)
        : move.blunder_details

      // Determine user's color
      const username = game.username?.toLowerCase()
      const whitePlayer = game.white_player?.toLowerCase()
      const userColor = username === whitePlayer ? 'white' : 'black'

      return {
        move_id: move.id,
        game_id: move.game_id,
        ply: move.ply,
        move_san: move.move_san,
        best_move_san: move.best_move_san,
        best_move_uci: move.best_move_uci,
        eval_delta: move.eval_delta,
        classification: move.classification,
        position_fen_before: move.position_fen_before,
        tactic_type: type as TacticType,
        tactic_description: details?.missed_tactic_description || '',
        tactic_squares: details?.missed_tactic_squares || [],
        phase: move.phase,
        user_color: userColor as 'white' | 'black',
        game: {
          id: game.id,
          white_player: game.white_player,
          black_player: game.black_player,
          result: game.result,
          opening_name: game.opening_name,
          eco: game.eco,
          time_control: game.time_control,
          played_at: game.played_at,
          username: game.username
        }
      }
    })

    return NextResponse.json({
      tactic_type: type,
      count: tactics.length,
      tactics
    })
  } catch (error) {
    console.error('Error in missed tactics by type API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
