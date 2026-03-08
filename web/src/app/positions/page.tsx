'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Chess } from 'chess.js'
import AnalysisBoard from '@/components/AnalysisBoard'

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

function sanToUci(fen: string, san: string): { from: string; to: string } | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move(san)
    if (move) return { from: move.from, to: move.to }
  } catch { /* invalid */ }
  return null
}

export default function CommonPositionsPage() {
  const [positions, setPositions] = useState<CommonPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<CommonPosition | null>(null)
  const [selectedMoveGroup, setSelectedMoveGroup] = useState<string | null>(null)
  const [minOccurrences, setMinOccurrences] = useState(2)
  const [showOnlyProblems, setShowOnlyProblems] = useState(true)
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [phaseFilter, setPhaseFilter] = useState<string>('all')


  const fetchPositions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/positions?minOccurrences=${minOccurrences}&limit=100&phase=${phaseFilter}`)
      if (!response.ok) throw new Error('Failed to fetch positions')
      const data = await response.json()
      setPositions(data)
      if (data.length > 0) {
        setSelectedPosition((prev) => prev || data[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [minOccurrences, phaseFilter])

  useEffect(() => {
    fetchPositions()
  }, [fetchPositions])

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

  const filteredPositions = positions.filter(p => {
    if (showOnlyProblems && p.mistake_count + p.blunder_count + p.inaccuracy_count === 0) {
      return false
    }
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
    if (move.classification === 'mistake' || move.classification === 'blunder') {
      const current = acc[move.move_san].last_mistake_date
      if (!current || move.played_at > current) {
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
    const aProblems = a.classifications.blunder * 3 + a.classifications.mistake * 2 + a.classifications.inaccuracy
    const bProblems = b.classifications.blunder * 3 + b.classifications.mistake * 2 + b.classifications.inaccuracy
    if (bProblems !== aProblems) return bProblems - aProblems
    return b.count - a.count
  })

  // Auto-select the first problematic move when position changes so arrows show immediately
  useEffect(() => {
    if (sortedGroupedMoves.length > 0) {
      const firstProblem = sortedGroupedMoves.find(g =>
        g.classifications.blunder + g.classifications.mistake + g.classifications.inaccuracy > 0
      )
      setSelectedMoveGroup(firstProblem ? firstProblem.move_san : sortedGroupedMoves[0].move_san)
    } else {
      setSelectedMoveGroup(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPosition?.position_fen])

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto animate-fadeIn">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-[var(--bg-tertiary)] rounded-2xl w-1/3"></div>
          <div className="h-14 bg-[var(--bg-tertiary)] rounded-2xl w-full"></div>
          <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_280px] gap-5">
            <div className="h-[500px] bg-[var(--bg-tertiary)] rounded-2xl"></div>
            <div className="h-[560px] bg-[var(--bg-tertiary)] rounded-2xl"></div>
            <div className="h-[500px] bg-[var(--bg-tertiary)] rounded-2xl"></div>
          </div>
        </div>
      </div>
    )
  }

  const selectedIndex = selectedPosition
    ? filteredPositions.findIndex(p => p.position_fen === selectedPosition.position_fen)
    : -1

  return (
    <div className="max-w-[1400px] mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] text-sm font-medium mb-3">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Dashboard
        </Link>
        <h1 className="text-4xl font-extrabold text-[var(--text-primary)]">Common Positions</h1>
        <p className="text-[var(--text-secondary)] text-lg mt-1">
          Positions you see often and how you play them
        </p>
      </div>

      {/* Filters */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Filters</h2>
          {(minOccurrences !== 2 || phaseFilter !== 'all' || dateFilter !== 'all' || !showOnlyProblems) && (
            <button
              onClick={() => { setMinOccurrences(2); setPhaseFilter('all'); setDateFilter('all'); setShowOnlyProblems(true) }}
              className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Min Games</label>
            <select
              value={minOccurrences}
              onChange={(e) => setMinOccurrences(parseInt(e.target.value))}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value={2}>2+ times</option>
              <option value={3}>3+ times</option>
              <option value={5}>5+ times</option>
              <option value={10}>10+ times</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Phase</label>
            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="all">All phases</option>
              <option value="opening">Opening</option>
              <option value="middlegame">Middlegame</option>
              <option value="endgame">Endgame</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Recency</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="all">All time</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="90days">Last 3 months</option>
            </select>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
            <input
              type="checkbox"
              checked={showOnlyProblems}
              onChange={(e) => setShowOnlyProblems(e.target.checked)}
              className="h-4 w-4 rounded text-[var(--accent-primary)] border-[var(--border-color)] bg-[var(--bg-tertiary)]"
            />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Mistakes only
            </span>
          </label>
          <div className="ml-auto text-sm text-[var(--text-muted)]">
            {filteredPositions.length} position{filteredPositions.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400 mb-6 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Main 3-column layout: Positions | Board | Your Moves */}
      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_280px] gap-5">

        {/* LEFT — Positions List */}
        <div className="rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] overflow-hidden xl:order-1 order-2">
          <div className="px-5 py-4 border-b border-[var(--border-color)]">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Positions</h2>
          </div>
          <div className="max-h-[600px] xl:max-h-[calc(100vh-280px)] overflow-y-auto">
            {filteredPositions.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)]">
                No positions found.
              </div>
            ) : (
              filteredPositions.map((position, index) => {
                const isSelected = selectedPosition?.position_fen === position.position_fen
                return (
                  <button
                    key={position.position_fen}
                    onClick={() => setSelectedPosition(position)}
                    className={`w-full text-left px-5 py-4 border-b border-[var(--divider-color)] transition-all ${
                      isSelected
                        ? 'bg-[var(--accent-primary)]/15 border-l-4 border-l-[var(--accent-primary)]'
                        : 'border-l-4 border-l-transparent hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className={`text-base font-bold ${isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                        Position {index + 1}
                      </span>
                      <span className="text-sm font-semibold text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-2.5 py-0.5 rounded-full">
                        {position.occurrence_count}x
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {position.blunder_count > 0 && (
                        <span className="px-2.5 py-1 bg-red-500/20 text-red-400 rounded-lg text-sm font-semibold">
                          {position.blunder_count} blunder{position.blunder_count > 1 ? 's' : ''}
                        </span>
                      )}
                      {position.mistake_count > 0 && (
                        <span className="px-2.5 py-1 bg-orange-500/20 text-orange-400 rounded-lg text-sm font-semibold">
                          {position.mistake_count} mistake{position.mistake_count > 1 ? 's' : ''}
                        </span>
                      )}
                      {position.inaccuracy_count > 0 && (
                        <span className="px-2.5 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-semibold">
                          {position.inaccuracy_count} inaccuracy
                        </span>
                      )}
                      {position.good_count > 0 && (
                        <span className="px-2.5 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm font-semibold">
                          {position.good_count} good
                        </span>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* CENTER — Chessboard with AnalysisBoard */}
        <div className="xl:order-2 order-1">
          {selectedPosition ? (
            <div className="rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] p-6">
              <div className="flex flex-col items-center">
                {(() => {
                  const fenParts = selectedPosition.position_fen.split(' ')
                  const sideToMove = fenParts[1] || 'w'
                  const orientation = sideToMove === 'w' ? 'white' : 'black'

                  // Build yourMove and bestMove from selectedMoveGroup
                  const yourMove = selectedMoveGroup
                    ? sanToUci(selectedPosition.position_fen, selectedMoveGroup)
                    : null
                  const bestMove = (() => {
                    const group = selectedMoveGroup
                      ? sortedGroupedMoves.find(g => g.move_san === selectedMoveGroup)
                      : sortedGroupedMoves.find(g => g.best_moves.size > 0)
                    if (group && group.best_moves.size > 0) {
                      return sanToUci(selectedPosition.position_fen, Array.from(group.best_moves)[0])
                    }
                    return null
                  })()

                  // Get SAN names for the hint text
                  const selectedGroup = selectedMoveGroup
                    ? sortedGroupedMoves.find(g => g.move_san === selectedMoveGroup)
                    : null
                  const bestMoveSan = selectedGroup && selectedGroup.best_moves.size > 0
                    ? Array.from(selectedGroup.best_moves)[0]
                    : undefined

                  return (
                    <div className="w-full max-w-[560px]">
                      <AnalysisBoard
                        key={selectedPosition.position_fen + (selectedMoveGroup || '')}
                        fen={selectedPosition.position_fen}
                        width={560}
                        orientation={orientation}
                        yourMove={yourMove}
                        bestMove={bestMove}
                        yourMoveSan={selectedMoveGroup || undefined}
                        bestMoveSan={bestMoveSan}
                        showAnalysis={true}
                        animateMove={false}
                      />
                    </div>
                  )
                })()}

                {/* Stats below board */}
                <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                  <span className="text-base text-[var(--text-secondary)]">
                    Seen <strong className="text-[var(--text-primary)]">{selectedPosition.occurrence_count}</strong> times
                  </span>
                  {selectedIndex >= 0 && (
                    <span className="text-sm text-[var(--text-muted)]">
                      Position {selectedIndex + 1} of {filteredPositions.length}
                    </span>
                  )}
                  {(() => {
                    const totalMoves = selectedPosition.moves.length
                    const problemMoves = selectedPosition.mistake_count + selectedPosition.blunder_count + selectedPosition.inaccuracy_count
                    if (totalMoves === 0) return null
                    const rate = Math.round((problemMoves / totalMoves) * 100)
                    return (
                      <span className={`text-sm font-semibold ${rate > 50 ? 'text-red-400' : rate > 25 ? 'text-orange-400' : 'text-green-400'}`}>
                        {rate}% mistake rate
                      </span>
                    )
                  })()}
                </div>

                {/* Prev / Next */}
                {filteredPositions.length > 1 && (
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={() => {
                        const idx = selectedIndex > 0 ? selectedIndex - 1 : filteredPositions.length - 1
                        setSelectedPosition(filteredPositions[idx])
                      }}
                      className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => {
                        const idx = selectedIndex < filteredPositions.length - 1 ? selectedIndex + 1 : 0
                        setSelectedPosition(filteredPositions[idx])
                      }}
                      className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors text-sm font-medium"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] p-12 text-center text-[var(--text-muted)] text-lg">
              Select a position from the list to view details
            </div>
          )}
        </div>

        {/* RIGHT — Your Moves */}
        <div className="rounded-2xl bg-[var(--bg-tertiary)] border border-[var(--border-color)] overflow-hidden xl:order-3 order-3">
          <div className="px-5 py-4 border-b border-[var(--border-color)]">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Your Moves
            </h2>
            {selectedPosition && (
              <p className="text-base text-[var(--text-secondary)] mt-0.5">
                {sortedGroupedMoves.length} move{sortedGroupedMoves.length !== 1 ? 's' : ''} played
              </p>
            )}
          </div>
          <div className="max-h-[600px] xl:max-h-[calc(100vh-280px)] overflow-y-auto">
            {!selectedPosition ? (
              <div className="p-8 text-center text-[var(--text-muted)] text-sm">
                Select a position to see your moves.
              </div>
            ) : sortedGroupedMoves.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)] text-sm">
                No moves recorded.
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {sortedGroupedMoves.map((group) => {
                  const hasProblems = group.classifications.blunder + group.classifications.mistake + group.classifications.inaccuracy > 0
                  const avgEvalDelta = group.total_eval_delta / group.count
                  const isSelected = selectedMoveGroup === group.move_san

                  return (
                    <button
                      key={group.move_san}
                      onClick={() => setSelectedMoveGroup(isSelected ? null : group.move_san)}
                      className={`w-full text-left rounded-xl p-5 border-2 transition-all ${
                        isSelected
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 ring-2 ring-[var(--accent-primary)]/30'
                          : hasProblems
                            ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
                            : 'border-green-500/30 bg-green-500/5 hover:bg-green-500/10'
                      }`}
                    >
                      {/* Row 1: Move name + avg eval */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-baseline gap-2.5">
                          <span className="font-mono text-2xl font-extrabold text-white leading-none">
                            {group.move_san}
                          </span>
                          <span className="text-sm font-semibold text-[var(--text-muted)]">
                            {group.count}x
                          </span>
                        </div>
                        <span className={`font-mono text-xl font-extrabold tabular-nums ${
                          !hasProblems ? 'text-green-400' :
                          avgEvalDelta < -200 ? 'text-red-400' :
                          avgEvalDelta < -100 ? 'text-orange-400' :
                          avgEvalDelta < -50 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                          {avgEvalDelta > 0 ? '+' : ''}{(avgEvalDelta / 100).toFixed(1)}
                        </span>
                      </div>

                      {/* Row 2: Classification badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {group.classifications.blunder > 0 && (
                          <span className="px-2.5 py-1 bg-red-500 text-white rounded-lg text-sm font-bold">
                            {group.classifications.blunder} blunder{group.classifications.blunder > 1 ? 's' : ''}
                          </span>
                        )}
                        {group.classifications.mistake > 0 && (
                          <span className="px-2.5 py-1 bg-orange-500 text-white rounded-lg text-sm font-bold">
                            {group.classifications.mistake} mistake{group.classifications.mistake > 1 ? 's' : ''}
                          </span>
                        )}
                        {group.classifications.inaccuracy > 0 && (
                          <span className="px-2.5 py-1 bg-yellow-500 text-yellow-950 rounded-lg text-sm font-bold">
                            {group.classifications.inaccuracy} inaccuracy
                          </span>
                        )}
                        {group.classifications.good > 0 && (
                          <span className="px-2.5 py-1 bg-green-500 text-white rounded-lg text-sm font-bold">
                            {group.classifications.good} good
                          </span>
                        )}
                      </div>

                      {/* Row 3: Best move suggestion — THE KEY TAKEAWAY */}
                      {hasProblems && group.best_moves.size > 0 && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2.5 mb-3">
                          <span className="text-sm font-semibold text-green-400">Try instead </span>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {Array.from(group.best_moves).slice(0, 2).map((bestMove) => (
                              <span key={bestMove} className="font-mono text-lg font-extrabold text-green-400 bg-green-500/20 px-3 py-1 rounded-lg">
                                {bestMove}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Row 4: Eval breakdown + last mistake date */}
                      {hasProblems && (() => {
                        const problemMoves = group.moves
                          .filter(m => m.classification !== 'good')
                          .sort((a, b) => a.eval_delta - b.eval_delta)
                        if (problemMoves.length === 0) return null
                        return (
                          <div className="pt-3 border-t border-[var(--divider-color)]" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-baseline justify-between mb-1.5">
                              <div className="text-sm text-[var(--text-secondary)]">
                                Eval: {problemMoves.slice(0, 4).map((m, i) => (
                                  <span key={m.id}>
                                    {i > 0 && <span className="text-[var(--text-muted)]"> / </span>}
                                    <a
                                      href={`/games/${m.game_id}?move=${m.id}`}
                                      className={`font-mono font-bold hover:underline ${
                                        m.classification === 'blunder' ? 'text-red-400' :
                                        m.classification === 'mistake' ? 'text-orange-400' :
                                        'text-yellow-400'
                                      }`}
                                    >
                                      {(m.eval_delta / 100).toFixed(1)}
                                    </a>
                                  </span>
                                ))}
                                {problemMoves.length > 4 && (
                                  <span className="text-[var(--text-muted)]"> +{problemMoves.length - 4} more</span>
                                )}
                              </div>
                            </div>
                            {group.last_mistake_date && (
                              <div className="mt-1.5">
                                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-400 bg-orange-500/15 px-2.5 py-1 rounded-lg">
                                  Last mistake: {new Date(group.last_mistake_date).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
