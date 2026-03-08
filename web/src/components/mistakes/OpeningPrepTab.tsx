'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Chess } from 'chess.js'
import { useGlobalFilters } from '@/contexts/FilterContext'
import AnalysisBoard from '@/components/AnalysisBoard'
import type { OpeningPattern, TroublePosition, MoveChoice } from '@/lib/types'

interface PreviousMoveData {
  fen: string
  san: string
  ply: number
}

interface GameMove {
  id: string
  ply: number
  move_san: string
  position_fen: string
  classification: string
}

const classificationColors: Record<string, string> = {
  good: 'bg-green-500 text-white',
  inaccuracy: 'bg-yellow-500 text-white',
  mistake: 'bg-orange-500 text-white',
  blunder: 'bg-red-600 text-white',
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return date.toLocaleDateString()
}

function getMistakeRateColor(rate: number): string {
  if (rate >= 75) return 'text-red-400'
  if (rate >= 50) return 'text-orange-400'
  if (rate >= 25) return 'text-yellow-400'
  return 'text-[var(--text-muted)]'
}

function getRecencyBadge(lastMistakeDate: string | null): { text: string; color: string } | null {
  if (!lastMistakeDate) return null
  const diffDays = Math.floor((Date.now() - new Date(lastMistakeDate).getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 7) return { text: 'Recent', color: 'bg-red-500/20 text-red-400' }
  if (diffDays <= 30) return { text: 'This month', color: 'bg-orange-500/20 text-orange-400' }
  return null
}

function sanToUci(fen: string, san: string): { from: string; to: string } | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move(san)
    if (move) return { from: move.from, to: move.to }
  } catch { /* invalid */ }
  return null
}

export default function OpeningPrepTab() {
  const { color: globalColor } = useGlobalFilters()
  const [openings, setOpenings] = useState<OpeningPattern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOpening, setSelectedOpening] = useState<OpeningPattern | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<TroublePosition | null>(null)
  const [selectedMoveChoice, setSelectedMoveChoice] = useState<MoveChoice | null>(null)
  const [previousMoves, setPreviousMoves] = useState<PreviousMoveData[]>([])
  const [loadingGame, setLoadingGame] = useState(false)

  // Tab-specific filters
  const [minOccurrences, setMinOccurrences] = useState(2)
  const [dateFilter, setDateFilter] = useState<string>('all')

  useEffect(() => {
    const fetchOpeningPatterns = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          minOccurrences: minOccurrences.toString(),
          limit: '20',
          dateFilter,
          color: globalColor,
        })

        const response = await fetch(`/api/opening-patterns?${params}`)
        if (!response.ok) throw new Error('Failed to fetch opening patterns')
        const data: OpeningPattern[] = await response.json()
        setOpenings(data)

        if (data.length > 0 && !selectedOpening) {
          setSelectedOpening(data[0])
          if (data[0].trouble_positions.length > 0) {
            setSelectedPosition(data[0].trouble_positions[0])
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchOpeningPatterns()
  }, [minOccurrences, dateFilter, globalColor])

  const fetchGameMoves = async (gameId: string, targetPly: number) => {
    setLoadingGame(true)
    try {
      const response = await fetch(`/api/analysis/${gameId}`)
      if (!response.ok) throw new Error('Failed to fetch game')
      const data = await response.json()
      const moves: PreviousMoveData[] = data.moves
        .filter((m: GameMove) => m.ply < targetPly)
        .sort((a: GameMove, b: GameMove) => a.ply - b.ply)
        .map((m: GameMove) => ({ fen: m.position_fen, san: m.move_san, ply: m.ply }))
      setPreviousMoves(moves)
    } catch { setPreviousMoves([]) }
    finally { setLoadingGame(false) }
  }

  const handleSelectOpening = (opening: OpeningPattern) => {
    setSelectedOpening(opening)
    setSelectedMoveChoice(null)
    setPreviousMoves([])
    if (opening.trouble_positions.length > 0) {
      setSelectedPosition(opening.trouble_positions[0])
    } else {
      setSelectedPosition(null)
    }
  }

  const handleSelectPosition = (position: TroublePosition) => {
    setSelectedPosition(position)
    setSelectedMoveChoice(null)
    setPreviousMoves([])
  }

  const handleSelectMoveChoice = (mc: MoveChoice) => {
    setSelectedMoveChoice(mc)
    if (mc.game_instances.length > 0) {
      fetchGameMoves(mc.game_instances[0].game_id, selectedPosition?.typical_ply || 1)
    }
  }

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Recency</label>
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none">
              <option value="all">All time</option>
              <option value="7days">Last 7 days</option>
              <option value="30days">Last 30 days</option>
              <option value="90days">Last 3 months</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Min Seen</label>
            <select value={minOccurrences} onChange={(e) => setMinOccurrences(parseInt(e.target.value))}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none">
              <option value={2}>2+ times</option>
              <option value={3}>3+ times</option>
              <option value={5}>5+ times</option>
            </select>
          </div>
          <div className="ml-auto text-sm text-[var(--text-muted)]">
            {openings.length} opening{openings.length !== 1 ? 's' : ''} with trouble spots
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-400">{error}</div>
      )}

      {openings.length === 0 && !error ? (
        <div className="card p-8 text-center">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No opening trouble spots found</h3>
          <p className="text-[var(--text-secondary)]">
            {dateFilter !== 'all' ? 'Try expanding the date range or lowering minimum occurrences.' : 'No recurring opening mistakes detected.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Opening List - Left Sidebar */}
          <div className="lg:col-span-1 card">
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Openings</h2>
            </div>
            <div className="max-h-[700px] overflow-y-auto">
              {openings.map((opening) => {
                // Find the most recent mistake date across all trouble positions
                const latestMistakeDate = opening.trouble_positions.reduce((latest: string | null, tp) => {
                  if (!tp.last_mistake_date) return latest
                  if (!latest || tp.last_mistake_date > latest) return tp.last_mistake_date
                  return latest
                }, null)
                const recencyBadge = getRecencyBadge(latestMistakeDate)

                return (
                  <button
                    key={`${opening.eco}-${opening.opening_name}-${opening.user_color}`}
                    onClick={() => handleSelectOpening(opening)}
                    className={`w-full text-left p-4 border-b border-[var(--divider-color)] hover:bg-[var(--bg-hover)] transition-colors ${
                      selectedOpening?.eco === opening.eco && selectedOpening?.opening_name === opening.opening_name && selectedOpening?.user_color === opening.user_color
                        ? 'bg-[var(--accent-primary)]/10 border-l-4 border-l-[var(--accent-primary)]'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)]">{opening.eco}</span>
                          {recencyBadge && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${recencyBadge.color}`}>{recencyBadge.text}</span>
                          )}
                        </div>
                        <div className="font-medium text-[var(--text-primary)] truncate mt-1">{opening.opening_name}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          as {opening.user_color} &middot; {opening.games_played} game{opening.games_played !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-[var(--text-secondary)]">{opening.trouble_positions.length} weak spot{opening.trouble_positions.length !== 1 ? 's' : ''}</span>
                      <span className={`font-semibold ${getMistakeRateColor(opening.opening_mistake_rate)}`}>{opening.opening_mistake_rate}% fail</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Opening Details - Right Panel */}
          <div className="lg:col-span-2">
            {selectedOpening ? (
              <div className="space-y-4">
                {/* Header Card */}
                <div className="card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--text-primary)]">{selectedOpening.opening_name}</h2>
                      <div className="text-sm text-[var(--text-secondary)] flex items-center gap-2 mt-1">
                        <span className="font-mono bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)]">{selectedOpening.eco}</span>
                        <span>&middot;</span>
                        <span>Playing as {selectedOpening.user_color}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getMistakeRateColor(selectedOpening.opening_mistake_rate)}`}>{selectedOpening.opening_mistake_rate}%</div>
                      <div className="text-xs text-[var(--text-muted)]">mistake rate</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 p-3 bg-[var(--bg-tertiary)] rounded-lg text-center border border-[var(--border-color)]">
                    <div><div className="text-lg font-bold text-[var(--text-primary)]">{selectedOpening.games_played}</div><div className="text-xs text-[var(--text-muted)]">games</div></div>
                    <div><div className="text-lg font-bold text-red-400">{selectedOpening.trouble_positions.length}</div><div className="text-xs text-[var(--text-muted)]">trouble spots</div></div>
                    <div><div className="text-lg font-bold text-orange-400">{selectedOpening.trouble_positions.reduce((s, tp) => s + tp.mistake_count + tp.blunder_count, 0)}</div><div className="text-xs text-[var(--text-muted)]">total mistakes</div></div>
                    <div>
                      <div className="text-lg font-bold text-[var(--text-secondary)]">
                        {(selectedOpening.trouble_positions.reduce((s, tp) => s + tp.avg_eval_delta, 0) / (selectedOpening.trouble_positions.length || 1) / 100).toFixed(1)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">avg loss</div>
                    </div>
                  </div>
                </div>

                {/* Trouble Positions */}
                <div className="card p-5">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Trouble Positions by Move</h3>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                    {selectedOpening.trouble_positions.map((tp) => {
                      const isSelected = selectedPosition?.position_fen === tp.position_fen
                      return (
                        <button
                          key={tp.position_fen}
                          onClick={() => handleSelectPosition(tp)}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            isSelected
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 ring-2 ring-[var(--accent-primary)]/30'
                              : 'border-[var(--border-color)] bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)]/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[var(--text-primary)]">Move {tp.move_number}</span>
                              <span className="text-xs text-[var(--text-muted)]">{tp.occurrence_count}x seen</span>
                            </div>
                            <span className={`font-semibold text-sm ${getMistakeRateColor(tp.mistake_rate)}`}>{tp.mistake_rate}% fail</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            {tp.your_moves.slice(0, 2).map((mc) => {
                              const hasProblem = mc.classifications.blunder + mc.classifications.mistake > 0
                              return (
                                <span key={mc.move_san} className={`font-mono px-1.5 py-0.5 rounded text-xs ${hasProblem ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                  {mc.move_san} ({mc.count}x)
                                </span>
                              )
                            })}
                            {tp.your_moves.length > 2 && <span className="text-xs text-[var(--text-muted)]">+{tp.your_moves.length - 2} more</span>}
                            {(() => {
                              const bestMoves = tp.your_moves.filter(mc => mc.best_move_san && mc.best_move_san !== mc.move_san)
                              const bestMove = bestMoves.length > 0 ? bestMoves[0].best_move_san : null
                              if (!bestMove) return null
                              return (
                                <span className="text-xs text-[var(--text-muted)]">
                                  Better: <span className="font-mono font-bold text-green-400">{bestMove}</span>
                                </span>
                              )
                            })()}
                          </div>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {tp.blunder_count > 0 && <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">{tp.blunder_count} blunder{tp.blunder_count > 1 ? 's' : ''}</span>}
                            {tp.mistake_count > 0 && <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">{tp.mistake_count} mistake{tp.mistake_count > 1 ? 's' : ''}</span>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Board + Move Choices for selected position */}
                {selectedPosition && (
                  <div className="card p-5">
                    <div className="flex flex-col xl:flex-row gap-6">
                      <div className="flex-shrink-0">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                          Move {selectedPosition.move_number} Analysis
                          {selectedMoveChoice && <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">- {selectedMoveChoice.move_san}</span>}
                        </h3>
                        {selectedMoveChoice && selectedMoveChoice.game_instances.length > 1 && (
                          <div className="mb-3 flex items-center gap-2 text-sm">
                            <span className="text-[var(--text-muted)]">Game:</span>
                            <div className="flex flex-wrap gap-1">
                              {selectedMoveChoice.game_instances.slice(0, 5).map((gi, idx) => (
                                <button key={gi.move_id} onClick={() => fetchGameMoves(gi.game_id, selectedPosition.typical_ply)}
                                  className={`px-2 py-1 rounded text-xs ${idx === 0 && !loadingGame ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)]'}`}>
                                  {formatDate(gi.played_at)}
                                </button>
                              ))}
                              {selectedMoveChoice.game_instances.length > 5 && <span className="text-xs text-[var(--text-muted)] self-center">+{selectedMoveChoice.game_instances.length - 5} more</span>}
                            </div>
                            {loadingGame && <span className="text-[var(--text-muted)] text-xs">loading...</span>}
                          </div>
                        )}
                        <AnalysisBoard
                          fen={selectedPosition.position_fen}
                          width={450}
                          orientation={selectedOpening.user_color}
                          yourMove={selectedMoveChoice ? sanToUci(selectedPosition.position_fen, selectedMoveChoice.move_san) : null}
                          bestMove={(() => {
                            const mc = selectedMoveChoice || selectedPosition.your_moves.find(m => m.best_move_san && m.best_move_san !== m.move_san)
                            if (mc?.best_move_san) return sanToUci(selectedPosition.position_fen, mc.best_move_san)
                            return null
                          })()}
                          yourMoveSan={selectedMoveChoice?.move_san}
                          bestMoveSan={(() => {
                            const mc = selectedMoveChoice || selectedPosition.your_moves.find(m => m.best_move_san && m.best_move_san !== m.move_san)
                            return mc?.best_move_san || undefined
                          })()}
                          previousMoves={previousMoves}
                          showAnalysis={true}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Your Moves</h3>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                          {selectedPosition.your_moves.map((mc) => {
                            const hasProblems = mc.classifications.blunder + mc.classifications.mistake + mc.classifications.inaccuracy > 0
                            const isSelected = selectedMoveChoice?.move_san === mc.move_san
                            return (
                              <button key={mc.move_san}
                                onClick={() => {
                                  if (isSelected) { setSelectedMoveChoice(null); setPreviousMoves([]) }
                                  else { handleSelectMoveChoice(mc) }
                                }}
                                className={`w-full text-left p-3 rounded-lg border transition-all ${
                                  isSelected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 ring-2 ring-[var(--accent-primary)]/30' :
                                  hasProblems ? 'border-red-500/30 bg-red-500/10 hover:border-red-500/50' : 'border-green-500/30 bg-green-500/10 hover:border-green-500/50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-lg font-bold text-[var(--text-primary)]">{mc.move_san}</span>
                                    <span className="text-xs text-[var(--text-muted)]">{mc.count}x</span>
                                    {hasProblems && (
                                      <span className={`text-sm font-semibold ${mc.avg_eval_delta < -200 ? 'text-red-400' : mc.avg_eval_delta < -100 ? 'text-orange-400' : mc.avg_eval_delta < -50 ? 'text-yellow-400' : 'text-[var(--text-muted)]'}`}>
                                        {mc.avg_eval_delta > 0 ? '+' : ''}{(mc.avg_eval_delta / 100).toFixed(2)} avg
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {mc.classifications.blunder > 0 && <span className="px-2 py-0.5 bg-red-600 text-white rounded text-xs font-medium">{mc.classifications.blunder} blunder{mc.classifications.blunder > 1 ? 's' : ''}</span>}
                                    {mc.classifications.mistake > 0 && <span className="px-2 py-0.5 bg-orange-500 text-white rounded text-xs font-medium">{mc.classifications.mistake} mistake{mc.classifications.mistake > 1 ? 's' : ''}</span>}
                                    {mc.classifications.good > 0 && !hasProblems && <span className="px-2 py-0.5 bg-green-500 text-white rounded text-xs font-medium">{mc.classifications.good} good</span>}
                                  </div>
                                </div>
                                {hasProblems && mc.best_move_san && mc.best_move_san !== mc.move_san && (
                                  <div className="mt-2 flex items-center gap-2 text-sm">
                                    <span className="text-[var(--text-muted)]">Better:</span>
                                    <span className="font-mono font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">{mc.best_move_san}</span>
                                  </div>
                                )}
                                {hasProblems && (
                                  <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                                    {mc.game_instances
                                      .filter(gi => {
                                        // Show instances that were mistakes/blunders (negative eval delta)
                                        return gi.eval_delta < -50
                                      })
                                      .slice(0, 4)
                                      .map(gi => (
                                        <Link key={gi.move_id} href={`/games/${gi.game_id}?move=${gi.move_id}`}
                                          className="px-2 py-1 rounded text-xs font-medium bg-orange-500 text-white hover:opacity-80 transition-opacity"
                                          title={formatDate(gi.played_at)}>
                                          {formatDate(gi.played_at)} &rarr;
                                        </Link>
                                      ))}
                                    {mc.game_instances.filter(gi => gi.eval_delta < -50).length > 4 && (
                                      <span className="text-xs text-[var(--text-muted)] self-center">+{mc.game_instances.filter(gi => gi.eval_delta < -50).length - 4} more</span>
                                    )}
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Study recommendation */}
                {selectedOpening.trouble_positions.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                    <h3 className="font-semibold text-amber-400 mb-2">Study Recommendation</h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {selectedOpening.opening_mistake_rate >= 50 ? (
                        <>The {selectedOpening.opening_name} is a major weak spot &mdash; you make mistakes in {selectedOpening.opening_mistake_rate}% of these positions. Focus on moves {selectedOpening.trouble_positions.map(tp => tp.move_number).join(', ')}.</>
                      ) : selectedOpening.trouble_positions.length >= 3 ? (
                        <>You have {selectedOpening.trouble_positions.length} trouble spots in this opening. Review each position and memorize the correct continuations.</>
                      ) : (
                        <>Review the highlighted positions to patch your opening preparation in the {selectedOpening.opening_name}.</>
                      )}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-8 text-center text-[var(--text-muted)]">Select an opening from the list</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
