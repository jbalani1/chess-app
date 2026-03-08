import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { OpeningPattern, TroublePosition, MoveChoice } from '@/lib/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username') || process.env.CHESS_COM_USERNAME || ''
  const minOccurrences = parseInt(searchParams.get('minOccurrences') || '2')
  const limit = parseInt(searchParams.get('limit') || '20')
  const dateFilter = searchParams.get('dateFilter') || 'all'
  const colorFilter = searchParams.get('color') || 'all'
  const ecoFilter = searchParams.get('eco') || ''

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

    // Group moves by game
    const movesByGame: Record<string, MoveRecord[]> = {}
    for (const move of allMoves) {
      if (!movesByGame[move.game_id]) {
        movesByGame[move.game_id] = []
      }
      movesByGame[move.game_id].push(move)
    }

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

    // Extended move with game context
    interface MoveWithContext extends MoveRecord {
      played_at: string
      opening_name: string
      eco: string
      user_color: 'white' | 'black'
    }

    // Build position -> data mapping (opening-only)
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
    const positionData: Record<string, {
      moves: MoveWithContext[]
      mistake_count: number
      blunder_count: number
      inaccuracy_count: number
      good_count: number
      total_eval_delta: number
      last_mistake_date: string | null
      user_colors: Set<string>
      typical_ply: number
      openings: Record<string, { eco: string; name: string; game_ids: Set<string> }>
    }> = {}

    // Process each game's moves - only opening phase
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

        // Hard filter: opening phase only
        if (move.phase !== 'opening') continue

        // Only include moves made by the user
        const isUserMove = (game.user_color === 'white' && move.ply % 2 === 1) ||
                          (game.user_color === 'black' && move.ply % 2 === 0)
        if (!isUserMove) continue

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
            user_colors: new Set(),
            typical_ply: move.ply,
            openings: {}
          }
        }

        const pos = positionData[normalizedFen]

        // Track opening for this position
        const openingKey = `${game.eco}|${game.opening_name}`
        if (!pos.openings[openingKey]) {
          pos.openings[openingKey] = { eco: game.eco, name: game.opening_name, game_ids: new Set() }
        }
        pos.openings[openingKey].game_ids.add(gameId)

        pos.user_colors.add(game.user_color)

        // Add move with game context
        pos.moves.push({
          ...move,
          played_at: game.played_at,
          opening_name: game.opening_name,
          eco: game.eco,
          user_color: game.user_color
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

    // Now group positions by opening (eco|name|color)
    const openingGroups: Record<string, {
      eco: string
      opening_name: string
      user_color: 'white' | 'black'
      game_ids: Set<string>
      positions: { fen: string; data: typeof positionData[string] }[]
    }> = {}

    for (const [fen, data] of Object.entries(positionData)) {
      // Must have minimum occurrences
      if (data.moves.length < minOccurrences) continue
      // Must have at least one mistake or blunder
      if (data.mistake_count + data.blunder_count === 0) continue

      // Apply date filter
      if (dateCutoff && data.last_mistake_date) {
        const lastMistake = new Date(data.last_mistake_date)
        if (lastMistake < dateCutoff) continue
      }

      // Group by the primary opening for this position
      const openingEntries = Object.values(data.openings).sort((a, b) => b.game_ids.size - a.game_ids.size)
      if (openingEntries.length === 0) continue

      const primaryOpening = openingEntries[0]
      const userColor: 'white' | 'black' = data.user_colors.has('white') && !data.user_colors.has('black') ? 'white' :
                       data.user_colors.has('black') && !data.user_colors.has('white') ? 'black' : 'white'

      const groupKey = `${primaryOpening.eco}|${primaryOpening.name}|${userColor}`

      if (!openingGroups[groupKey]) {
        openingGroups[groupKey] = {
          eco: primaryOpening.eco,
          opening_name: primaryOpening.name,
          user_color: userColor,
          game_ids: new Set(),
          positions: []
        }
      }

      // Merge game IDs
      for (const opening of openingEntries) {
        for (const gid of opening.game_ids) {
          openingGroups[groupKey].game_ids.add(gid)
        }
      }

      openingGroups[groupKey].positions.push({ fen, data })
    }

    // Convert to OpeningPattern[]
    const results: OpeningPattern[] = Object.values(openingGroups).map(group => {
      const troublePositions: TroublePosition[] = group.positions.map(({ fen, data }) => {
        const occurrence_count = data.moves.length
        const mistake_rate = ((data.mistake_count + data.blunder_count) / occurrence_count) * 100

        // Calculate recency score
        let recency_score = 0
        if (data.last_mistake_date) {
          const daysSinceLastMistake = (now.getTime() - new Date(data.last_mistake_date).getTime()) / (1000 * 60 * 60 * 24)
          recency_score = Math.max(0, 100 - daysSinceLastMistake)
        }

        // Build move choices
        const moveGroups: Record<string, {
          move_san: string
          count: number
          classifications: { good: number; inaccuracy: number; mistake: number; blunder: number }
          total_eval_delta: number
          best_move_san: string | null
          game_instances: { game_id: string; move_id: string; played_at: string; eval_delta: number }[]
        }> = {}

        for (const move of data.moves) {
          if (!moveGroups[move.move_san]) {
            moveGroups[move.move_san] = {
              move_san: move.move_san,
              count: 0,
              classifications: { good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
              total_eval_delta: 0,
              best_move_san: null,
              game_instances: []
            }
          }
          const mg = moveGroups[move.move_san]
          mg.count++
          mg.classifications[move.classification as keyof typeof mg.classifications]++
          mg.total_eval_delta += move.eval_delta || 0
          if (move.best_move_san) mg.best_move_san = move.best_move_san
          mg.game_instances.push({
            game_id: move.game_id,
            move_id: move.id,
            played_at: move.played_at,
            eval_delta: move.eval_delta
          })
        }

        const your_moves: MoveChoice[] = Object.values(moveGroups).map(mg => ({
          move_san: mg.move_san,
          count: mg.count,
          classifications: mg.classifications,
          avg_eval_delta: Math.round(mg.total_eval_delta / mg.count),
          best_move_san: mg.best_move_san,
          game_instances: mg.game_instances.sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
        })).sort((a, b) => {
          // Sort by problem severity
          const aP = a.classifications.blunder * 3 + a.classifications.mistake * 2 + a.classifications.inaccuracy
          const bP = b.classifications.blunder * 3 + b.classifications.mistake * 2 + b.classifications.inaccuracy
          return bP !== aP ? bP - aP : b.count - a.count
        })

        return {
          position_fen: fen,
          move_number: Math.ceil(data.typical_ply / 2),
          typical_ply: data.typical_ply,
          occurrence_count,
          mistake_count: data.mistake_count,
          blunder_count: data.blunder_count,
          inaccuracy_count: data.inaccuracy_count,
          good_count: data.good_count,
          mistake_rate: Math.round(mistake_rate * 10) / 10,
          avg_eval_delta: Math.round(data.total_eval_delta / occurrence_count),
          last_mistake_date: data.last_mistake_date,
          recency_score,
          your_moves
        }
      }).sort((a, b) => a.move_number - b.move_number) // Sort by move number within opening

      // Calculate opening-level stats
      const totalMoves = troublePositions.reduce((sum, tp) => sum + tp.occurrence_count, 0)
      const totalMistakes = troublePositions.reduce((sum, tp) => sum + tp.mistake_count + tp.blunder_count, 0)
      const opening_mistake_rate = totalMoves > 0 ? Math.round((totalMistakes / totalMoves) * 1000) / 10 : 0
      const avg_mistake_rate = totalMoves > 0 ? totalMistakes / totalMoves : 0
      const avg_recency = troublePositions.reduce((sum, tp) => sum + tp.recency_score, 0) / (troublePositions.length || 1)

      // Trouble score formula
      const trouble_score = Math.round(
        (troublePositions.length * 2 + totalMistakes) * avg_mistake_rate * (avg_recency / 100 + 0.1) * 100
      ) / 100

      return {
        eco: group.eco,
        opening_name: group.opening_name,
        user_color: group.user_color,
        games_played: group.game_ids.size,
        opening_mistake_rate,
        trouble_score,
        trouble_positions: troublePositions
      }
    })
    .sort((a, b) => b.trouble_score - a.trouble_score)
    .slice(0, limit)

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching opening patterns:', error)
    return NextResponse.json({ error: 'Failed to fetch opening patterns' }, { status: 500 })
  }
}
