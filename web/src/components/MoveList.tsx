'use client'

import { useState } from 'react'
import { Move, MoveClassification, getEffectiveClassification, isCheckmate } from '@/lib/types'

interface MoveListProps {
  moves: Move[]
  onMoveClick: (moveId: string, fen: string) => void
  selectedMoveId: string | null
}

const classificationColors = {
  good: 'bg-green-100 text-green-800 border-green-200',
  inaccuracy: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  mistake: 'bg-orange-100 text-orange-800 border-orange-200',
  blunder: 'bg-red-100 text-red-800 border-red-200',
}

const classificationLabels = {
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

type FilterOption = 'all' | 'inaccuracy' | 'mistake' | 'blunder'

export default function MoveList({ moves, onMoveClick, selectedMoveId }: MoveListProps) {
  const [filter, setFilter] = useState<FilterOption>('all')

  // Filter moves based on selection (using effective classification for checkmate handling)
  const filteredMoves = filter === 'all'
    ? moves
    : moves.filter(m => getEffectiveClassification(m) === filter)

  // Group moves into pairs (White, Black)
  // When filtering, we show moves individually rather than in pairs
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

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Move List</h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterOption)}
          className="text-sm text-gray-900 border border-gray-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Moves</option>
          <option value="inaccuracy">Inaccuracies</option>
          <option value="mistake">Mistakes</option>
          <option value="blunder">Blunders</option>
        </select>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {filter === 'all' ? (
          /* Normal paired view */
          <div className="grid grid-cols-3 gap-1 p-2 text-sm">
            {/* Header */}
            <div className="font-medium text-gray-600 text-center">Move</div>
            <div className="font-medium text-gray-600 text-center">White</div>
            <div className="font-medium text-gray-600 text-center">Black</div>

            {/* Move pairs */}
            {movePairs.map(({ whiteMove, blackMove, moveNumber }) => (
              <div key={moveNumber} className="contents">
                {/* Move number */}
                <div className="flex items-center justify-center text-gray-500 font-medium">
                  {moveNumber}.
                </div>

                {/* White move */}
                {(() => {
                  const effectiveClass = getEffectiveClassification(whiteMove)
                  const isCheckmateMove = isCheckmate(whiteMove)
                  return (
                    <div
                      id={`move-${whiteMove.id}`}
                      className={`p-2 rounded border transition-all duration-200 ease-in-out cursor-pointer hover:shadow-md ${
                        classificationColors[effectiveClass]
                      } ${selectedMoveId === whiteMove.id ? 'ring-2 ring-blue-500 ring-offset-1 scale-105' : 'hover:scale-[1.02]'}`}
                      onClick={() => onMoveClick(whiteMove.id, whiteMove.position_fen)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{whiteMove.move_san}</span>
                        <div className="flex flex-col items-end text-xs">
                          <span className={isCheckmateMove ? 'text-green-600 font-bold' : whiteMove.eval_delta < 0 ? 'text-red-600' : 'text-green-600'}>
                            {isCheckmateMove ? '#' : formatEval(whiteMove.eval_after)}
                          </span>
                          {!isCheckmateMove && whiteMove.eval_delta < -50 && (
                            <span className="text-red-500">
                              {formatEval(whiteMove.eval_delta)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs mt-1 opacity-75">
                        {isCheckmateMove ? 'Checkmate' : classificationLabels[effectiveClass]}
                      </div>
                    </div>
                  )
                })()}

                {/* Black move */}
                {blackMove ? (() => {
                  const effectiveClass = getEffectiveClassification(blackMove)
                  const isCheckmateMove = isCheckmate(blackMove)
                  return (
                    <div
                      id={`move-${blackMove.id}`}
                      className={`p-2 rounded border transition-all duration-200 ease-in-out cursor-pointer hover:shadow-md ${
                        classificationColors[effectiveClass]
                      } ${selectedMoveId === blackMove.id ? 'ring-2 ring-blue-500 ring-offset-1 scale-105' : 'hover:scale-[1.02]'}`}
                      onClick={() => onMoveClick(blackMove.id, blackMove.position_fen)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{blackMove.move_san}</span>
                        <div className="flex flex-col items-end text-xs">
                          <span className={isCheckmateMove ? 'text-green-600 font-bold' : blackMove.eval_delta < 0 ? 'text-red-600' : 'text-green-600'}>
                            {isCheckmateMove ? '#' : formatEval(blackMove.eval_after)}
                          </span>
                          {!isCheckmateMove && blackMove.eval_delta < -50 && (
                            <span className="text-red-500">
                              {formatEval(blackMove.eval_delta)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs mt-1 opacity-75">
                        {isCheckmateMove ? 'Checkmate' : classificationLabels[effectiveClass]}
                      </div>
                    </div>
                  )
                })() : (
                  <div />
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Filtered view - single column list */
          <div className="p-2 space-y-2">
            {filteredMoves.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No {filter}s in this game.
              </p>
            ) : (
              filteredMoves.map((move) => {
                const isWhiteMove = move.ply % 2 === 1
                const moveNumber = Math.ceil(move.ply / 2)
                const effectiveClass = getEffectiveClassification(move)
                const isCheckmateMove = isCheckmate(move)
                return (
                  <div
                    key={move.id}
                    id={`move-${move.id}`}
                    className={`p-3 rounded border transition-all duration-200 ease-in-out cursor-pointer hover:shadow-md ${
                      classificationColors[effectiveClass]
                    } ${selectedMoveId === move.id ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                    onClick={() => onMoveClick(move.id, move.position_fen)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500 font-medium">
                          {moveNumber}.{!isWhiteMove && '..'}
                        </span>
                        <span className="font-mono font-bold">{move.move_san}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                          {isWhiteMove ? 'White' : 'Black'}
                        </span>
                      </div>
                      <div className="flex flex-col items-end text-xs">
                        <span className={isCheckmateMove ? 'text-green-600 font-bold' : move.eval_delta < 0 ? 'text-red-600' : 'text-green-600'}>
                          {isCheckmateMove ? '#' : formatEval(move.eval_after)}
                        </span>
                        {!isCheckmateMove && move.eval_delta < -50 && (
                          <span className="text-red-500">
                            {formatEval(move.eval_delta)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs mt-1 opacity-75">
                      {isCheckmateMove ? 'Checkmate' : classificationLabels[effectiveClass]} • {move.piece_moved} • {move.phase}
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
