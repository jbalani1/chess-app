import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface PositionMove {
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username') || process.env.CHESS_COM_USERNAME || ''
  const minOccurrences = parseInt(searchParams.get('minOccurrences') || '2')
  const limit = parseInt(searchParams.get('limit') || '50')
  const phaseFilter = searchParams.get('phase') || 'all'

  if (!username) {
    return NextResponse.json({ error: 'Username required' }, { status: 400 })
  }

  try {
    // Use a more efficient SQL approach:
    // For each move, get the position BEFORE it (which is the position_fen of the previous move)
    // For ply=1, the before position is the starting position

    // First, get common positions with their stats using SQL
    const { data: positionStats, error: statsError } = await supabase.rpc('get_common_positions', {
      p_username: username,
      p_min_occurrences: minOccurrences,
      p_limit: limit
    })

    // If the RPC doesn't exist, fall back to a direct query approach
    if (statsError) {
      console.log('RPC not available, using fallback query')

      // Get all games for this user with played_at
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('id, played_at')
        .eq('username', username)

      if (gamesError) throw gamesError
      if (!games || games.length === 0) {
        return NextResponse.json([])
      }

      const gameIds = games.map(g => g.id)
      const gamePlayedAt: Record<string, string> = {}
      for (const game of games) {
        gamePlayedAt[game.id] = game.played_at
      }

      // Get all moves - need to paginate since Supabase limits to 1000 rows
      let allMoves: PositionMove[] = []
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
          allMoves = allMoves.concat(pageMoves)
          offset += pageSize
          hasMore = pageMoves.length === pageSize
        } else {
          hasMore = false
        }
      }

      if (allMoves.length === 0) {
        return NextResponse.json([])
      }

      console.log(`Fetched ${allMoves.length} total moves`)

      // Build position -> moves mapping
      const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
      const positionMoves: Record<string, {
        moves: typeof allMoves,
        mistake_count: number,
        blunder_count: number,
        inaccuracy_count: number,
        good_count: number
      }> = {}

      // Group moves by game
      const movesByGame: Record<string, typeof allMoves> = {}
      for (const move of allMoves) {
        if (!movesByGame[move.game_id]) {
          movesByGame[move.game_id] = []
        }
        movesByGame[move.game_id].push(move)
      }

      // Process each game
      for (const gameId of Object.keys(movesByGame)) {
        const gameMoves = movesByGame[gameId].sort((a, b) => a.ply - b.ply)

        for (let i = 0; i < gameMoves.length; i++) {
          const move = gameMoves[i]

          // Apply phase filter
          if (phaseFilter !== 'all' && move.phase !== phaseFilter) continue

          // Get position BEFORE this move
          let beforeFen: string
          if (move.ply === 1) {
            beforeFen = startingFen
          } else {
            // Find previous move in this game
            const prevMove = gameMoves.find(m => m.ply === move.ply - 1)
            if (!prevMove) continue
            beforeFen = prevMove.position_fen
          }

          // Normalize FEN (remove halfmove and fullmove counters)
          const fenParts = beforeFen.split(' ')
          const normalizedFen = fenParts.slice(0, 4).join(' ')

          if (!positionMoves[normalizedFen]) {
            positionMoves[normalizedFen] = {
              moves: [],
              mistake_count: 0,
              blunder_count: 0,
              inaccuracy_count: 0,
              good_count: 0
            }
          }

          positionMoves[normalizedFen].moves.push(move)

          switch (move.classification) {
            case 'mistake':
              positionMoves[normalizedFen].mistake_count++
              break
            case 'blunder':
              positionMoves[normalizedFen].blunder_count++
              break
            case 'inaccuracy':
              positionMoves[normalizedFen].inaccuracy_count++
              break
            case 'good':
              positionMoves[normalizedFen].good_count++
              break
          }
        }
      }

      // Convert to array and filter
      const result = Object.entries(positionMoves)
        .filter(([, data]) => data.moves.length >= minOccurrences)
        .map(([fen, data]) => ({
          position_fen: fen,
          occurrence_count: data.moves.length,
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
            played_at: gamePlayedAt[m.game_id],
          })),
          mistake_count: data.mistake_count,
          blunder_count: data.blunder_count,
          inaccuracy_count: data.inaccuracy_count,
          good_count: data.good_count,
        }))
        .sort((a, b) => {
          // Sort by problems first, then by occurrence
          const aProblems = a.mistake_count + a.blunder_count * 2 + a.inaccuracy_count * 0.5
          const bProblems = b.mistake_count + b.blunder_count * 2 + b.inaccuracy_count * 0.5
          if (bProblems !== aProblems) return bProblems - aProblems
          return b.occurrence_count - a.occurrence_count
        })
        .slice(0, limit)

      return NextResponse.json(result)
    }

    return NextResponse.json(positionStats || [])
  } catch (error) {
    console.error('Error fetching common positions:', error)
    return NextResponse.json({ error: 'Failed to fetch common positions' }, { status: 500 })
  }
}
