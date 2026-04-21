'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Chess } from 'chess.js'
import { useGlobalFilters } from '@/contexts/FilterContext'
import AnalysisBoard from '@/components/AnalysisBoard'
import { TACTIC_ICONS, TACTIC_NAMES, TACTIC_COLORS } from '@/components/TacticCard'
import type { TacticType } from '@/app/api/tactics/missed/route'

// --- Types matching API response ---

interface MotifVulnerability {
  tactic_type: string
  count: number
  total_eval_loss: number
  avg_eval_loss: number
  recent_count: number
  older_count: number
  trend: 'improving' | 'stable' | 'worsening'
  top_openings: { eco: string; opening_name: string; count: number }[]
  phases: { phase: string; count: number }[]
}

interface OpeningMotifLink {
  eco: string
  opening_name: string
  games_played: number
  motifs: { tactic_type: string; count: number; avg_eval_loss: number }[]
  total_missed: number
  worst_motif: string
}

interface StudyPosition {
  move_id: string
  game_id: string
  position_fen: string
  move_san: string
  best_move_san: string | null
  best_move_uci: string | null
  eval_delta: number
  tactic_type: string
  tactic_description: string
  tactic_squares: string[]
  phase: string
  user_color: 'white' | 'black'
  opening_name: string
  eco: string
  played_at: string
  priority_score: number
}

interface WeaknessProfileData {
  motifs: MotifVulnerability[]
  opening_motifs: OpeningMotifLink[]
  study_queue: StudyPosition[]
}

// --- Helpers ---

const trendInfo: Record<string, { arrow: string; color: string; label: string }> = {
  improving: { arrow: '\u2193', color: 'text-green-400', label: 'Improving' },
  stable: { arrow: '\u2192', color: 'text-yellow-400', label: 'Stable' },
  worsening: { arrow: '\u2191', color: 'text-red-400', label: 'Getting worse' },
}

const TACTIC_RECOMMENDATIONS: Record<string, string> = {
  fork: 'Practice looking for squares where your piece can attack two valuable targets simultaneously, especially knight forks.',
  pin: 'Pins immobilize pieces. Look for opportunities where a piece is pinned to a more valuable one behind it.',
  skewer: 'A skewer forces a valuable piece to move, exposing a piece behind it. Watch for these with rooks and bishops.',
  discovered_attack: 'When you move a piece, check if it reveals an attack from another piece. Discovered checks are especially powerful.',
  back_rank: 'Always ensure your king has an escape square (luft). Watch for back rank threats when the king is boxed in by pawns.',
  removal_of_defender: 'If a piece is defending something critical, consider capturing it. The defender must be removed before the real target falls.',
  zwischenzug: 'Before making the expected reply, check if there is a stronger "in-between" move, especially a check or a threat.',
  deflection: 'Force a defender away from its duty by attacking it. The defender has to choose which piece to save.',
}

function sanToUci(fen: string, san: string): { from: string; to: string } | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move(san)
    if (move) return { from: move.from, to: move.to }
  } catch { /* invalid */ }
  return null
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

// --- Component ---

export default function WeaknessProfileTab() {
  const { color: globalColor } = useGlobalFilters()

  const [data, setData] = useState<WeaknessProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [phaseFilter, setPhaseFilter] = useState<string>('all')

  // Selection state
  const [selectedMotif, setSelectedMotif] = useState<string | null>(null)
  const [selectedOpening, setSelectedOpening] = useState<OpeningMotifLink | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<StudyPosition | null>(null)

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          dateFilter,
          color: globalColor,
          phase: phaseFilter,
        })
        const response = await fetch(`/api/weakness-profile?${params}`)
        if (!response.ok) throw new Error('Failed to fetch weakness profile')
        const result: WeaknessProfileData = await response.json()
        setData(result)

        // Auto-select first motif if available
        if (result.motifs.length > 0 && !selectedMotif) {
          setSelectedMotif(result.motifs[0].tactic_type)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [dateFilter, globalColor, phaseFilter])

  // Reset opening selection when motif changes
  useEffect(() => {
    setSelectedOpening(null)
  }, [selectedMotif])

  // Derived: filtered openings based on selected motif
  const filteredOpenings = data?.opening_motifs.filter((om) => {
    if (!selectedMotif) return true
    return om.motifs.some((m) => m.tactic_type === selectedMotif)
  }) || []

  // Derived: filtered study positions based on selected motif and/or opening
  const filteredPositions = data?.study_queue.filter((sp) => {
    if (selectedMotif && sp.tactic_type !== selectedMotif) return false
    if (selectedOpening && (sp.eco !== selectedOpening.eco || sp.opening_name !== selectedOpening.opening_name)) return false
    return true
  }) || []

  // Auto-select first position when filters change
  useEffect(() => {
    if (filteredPositions.length > 0) {
      setSelectedPosition(filteredPositions[0])
    } else {
      setSelectedPosition(null)
    }
  }, [selectedMotif, selectedOpening])

  // Get recommendation text
  const getRecommendation = (): string => {
    if (!data || data.motifs.length === 0) return ''
    const worst = data.motifs[0]
    const name = TACTIC_NAMES[worst.tactic_type as TacticType] || worst.tactic_type
    const specific = TACTIC_RECOMMENDATIONS[worst.tactic_type] || ''
    return `Your biggest tactical blind spot is ${name} (${worst.count} missed, averaging ${(worst.avg_eval_loss / 100).toFixed(1)} pawns lost each time). ${specific}`
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

  if (!data || data.motifs.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No tactical weaknesses found</h3>
        <p className="text-[var(--text-secondary)]">
          {dateFilter !== 'all' ? 'Try expanding the date range or adjusting filters.' : 'No missed tactics detected in your games yet. Run the missed tactics backfill to analyze your games.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-end">
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
          <div className="ml-auto text-sm text-[var(--text-muted)]">
            {data.motifs.reduce((sum, m) => sum + m.count, 0)} missed tactics across {data.motifs.length} motif types
          </div>
        </div>
      </div>

      {/* Section A: Motif Vulnerability Ranking */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Tactical Blind Spots</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {data.motifs.map((motif) => {
            const tt = motif.tactic_type as TacticType
            const isSelected = selectedMotif === motif.tactic_type
            const trend = trendInfo[motif.trend]
            const tacticColor = TACTIC_COLORS[tt] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
            const topOpening = motif.top_openings.length > 0 ? motif.top_openings[0] : null
            return (
              <button
                key={motif.tactic_type}
                onClick={() => setSelectedMotif(isSelected ? null : motif.tactic_type)}
                className={`flex-shrink-0 w-48 p-4 rounded-lg border transition-all text-left ${
                  isSelected
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 ring-2 ring-[var(--accent-primary)]/30'
                    : 'border-[var(--border-color)] bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)]/50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded border text-xs font-medium ${tacticColor}`}>
                    <span className="mr-1">{TACTIC_ICONS[tt]}</span>
                    {TACTIC_NAMES[tt] || motif.tactic_type}
                  </span>
                  <span className={`text-lg font-bold ${trend.color}`} title={trend.label}>
                    {trend.arrow}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-2xl font-bold text-[var(--text-primary)]">{motif.count}</span>
                  <span className="text-xs text-[var(--text-muted)]">missed</span>
                </div>
                <div className="text-xs text-[var(--text-muted)] mb-2">
                  {(motif.avg_eval_loss / 100).toFixed(1)} avg pawn loss
                </div>
                {topOpening && (
                  <div className="text-xs text-[var(--text-secondary)] truncate">
                    Most common in {topOpening.opening_name}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Sections B & C: Opening breakdown + Study Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section B: Left panel - Opening x Motif breakdown */}
        <div className="lg:col-span-1 card">
          <div className="px-4 py-3 border-b border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {selectedMotif
                ? `${TACTIC_NAMES[selectedMotif as TacticType] || selectedMotif} by Opening`
                : 'Openings & Motifs'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {filteredOpenings.length} opening{filteredOpenings.length !== 1 ? 's' : ''}
              {selectedMotif && <span> &middot; click to filter study positions</span>}
            </p>
          </div>
          <div className="max-h-[50vh] md:max-h-[600px] overflow-y-auto">
            {filteredOpenings.length === 0 ? (
              <div className="p-4 text-center text-[var(--text-muted)] text-sm">
                No openings match the current filters.
              </div>
            ) : !selectedMotif ? (
              /* Matrix view: each opening shows which motif types appear as chips */
              filteredOpenings.map((om) => {
                const isSelected = selectedOpening?.eco === om.eco && selectedOpening?.opening_name === om.opening_name
                return (
                  <button
                    key={`${om.eco}-${om.opening_name}`}
                    onClick={() => setSelectedOpening(isSelected ? null : om)}
                    className={`w-full text-left p-4 border-b border-[var(--divider-color)] hover:bg-[var(--bg-hover)] transition-colors ${
                      isSelected ? 'bg-[var(--accent-primary)]/10 border-l-4 border-l-[var(--accent-primary)]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)]">
                        {om.eco}
                      </span>
                      <span className="font-medium text-[var(--text-primary)] truncate">{om.opening_name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {om.motifs.map((m) => {
                        const chipColor = TACTIC_COLORS[m.tactic_type as TacticType] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                        return (
                          <span
                            key={m.tactic_type}
                            className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs ${chipColor}`}
                          >
                            <span className="mr-0.5">{TACTIC_ICONS[m.tactic_type as TacticType]}</span>
                            {m.count}
                          </span>
                        )
                      })}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {om.total_missed} total missed &middot; {om.games_played} game{om.games_played !== 1 ? 's' : ''}
                    </div>
                  </button>
                )
              })
            ) : (
              /* Filtered view: openings where the selected motif occurs */
              filteredOpenings.map((om) => {
                const motifData = om.motifs.find((m) => m.tactic_type === selectedMotif)
                const isSelected = selectedOpening?.eco === om.eco && selectedOpening?.opening_name === om.opening_name
                return (
                  <button
                    key={`${om.eco}-${om.opening_name}`}
                    onClick={() => setSelectedOpening(isSelected ? null : om)}
                    className={`w-full text-left p-4 border-b border-[var(--divider-color)] hover:bg-[var(--bg-hover)] transition-colors ${
                      isSelected ? 'bg-[var(--accent-primary)]/10 border-l-4 border-l-[var(--accent-primary)]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)]">
                          {om.eco}
                        </span>
                        <span className="font-medium text-[var(--text-primary)] truncate">{om.opening_name}</span>
                      </div>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs flex-shrink-0 ${TACTIC_COLORS[om.worst_motif as TacticType] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                        {TACTIC_ICONS[om.worst_motif as TacticType]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-[var(--text-secondary)]">{motifData?.count || 0} missed</span>
                      <span className="text-[var(--text-muted)]">
                        {motifData ? (motifData.avg_eval_loss / 100).toFixed(1) : '0.0'} avg loss
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Section C: Right panel - Study Positions */}
        <div className="lg:col-span-2">
          {filteredPositions.length > 0 ? (
            <div className="space-y-4">
              {/* Position detail card */}
              {selectedPosition && (
                <div className="card p-5">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                    Study Position
                    <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
                      {selectedMotif && (TACTIC_NAMES[selectedMotif as TacticType] || selectedMotif)}
                      {selectedOpening && ` in ${selectedOpening.opening_name}`}
                    </span>
                  </h3>
                  <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
                    <div className="w-full lg:w-auto lg:flex-shrink-0">
                      <AnalysisBoard
                        fen={selectedPosition.position_fen}
                        width={400}
                        orientation={selectedPosition.user_color}
                        yourMove={sanToUci(selectedPosition.position_fen, selectedPosition.move_san)}
                        bestMove={selectedPosition.best_move_san ? sanToUci(selectedPosition.position_fen, selectedPosition.best_move_san) : null}
                        yourMoveSan={selectedPosition.move_san}
                        bestMoveSan={selectedPosition.best_move_san || undefined}
                        showAnalysis={true}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Tactic info */}
                      <div className={`inline-flex items-center px-2 py-1 rounded border text-xs font-medium mb-3 ${TACTIC_COLORS[selectedPosition.tactic_type as TacticType] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                        <span className="mr-1">{TACTIC_ICONS[selectedPosition.tactic_type as TacticType]}</span>
                        {TACTIC_NAMES[selectedPosition.tactic_type as TacticType] || selectedPosition.tactic_type}
                      </div>

                      {/* Move comparison */}
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-red-400">You played</span>
                          <span className="font-mono font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded">
                            {selectedPosition.move_san}
                          </span>
                          <span className="text-sm text-[var(--text-muted)]">
                            ({(Math.abs(selectedPosition.eval_delta) / 100).toFixed(1)} pawns lost)
                          </span>
                        </div>
                        {selectedPosition.best_move_san && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm font-semibold text-green-400">Best was</span>
                            <span className="font-mono font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">
                              {selectedPosition.best_move_san}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Tactic description */}
                      {selectedPosition.tactic_description && (
                        <div className="p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg mb-3">
                          <div className="text-xs text-[var(--text-muted)] mb-1">Tactic Explanation</div>
                          <p className="text-sm text-[var(--text-secondary)]">{selectedPosition.tactic_description}</p>
                        </div>
                      )}

                      {/* Meta */}
                      <div className="text-sm text-[var(--text-muted)] flex items-center gap-3 mb-4">
                        <span>{formatDate(selectedPosition.played_at)}</span>
                        <span>&middot;</span>
                        <span className="font-mono text-xs">{selectedPosition.eco}</span>
                        <span>{selectedPosition.opening_name}</span>
                        <Link
                          href={`/games/${selectedPosition.game_id}?move=${selectedPosition.move_id}`}
                          className="text-[var(--accent-primary)] hover:underline ml-auto"
                        >
                          View game &rarr;
                        </Link>
                      </div>

                      {/* Position list */}
                      <div className="border-t border-[var(--divider-color)] pt-3">
                        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-2">
                          All Study Positions ({filteredPositions.length})
                        </h4>
                        <div className="space-y-1.5 max-h-[40vh] md:max-h-[280px] overflow-y-auto pr-1">
                          {filteredPositions.map((pos, i) => {
                            const isActive = selectedPosition?.move_id === pos.move_id
                            const posColor = TACTIC_COLORS[pos.tactic_type as TacticType] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            return (
                              <button
                                key={pos.move_id}
                                onClick={() => setSelectedPosition(pos)}
                                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between transition-colors ${
                                  isActive
                                    ? 'bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30'
                                    : 'hover:bg-[var(--bg-hover)]'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs text-[var(--text-muted)]">#{i + 1}</span>
                                  <span className={`inline-flex items-center px-1 py-0.5 rounded border text-xs ${posColor}`}>
                                    {TACTIC_ICONS[pos.tactic_type as TacticType]}
                                  </span>
                                  <span className="font-mono text-[var(--text-primary)]">
                                    {pos.move_san}
                                  </span>
                                  <span className="text-xs text-[var(--text-muted)] truncate">{pos.opening_name}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-xs text-red-400 font-semibold">
                                    -{(Math.abs(pos.eval_delta) / 100).toFixed(1)}
                                  </span>
                                  <span className="text-xs text-[var(--text-muted)]">{formatDate(pos.played_at)}</span>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!selectedPosition && (
                <div className="card p-8 text-center text-[var(--text-muted)]">
                  Select a position from the list to study
                </div>
              )}
            </div>
          ) : (
            <div className="card p-8 text-center">
              <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No study positions</h3>
              <p className="text-[var(--text-secondary)]">
                {selectedMotif || selectedOpening
                  ? 'No positions match the current motif and opening selection. Try broadening your filters.'
                  : 'Select a tactical motif or opening to view study positions.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Training recommendation */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <h3 className="font-semibold text-amber-400 mb-2">Training Recommendation</h3>
        <p className="text-sm text-[var(--text-secondary)]">{getRecommendation()}</p>
        {data.motifs.length > 0 && data.motifs[0].trend === 'worsening' && (
          <p className="text-sm text-red-400 mt-2">
            Your biggest weakness ({TACTIC_NAMES[data.motifs[0].tactic_type as TacticType] || data.motifs[0].tactic_type}) is getting worse recently. Prioritize targeted practice on these patterns.
          </p>
        )}
        {data.motifs.length > 0 && data.motifs[0].trend === 'improving' && (
          <p className="text-sm text-green-400 mt-2">
            Good progress on {TACTIC_NAMES[data.motifs[0].tactic_type as TacticType] || data.motifs[0].tactic_type} &mdash; keep practicing to solidify the improvement.
          </p>
        )}
        {selectedMotif && selectedOpening && (
          <p className="text-sm text-[var(--text-secondary)] mt-2">
            Focus area: {TACTIC_NAMES[selectedMotif as TacticType] || selectedMotif} patterns in the {selectedOpening.opening_name} ({selectedOpening.eco}).
            Review the {filteredPositions.length} study position{filteredPositions.length !== 1 ? 's' : ''} above.
          </p>
        )}
      </div>
    </div>
  )
}
