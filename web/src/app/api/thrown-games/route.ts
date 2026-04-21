import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// --- Type definitions ---

interface ThrownGame {
  game_id: string
  white_player: string
  black_player: string
  user_color: 'white' | 'black'
  result: string
  opening_name: string
  eco: string
  time_control: string
  played_at: string
  peak_eval: number
  peak_eval_ply: number
  turning_point_ply: number
  turning_point_move_san: string
  turning_point_eval_delta: number
  turning_point_best_move: string | null
  turning_point_fen: string
  turning_point_classification: string
  turning_point_tactic: string | null
  turning_point_tactic_description: string | null
  total_eval_swing: number
  moves_after_peak: number
}

interface ThrownGamesResponse {
  summary: {
    total_thrown: number
    total_losses: number
    throw_rate: number
    avg_peak_eval: number
    avg_eval_swing: number
    common_turning_motifs: { tactic_type: string; count: number }[]
    common_turning_phases: { phase: string; count: number }[]
  }
  games: ThrownGame[]
}

// --- Helpers ---

interface GameRow {
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

interface MoveRow {
  id: string
  game_id: string
  ply: number
  move_san: string
  best_move_san: string | null
  eval_after: number | null
  eval_delta: number | null
  classification: string | null
  phase: string | null
  position_fen: string | null
  blunder_details: unknown
}

interface BlunderDetails {
  missed_tactic_type?: string
  missed_tactic_description?: string
  missed_tactic_squares?: string[]
}

function parseBlunderDetails(raw: unknown): BlunderDetails {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return (raw as BlunderDetails) || {}
}

function computeDateCutoff(dateFilter: string): Date | null {
  const now = new Date()
  switch (dateFilter) {
    case '7days':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30days':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90days':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    default:
      return null
  }
}

/**
 * Determine the game outcome from the user's perspective.
 * Returns 'win', 'loss', or 'draw'.
 */
function userOutcome(result: string, userColor: 'white' | 'black'): 'win' | 'loss' | 'draw' {
  const normalized = result?.toLowerCase().trim() ?? ''

  if (normalized === '1/2-1/2' || normalized === 'draw' || normalized === '0.5-0.5') {
    return 'draw'
  }

  const whiteWins = normalized === '1-0' || normalized === 'white'
  const blackWins = normalized === '0-1' || normalized === 'black'

  if (userColor === 'white') {
    if (whiteWins) return 'win'
    if (blackWins) return 'loss'
  } else {
    if (blackWins) return 'win'
    if (whiteWins) return 'loss'
  }

  return 'draw'
}

/**
 * Convert an engine eval to be from the user's perspective.
 * Engine evals are typically from white's perspective, so flip for black.
 */
function evalFromUserPerspective(evalAfter: number, userColor: 'white' | 'black'): number {
  return userColor === 'white' ? evalAfter : -evalAfter
}

/**
 * Fetch moves for a set of game IDs in batches.
 * Supabase has row limits, so we paginate through results.
 */
async function fetchMovesForGames(gameIds: string[]): Promise<MoveRow[]> {
  const BATCH_SIZE = 1000
  const allMoves: MoveRow[] = []

  // Process game IDs in chunks to avoid overly large IN clauses
  const GAME_CHUNK_SIZE = 100
  for (let gc = 0; gc < gameIds.length; gc += GAME_CHUNK_SIZE) {
    const gameChunk = gameIds.slice(gc, gc + GAME_CHUNK_SIZE)

    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('moves')
        .select('id, game_id, ply, move_san, best_move_san, eval_after, eval_delta, classification, phase, position_fen, blunder_details')
        .in('game_id', gameChunk)
        .order('ply', { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1)

      if (error) {
        console.error('Error fetching moves batch:', error)
        break
      }

      if (!data || data.length === 0) {
        hasMore = false
        break
      }

      allMoves.push(...(data as MoveRow[]))

      if (data.length < BATCH_SIZE) {
        hasMore = false
      } else {
        offset += BATCH_SIZE
      }
    }
  }

  return allMoves
}

// --- Main handler ---

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin
    const searchParams = request.nextUrl.searchParams

    const dateFilter = searchParams.get('dateFilter') || 'all'
    const colorFilter = searchParams.get('color') || 'all'
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200)

    const dateCutoff = computeDateCutoff(dateFilter)

    // Step 1: Fetch games ordered by played_at desc
    let gamesQuery = supabase
      .from('games')
      .select('id, white_player, black_player, result, opening_name, eco, time_control, played_at, username')
      .order('played_at', { ascending: false })

    if (dateCutoff) {
      gamesQuery = gamesQuery.gte('played_at', dateCutoff.toISOString())
    }

    const { data: gamesData, error: gamesError } = await gamesQuery.limit(2000)

    if (gamesError) {
      console.error('Error fetching games:', gamesError)
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 })
    }

    if (!gamesData || gamesData.length === 0) {
      return NextResponse.json(emptyResponse())
    }

    const games = gamesData as GameRow[]

    // Step 2: Determine user color and filter to losses/draws
    interface CandidateGame {
      game: GameRow
      userColor: 'white' | 'black'
      outcome: 'loss' | 'draw'
    }

    const candidateGames: CandidateGame[] = []
    let totalLosses = 0

    for (const game of games) {
      const username = game.username?.toLowerCase()
      const whitePlayer = game.white_player?.toLowerCase()
      const blackPlayer = game.black_player?.toLowerCase()

      let userColor: 'white' | 'black'
      if (username === whitePlayer) {
        userColor = 'white'
      } else if (username === blackPlayer) {
        userColor = 'black'
      } else {
        // Cannot determine user color, skip
        continue
      }

      if (colorFilter !== 'all' && userColor !== colorFilter) continue

      const outcome = userOutcome(game.result, userColor)

      if (outcome === 'loss') totalLosses++

      // Only consider losses and draws as potential thrown games
      if (outcome === 'loss' || outcome === 'draw') {
        candidateGames.push({ game, userColor, outcome })
      }
    }

    if (candidateGames.length === 0) {
      return NextResponse.json(emptyResponse())
    }

    // Step 3: Fetch all moves for candidate games
    const candidateGameIds = candidateGames.map((c) => c.game.id)
    const allMoves = await fetchMovesForGames(candidateGameIds)

    // Group moves by game_id
    const movesByGame = new Map<string, MoveRow[]>()
    for (const move of allMoves) {
      let gameMoves = movesByGame.get(move.game_id)
      if (!gameMoves) {
        gameMoves = []
        movesByGame.set(move.game_id, gameMoves)
      }
      gameMoves.push(move)
    }

    // Step 4: Analyze each candidate game for "thrown" pattern
    const thrownGames: ThrownGame[] = []

    for (const { game, userColor } of candidateGames) {
      const gameMoves = movesByGame.get(game.id)
      if (!gameMoves || gameMoves.length === 0) continue

      // Sort moves by ply to ensure correct order
      gameMoves.sort((a, b) => a.ply - b.ply)

      // Build eval curve from user's perspective using eval_after
      // Filter to user's own moves via ply parity (odd ply = white, even = black)
      const isUserPly = (ply: number): boolean => {
        if (userColor === 'white') return ply % 2 === 1
        return ply % 2 === 0
      }

      // Build full eval timeline (all moves, not just user's) for accurate eval tracking
      let peakEval = -Infinity
      let peakEvalPly = 0
      let lastEval = 0
      let hasAnyEval = false

      // First pass: find peak eval from user's perspective across ALL moves
      // We look at eval_after for every move to track the position evaluation
      for (const move of gameMoves) {
        if (move.eval_after === null || move.eval_after === undefined) continue
        hasAnyEval = true

        const userEval = evalFromUserPerspective(move.eval_after, userColor)
        lastEval = userEval

        if (userEval > peakEval) {
          peakEval = userEval
          peakEvalPly = move.ply
        }
      }

      if (!hasAnyEval) continue

      // A game is "thrown" if the user's best eval was >= +200cp and they lost or drew
      const WINNING_THRESHOLD = 200
      if (peakEval < WINNING_THRESHOLD) continue

      // Find the turning point: the first USER move after peak where eval drops below 0
      let turningPointMove: MoveRow | null = null

      for (const move of gameMoves) {
        // Only consider user's own moves as turning points
        if (!isUserPly(move.ply)) continue
        // Only look at moves after the peak
        if (move.ply <= peakEvalPly) continue
        if (move.eval_after === null || move.eval_after === undefined) continue

        const userEval = evalFromUserPerspective(move.eval_after, userColor)

        if (userEval < 0) {
          turningPointMove = move
          break
        }
      }

      // If no clear turning point below 0, find the user move with the biggest single eval drop after peak
      if (!turningPointMove) {
        let biggestDrop = 0

        for (const move of gameMoves) {
          if (!isUserPly(move.ply)) continue
          if (move.ply <= peakEvalPly) continue
          if (move.eval_delta === null || move.eval_delta === undefined) continue

          // eval_delta is typically negative for bad moves
          const drop = Math.abs(move.eval_delta)
          if (drop > biggestDrop) {
            biggestDrop = drop
            turningPointMove = move
          }
        }
      }

      // If still no turning point found, skip this game
      if (!turningPointMove) continue

      // Extract tactic info from blunder_details at the turning point
      const details = parseBlunderDetails(turningPointMove.blunder_details)

      // Calculate moves after peak (in user's half-moves)
      const userMovesAfterPeak = gameMoves.filter(
        (m) => isUserPly(m.ply) && m.ply > peakEvalPly
      ).length

      const totalEvalSwing = peakEval - lastEval

      thrownGames.push({
        game_id: game.id,
        white_player: game.white_player,
        black_player: game.black_player,
        user_color: userColor,
        result: game.result,
        opening_name: game.opening_name || 'Unknown Opening',
        eco: game.eco || '',
        time_control: game.time_control || '',
        played_at: game.played_at,
        peak_eval: Math.round(peakEval),
        peak_eval_ply: peakEvalPly,
        turning_point_ply: turningPointMove.ply,
        turning_point_move_san: turningPointMove.move_san || '',
        turning_point_eval_delta: Math.round(turningPointMove.eval_delta ?? 0),
        turning_point_best_move: turningPointMove.best_move_san || null,
        turning_point_fen: turningPointMove.position_fen || '',
        turning_point_classification: turningPointMove.classification || 'unknown',
        turning_point_tactic: details.missed_tactic_type || null,
        turning_point_tactic_description: details.missed_tactic_description || null,
        total_eval_swing: Math.round(totalEvalSwing),
        moves_after_peak: userMovesAfterPeak,
      })
    }

    // Sort by total eval swing descending (biggest throws first)
    thrownGames.sort((a, b) => b.total_eval_swing - a.total_eval_swing)

    // Apply limit
    const limitedGames = thrownGames.slice(0, limit)

    // Step 5: Build summary
    const totalThrown = thrownGames.length

    const avgPeakEval = totalThrown > 0
      ? Math.round(thrownGames.reduce((sum, g) => sum + g.peak_eval, 0) / totalThrown)
      : 0

    const avgEvalSwing = totalThrown > 0
      ? Math.round(thrownGames.reduce((sum, g) => sum + g.total_eval_swing, 0) / totalThrown)
      : 0

    const throwRate = totalLosses > 0
      ? Math.round((totalThrown / totalLosses) * 1000) / 10
      : 0

    // Common turning point motifs (tactics missed at the turning point)
    const motifCounts = new Map<string, number>()
    for (const g of thrownGames) {
      if (g.turning_point_tactic) {
        motifCounts.set(g.turning_point_tactic, (motifCounts.get(g.turning_point_tactic) || 0) + 1)
      }
    }
    const commonTurningMotifs = Array.from(motifCounts.entries())
      .map(([tactic_type, count]) => ({ tactic_type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Common turning point phases
    const phaseCounts = new Map<string, number>()
    for (const g of thrownGames) {
      // Derive phase from turning point ply if not directly available
      // Use a heuristic: ply 1-20 = opening, 21-60 = middlegame, 61+ = endgame
      const ply = g.turning_point_ply
      let phase: string
      if (ply <= 20) phase = 'opening'
      else if (ply <= 60) phase = 'middlegame'
      else phase = 'endgame'

      phaseCounts.set(phase, (phaseCounts.get(phase) || 0) + 1)
    }
    const commonTurningPhases = Array.from(phaseCounts.entries())
      .map(([phase, count]) => ({ phase, count }))
      .sort((a, b) => b.count - a.count)

    const response: ThrownGamesResponse = {
      summary: {
        total_thrown: totalThrown,
        total_losses: totalLosses,
        throw_rate: throwRate,
        avg_peak_eval: avgPeakEval,
        avg_eval_swing: avgEvalSwing,
        common_turning_motifs: commonTurningMotifs,
        common_turning_phases: commonTurningPhases,
      },
      games: limitedGames,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in thrown-games API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function emptyResponse(): ThrownGamesResponse {
  return {
    summary: {
      total_thrown: 0,
      total_losses: 0,
      throw_rate: 0,
      avg_peak_eval: 0,
      avg_eval_swing: 0,
      common_turning_motifs: [],
      common_turning_phases: [],
    },
    games: [],
  }
}
