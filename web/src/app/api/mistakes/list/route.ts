import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Get filter parameters
    const username = searchParams.get('username') || process.env.CHESS_COM_USERNAME || ''
    const classification = searchParams.get('classification') // 'mistake', 'blunder', or null for both
    const pieceMoved = searchParams.get('piece_moved') // 'P', 'N', 'B', 'R', 'Q', 'K'
    const phase = searchParams.get('phase') // 'opening', 'middlegame', 'endgame'
    const timeControl = searchParams.get('time_control') // e.g., '10+5'
    const dateFrom = searchParams.get('date_from') // YYYY-MM-DD
    const dateTo = searchParams.get('date_to') // YYYY-MM-DD
    const sortBy = searchParams.get('sortBy') || 'date' // 'date', 'eval_delta', 'phase', 'piece'
    const sortDir = (searchParams.get('sortDir') || 'desc') as 'asc' | 'desc'
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }

    // First, get all games for this user with their color info
    let gamesQuery = supabase
      .from('games')
      .select('id, white_player, black_player, username')
      .eq('username', username)

    if (dateFrom) {
      gamesQuery = gamesQuery.gte('played_at', dateFrom)
    }
    if (dateTo) {
      gamesQuery = gamesQuery.lte('played_at', dateTo + 'T23:59:59')
    }
    if (timeControl) {
      gamesQuery = gamesQuery.eq('time_control', timeControl)
    }

    const { data: games, error: gamesError } = await gamesQuery

    if (gamesError) {
      console.error('Error fetching games:', gamesError)
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 })
    }

    if (!games || games.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
        limit,
        offset
      })
    }

    // Build a map of game_id -> user's color
    const gameColorMap: Record<string, 'white' | 'black'> = {}
    for (const game of games) {
      const isWhite = game.username.toLowerCase() === game.white_player.toLowerCase()
      gameColorMap[game.id] = isWhite ? 'white' : 'black'
    }

    const gameIds = games.map(g => g.id)

    // Build query - join moves with games to get date filtering
    let query = supabase
      .from('moves')
      .select(`
        id,
        game_id,
        ply,
        move_san,
        move_uci,
        eval_before,
        eval_after,
        eval_delta,
        classification,
        piece_moved,
        phase,
        position_fen,
        move_quality,
        games!inner (
          id,
          played_at,
          white_player,
          black_player,
          opening_name,
          eco,
          time_control,
          result,
          username
        )
      `)
      .in('classification', classification
        ? [classification]
        : ['mistake', 'blunder']
      )
      .in('game_id', gameIds)

    // Apply filters
    if (pieceMoved) {
      query = query.eq('piece_moved', pieceMoved)
    }

    if (phase) {
      query = query.eq('phase', phase)
    }

    // Apply sort
    switch (sortBy) {
      case 'eval_delta':
        query = query.order('eval_delta', { ascending: sortDir === 'asc' })
        break
      case 'phase':
        query = query.order('phase', { ascending: sortDir === 'asc' })
        break
      case 'piece':
        query = query.order('piece_moved', { ascending: sortDir === 'asc' })
        break
      case 'date':
      default:
        query = query
          .order('played_at', { foreignTable: 'games', ascending: sortDir === 'asc' })
          .order('eval_delta', { ascending: true })
        break
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching mistakes:', error)
      return NextResponse.json({ error: 'Failed to fetch mistakes' }, { status: 500 })
    }

    // Filter to only include USER's moves (not opponent's moves)
    // Odd ply = White's move, Even ply = Black's move
    const userMoves = (data || []).filter(move => {
      const userColor = gameColorMap[move.game_id]
      const isWhiteMove = move.ply % 2 === 1
      return (userColor === 'white' && isWhiteMove) || (userColor === 'black' && !isWhiteMove)
    })

    // Apply pagination after filtering
    const total = userMoves.length
    const paginatedMoves = userMoves.slice(offset, offset + limit)

    return NextResponse.json({
      data: paginatedMoves,
      total,
      limit,
      offset
    })
    
  } catch (error) {
    console.error('Error in mistakes list API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

