import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchInGameIdChunks, type RangeableQuery } from '@/lib/queryChunks'

interface MoveListRow {
  id: string
  game_id: string
  ply: number
  eval_delta: number | null
  classification: string
  piece_moved: string | null
  phase: string | null
  games: { played_at: string | null } | { played_at: string | null }[] | null
  [key: string]: unknown
}

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

    // Fetch matching moves in game-id batches. A single .in('game_id', gameIds)
    // with all of a user's games (600+) builds an over-length URL that fails
    // with "fetch failed"; fetchInGameIdChunks batches and paginates instead.
    const classifications = classification ? [classification] : ['mistake', 'blunder']

    let data: MoveListRow[]
    try {
      data = await fetchInGameIdChunks<MoveListRow>(gameIds, (chunk) => {
        let q = supabase
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
          .in('classification', classifications)
          .in('game_id', chunk)
        if (pieceMoved) q = q.eq('piece_moved', pieceMoved)
        if (phase) q = q.eq('phase', phase)
        return q as unknown as RangeableQuery<MoveListRow>
      })
    } catch (err) {
      console.error('Error fetching mistakes:', err)
      return NextResponse.json({ error: 'Failed to fetch mistakes' }, { status: 500 })
    }

    // Filter to only include USER's moves (not opponent's moves)
    // Odd ply = White's move, Even ply = Black's move
    const userMoves = data.filter(move => {
      const userColor = gameColorMap[move.game_id]
      const isWhiteMove = move.ply % 2 === 1
      return (userColor === 'white' && isWhiteMove) || (userColor === 'black' && !isWhiteMove)
    })

    // Sort in JS: batching means DB ordering only held within each batch.
    const dir = sortDir === 'asc' ? 1 : -1
    const playedAt = (m: MoveListRow) => {
      const g = Array.isArray(m.games) ? m.games[0] : m.games
      return g?.played_at ?? ''
    }
    userMoves.sort((a, b) => {
      switch (sortBy) {
        case 'eval_delta':
          return dir * ((a.eval_delta ?? 0) - (b.eval_delta ?? 0))
        case 'phase':
          return dir * String(a.phase ?? '').localeCompare(String(b.phase ?? ''))
        case 'piece':
          return dir * String(a.piece_moved ?? '').localeCompare(String(b.piece_moved ?? ''))
        case 'date':
        default: {
          const cmp = dir * String(playedAt(a)).localeCompare(String(playedAt(b)))
          return cmp !== 0 ? cmp : (a.eval_delta ?? 0) - (b.eval_delta ?? 0)
        }
      }
    })

    // Apply pagination after filtering + sorting
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

