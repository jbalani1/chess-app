'use client'

import { useState, useEffect } from 'react'
import ChessBoard from '@/components/ChessBoard'

interface PositionMove {
  id: string
  move_san: string
  classification: string
  eval_delta: number
  game_id: string
  ply: number
  piece_moved: string
  phase: string
  best_move_san: string | null
  played_at: string
}

interface CommonPosition {
  position_fen: string
  occurrence_count: number
  moves: PositionMove[]
  mistake_count: number
  blunder_count: number
  inaccuracy_count: number
  good_count: number
}

const classificationColors = {
  good: 'bg-green-500 text-white border-green-600',
  inaccuracy: 'bg-yellow-500 text-white border-yellow-600',
  mistake: 'bg-orange-500 text-white border-orange-600',
  blunder: 'bg-red-600 text-white border-red-700',
}

const classificationBadgeColors = {
  good: 'bg-green-500',
  inaccuracy: 'bg-yellow-500',
  mistake: 'bg-orange-500',
  blunder: 'bg-red-500',
}

export default function CommonPositionsPage() {
  const [positions, setPositions] = useState<CommonPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<CommonPosition | null>(null)
  const [minOccurrences, setMinOccurrences] = useState(2)
  const [showOnlyProblems, setShowOnlyProblems] = useState(true)
  const [dateFilter, setDateFilter] = useState<string>('all')

  useEffect(() => {
    fetchPositions()
  }, [minOccurrences])

  const fetchPositions = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/positions?minOccurrences=${minOccurrences}&limit=100`)
      if (!response.ok) throw new Error('Failed to fetch positions')
      const data = await response.json()
      setPositions(data)
      if (data.length > 0 && !selectedPosition) {
        setSelectedPosition(data[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Calculate date cutoff based on filter
  const getDateCutoff = () => {
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

  // Filter positions based on showOnlyProblems and date filter
  const filteredPositions = positions.filter(p => {
    // Filter by problems
    if (showOnlyProblems && p.mistake_count + p.blunder_count + p.inaccuracy_count === 0) {
      return false
    }

    // Filter by date - check if any mistake/blunder is within the date range
    const dateCutoff = getDateCutoff()
    if (dateCutoff) {
      const hasRecentMistake = p.moves.some(m =>
        (m.classification === 'mistake' || m.classification === 'blunder') &&
        new Date(m.played_at) >= dateCutoff
      )
      if (!hasRecentMistake) return false
    }

    return true
  })

  // Group moves by move_san for the selected position
  const groupedMoves = selectedPosition?.moves.reduce((acc, move) => {
    if (!acc[move.move_san]) {
      acc[move.move_san] = {
        move_san: move.move_san,
        count: 0,
        classifications: { good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
        total_eval_delta: 0,
        moves: [],
        best_moves: new Set<string>(),
        last_mistake_date: null as string | null
      }
    }
    acc[move.move_san].count++
    acc[move.move_san].classifications[move.classification as keyof typeof acc[typeof move.move_san]['classifications']]++
    acc[move.move_san].total_eval_delta += move.eval_delta
    acc[move.move_san].moves.push(move)
    if (move.best_move_san && move.best_move_san !== move.move_san) {
      acc[move.move_san].best_moves.add(move.best_move_san)
    }
    // Track most recent mistake/blunder date
    if (move.classification === 'mistake' || move.classification === 'blunder') {
      if (!acc[move.move_san].last_mistake_date || move.played_at > acc[move.move_san].last_mistake_date) {
        acc[move.move_san].last_mistake_date = move.played_at
      }
    }
    return acc
  }, {} as Record<string, {
    move_san: string
    count: number
    classifications: { good: number; inaccuracy: number; mistake: number; blunder: number }
    total_eval_delta: number
    moves: PositionMove[]
    best_moves: Set<string>
    last_mistake_date: string | null
  }>) || {}

  const sortedGroupedMoves = Object.values(groupedMoves).sort((a, b) => {
    // Sort by problem severity, then by count
    const aProblems = a.classifications.blunder * 3 + a.classifications.mistake * 2 + a.classifications.inaccuracy
    const bProblems = b.classifications.blunder * 3 + b.classifications.mistake * 2 + b.classifications.inaccuracy
    if (bProblems !== aProblems) return bProblems - aProblems
    return b.count - a.count
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-96 bg-gray-200 rounded"></div>
              <div className="h-96 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <a href="/" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Back to Dashboard
          </a>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">Common Positions</h1>
          <p className="text-gray-600">
            Positions you encounter frequently and the moves you make from them
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Occurrences</label>
              <select
                value={minOccurrences}
                onChange={(e) => setMinOccurrences(parseInt(e.target.value))}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white"
              >
                <option value={2}>2+ times</option>
                <option value={3}>3+ times</option>
                <option value={5}>5+ times</option>
                <option value={10}>10+ times</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Mistake</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white"
              >
                <option value="all">All time</option>
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 3 months</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="showOnlyProblems"
                checked={showOnlyProblems}
                onChange={(e) => setShowOnlyProblems(e.target.checked)}
                className="h-4 w-4 text-blue-600 rounded border-gray-300"
              />
              <label htmlFor="showOnlyProblems" className="ml-2 text-sm text-gray-700">
                Show only positions with mistakes
              </label>
            </div>
            <div className="ml-auto text-sm text-gray-500">
              {filteredPositions.length} positions found
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Position List */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Positions</h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {filteredPositions.length === 0 ? (
                <div className="p-4 text-gray-500 text-center">
                  No common positions found with the current filters.
                </div>
              ) : (
                filteredPositions.map((position, index) => (
                  <button
                    key={position.position_fen}
                    onClick={() => setSelectedPosition(position)}
                    className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      selectedPosition?.position_fen === position.position_fen ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        Position #{index + 1}
                      </span>
                      <span className="text-xs text-gray-500">
                        {position.occurrence_count}x
                      </span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {position.blunder_count > 0 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs">
                          {position.blunder_count} blunder{position.blunder_count > 1 ? 's' : ''}
                        </span>
                      )}
                      {position.mistake_count > 0 && (
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs">
                          {position.mistake_count} mistake{position.mistake_count > 1 ? 's' : ''}
                        </span>
                      )}
                      {position.inaccuracy_count > 0 && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                          {position.inaccuracy_count} inaccuracy
                        </span>
                      )}
                      {position.good_count > 0 && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs">
                          {position.good_count} good
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Selected Position Details */}
          <div className="lg:col-span-2">
            {selectedPosition ? (
              <div className="space-y-4">
                {/* Board + Problematic Moves Side by Side */}
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex flex-col xl:flex-row gap-6">
                    {/* Chess Board */}
                    <div className="flex-shrink-0">
                      <h2 className="text-lg font-medium text-gray-900 mb-3">Position</h2>
                      {(() => {
                        // Determine board orientation based on whose turn it is
                        // The FEN shows whose turn to move - that's the user's color in this position
                        const fenParts = selectedPosition.position_fen.split(' ')
                        const sideToMove = fenParts[1] || 'w'
                        const orientation = sideToMove === 'w' ? 'white' : 'black'
                        return (
                          <ChessBoard
                            fen={selectedPosition.position_fen}
                            width={320}
                            orientation={orientation}
                          />
                        )
                      })()}
                      <div className="mt-3 text-center text-sm text-gray-500">
                        Seen {selectedPosition.occurrence_count} times
                      </div>
                    </div>

                    {/* Problematic Moves - Right beside board */}
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-medium text-gray-900 mb-3">Your Moves</h2>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {sortedGroupedMoves.map((group) => {
                          const hasProblems = group.classifications.blunder + group.classifications.mistake + group.classifications.inaccuracy > 0
                          const avgEvalDelta = group.total_eval_delta / group.count

                          return (
                            <div
                              key={group.move_san}
                              className={`p-3 rounded-lg border ${
                                hasProblems ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-lg font-bold text-gray-900">
                                    {group.move_san}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {group.count}x
                                  </span>
                                  {hasProblems && (
                                    <span className={`text-sm font-semibold ${
                                      avgEvalDelta < -200 ? 'text-red-700' :
                                      avgEvalDelta < -100 ? 'text-orange-600' :
                                      avgEvalDelta < -50 ? 'text-yellow-600' : 'text-gray-600'
                                    }`}>
                                      {avgEvalDelta > 0 ? '+' : ''}{(avgEvalDelta / 100).toFixed(2)} avg
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {group.classifications.blunder > 0 && (
                                    <span className="px-2 py-0.5 bg-red-600 text-white rounded text-xs font-medium">
                                      {group.classifications.blunder} blunder{group.classifications.blunder > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {group.classifications.mistake > 0 && (
                                    <span className="px-2 py-0.5 bg-orange-500 text-white rounded text-xs font-medium">
                                      {group.classifications.mistake} mistake{group.classifications.mistake > 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {group.classifications.inaccuracy > 0 && (
                                    <span className="px-2 py-0.5 bg-yellow-500 text-white rounded text-xs font-medium">
                                      {group.classifications.inaccuracy} inaccuracy
                                    </span>
                                  )}
                                  {group.classifications.good > 0 && !hasProblems && (
                                    <span className="px-2 py-0.5 bg-green-500 text-white rounded text-xs font-medium">
                                      {group.classifications.good} good
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Best move suggestion and last mistake date */}
                              {hasProblems && (
                                <div className="mt-2 flex items-center justify-between text-sm">
                                  <div className="flex items-center gap-2">
                                    {group.best_moves.size > 0 && (
                                      <>
                                        <span className="text-gray-500">Better:</span>
                                        {Array.from(group.best_moves).slice(0, 2).map((bestMove) => (
                                          <span key={bestMove} className="font-mono font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
                                            {bestMove}
                                          </span>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                  {group.last_mistake_date && (
                                    <span className="text-gray-700 text-sm font-medium">
                                      Last: {new Date(group.last_mistake_date).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Game links for problematic moves with eval delta */}
                              {hasProblems && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {group.moves
                                    .filter(m => m.classification !== 'good')
                                    .sort((a, b) => a.eval_delta - b.eval_delta)
                                    .slice(0, 4)
                                    .map((move) => (
                                      <a
                                        key={move.id}
                                        href={`/games/${move.game_id}?move=${move.id}`}
                                        className={`px-2 py-1 rounded text-xs font-medium ${classificationColors[move.classification as keyof typeof classificationColors]} hover:opacity-80 transition-opacity`}
                                      >
                                        {(move.eval_delta / 100).toFixed(1)} →
                                      </a>
                                    ))}
                                  {group.moves.filter(m => m.classification !== 'good').length > 4 && (
                                    <span className="text-xs text-gray-500 self-center">
                                      +{group.moves.filter(m => m.classification !== 'good').length - 4} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Insight - Compact */}
                {sortedGroupedMoves.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-medium text-blue-900 mb-2">Analysis</h3>
                    <div className="text-sm text-blue-800 flex flex-wrap gap-x-6 gap-y-1">
                      {(() => {
                        const totalMoves = selectedPosition.moves.length
                        const problemMoves = selectedPosition.mistake_count + selectedPosition.blunder_count + selectedPosition.inaccuracy_count
                        const problemRate = ((problemMoves / totalMoves) * 100).toFixed(0)
                        const mostPlayedMove = sortedGroupedMoves[0]
                        const bestMove = [...sortedGroupedMoves].sort((a, b) =>
                          (b.classifications.good / b.count) - (a.classifications.good / a.count)
                        )[0]

                        return (
                          <>
                            <span>Mistake rate: <strong>{problemRate}%</strong></span>
                            <span>Most played: <strong>{mostPlayedMove.move_san}</strong> ({mostPlayedMove.count}x)</span>
                            {bestMove && bestMove.classifications.good > 0 && (
                              <span>Best move: <strong>{bestMove.move_san}</strong> ({Math.round((bestMove.classifications.good / bestMove.count) * 100)}% good)</span>
                            )}
                            {problemMoves > totalMoves * 0.5 && (
                              <span className="text-red-700 font-medium">Trouble spot - study this!</span>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                Select a position from the list to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
