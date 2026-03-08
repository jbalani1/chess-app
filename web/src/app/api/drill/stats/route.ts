import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { DrillStats, CategoryDrillStats, BlunderCategory, JoinedGameData } from '@/lib/types'

export async function GET() {
  try {
    const username = process.env.CHESS_COM_USERNAME || 'negrilmannings'
    const now = new Date().toISOString()

    // Get all blunder positions (to know total available)
    const { data: allBlunders, error: blunderError } = await supabaseAdmin
      .from('moves')
      .select(`
        id,
        blunder_category,
        games!inner (username, white_player, black_player),
        ply
      `)
      .in('classification', ['mistake', 'blunder'])
      .not('blunder_category', 'is', null)
      .not('best_move_uci', 'is', null)

    if (blunderError) {
      console.error('Error fetching blunders:', blunderError)
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    // Filter to only user's moves
    const userBlunders = (allBlunders || []).filter(move => {
      const game = move.games as unknown as JoinedGameData
      const gameUsername = game.username?.toLowerCase()
      const whitePlayer = game.white_player?.toLowerCase()
      const blackPlayer = game.black_player?.toLowerCase()
      const userIsWhite = gameUsername === whitePlayer
      const userIsBlack = gameUsername === blackPlayer
      const isWhiteMove = move.ply % 2 === 1
      const isBlackMove = move.ply % 2 === 0
      return (userIsWhite && isWhiteMove) || (userIsBlack && isBlackMove)
    })

    // Get all drill attempts for this user
    const { data: attempts, error: attemptError } = await supabaseAdmin
      .from('drill_attempts')
      .select('move_id, is_correct, repetition_number, interval_days, next_review_at, created_at')
      .eq('username', username)
      .order('created_at', { ascending: false })

    if (attemptError) {
      console.error('Error fetching attempts:', attemptError)
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    // Build latest attempt map
    const latestAttempts = new Map<string, {
      is_correct: boolean
      repetition_number: number
      interval_days: number
      next_review_at: string | null
    }>()

    for (const attempt of attempts || []) {
      if (!latestAttempts.has(attempt.move_id)) {
        latestAttempts.set(attempt.move_id, {
          is_correct: attempt.is_correct,
          repetition_number: attempt.repetition_number,
          interval_days: attempt.interval_days,
          next_review_at: attempt.next_review_at
        })
      }
    }

    // Calculate stats by category
    const categoryStats: Record<string, {
      total: number
      drilled: number
      mastered: number
      correct: number
      total_attempts: number
      due: number
    }> = {}

    // Initialize categories
    const categories: BlunderCategory[] = [
      'hanging_piece', 'overlooked_check', 'back_rank', 'greedy_capture',
      'opening_principle', 'endgame_technique', 'missed_tactic',
      'calculation_error', 'positional_collapse', 'time_pressure'
    ]

    for (const cat of categories) {
      categoryStats[cat] = { total: 0, drilled: 0, mastered: 0, correct: 0, total_attempts: 0, due: 0 }
    }

    // Count blunders by category
    for (const blunder of userBlunders) {
      const cat = blunder.blunder_category as string
      if (!categoryStats[cat]) {
        categoryStats[cat] = { total: 0, drilled: 0, mastered: 0, correct: 0, total_attempts: 0, due: 0 }
      }
      categoryStats[cat].total++

      const attempt = latestAttempts.get(blunder.id)
      if (attempt) {
        categoryStats[cat].drilled++
        if (attempt.repetition_number >= 3 && attempt.interval_days >= 7) {
          categoryStats[cat].mastered++
        }
        if (attempt.next_review_at && new Date(attempt.next_review_at) <= new Date(now)) {
          categoryStats[cat].due++
        }
      } else {
        // Never drilled = due
        categoryStats[cat].due++
      }
    }

    // Count correct attempts
    for (const attempt of attempts || []) {
      // Find the category for this move
      const blunder = userBlunders.find(b => b.id === attempt.move_id)
      if (blunder) {
        const cat = blunder.blunder_category as string
        if (categoryStats[cat]) {
          categoryStats[cat].total_attempts++
          if (attempt.is_correct) {
            categoryStats[cat].correct++
          }
        }
      }
    }

    // Calculate current streak (consecutive correct answers, most recent first)
    let currentStreak = 0
    const sortedAttempts = [...(attempts || [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    for (const attempt of sortedAttempts) {
      if (attempt.is_correct) {
        currentStreak++
      } else {
        break
      }
    }

    // Build the response
    const totalPositions = userBlunders.length
    const totalAttempts = attempts?.length || 0
    const correctAttempts = attempts?.filter(a => a.is_correct).length || 0
    const positionsMastered = [...latestAttempts.values()].filter(
      a => a.repetition_number >= 3 && a.interval_days >= 7
    ).length
    const positionsDue = userBlunders.filter(b => {
      const attempt = latestAttempts.get(b.id)
      if (!attempt) return true // Never drilled
      return attempt.next_review_at && new Date(attempt.next_review_at) <= new Date(now)
    }).length

    const byCategory = {} as Record<BlunderCategory, CategoryDrillStats>
    for (const [cat, stats] of Object.entries(categoryStats)) {
      byCategory[cat as BlunderCategory] = {
        total: stats.total,
        drilled: stats.drilled,
        mastered: stats.mastered,
        accuracy: stats.total_attempts > 0 ? Math.round(100 * stats.correct / stats.total_attempts) : 0,
        due_count: stats.due
      }
    }

    const result: DrillStats = {
      total_positions: totalPositions,
      total_attempts: totalAttempts,
      accuracy_rate: totalAttempts > 0 ? Math.round(100 * correctAttempts / totalAttempts) : 0,
      positions_mastered: positionsMastered,
      positions_due: positionsDue,
      current_streak: currentStreak,
      by_category: byCategory
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in drill stats API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
