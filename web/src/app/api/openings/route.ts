import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username') || 'negrilmannings'
  const color = searchParams.get('color') // 'white', 'black', or null for all

  try {
    // Get opening stats with color information
    let query = supabase
      .from('games')
      .select('id, eco, opening_name, white_player, black_player, username')
      .eq('username', username)

    if (color === 'white') {
      query = query.ilike('white_player', username)
    } else if (color === 'black') {
      query = query.ilike('black_player', username)
    }

    const { data: games, error: gamesError } = await query

    if (gamesError) {
      throw gamesError
    }

    if (!games || games.length === 0) {
      return NextResponse.json([])
    }

    // Get all game IDs
    const gameIds = games.map(g => g.id)

    // Get move statistics for these games
    const { data: moves, error: movesError } = await supabase
      .from('moves')
      .select('game_id, classification, eval_delta')
      .in('game_id', gameIds)

    if (movesError) {
      throw movesError
    }

    // Group stats by opening
    const openingStats: Record<string, {
      eco: string
      opening_name: string
      games_played: number
      total_moves: number
      good_moves: number
      inaccuracies: number
      mistakes: number
      blunders: number
      total_eval_delta: number
      game_ids: string[]
    }> = {}

    // First, group games by opening
    for (const game of games) {
      const key = `${game.eco}|${game.opening_name}`
      if (!openingStats[key]) {
        openingStats[key] = {
          eco: game.eco,
          opening_name: game.opening_name || game.eco || 'Unknown',
          games_played: 0,
          total_moves: 0,
          good_moves: 0,
          inaccuracies: 0,
          mistakes: 0,
          blunders: 0,
          total_eval_delta: 0,
          game_ids: []
        }
      }
      openingStats[key].games_played++
      openingStats[key].game_ids.push(game.id)
    }

    // Then, aggregate move statistics
    if (moves) {
      // Create a map of game_id to opening key
      const gameToOpening: Record<string, string> = {}
      for (const game of games) {
        gameToOpening[game.id] = `${game.eco}|${game.opening_name}`
      }

      for (const move of moves) {
        const key = gameToOpening[move.game_id]
        if (key && openingStats[key]) {
          openingStats[key].total_moves++
          openingStats[key].total_eval_delta += move.eval_delta || 0

          switch (move.classification) {
            case 'good':
              openingStats[key].good_moves++
              break
            case 'inaccuracy':
              openingStats[key].inaccuracies++
              break
            case 'mistake':
              openingStats[key].mistakes++
              break
            case 'blunder':
              openingStats[key].blunders++
              break
          }
        }
      }
    }

    // Convert to array and calculate rates
    const result = Object.values(openingStats)
      .map(stat => ({
        eco: stat.eco,
        opening_name: stat.opening_name,
        games_played: stat.games_played,
        total_moves: stat.total_moves,
        good_moves: stat.good_moves,
        inaccuracies: stat.inaccuracies,
        mistakes: stat.mistakes,
        blunders: stat.blunders,
        mistake_rate: stat.total_moves > 0
          ? Math.round(((stat.mistakes + stat.blunders) / stat.total_moves) * 1000) / 10
          : 0,
        avg_eval_delta: stat.total_moves > 0
          ? Math.round(stat.total_eval_delta / stat.total_moves)
          : 0
      }))
      .filter(stat => stat.games_played >= 1)
      .sort((a, b) => b.games_played - a.games_played)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching opening stats:', error)
    return NextResponse.json({ error: 'Failed to fetch opening statistics' }, { status: 500 })
  }
}
