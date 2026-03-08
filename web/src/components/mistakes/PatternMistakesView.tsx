'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Chess } from 'chess.js'
import type { PatternGroup, PatternExample } from '@/lib/types'
import AnalysisBoard from '@/components/AnalysisBoard'

interface PatternMistakesViewProps {
  dateFilter: string
  phaseFilter: string
  ecoFilter: string
  colorFilter: string
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

function sanToUci(fen: string, san: string): { from: string; to: string } | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move(san)
    if (move) return { from: move.from, to: move.to }
  } catch { /* invalid */ }
  return null
}

const trendInfo: Record<string, { arrow: string; color: string; label: string }> = {
  improving: { arrow: '\u2193', color: 'text-green-400', label: 'Improving' },
  stable: { arrow: '\u2192', color: 'text-yellow-400', label: 'Stable' },
  worsening: { arrow: '\u2191', color: 'text-red-400', label: 'Getting worse' },
}

const pieceNames: Record<string, string> = {
  p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King',
  P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King',
}

export default function PatternMistakesView({ dateFilter, phaseFilter, ecoFilter, colorFilter }: PatternMistakesViewProps) {
  const [patterns, setPatterns] = useState<PatternGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPattern, setSelectedPattern] = useState<PatternGroup | null>(null)
  const [selectedExample, setSelectedExample] = useState<PatternExample | null>(null)

  useEffect(() => {
    const fetchPatterns = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          limit: '50',
          dateFilter,
          color: colorFilter,
          phase: phaseFilter,
        })
        if (ecoFilter) params.set('eco', ecoFilter)

        const response = await fetch(`/api/recurring-mistakes/patterns?${params}`)
        if (!response.ok) throw new Error('Failed to fetch pattern mistakes')
        const data: PatternGroup[] = await response.json()
        setPatterns(data)

        if (data.length > 0) {
          setSelectedPattern(data[0])
          if (data[0].examples.length > 0) setSelectedExample(data[0].examples[0])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchPatterns()
  }, [dateFilter, colorFilter, phaseFilter, ecoFilter])

  const handleSelectPattern = (pattern: PatternGroup) => {
    setSelectedPattern(pattern)
    setSelectedExample(pattern.examples.length > 0 ? pattern.examples[0] : null)
  }

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  if (error) {
    return <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-400">{error}</div>
  }

  if (patterns.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No recurring patterns found</h3>
        <p className="text-[var(--text-secondary)]">
          {dateFilter !== 'all' ? 'Try expanding the date range or adjusting other filters.' : 'No repeated mistake patterns detected.'}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left panel - Pattern list */}
      <div className="lg:col-span-1 card">
        <div className="px-4 py-3 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Mistake Patterns</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{patterns.length} pattern{patterns.length !== 1 ? 's' : ''} found</p>
        </div>
        <div className="max-h-[700px] overflow-y-auto">
          {patterns.map((pattern) => {
            const trend = trendInfo[pattern.trend]
            const isSelected = selectedPattern?.blunder_category === pattern.blunder_category &&
                              selectedPattern?.phase === pattern.phase
            return (
              <button
                key={`${pattern.blunder_category}-${pattern.phase}`}
                onClick={() => handleSelectPattern(pattern)}
                className={`w-full text-left p-4 border-b border-[var(--divider-color)] hover:bg-[var(--bg-hover)] transition-colors ${
                  isSelected ? 'bg-[var(--accent-primary)]/10 border-l-4 border-l-[var(--accent-primary)]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg flex-shrink-0">{pattern.icon}</span>
                    <span className="font-medium text-[var(--text-primary)] truncate">{pattern.label}</span>
                  </div>
                  <span className={`text-sm font-semibold flex-shrink-0 ${trend.color}`} title={trend.label}>
                    {trend.arrow}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-[var(--text-secondary)]">{pattern.count}x</span>
                  <span className="text-[var(--text-muted)]">{(pattern.avg_eval_loss / 100).toFixed(1)} avg loss</span>
                  {pattern.recent_count > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-400">
                      {pattern.recent_count} recent
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right panel - Selected pattern details */}
      <div className="lg:col-span-2">
        {selectedPattern ? (
          <div className="space-y-4">
            {/* Header card */}
            <div className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="text-2xl">{selectedPattern.icon}</span>
                    {selectedPattern.label}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{selectedPattern.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-lg font-bold ${trendInfo[selectedPattern.trend].color}`}>
                    {trendInfo[selectedPattern.trend].arrow} {trendInfo[selectedPattern.trend].label}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 p-3 bg-[var(--bg-tertiary)] rounded-lg text-center border border-[var(--border-color)]">
                <div>
                  <div className="text-lg font-bold text-[var(--text-primary)]">{selectedPattern.count}</div>
                  <div className="text-xs text-[var(--text-muted)]">occurrences</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-red-400">{selectedPattern.recent_count}</div>
                  <div className="text-xs text-[var(--text-muted)]">last 30d</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-[var(--text-secondary)]">{(selectedPattern.avg_eval_loss / 100).toFixed(1)}</div>
                  <div className="text-xs text-[var(--text-muted)]">avg loss</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-[var(--text-muted)]">{selectedPattern.older_count}</div>
                  <div className="text-xs text-[var(--text-muted)]">prior 30d</div>
                </div>
              </div>

              {/* Piece breakdown */}
              {selectedPattern.piece_breakdown.length > 0 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-[var(--text-muted)]">Pieces involved:</span>
                  {selectedPattern.piece_breakdown.map(({ piece, count }) => (
                    <span key={piece} className="px-2 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-xs text-[var(--text-secondary)]">
                      {pieceNames[piece] || piece} ({count})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Example positions */}
            <div className="card p-5">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Worst Examples</h3>
              <div className="flex flex-col xl:flex-row gap-6">
                <div className="flex-shrink-0">
                  {/* Example selector */}
                  <div className="mb-3 flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-[var(--text-muted)]">Example:</span>
                    {selectedPattern.examples.map((ex, i) => (
                      <button
                        key={ex.move_id}
                        onClick={() => setSelectedExample(ex)}
                        className={`px-2 py-1 rounded text-xs ${
                          selectedExample?.move_id === ex.move_id
                            ? 'bg-[var(--accent-primary)] text-white'
                            : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)]'
                        }`}
                      >
                        #{i + 1} ({(Math.abs(ex.eval_delta) / 100).toFixed(1)})
                      </button>
                    ))}
                  </div>

                  {selectedExample && (
                    <AnalysisBoard
                      fen={selectedExample.fen}
                      width={450}
                      orientation="white"
                      yourMove={sanToUci(selectedExample.fen, selectedExample.move_san)}
                      bestMove={selectedExample.best_move_san ? sanToUci(selectedExample.fen, selectedExample.best_move_san) : null}
                      yourMoveSan={selectedExample.move_san}
                      bestMoveSan={selectedExample.best_move_san || undefined}
                      showAnalysis={true}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {selectedExample && (
                    <div className="space-y-3">
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-red-400">You played</span>
                          <span className="font-mono font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded">{selectedExample.move_san}</span>
                          <span className="text-sm text-[var(--text-muted)]">({(Math.abs(selectedExample.eval_delta) / 100).toFixed(1)} pawns lost)</span>
                        </div>
                        {selectedExample.best_move_san && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-semibold text-green-400">Best was</span>
                            <span className="font-mono font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">{selectedExample.best_move_san}</span>
                          </div>
                        )}
                      </div>

                      {selectedExample.explanation && (
                        <div className="p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg">
                          <div className="text-xs text-[var(--text-muted)] mb-1">Why this was wrong</div>
                          <p className="text-sm text-[var(--text-secondary)]">{selectedExample.explanation}</p>
                        </div>
                      )}

                      <div className="text-sm text-[var(--text-muted)] flex items-center gap-3">
                        <span>{formatDate(selectedExample.played_at)}</span>
                        <span>&middot;</span>
                        <span>{selectedExample.opening_name}</span>
                        <Link href={`/games/${selectedExample.game_id}?move=${selectedExample.move_id}`}
                          className="text-[var(--accent-primary)] hover:underline ml-auto">
                          View game &rarr;
                        </Link>
                      </div>

                      {/* All examples summary */}
                      <div className="mt-4 pt-4 border-t border-[var(--divider-color)]">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">All {selectedPattern.examples.length} worst instances</h4>
                        <div className="space-y-1.5">
                          {selectedPattern.examples.map((ex, i) => (
                            <button
                              key={ex.move_id}
                              onClick={() => setSelectedExample(ex)}
                              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between transition-colors ${
                                selectedExample?.move_id === ex.move_id
                                  ? 'bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30'
                                  : 'hover:bg-[var(--bg-hover)]'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-[var(--text-muted)]">#{i + 1}</span>
                                <span className="font-mono text-[var(--text-primary)]">{ex.move_san}</span>
                                <span className="text-xs text-[var(--text-muted)]">{pieceNames[ex.piece_moved] || ex.piece_moved}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-red-400 font-semibold">-{(Math.abs(ex.eval_delta) / 100).toFixed(1)}</span>
                                <span className="text-xs text-[var(--text-muted)]">{formatDate(ex.played_at)}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Training recommendation */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <h3 className="font-semibold text-amber-400 mb-2">Training Recommendation</h3>
              <p className="text-sm text-[var(--text-secondary)]">{selectedPattern.recommendation}</p>
              {selectedPattern.trend === 'worsening' && (
                <p className="text-sm text-red-400 mt-2">
                  This pattern is getting worse recently. Consider focused practice on this area.
                </p>
              )}
              {selectedPattern.trend === 'improving' && (
                <p className="text-sm text-green-400 mt-2">
                  Good news - you&apos;re making this mistake less often. Keep it up!
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-8 text-center text-[var(--text-muted)]">Select a pattern from the list</div>
        )}
      </div>
    </div>
  )
}
