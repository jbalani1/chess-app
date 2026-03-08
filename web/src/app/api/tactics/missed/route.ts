import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// List of tactic types we detect
const TACTIC_TYPES = [
  'fork',
  'pin',
  'skewer',
  'discovered_attack',
  'back_rank',
  'removal_of_defender',
  'zwischenzug',
  'deflection'
] as const

export type TacticType = typeof TACTIC_TYPES[number]

export interface MissedTactic {
  move_id: string
  game_id: string
  ply: number
  move_san: string
  best_move_san: string | null
  best_move_uci: string | null
  eval_delta: number
  classification: string
  position_fen_before: string
  tactic_type: TacticType
  tactic_description: string
  tactic_squares: string[]
  phase: string
  user_color: 'white' | 'black'
  game: {
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
}

export interface MissedTacticsResponse {
  summary: {
    total: number
    by_type: Record<TacticType, number>
  }
  tactics: MissedTactic[]
}

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '100')

    // Filter parameters
    const dateFilter = searchParams.get('dateFilter') || 'all'
    const colorFilter = searchParams.get('color') || 'all'
    const phaseFilter = searchParams.get('phase') || 'all'
    const ecoFilter = searchParams.get('eco') || ''
    const tacticType = searchParams.get('tacticType') || 'all'

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

    // Build query
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
        // Filter by ECO category (A, B, C, D, E)
        query = query.like('games.eco', `${ecoFilter}%`)
      } else {
        // Filter by specific ECO code
        query = query.eq('games.eco', ecoFilter)
      }
    }

    // Apply date filter
    if (dateCutoff) {
      query = query.gte('games.played_at', dateCutoff.toISOString())
    }

    // Apply tactic type filter at query level if possible
    if (tacticType !== 'all') {
      query = query.eq('blunder_details->missed_tactic_type', tacticType)
    }

    const { data: moves, error } = await query.limit(limit * 2) // Fetch more to account for filtering

    if (error) {
      console.error('Error fetching missed tactics:', error)
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

    // Filter to only include user's moves (not opponent's) and apply color filter
    const userMoves = (moves || []).filter(move => {
      const game = move.games as unknown as GameData
      const username = game.username?.toLowerCase()
      const whitePlayer = game.white_player?.toLowerCase()
      const blackPlayer = game.black_player?.toLowerCase()

      const userIsWhite = username === whitePlayer
      const userIsBlack = username === blackPlayer

      // Ply 1,3,5... = White's moves, Ply 2,4,6... = Black's moves
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
    })

    // Calculate summary counts by type
    const byType: Record<string, number> = {}
    for (const type of TACTIC_TYPES) {
      byType[type] = 0
    }

    const tactics: MissedTactic[] = userMoves.slice(0, limit).map(move => {
      const game = move.games as unknown as GameData
      const details = typeof move.blunder_details === 'string'
        ? JSON.parse(move.blunder_details)
        : move.blunder_details

      const tacticTypeValue = details?.missed_tactic_type as TacticType
      if (tacticTypeValue && byType[tacticTypeValue] !== undefined) {
        byType[tacticTypeValue]++
      }

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
        tactic_type: tacticTypeValue,
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

    const response: MissedTacticsResponse = {
      summary: {
        total: tactics.length,
        by_type: byType as Record<TacticType, number>
      },
      tactics
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in missed tactics API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
