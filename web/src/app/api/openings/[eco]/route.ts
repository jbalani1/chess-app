import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eco: string }> }
) {
  const { eco } = await params
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username') || process.env.CHESS_COM_USERNAME || ''
  const color = searchParams.get('color') // 'white', 'black', or null
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const classificationType = searchParams.get('classification') // 'mistake', 'blunder', 'inaccuracy', or null for all

  try {
    // Build query for games with this ECO code
    let gamesQuery = supabase
      .from('games')
      .select('*')
      .eq('username', username)
      .eq('eco', eco)
      .order('played_at', { ascending: false })

    if (color === 'white') {
      gamesQuery = gamesQuery.ilike('white_player', username)
    } else if (color === 'black') {
      gamesQuery = gamesQuery.ilike('black_player', username)
    }

    if (startDate) {
      gamesQuery = gamesQuery.gte('played_at', startDate)
    }
    if (endDate) {
      gamesQuery = gamesQuery.lte('played_at', endDate)
    }

    const { data: games, error: gamesError } = await gamesQuery

    if (gamesError) {
      throw gamesError
    }

    if (!games || games.length === 0) {
      return NextResponse.json({ games: [], mistakes: [] })
    }

    const gameIds = games.map(g => g.id)

    // Get mistakes/blunders for these games
    let movesQuery = supabase
      .from('moves')
      .select('*')
      .in('game_id', gameIds)
      .order('ply', { ascending: true })

    if (classificationType) {
      movesQuery = movesQuery.eq('classification', classificationType)
    } else {
      // Get all non-good moves by default
      movesQuery = movesQuery.in('classification', ['inaccuracy', 'mistake', 'blunder'])
    }

    const { data: moves, error: movesError } = await movesQuery

    if (movesError) {
      throw movesError
    }

    // Group moves by game for easier consumption
    const movesByGame: Record<string, typeof moves> = {}
    for (const move of moves || []) {
      if (!movesByGame[move.game_id]) {
        movesByGame[move.game_id] = []
      }
      movesByGame[move.game_id].push(move)
    }

    // Enrich games with their mistakes
    const enrichedGames = games.map(game => ({
      ...game,
      mistakes: movesByGame[game.id] || [],
      mistake_count: (movesByGame[game.id] || []).filter(m => m.classification === 'mistake').length,
      blunder_count: (movesByGame[game.id] || []).filter(m => m.classification === 'blunder').length,
      inaccuracy_count: (movesByGame[game.id] || []).filter(m => m.classification === 'inaccuracy').length,
    }))

    // Get opening name from first game
    const openingName = games[0]?.opening_name || eco

    return NextResponse.json({
      eco,
      opening_name: openingName,
      games: enrichedGames,
      total_games: games.length,
      total_mistakes: (moves || []).length,
    })
  } catch (error) {
    console.error('Error fetching opening details:', error)
    return NextResponse.json({ error: 'Failed to fetch opening details' }, { status: 500 })
  }
}
