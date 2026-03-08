import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface RecurringMistakePosition {
  position_fen: string
  occurrence_count: number
  mistake_count: number
  blunder_count: number
  inaccuracy_count: number
  good_count: number
  mistake_rate: number
  avg_eval_delta: number
  last_mistake_date: string | null
  first_seen_date: string
  last_seen_date: string
  user_color: 'white' | 'black'
  phase: 'opening' | 'middlegame' | 'endgame'
  openings: { eco: string; name: string; count: number }[]
  primary_opening: { eco: string; name: string } | null
  moves: {
    id: string
    move_san: string
    classification: string
    eval_delta: number
    game_id: string
    ply: number
    piece_moved: string
    phase: string
    best_move_san: string | null
    played_at: string
    opening_name: string
    eco: string
  }[]
  recency_score: number
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username') || process.env.CHESS_COM_USERNAME || ''
  const minOccurrences = parseInt(searchParams.get('minOccurrences') || '2')
  const limit = parseInt(searchParams.get('limit') || '50')
  const dateFilter = searchParams.get('dateFilter') || 'all' // 'all', '7days', '30days', '90days'
  const colorFilter = searchParams.get('color') || 'all' // 'all', 'white', 'black'
  const phaseFilter = searchParams.get('phase') || 'all' // 'all', 'opening', 'middlegame', 'endgame'
  const ecoFilter = searchParams.get('eco') || '' // e.g., 'C4' for Four Knights, 'D' for d4 openings

  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 })
  }

  try {
    // Get all games for this user with opening info
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, played_at, eco, opening_name, white_player, black_player, username')
      .eq('username', username)

    if (gamesError) throw gamesError
    if (!games || games.length === 0) {
      return NextResponse.json([])
    }

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

    // Define move type
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
    }

    // Fetch all moves with pagination
    let allMoves: MoveRecord[] = []
    const pageSize = 1000
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data: pageMoves, error: movesError } = await supabase
        .from('moves')
        .select('id, game_id, ply, move_san, classification, eval_delta, piece_moved, phase, position_fen, best_move_san')
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

    if (allMoves.length === 0) {
      return NextResponse.json([])
    }

    // Group moves by game for position-before calculation
    const movesByGame: Record<string, MoveRecord[]> = {}
    for (const move of allMoves) {
      if (!movesByGame[move.game_id]) {
        movesByGame[move.game_id] = []
      }
      movesByGame[move.game_id].push(move)
    }

    // Extended move with game context
    interface MoveWithContext extends MoveRecord {
      played_at: string
      opening_name: string
      eco: string
    }

    // Build position -> data mapping
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
    const positionData: Record<string, {
      moves: MoveWithContext[]
      mistake_count: number
      blunder_count: number
      inaccuracy_count: number
      good_count: number
      total_eval_delta: number
      last_mistake_date: string | null
      first_seen_date: string
      last_seen_date: string
      openings: Record<string, { eco: string; name: string; count: number }>
      user_colors: Set<string>
      phases: Set<string>
    }> = {}

    // Calculate date cutoffs
    const now = new Date()
    let dateCutoff: Date | null = null
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

    // Process each game's moves
    for (const gameId of Object.keys(movesByGame)) {
      const gameMoves = movesByGame[gameId].sort((a, b) => a.ply - b.ply)
      const game = gameInfo[gameId]
      if (!game) continue

      // Apply color filter at game level
      if (colorFilter !== 'all' && game.user_color !== colorFilter) continue

      // Apply ECO filter at game level
      if (ecoFilter && !game.eco.startsWith(ecoFilter)) continue

      for (let i = 0; i < gameMoves.length; i++) {
        const move = gameMoves[i]

        // Only include moves made by the user (not opponent's moves)
        // Odd ply = White's move, Even ply = Black's move
        const isUserMove = (game.user_color === 'white' && move.ply % 2 === 1) ||
                          (game.user_color === 'black' && move.ply % 2 === 0)
        if (!isUserMove) continue

        // Apply phase filter
        if (phaseFilter !== 'all' && move.phase !== phaseFilter) continue

        // Get position BEFORE this move
        let beforeFen: string
        if (move.ply === 1) {
          beforeFen = startingFen
        } else {
          const prevMove = gameMoves.find((m) => m.ply === move.ply - 1)
          if (!prevMove) continue
          beforeFen = prevMove.position_fen
        }

        // Normalize FEN (remove halfmove and fullmove counters)
        const fenParts = beforeFen.split(' ')
        const normalizedFen = fenParts.slice(0, 4).join(' ')

        if (!positionData[normalizedFen]) {
          positionData[normalizedFen] = {
            moves: [],
            mistake_count: 0,
            blunder_count: 0,
            inaccuracy_count: 0,
            good_count: 0,
            total_eval_delta: 0,
            last_mistake_date: null,
            first_seen_date: game.played_at,
            last_seen_date: game.played_at,
            openings: {},
            user_colors: new Set(),
            phases: new Set()
          }
        }

        const pos = positionData[normalizedFen]

        // Track opening for this position
        const openingKey = `${game.eco}|${game.opening_name}`
        if (!pos.openings[openingKey]) {
          pos.openings[openingKey] = { eco: game.eco, name: game.opening_name, count: 0 }
        }
        pos.openings[openingKey].count++

        pos.user_colors.add(game.user_color)
        pos.phases.add(move.phase)

        // Update dates
        if (game.played_at < pos.first_seen_date) pos.first_seen_date = game.played_at
        if (game.played_at > pos.last_seen_date) pos.last_seen_date = game.played_at

        // Add move with game context
        pos.moves.push({
          ...move,
          played_at: game.played_at,
          opening_name: game.opening_name,
          eco: game.eco
        })

        // Track classifications
        switch (move.classification) {
          case 'mistake':
            pos.mistake_count++
            if (!pos.last_mistake_date || game.played_at > pos.last_mistake_date) {
              pos.last_mistake_date = game.played_at
            }
            break
          case 'blunder':
            pos.blunder_count++
            if (!pos.last_mistake_date || game.played_at > pos.last_mistake_date) {
              pos.last_mistake_date = game.played_at
            }
            break
          case 'inaccuracy':
            pos.inaccuracy_count++
            break
          case 'good':
            pos.good_count++
            break
        }

        pos.total_eval_delta += move.eval_delta || 0
      }
    }

    // Convert to array and filter/sort
    const results: RecurringMistakePosition[] = Object.entries(positionData)
      .filter(([, data]) => {
        // Must have minimum occurrences
        if (data.moves.length < minOccurrences) return false

        // Must have at least one mistake or blunder
        if (data.mistake_count + data.blunder_count === 0) return false

        // Apply date filter for recency of mistakes
        if (dateCutoff && data.last_mistake_date) {
          const lastMistake = new Date(data.last_mistake_date)
          if (lastMistake < dateCutoff) return false
        }

        return true
      })
      .map(([fen, data]) => {
        const occurrence_count = data.moves.length
        const mistake_rate = ((data.mistake_count + data.blunder_count) / occurrence_count) * 100
        const avg_eval_delta = data.total_eval_delta / occurrence_count

        // Calculate recency score (higher = more recent mistakes)
        let recency_score = 0
        if (data.last_mistake_date) {
          const daysSinceLastMistake = (now.getTime() - new Date(data.last_mistake_date).getTime()) / (1000 * 60 * 60 * 24)
          recency_score = Math.max(0, 100 - daysSinceLastMistake) // 100 for today, 0 for 100+ days ago
        }

        // Get openings sorted by frequency
        const openings = Object.values(data.openings).sort((a, b) => b.count - a.count)
        const primary_opening = openings.length > 0 ? { eco: openings[0].eco, name: openings[0].name } : null

        // Determine dominant color and phase
        const user_color: 'white' | 'black' = data.user_colors.has('white') && !data.user_colors.has('black') ? 'white' :
                         data.user_colors.has('black') && !data.user_colors.has('white') ? 'black' : 'white'

        const phases = Array.from(data.phases)
        const phase = phases.length === 1 ? phases[0] as 'opening' | 'middlegame' | 'endgame' :
                     phases.includes('middlegame') ? 'middlegame' : 'opening'

        return {
          position_fen: fen,
          occurrence_count,
          mistake_count: data.mistake_count,
          blunder_count: data.blunder_count,
          inaccuracy_count: data.inaccuracy_count,
          good_count: data.good_count,
          mistake_rate: Math.round(mistake_rate * 10) / 10,
          avg_eval_delta: Math.round(avg_eval_delta),
          last_mistake_date: data.last_mistake_date,
          first_seen_date: data.first_seen_date,
          last_seen_date: data.last_seen_date,
          user_color,
          phase,
          openings,
          primary_opening,
          moves: data.moves.map(m => ({
            id: m.id,
            move_san: m.move_san,
            classification: m.classification,
            eval_delta: m.eval_delta,
            game_id: m.game_id,
            ply: m.ply,
            piece_moved: m.piece_moved,
            phase: m.phase,
            best_move_san: m.best_move_san,
            played_at: m.played_at,
            opening_name: m.opening_name,
            eco: m.eco
          })),
          recency_score
        }
      })
      // Sort by: recency_score * mistake_rate * severity_weight
      .sort((a, b) => {
        const severityA = a.blunder_count * 3 + a.mistake_count * 2 + a.inaccuracy_count
        const severityB = b.blunder_count * 3 + b.mistake_count * 2 + b.inaccuracy_count

        const scoreA = (a.recency_score + 10) * (a.mistake_rate / 100) * severityA
        const scoreB = (b.recency_score + 10) * (b.mistake_rate / 100) * severityB

        return scoreB - scoreA
      })
      .slice(0, limit)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching recurring mistakes:', error)
    return NextResponse.json({ error: 'Failed to fetch recurring mistakes' }, { status: 500 })
  }
}
