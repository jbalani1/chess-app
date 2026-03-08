import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { DrillAttemptResult } from '@/lib/types'

interface SpacedRepetitionResult {
  easiness_factor: number
  repetition_number: number
  interval_days: number
  next_review_at: Date
}

function calculateNextReview(
  isCorrect: boolean,
  currentEF: number,
  currentRep: number,
  currentInterval: number
): SpacedRepetitionResult {
  let newEF = currentEF
  let newRep = currentRep
  let newInterval = currentInterval

  if (isCorrect) {
    // Correct answer - increase interval
    if (currentRep === 0) {
      newInterval = 1
    } else if (currentRep === 1) {
      newInterval = 3
    } else {
      newInterval = Math.round(currentInterval * currentEF)
    }
    newRep = currentRep + 1
    // Slightly increase easiness for correct answers
    newEF = Math.min(2.5, currentEF + 0.1)
  } else {
    // Wrong answer - reset and decrease easiness
    newRep = 0
    newInterval = 1 // Review again tomorrow
    newEF = Math.max(1.3, currentEF - 0.2)
  }

  const nextReviewAt = new Date()
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval)

  return {
    easiness_factor: Math.round(newEF * 100) / 100,
    repetition_number: newRep,
    interval_days: newInterval,
    next_review_at: nextReviewAt
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { move_id, attempted_move_uci, attempted_move_san, time_spent_ms } = body

    if (!move_id || !attempted_move_uci) {
      return NextResponse.json({ error: 'move_id and attempted_move_uci are required' }, { status: 400 })
    }

    const username = process.env.CHESS_COM_USERNAME || 'negrilmannings'

    // Get the move to check the correct answer
    const { data: move, error: moveError } = await supabaseAdmin
      .from('moves')
      .select('best_move_uci, best_move_san, blunder_details, eval_delta')
      .eq('id', move_id)
      .single()

    if (moveError || !move) {
      return NextResponse.json({ error: 'Move not found' }, { status: 404 })
    }

    // Check if the answer is correct (normalize UCI for comparison)
    const normalize = (uci: string) => uci.toLowerCase().trim()
    const isCorrect = normalize(attempted_move_uci) === normalize(move.best_move_uci)

    // Get the latest attempt for this move to get current SR values
    const { data: lastAttempt } = await supabaseAdmin
      .from('drill_attempts')
      .select('easiness_factor, repetition_number, interval_days')
      .eq('move_id', move_id)
      .eq('username', username)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Calculate spaced repetition values
    const currentEF = lastAttempt?.easiness_factor || 2.5
    const currentRep = lastAttempt?.repetition_number || 0
    const currentInterval = lastAttempt?.interval_days || 1

    const srResult = calculateNextReview(isCorrect, currentEF, currentRep, currentInterval)

    // Insert the new attempt
    const { error: insertError } = await supabaseAdmin
      .from('drill_attempts')
      .insert({
        move_id,
        username,
        attempted_move_uci,
        attempted_move_san: attempted_move_san || null,
        is_correct: isCorrect,
        time_spent_ms: time_spent_ms || null,
        easiness_factor: srResult.easiness_factor,
        repetition_number: srResult.repetition_number,
        interval_days: srResult.interval_days,
        next_review_at: srResult.next_review_at.toISOString()
      })

    if (insertError) {
      console.error('Error inserting drill attempt:', insertError)
      return NextResponse.json({ error: 'Failed to record attempt' }, { status: 500 })
    }

    // Parse explanation from blunder_details
    const details = typeof move.blunder_details === 'string'
      ? JSON.parse(move.blunder_details)
      : move.blunder_details || {}

    const result: DrillAttemptResult = {
      is_correct: isCorrect,
      correct_move_san: move.best_move_san,
      correct_move_uci: move.best_move_uci,
      explanation: details.explanation || 'No explanation available',
      eval_delta: move.eval_delta,
      next_review_at: srResult.next_review_at.toISOString(),
      repetition_number: srResult.repetition_number,
      interval_days: srResult.interval_days
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in drill attempt API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
