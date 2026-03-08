import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getBaseOpeningName } from '@/lib/openings'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username') || process.env.CHESS_COM_USERNAME || ''
  const color = searchParams.get('color') // 'white', 'black', or null for all
  const view = searchParams.get('view') // 'browse' for family-grouped view

  if (view === 'browse') {
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    return handleBrowseView(username, color, dateFrom, dateTo)
  }

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

async function handleBrowseView(username: string, color: string | null, dateFrom: string | null, dateTo: string | null) {
  try {
    let query = supabase
      .from('games')
      .select('id, eco, opening_name, result, white_player, black_player, played_at')
      .eq('username', username)

    if (color === 'white') {
      query = query.ilike('white_player', username)
    } else if (color === 'black') {
      query = query.ilike('black_player', username)
    }

    if (dateFrom) {
      query = query.gte('played_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('played_at', dateTo)
    }

    const { data: games, error } = await query

    if (error) throw error
    if (!games || games.length === 0) return NextResponse.json([])

    // Group by opening family
    const families: Record<string, {
      base_name: string
      total_games: number
      wins: number
      losses: number
      draws: number
      eco_codes: Set<string>
      variations: Set<string>
      last_played: string
    }> = {}

    for (const game of games) {
      const baseName = getBaseOpeningName(game.opening_name || '')
      if (!families[baseName]) {
        families[baseName] = {
          base_name: baseName,
          total_games: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          eco_codes: new Set(),
          variations: new Set(),
          last_played: game.played_at,
        }
      }

      const fam = families[baseName]
      fam.total_games++

      if (game.eco) fam.eco_codes.add(game.eco)
      if (game.opening_name && game.opening_name !== baseName) {
        fam.variations.add(game.opening_name)
      }

      if (game.played_at > fam.last_played) {
        fam.last_played = game.played_at
      }

      // Determine win/loss/draw from PGN Result header (1-0, 0-1, 1/2-1/2)
      const isWhite = game.white_player?.toLowerCase() === username.toLowerCase()
      if (game.result === '1-0') {
        isWhite ? fam.wins++ : fam.losses++
      } else if (game.result === '0-1') {
        isWhite ? fam.losses++ : fam.wins++
      } else {
        fam.draws++
      }
    }

    const result = Object.values(families)
      .map(fam => ({
        base_name: fam.base_name,
        total_games: fam.total_games,
        wins: fam.wins,
        losses: fam.losses,
        draws: fam.draws,
        win_rate: fam.total_games > 0
          ? Math.round((fam.wins / fam.total_games) * 1000) / 10
          : 0,
        eco_codes: Array.from(fam.eco_codes).sort(),
        variations: Array.from(fam.variations).sort(),
        last_played: fam.last_played,
      }))
      .sort((a, b) => b.total_games - a.total_games)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error fetching opening browse data:', error)
    return NextResponse.json({ error: 'Failed to fetch openings' }, { status: 500 })
  }
}
