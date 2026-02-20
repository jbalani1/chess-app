import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function getDateFromRange(range: string): Date | null {
  const now = new Date()
  switch (range) {
    case '7d': return new Date(now.setDate(now.getDate() - 7))
    case '30d': return new Date(now.setDate(now.getDate() - 30))
    case '90d': return new Date(now.setDate(now.getDate() - 90))
    case '1y': return new Date(now.setFullYear(now.getFullYear() - 1))
    default: return null
  }
}

function getTimeControlPattern(timeControl: string): string[] | null {
  switch (timeControl) {
    case 'bullet': return ['60', '60+0', '60+1', '120', '120+0', '120+1', '1+0', '1+1', '2+0', '2+1']
    case 'blitz': return ['180', '180+0', '180+2', '300', '300+0', '300+2', '300+3', '3+0', '3+2', '5+0', '5+3']
    case 'rapid': return ['600', '600+0', '600+5', '900', '900+0', '900+10', '10+0', '10+5', '15+0', '15+10']
    case 'classical': return ['1800', '1800+0', '1800+30', '30+0', '30+20', '45+45', '60+30', '90+30']
    default: return null
  }
}

function getMondayOfWeek(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

function getMonthBucket(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function formatBucketLabel(period: string, granularity: string): string {
  const d = new Date(period)
  if (granularity === 'month') {
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }
  const end = new Date(d)
  end.setDate(end.getDate() + 6)
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${end.getDate()}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const granularity = searchParams.get('granularity') || 'week'
    const category = searchParams.get('category')
    const timeControl = searchParams.get('timeControl')
    const dateRange = searchParams.get('dateRange')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabaseAdmin
      .from('moves')
      .select(`
        blunder_category,
        classification,
        eval_delta,
        ply,
        games!inner (
          username,
          white_player,
          black_player,
          time_control,
          played_at
        )
      `)
      .in('classification', ['mistake', 'blunder'])

    if (category) {
      query = query.eq('blunder_category', category)
    } else {
      query = query.not('blunder_category', 'is', null)
    }

    // Apply date filter
    if (dateRange) {
      const fromDate = getDateFromRange(dateRange)
      if (fromDate) {
        query = query.gte('games.played_at', fromDate.toISOString())
      }
    } else if (startDate) {
      query = query.gte('games.played_at', startDate)
      if (endDate) {
        query = query.lte('games.played_at', endDate)
      }
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching trend data:', error)
      return NextResponse.json({ error: 'Failed to fetch trend data' }, { status: 500 })
    }

    const timeControlPatterns = timeControl ? getTimeControlPattern(timeControl) : null

    // Bucket the data
    const bucketMap: Record<string, {
      period: string
      mistakes: number
      blunders: number
      total: number
      total_eval_loss: number
      by_category: Record<string, number>
    }> = {}

    for (const move of data || []) {
      const game = move.games as any
      const username = game.username?.toLowerCase()
      const whitePlayer = game.white_player?.toLowerCase()
      const blackPlayer = game.black_player?.toLowerCase()

      // Filter to user's moves
      const userIsWhite = username === whitePlayer
      const userIsBlack = username === blackPlayer
      const isWhiteMove = move.ply % 2 === 1
      const isBlackMove = move.ply % 2 === 0
      const isUserMove = (userIsWhite && isWhiteMove) || (userIsBlack && isBlackMove)
      if (!isUserMove) continue

      // Filter by time control
      if (timeControlPatterns) {
        const gameTC = game.time_control || ''
        if (!timeControlPatterns.some(p => gameTC.includes(p))) continue
      }

      const playedAt = new Date(game.played_at)
      const bucketKey = granularity === 'month'
        ? getMonthBucket(playedAt)
        : getMondayOfWeek(playedAt)

      if (!bucketMap[bucketKey]) {
        bucketMap[bucketKey] = {
          period: bucketKey,
          mistakes: 0,
          blunders: 0,
          total: 0,
          total_eval_loss: 0,
          by_category: {},
        }
      }

      const bucket = bucketMap[bucketKey]
      bucket.total++
      bucket.total_eval_loss += Math.abs(move.eval_delta || 0)

      if (move.classification === 'blunder') {
        bucket.blunders++
      } else {
        bucket.mistakes++
      }

      if (move.blunder_category) {
        bucket.by_category[move.blunder_category] = (bucket.by_category[move.blunder_category] || 0) + 1
      }
    }

    // Sort buckets chronologically
    const buckets = Object.values(bucketMap)
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(b => ({
        ...b,
        label: formatBucketLabel(b.period, granularity),
        avg_eval_loss: b.total > 0 ? Math.round(b.total_eval_loss / b.total) : 0,
      }))

    // Compute trend summary: compare recent half vs earlier half
    const midpoint = Math.floor(buckets.length / 2)
    const recentBuckets = buckets.slice(midpoint)
    const earlierBuckets = buckets.slice(0, midpoint)

    const recentAvg = recentBuckets.length > 0
      ? recentBuckets.reduce((sum, b) => sum + b.total, 0) / recentBuckets.length
      : 0
    const earlierAvg = earlierBuckets.length > 0
      ? earlierBuckets.reduce((sum, b) => sum + b.total, 0) / earlierBuckets.length
      : 0

    let trendDirection: 'improving' | 'worsening' | 'stable' = 'stable'
    let percentChange = 0

    if (earlierAvg > 0) {
      percentChange = Math.round(((recentAvg - earlierAvg) / earlierAvg) * 100)
      if (percentChange < -20) trendDirection = 'improving'
      else if (percentChange > 20) trendDirection = 'worsening'
    }

    return NextResponse.json({
      buckets,
      summary: {
        trend_direction: trendDirection,
        recent_avg: Math.round(recentAvg * 10) / 10,
        earlier_avg: Math.round(earlierAvg * 10) / 10,
        percent_change: percentChange,
      },
    })
  } catch (error) {
    console.error('Error in trends API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
