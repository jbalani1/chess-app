import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// --- Type definitions ---

interface CommonMistake {
  move_san: string
  ply: number
  count: number
  avg_eval_delta: number
}

interface OpeningHealth {
  eco: string
  opening_name: string
  games_played: number
  wins: number
  losses: number
  draws: number
  win_rate: number
  accuracy: number
  avg_eval_delta: number
  mistake_rate: number
  blunder_count: number
  health_score: number
  health_grade: string
  trend: 'improving' | 'stable' | 'worsening'
  user_colors: { white: number; black: number }
  common_mistakes: CommonMistake[]
}

interface RepertoireHealthResponse {
  summary: {
    total_openings: number
    healthiest: { eco: string; name: string; grade: string } | null
    weakest: { eco: string; name: string; grade: string } | null
    avg_health_score: number
  }
  openings: OpeningHealth[]
}

// --- Helpers ---

interface GameData {
  id: string
  white_player: string
  black_player: string
  result: string
  opening_name: string
  eco: string
  played_at: string
  username: string
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

function computeHealthGrade(score: number): string {
  if (score >= 80) return 'A'
  if (score >= 65) return 'B'
  if (score >= 50) return 'C'
  if (score >= 35) return 'D'
  return 'F'
}

function computeHealthScore(
  winRate: number,
  accuracy: number,
  mistakeRate: number,
  blunderCount: number,
): number {
  let score = 50
  score += (winRate - 50) * 0.5
  score += (accuracy - 70) * 0.3
  score -= mistakeRate * 0.5
  score -= Math.min(blunderCount * 2, 20)
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100))
}

// --- Main handler ---

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin
    const searchParams = request.nextUrl.searchParams

    const dateFilter = searchParams.get('dateFilter') || 'all'
    const colorFilter = searchParams.get('color') || 'all'
    const minGames = parseInt(searchParams.get('minGames') || '3', 10)

    const dateCutoff = computeDateCutoff(dateFilter)

    // Step 1: Fetch all games with opening info
    let gamesQuery = supabase
      .from('games')
      .select('id, white_player, black_player, result, opening_name, eco, played_at, username')

    if (dateCutoff) {
      gamesQuery = gamesQuery.gte('played_at', dateCutoff.toISOString())
    }

    const { data: games, error: gamesError } = await gamesQuery.limit(10000)

    if (gamesError) {
      console.error('Error fetching games:', gamesError)
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 })
    }

    if (!games || games.length === 0) {
      const empty: RepertoireHealthResponse = {
        summary: { total_openings: 0, healthiest: null, weakest: null, avg_health_score: 0 },
        openings: [],
      }
      return NextResponse.json(empty)
    }

    // Step 2: Fetch all moves for these games
    const gameIds = games.map((g) => g.id)

    // Fetch moves in batches to avoid URL length limits
    const BATCH_SIZE = 200
    interface MoveRow {
      id: string
      game_id: string
      ply: number
      move_san: string
      eval_delta: number
      classification: string
    }
    const allMoves: MoveRow[] = []

    for (let i = 0; i < gameIds.length; i += BATCH_SIZE) {
      const batch = gameIds.slice(i, i + BATCH_SIZE)
      const { data: moveBatch, error: movesError } = await supabase
        .from('moves')
        .select('id, game_id, ply, move_san, eval_delta, classification')
        .in('game_id', batch)
        .limit(50000)

      if (movesError) {
        console.error('Error fetching moves batch:', movesError)
        return NextResponse.json({ error: 'Failed to fetch moves' }, { status: 500 })
      }

      if (moveBatch) {
        allMoves.push(...moveBatch)
      }
    }

    // Build game lookup
    const gameMap = new Map<string, GameData>()
    for (const g of games) {
      gameMap.set(g.id, g as GameData)
    }

    // Step 3: Process moves, filtering to user's own moves
    interface OpeningAccumulator {
      eco: string
      opening_name: string
      game_ids: Set<string>
      wins: number
      losses: number
      draws: number
      total_moves: number
      good_moves: number // moves that are not inaccuracy/mistake/blunder
      total_eval_delta: number
      mistake_count: number // inaccuracy + mistake + blunder
      blunder_count: number
      white_games: Set<string>
      black_games: Set<string>
      // For trend calculation
      recent_moves: number // last 30 days
      recent_good_moves: number
      prior_moves: number // 30-60 days ago
      prior_good_moves: number
      // For common mistakes
      mistake_moves: Map<string, { ply: number; count: number; total_eval_delta: number }>
    }

    const openingAccumulators = new Map<string, OpeningAccumulator>()
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const BAD_CLASSIFICATIONS = new Set(['inaccuracy', 'mistake', 'blunder'])

    // Track which games have been counted for W/L/D per opening
    const gameResultCounted = new Set<string>() // `${openingKey}|${gameId}`

    for (const move of allMoves) {
      const game = gameMap.get(move.game_id)
      if (!game) continue

      const eco = game.eco || ''
      const openingName = game.opening_name || 'Unknown Opening'
      if (!eco && openingName === 'Unknown Opening') continue

      const username = game.username?.toLowerCase()
      const whitePlayer = game.white_player?.toLowerCase()
      const blackPlayer = game.black_player?.toLowerCase()

      const userIsWhite = username === whitePlayer
      const userIsBlack = username === blackPlayer
      if (!userIsWhite && !userIsBlack) continue

      // Ply parity check: only user's moves
      const isWhiteMove = move.ply % 2 === 1
      const isBlackMove = move.ply % 2 === 0
      const isUserMove = (userIsWhite && isWhiteMove) || (userIsBlack && isBlackMove)
      if (!isUserMove) continue

      const userColor: 'white' | 'black' = userIsWhite ? 'white' : 'black'
      if (colorFilter !== 'all' && userColor !== colorFilter) continue

      const openingKey = `${eco}|${openingName}`

      let acc = openingAccumulators.get(openingKey)
      if (!acc) {
        acc = {
          eco,
          opening_name: openingName,
          game_ids: new Set(),
          wins: 0,
          losses: 0,
          draws: 0,
          total_moves: 0,
          good_moves: 0,
          total_eval_delta: 0,
          mistake_count: 0,
          blunder_count: 0,
          white_games: new Set(),
          black_games: new Set(),
          recent_moves: 0,
          recent_good_moves: 0,
          prior_moves: 0,
          prior_good_moves: 0,
          mistake_moves: new Map(),
        }
        openingAccumulators.set(openingKey, acc)
      }

      acc.game_ids.add(move.game_id)
      acc.total_moves++
      acc.total_eval_delta += Math.abs(move.eval_delta || 0)

      if (userIsWhite) {
        acc.white_games.add(move.game_id)
      } else {
        acc.black_games.add(move.game_id)
      }

      const isBad = BAD_CLASSIFICATIONS.has(move.classification)
      if (!isBad) {
        acc.good_moves++
      } else {
        acc.mistake_count++

        // Track common mistake moves
        const mistakeKey = move.move_san
        const existing = acc.mistake_moves.get(mistakeKey)
        if (existing) {
          existing.count++
          existing.total_eval_delta += Math.abs(move.eval_delta || 0)
          // Keep the most common ply for this move
        } else {
          acc.mistake_moves.set(mistakeKey, {
            ply: move.ply,
            count: 1,
            total_eval_delta: Math.abs(move.eval_delta || 0),
          })
        }
      }

      if (move.classification === 'blunder') {
        acc.blunder_count++
      }

      // Trend tracking
      const playedAt = new Date(game.played_at)
      if (playedAt >= thirtyDaysAgo) {
        acc.recent_moves++
        if (!isBad) acc.recent_good_moves++
      } else if (playedAt >= sixtyDaysAgo) {
        acc.prior_moves++
        if (!isBad) acc.prior_good_moves++
      }

      // Count game result once per opening
      const resultKey = `${openingKey}|${move.game_id}`
      if (!gameResultCounted.has(resultKey)) {
        gameResultCounted.add(resultKey)

        const result = game.result
        if (
          (userIsWhite && result === '1-0') ||
          (userIsBlack && result === '0-1')
        ) {
          acc.wins++
        } else if (
          (userIsWhite && result === '0-1') ||
          (userIsBlack && result === '1-0')
        ) {
          acc.losses++
        } else if (result === '1/2-1/2') {
          acc.draws++
        }
      }
    }

    // Step 4: Build OpeningHealth[] from accumulators
    const openings: OpeningHealth[] = []

    for (const acc of openingAccumulators.values()) {
      const gamesPlayed = acc.game_ids.size
      if (gamesPlayed < minGames) continue

      const winRate = gamesPlayed > 0 ? (acc.wins / gamesPlayed) * 100 : 0
      const accuracy = acc.total_moves > 0 ? (acc.good_moves / acc.total_moves) * 100 : 0
      const avgEvalDelta = acc.total_moves > 0 ? Math.round(acc.total_eval_delta / acc.total_moves) : 0
      const mistakeRate = acc.total_moves > 0 ? (acc.mistake_count / acc.total_moves) * 100 : 0

      const healthScore = computeHealthScore(winRate, accuracy, mistakeRate, acc.blunder_count)
      const healthGrade = computeHealthGrade(healthScore)

      // Compute trend
      let trend: 'improving' | 'stable' | 'worsening' = 'stable'
      if (acc.recent_moves >= 5 && acc.prior_moves >= 5) {
        const recentAccuracy = (acc.recent_good_moves / acc.recent_moves) * 100
        const priorAccuracy = (acc.prior_good_moves / acc.prior_moves) * 100
        const diff = recentAccuracy - priorAccuracy
        if (diff > 5) {
          trend = 'improving'
        } else if (diff < -5) {
          trend = 'worsening'
        }
      }

      // Build common_mistakes: top 5 by count
      const commonMistakes: CommonMistake[] = Array.from(acc.mistake_moves.entries())
        .map(([moveSan, data]) => ({
          move_san: moveSan,
          ply: data.ply,
          count: data.count,
          avg_eval_delta: data.count > 0
            ? Math.round(data.total_eval_delta / data.count)
            : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      openings.push({
        eco: acc.eco,
        opening_name: acc.opening_name,
        games_played: gamesPlayed,
        wins: acc.wins,
        losses: acc.losses,
        draws: acc.draws,
        win_rate: Math.round(winRate * 100) / 100,
        accuracy: Math.round(accuracy * 100) / 100,
        avg_eval_delta: avgEvalDelta,
        mistake_rate: Math.round(mistakeRate * 100) / 100,
        blunder_count: acc.blunder_count,
        health_score: healthScore,
        health_grade: healthGrade,
        trend,
        user_colors: {
          white: acc.white_games.size,
          black: acc.black_games.size,
        },
        common_mistakes: commonMistakes,
      })
    }

    // Sort by health_score descending
    openings.sort((a, b) => b.health_score - a.health_score)

    // Step 5: Build summary
    const totalOpenings = openings.length
    const avgHealthScore = totalOpenings > 0
      ? Math.round((openings.reduce((sum, o) => sum + o.health_score, 0) / totalOpenings) * 100) / 100
      : 0

    const healthiest = totalOpenings > 0
      ? { eco: openings[0].eco, name: openings[0].opening_name, grade: openings[0].health_grade }
      : null

    const weakest = totalOpenings > 0
      ? {
          eco: openings[totalOpenings - 1].eco,
          name: openings[totalOpenings - 1].opening_name,
          grade: openings[totalOpenings - 1].health_grade,
        }
      : null

    const response: RepertoireHealthResponse = {
      summary: {
        total_openings: totalOpenings,
        healthiest,
        weakest,
        avg_health_score: avgHealthScore,
      },
      openings,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in repertoire-health API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
