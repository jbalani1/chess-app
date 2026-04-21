import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// --- Type definitions ---

interface MoveSegmentStats {
  segment: string
  total_moves: number
  good_moves: number
  inaccuracies: number
  mistakes: number
  blunders: number
  accuracy: number
  avg_eval_delta: number
  mistake_rate: number
}

interface TimeControlPerformance {
  time_control_category: string
  games_played: number
  wins: number
  losses: number
  draws: number
  win_rate: number
  overall_accuracy: number
  overall_mistake_rate: number
  segments: MoveSegmentStats[]
}

interface TimePerformanceResponse {
  performances: TimeControlPerformance[]
  insights: string[]
}

// --- Helpers ---

const SEGMENTS = [
  { label: '1-10', min: 1, max: 10 },
  { label: '11-20', min: 11, max: 20 },
  { label: '21-30', min: 21, max: 30 },
  { label: '31-40', min: 31, max: 40 },
  { label: '41+', min: 41, max: Infinity },
] as const

function parseTimeControlCategory(timeControl: string | null): string | null {
  if (!timeControl) return null

  // Chess.com format: "180+2", "600", "60+1", etc.
  const match = timeControl.match(/^(\d+)/)
  if (!match) return null

  const baseSeconds = parseInt(match[1], 10)
  if (isNaN(baseSeconds)) return null

  if (baseSeconds < 180) return 'bullet'
  if (baseSeconds < 600) return 'blitz'
  return 'rapid'
}

function getMoveNumber(ply: number): number {
  return Math.ceil(ply / 2)
}

function getSegmentLabel(moveNumber: number): string {
  for (const seg of SEGMENTS) {
    if (moveNumber >= seg.min && moveNumber <= seg.max) {
      return seg.label
    }
  }
  return '41+'
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

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}

interface GameData {
  id: string
  white_player: string
  black_player: string
  result: string
  time_control: string
  played_at: string
  username: string
}

// --- Main handler ---

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin
    const searchParams = request.nextUrl.searchParams

    const dateFilter = searchParams.get('dateFilter') || 'all'
    const colorFilter = searchParams.get('color') || 'all'

    const dateCutoff = computeDateCutoff(dateFilter)

    // Fetch all moves joined to games
    let query = supabase
      .from('moves')
      .select(`
        id,
        game_id,
        ply,
        eval_delta,
        classification,
        games!inner (
          id,
          white_player,
          black_player,
          result,
          time_control,
          played_at,
          username
        )
      `)

    if (dateCutoff) {
      query = query.gte('games.played_at', dateCutoff.toISOString())
    }

    const { data: moves, error } = await query.limit(50000)

    if (error) {
      console.error('Error fetching time performance data:', error)
      return NextResponse.json(
        { error: 'Failed to fetch time performance data' },
        { status: 500 }
      )
    }

    if (!moves || moves.length === 0) {
      const empty: TimePerformanceResponse = { performances: [], insights: [] }
      return NextResponse.json(empty)
    }

    // Group data by time control category
    // Track per-game results and per-move stats

    interface CategoryAccumulator {
      gameResults: Map<string, { result: string; userColor: 'white' | 'black' }>
      segmentStats: Map<string, {
        total_moves: number
        good_moves: number
        inaccuracies: number
        mistakes: number
        blunders: number
        total_eval_delta: number
      }>
    }

    const categories = new Map<string, CategoryAccumulator>()

    for (const move of moves) {
      const game = move.games as unknown as GameData
      const username = game.username?.toLowerCase()
      const whitePlayer = game.white_player?.toLowerCase()
      const blackPlayer = game.black_player?.toLowerCase()

      const userIsWhite = username === whitePlayer
      const userIsBlack = username === blackPlayer

      if (!userIsWhite && !userIsBlack) continue

      const isWhiteMove = move.ply % 2 === 1
      const isBlackMove = move.ply % 2 === 0
      const isUserMove = (userIsWhite && isWhiteMove) || (userIsBlack && isBlackMove)

      if (!isUserMove) continue

      const userColor: 'white' | 'black' = userIsWhite ? 'white' : 'black'

      if (colorFilter !== 'all' && userColor !== colorFilter) continue

      const category = parseTimeControlCategory(game.time_control)
      if (!category) continue

      // Initialize category if needed
      if (!categories.has(category)) {
        categories.set(category, {
          gameResults: new Map(),
          segmentStats: new Map(),
        })
      }

      const acc = categories.get(category)!

      // Track game result (once per game)
      if (!acc.gameResults.has(game.id)) {
        acc.gameResults.set(game.id, { result: game.result, userColor })
      }

      // Classify this move into a segment
      const moveNumber = getMoveNumber(move.ply)
      const segmentLabel = getSegmentLabel(moveNumber)

      if (!acc.segmentStats.has(segmentLabel)) {
        acc.segmentStats.set(segmentLabel, {
          total_moves: 0,
          good_moves: 0,
          inaccuracies: 0,
          mistakes: 0,
          blunders: 0,
          total_eval_delta: 0,
        })
      }

      const seg = acc.segmentStats.get(segmentLabel)!
      seg.total_moves++
      seg.total_eval_delta += Math.abs(move.eval_delta ?? 0)

      const classification = move.classification?.toLowerCase()
      switch (classification) {
        case 'best':
        case 'excellent':
        case 'good':
        case 'book':
          seg.good_moves++
          break
        case 'inaccuracy':
          seg.inaccuracies++
          break
        case 'mistake':
          seg.mistakes++
          break
        case 'blunder':
          seg.blunders++
          break
        default:
          // Treat unclassified moves as neutral (not good, not bad)
          break
      }
    }

    // Build response
    const performances: TimeControlPerformance[] = []
    const categoryOrder = ['bullet', 'blitz', 'rapid']

    for (const categoryName of categoryOrder) {
      const acc = categories.get(categoryName)
      if (!acc) continue

      // Compute win/loss/draw
      let wins = 0
      let losses = 0
      let draws = 0

      for (const { result, userColor } of acc.gameResults.values()) {
        if (result === '1/2-1/2' || result === 'draw') {
          draws++
        } else if (
          (result === '1-0' && userColor === 'white') ||
          (result === '0-1' && userColor === 'black')
        ) {
          wins++
        } else {
          losses++
        }
      }

      const gamesPlayed = acc.gameResults.size
      const winRate = gamesPlayed > 0 ? roundTo((wins / gamesPlayed) * 100, 1) : 0

      // Build segment stats
      const segments: MoveSegmentStats[] = []
      let overallTotalMoves = 0
      let overallGoodMoves = 0
      let overallMistakes = 0
      let overallBlunders = 0
      let overallEvalDelta = 0

      for (const segDef of SEGMENTS) {
        const stats = acc.segmentStats.get(segDef.label)
        if (!stats || stats.total_moves === 0) {
          segments.push({
            segment: segDef.label,
            total_moves: 0,
            good_moves: 0,
            inaccuracies: 0,
            mistakes: 0,
            blunders: 0,
            accuracy: 0,
            avg_eval_delta: 0,
            mistake_rate: 0,
          })
          continue
        }

        const accuracy = roundTo((stats.good_moves / stats.total_moves) * 100, 1)
        const avgEvalDelta = roundTo(stats.total_eval_delta / stats.total_moves, 1)
        const mistakeRate = roundTo(
          ((stats.mistakes + stats.blunders) / stats.total_moves) * 100,
          1
        )

        segments.push({
          segment: segDef.label,
          total_moves: stats.total_moves,
          good_moves: stats.good_moves,
          inaccuracies: stats.inaccuracies,
          mistakes: stats.mistakes,
          blunders: stats.blunders,
          accuracy,
          avg_eval_delta: avgEvalDelta,
          mistake_rate: mistakeRate,
        })

        overallTotalMoves += stats.total_moves
        overallGoodMoves += stats.good_moves
        overallMistakes += stats.mistakes
        overallBlunders += stats.blunders
        overallEvalDelta += stats.total_eval_delta
      }

      const overallAccuracy =
        overallTotalMoves > 0
          ? roundTo((overallGoodMoves / overallTotalMoves) * 100, 1)
          : 0
      const overallMistakeRate =
        overallTotalMoves > 0
          ? roundTo(((overallMistakes + overallBlunders) / overallTotalMoves) * 100, 1)
          : 0

      performances.push({
        time_control_category: categoryName,
        games_played: gamesPlayed,
        wins,
        losses,
        draws,
        win_rate: winRate,
        overall_accuracy: overallAccuracy,
        overall_mistake_rate: overallMistakeRate,
        segments,
      })
    }

    // Generate insights
    const insights = generateInsights(performances)

    const response: TimePerformanceResponse = { performances, insights }
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in time-performance API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// --- Insight generation ---

function generateInsights(performances: TimeControlPerformance[]): string[] {
  const insights: string[] = []

  // Within each time control: compare early vs late segments
  for (const perf of performances) {
    if (perf.games_played < 3) continue

    const filledSegments = perf.segments.filter((s) => s.total_moves >= 5)
    if (filledSegments.length < 2) continue

    const early = filledSegments[0]
    const late = filledSegments[filledSegments.length - 1]

    const accuracyDrop = early.accuracy - late.accuracy
    if (accuracyDrop >= 10) {
      insights.push(
        `In ${perf.time_control_category}, your accuracy drops from ${early.accuracy}% (moves ${early.segment}) to ${late.accuracy}% (moves ${late.segment}) - consider managing your clock better in the later stages.`
      )
    }

    const mistakeRateIncrease = late.mistake_rate - early.mistake_rate
    if (mistakeRateIncrease >= 8) {
      insights.push(
        `Your ${perf.time_control_category} mistake rate climbs from ${early.mistake_rate}% to ${late.mistake_rate}% as games progress - time pressure may be a factor.`
      )
    }

    // Check for a specific "cliff" - a segment where accuracy drops sharply
    for (let i = 1; i < filledSegments.length; i++) {
      const prev = filledSegments[i - 1]
      const curr = filledSegments[i]
      const drop = prev.accuracy - curr.accuracy
      if (drop >= 15) {
        insights.push(
          `In ${perf.time_control_category}, there's a sharp accuracy drop after move ${prev.segment.split('-')[1] || prev.segment}: ${prev.accuracy}% down to ${curr.accuracy}%.`
        )
        break // Only report the first cliff per time control
      }
    }
  }

  // Cross time-control comparisons
  const validPerfs = performances.filter((p) => p.games_played >= 3)
  if (validPerfs.length >= 2) {
    const sorted = [...validPerfs].sort((a, b) => b.overall_accuracy - a.overall_accuracy)
    const best = sorted[0]
    const worst = sorted[sorted.length - 1]

    const gap = best.overall_accuracy - worst.overall_accuracy
    if (gap >= 5) {
      insights.push(
        `Your ${best.time_control_category} accuracy (${best.overall_accuracy}%) is notably higher than ${worst.time_control_category} (${worst.overall_accuracy}%) - you may perform better with more thinking time.`
      )
    }

    // Win rate comparison
    const sortedByWinRate = [...validPerfs].sort((a, b) => b.win_rate - a.win_rate)
    const bestWR = sortedByWinRate[0]
    const worstWR = sortedByWinRate[sortedByWinRate.length - 1]
    const wrGap = bestWR.win_rate - worstWR.win_rate
    if (wrGap >= 10) {
      insights.push(
        `You win ${bestWR.win_rate}% of ${bestWR.time_control_category} games vs ${worstWR.win_rate}% in ${worstWR.time_control_category} - consider focusing on your stronger time control.`
      )
    }
  }

  // Blunder-heavy late game
  for (const perf of performances) {
    if (perf.games_played < 3) continue

    const lateSegment = perf.segments.find((s) => s.segment === '41+')
    if (lateSegment && lateSegment.total_moves >= 10 && lateSegment.blunders >= 3) {
      const blunderPct = roundTo((lateSegment.blunders / lateSegment.total_moves) * 100, 1)
      if (blunderPct >= 10) {
        insights.push(
          `In ${perf.time_control_category} endgames (move 41+), ${blunderPct}% of your moves are blunders - endgame practice could help.`
        )
      }
    }
  }

  return insights
}
