'use client'

import { useState } from 'react'
import { Move, MoveClassification, getEffectiveClassification, isCheckmate } from '@/lib/types'

interface MoveListProps {
  moves: Move[]
  onMoveClick: (moveId: string, fen: string) => void
  selectedMoveId: string | null
}

// Classification → accent colour (used for the left border + label), readable on
// the dark theme. The move text itself stays high-contrast white.
const classColorVar: Record<MoveClassification, string> = {
  good: 'var(--color-good)',
  inaccuracy: 'var(--color-inaccuracy)',
  mistake: 'var(--color-mistake)',
  blunder: 'var(--color-blunder)',
}

const classificationLabels: Record<MoveClassification, string> = {
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

type FilterOption = 'all' | 'inaccuracy' | 'mistake' | 'blunder'

export default function MoveList({ moves, onMoveClick, selectedMoveId }: MoveListProps) {
  const [filter, setFilter] = useState<FilterOption>('all')

  const filteredMoves = filter === 'all'
    ? moves
    : moves.filter(m => getEffectiveClassification(m) === filter)

  const movePairs = []
  if (filter === 'all') {
    for (let i = 0; i < moves.length; i += 2) {
      const whiteMove = moves[i]
      const blackMove = moves[i + 1]
      movePairs.push({ whiteMove, blackMove, moveNumber: Math.floor(i / 2) + 1 })
    }
  }

  const formatEval = (evaluation: number) => {
    if (evaluation > 10000) return 'M+' + (10000 - evaluation)
    if (evaluation < -10000) return 'M' + (evaluation + 10000)
    return (evaluation > 0 ? '+' : '') + (evaluation / 100).toFixed(1)
  }

  // A single move cell, dark-themed with a classification-coloured left border.
  const MoveCell = ({ move }: { move: Move }) => {
    const effectiveClass = getEffectiveClassification(move)
    const isCheckmateMove = isCheckmate(move)
    const color = classColorVar[effectiveClass]
    const selected = selectedMoveId === move.id
    return (
      <div
        id={`move-${move.id}`}
        onClick={() => onMoveClick(move.id, move.position_fen)}
        style={{ borderLeftColor: color }}
        className={`px-2.5 py-1.5 rounded-md border border-l-[3px] cursor-pointer transition-colors bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] ${
          selected
            ? 'border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]'
            : 'border-[var(--border-color)]'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono font-semibold text-[var(--text-primary)]">{move.move_san}</span>
          <div className="flex flex-col items-end leading-tight">
            <span
              className="text-xs font-medium"
              style={{ color: isCheckmateMove ? 'var(--color-good)' : move.eval_delta < 0 ? 'var(--color-blunder)' : 'var(--color-good)' }}
            >
              {isCheckmateMove ? '#' : formatEval(move.eval_after)}
            </span>
            {!isCheckmateMove && move.eval_delta < -50 && (
              <span className="text-xs" style={{ color: 'var(--color-blunder)' }}>
                {formatEval(move.eval_delta)}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs mt-0.5 font-medium" style={{ color }}>
          {isCheckmateMove ? 'Checkmate' : classificationLabels[effectiveClass]}
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Move List</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterOption)}
          className="text-sm text-[var(--text-primary)] border border-[var(--border-color)] rounded-md px-2 py-1 bg-[var(--bg-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
        >
          <option value="all">All Moves</option>
          <option value="inaccuracy">Inaccuracies</option>
          <option value="mistake">Mistakes</option>
          <option value="blunder">Blunders</option>
        </select>
      </div>
      <div className="max-h-[28rem] overflow-y-auto">
        {filter === 'all' ? (
          <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 p-3 text-sm items-stretch">
            <div className="font-semibold text-[var(--text-secondary)] text-center text-xs uppercase tracking-wide self-center">#</div>
            <div className="font-semibold text-[var(--text-secondary)] text-center text-xs uppercase tracking-wide self-center">White</div>
            <div className="font-semibold text-[var(--text-secondary)] text-center text-xs uppercase tracking-wide self-center">Black</div>

            {movePairs.map(({ whiteMove, blackMove, moveNumber }) => (
              <div key={moveNumber} className="contents">
                <div className="flex items-center justify-center text-[var(--text-secondary)] font-medium">
                  {moveNumber}.
                </div>
                {whiteMove ? <MoveCell move={whiteMove} /> : <div />}
                {blackMove ? <MoveCell move={blackMove} /> : <div />}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredMoves.length === 0 ? (
              <p className="text-[var(--text-secondary)] text-center py-6">
                No {filter}s in this game.
              </p>
            ) : (
              filteredMoves.map((move) => {
                const isWhiteMove = move.ply % 2 === 1
                const moveNumber = Math.ceil(move.ply / 2)
                return (
                  <div key={move.id} className="flex items-center gap-2">
                    <span className="text-[var(--text-secondary)] font-medium text-sm w-10 shrink-0 text-right">
                      {moveNumber}.{!isWhiteMove && '..'}
                    </span>
                    <div className="flex-1">
                      <MoveCell move={move} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
