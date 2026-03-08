"use client"

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import DrillBoard from '@/components/drill/DrillBoard'
import DrillFeedback from '@/components/drill/DrillFeedback'
import DrillProgress from '@/components/drill/DrillProgress'
import { DrillPosition, DrillAttemptResult } from '@/lib/types'

type SessionState = 'loading' | 'drilling' | 'feedback' | 'complete'

function DrillSessionContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const category = searchParams.get('category')
  const count = parseInt(searchParams.get('count') || '10', 10)

  const [positions, setPositions] = useState<DrillPosition[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [state, setState] = useState<SessionState>('loading')
  const [lastResult, setLastResult] = useState<DrillAttemptResult | null>(null)
  const [lastUserMove, setLastUserMove] = useState<string>('')
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [moveStartTime, setMoveStartTime] = useState<Date | null>(null)
  const [showHint, setShowHint] = useState<{ from?: string; to?: string }>({})
  const [hintLevel, setHintLevel] = useState(0)

  // Fetch positions on mount
  useEffect(() => {
    async function fetchPositions() {
      try {
        const params = new URLSearchParams()
        if (category) params.set('category', category)
        params.set('limit', count.toString())

        const response = await fetch(`/api/drill/positions?${params}`)
        if (!response.ok) throw new Error('Failed to fetch positions')

        const data = await response.json()
        if (data.length === 0) {
          setState('complete')
          return
        }

        setPositions(data)
        setStartTime(new Date())
        setMoveStartTime(new Date())
        setState('drilling')
      } catch (e) {
        console.error('Failed to fetch positions:', e)
        setState('complete')
      }
    }
    fetchPositions()
  }, [category, count])

  const currentPosition = positions[currentIndex]

  // Determine board orientation based on who played the move
  const orientation = currentPosition
    ? (currentPosition.username.toLowerCase() === currentPosition.black_player.toLowerCase() ? 'black' : 'white')
    : 'white'

  const handleMove = useCallback(async (move: { from: string; to: string; san: string; uci: string }) => {
    if (!currentPosition || state !== 'drilling') return

    const timeSpent = moveStartTime ? Date.now() - moveStartTime.getTime() : 0

    try {
      const response = await fetch('/api/drill/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          move_id: currentPosition.move_id,
          attempted_move_uci: move.uci,
          attempted_move_san: move.san,
          time_spent_ms: timeSpent
        })
      })

      if (!response.ok) throw new Error('Failed to record attempt')

      const result: DrillAttemptResult = await response.json()
      setLastResult(result)
      setLastUserMove(move.san)
      if (result.is_correct) {
        setCorrectCount(c => c + 1)
      }
      setState('feedback')
      setShowHint({})
      setHintLevel(0)
    } catch (e) {
      console.error('Failed to record attempt:', e)
    }
  }, [currentPosition, state, moveStartTime])

  const handleNext = useCallback(() => {
    if (currentIndex >= positions.length - 1) {
      setState('complete')
    } else {
      setCurrentIndex(i => i + 1)
      setMoveStartTime(new Date())
      setState('drilling')
      setLastResult(null)
      setShowHint({})
      setHintLevel(0)
    }
  }, [currentIndex, positions.length])

  const handleHint = useCallback(() => {
    if (!currentPosition) return

    const bestMove = currentPosition.best_move_uci
    if (!bestMove || bestMove.length < 4) return

    const from = bestMove.substring(0, 2)
    const to = bestMove.substring(2, 4)

    if (hintLevel === 0) {
      setShowHint({ from })
      setHintLevel(1)
    } else {
      setShowHint({ from, to })
      setHintLevel(2)
    }
  }, [currentPosition, hintLevel])

  const handleViewGame = useCallback(() => {
    if (currentPosition) {
      router.push(`/games/${currentPosition.game_id}`)
    }
  }, [currentPosition, router])

  // Loading state
  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent-primary)] mx-auto mb-4"></div>
          <div className="text-[var(--text-muted)]">Loading positions...</div>
        </div>
      </div>
    )
  }

  // Complete state
  if (state === 'complete') {
    const accuracy = positions.length > 0 ? Math.round((correctCount / positions.length) * 100) : 0

    return (
      <div className="max-w-2xl mx-auto animate-fadeIn">
        <div className="card p-8 text-center">
          <div className="text-6xl mb-4">
            {accuracy >= 80 ? '🎉' : accuracy >= 50 ? '👍' : '💪'}
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Session Complete!</h1>
          <p className="text-[var(--text-secondary)] mb-6">
            You got <span className="font-bold text-green-400">{correctCount}</span> out of{' '}
            <span className="font-bold text-[var(--text-primary)]">{positions.length}</span> positions correct
          </p>

          <div className="text-5xl font-bold text-[var(--accent-primary)] mb-2">{accuracy}%</div>
          <div className="text-[var(--text-muted)] mb-8">Accuracy</div>

          {accuracy < 50 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 text-left">
              <p className="text-[var(--text-secondary)]">
                <span className="font-bold text-amber-400">Keep practicing!</span> These positions will come back tomorrow.
                Remember: before every move, check if your pieces are defended.
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <Link
              href="/drill"
              className="flex-1 px-4 py-3 text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-hover)] font-medium border border-[var(--border-color)] transition-colors"
            >
              Back to Dashboard
            </Link>
            <Link
              href={`/drill/session${category ? `?category=${category}` : ''}`}
              className="flex-1 px-4 py-3 text-white bg-[var(--accent-primary)] rounded-lg hover:bg-[var(--accent-primary-hover)] font-medium transition-colors"
            >
              Drill Again
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // No positions available
  if (!currentPosition) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">No positions to drill!</h2>
          <p className="text-[var(--text-secondary)] mb-4">You&apos;re all caught up. Check back later.</p>
          <Link href="/drill" className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-4">
        <Link href="/drill" className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] text-sm">
          ← Exit Drill
        </Link>
      </div>

      {/* Progress */}
      <DrillProgress
        current={currentIndex + 1}
        total={positions.length}
        correct={correctCount}
        category={category || undefined}
        startTime={startTime || undefined}
      />

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Board */}
        <div className="card p-5 flex-shrink-0">
          <div className="mb-4 text-center">
            <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${
              currentPosition.blunder_category === 'hanging_piece' ? 'bg-red-500/20 text-red-400' :
              currentPosition.blunder_category === 'endgame_technique' ? 'bg-purple-500/20 text-purple-400' :
              'bg-orange-500/20 text-orange-400'
            }`}>
              {currentPosition.blunder_category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </span>
          </div>

          <div className="bg-[var(--bg-tertiary)] p-4 rounded-lg border border-[var(--border-color)]">
            <DrillBoard
              key={currentPosition.move_id}
              fen={currentPosition.position_fen}
              orientation={orientation}
              onMove={handleMove}
              disabled={state === 'feedback'}
              showHint={showHint}
            />
          </div>

          {state === 'drilling' && (
            <div className="mt-4 text-center">
              <p className="text-[var(--text-primary)] font-medium mb-3">Find the best move!</p>
              <button
                onClick={handleHint}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-tertiary)] rounded-lg hover:bg-[var(--bg-hover)] border border-[var(--border-color)] transition-colors"
                disabled={hintLevel >= 2}
              >
                {hintLevel === 0 ? 'Show Hint' : hintLevel === 1 ? 'Show More' : 'Hint Used'}
              </button>
            </div>
          )}
        </div>

        {/* Feedback or instructions */}
        <div className="flex-1 min-w-0 w-full xl:w-auto">
          {state === 'feedback' && lastResult ? (
            <DrillFeedback
              result={lastResult}
              userMove={lastUserMove}
              onNext={handleNext}
              onViewGame={handleViewGame}
              isLastPosition={currentIndex >= positions.length - 1}
            />
          ) : (
            <div className="card p-6">
              <h3 className="font-bold text-[var(--text-primary)] mb-3">Position Context</h3>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                <p>
                  <span className="font-medium text-[var(--text-primary)]">Phase:</span>{' '}
                  {currentPosition.phase.charAt(0).toUpperCase() + currentPosition.phase.slice(1)}
                </p>
                <p>
                  <span className="font-medium text-[var(--text-primary)]">You played as:</span>{' '}
                  {orientation === 'white' ? 'White' : 'Black'}
                </p>
                <p>
                  <span className="font-medium text-[var(--text-primary)]">Original eval loss:</span>{' '}
                  <span className="text-red-400">{currentPosition.eval_delta} centipawns</span>
                </p>
              </div>

              <div className="mt-6 p-4 bg-[var(--accent-primary)]/10 rounded-lg border border-[var(--accent-primary)]/30">
                <p className="text-sm text-[var(--text-secondary)]">
                  <span className="font-bold text-[var(--accent-primary)]">Tip:</span> Before moving, ask yourself:
                  <br />• Is anything I have hanging?
                  <br />• What can my opponent capture?
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DrillSession() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--text-muted)]">Loading...</div>
      </div>
    }>
      <DrillSessionContent />
    </Suspense>
  )
}
