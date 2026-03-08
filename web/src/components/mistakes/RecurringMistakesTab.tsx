'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Chess } from 'chess.js'
import { useGlobalFilters } from '@/contexts/FilterContext'
import AnalysisBoard from '@/components/AnalysisBoard'
import PatternMistakesView from '@/components/mistakes/PatternMistakesView'

interface RecurringMistakePosition {
  position_fen: string
  occurrence_count: number
  mistake_count: number
  blunder_count: number
  inaccuracy_count: number
  good_count: number
  mistake_rate: number
  avg_eval_delta: number
  last_mistake_date: string | null
  first_seen_date: string
  last_seen_date: string
  user_color: 'white' | 'black'
  phase: 'opening' | 'middlegame' | 'endgame'
  openings: { eco: string; name: string; count: number }[]
  primary_opening: { eco: string; name: string } | null
  moves: PositionMove[]
  recency_score: number
}

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
  opening_name: string
  eco: string
}

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

export default function RecurringMistakesTab() {
  const { color: globalColor } = useGlobalFilters()
  const [mode, setMode] = useState<'position' | 'pattern'>('position')
  const [positions, setPositions] = useState<RecurringMistakePosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPosition, setSelectedPosition] = useState<RecurringMistakePosition | null>(null)
  const [selectedMoveGroup, setSelectedMoveGroup] = useState<string | null>(null)
  const [selectedGameMove, setSelectedGameMove] = useState<PositionMove | null>(null)
  const [previousMoves, setPreviousMoves] = useState<PreviousMoveData[]>([])
  const [loadingGame, setLoadingGame] = useState(false)

  // Tab-specific filters
  const [minOccurrences, setMinOccurrences] = useState(2)
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [phaseFilter, setPhaseFilter] = useState<string>('all')
  const [ecoFilter, setEcoFilter] = useState<string>('')
  const [availableOpenings, setAvailableOpenings] = useState<{ eco: string; name: string }[]>([])

  useEffect(() => {
    const fetchPositions = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          minOccurrences: minOccurrences.toString(),
          limit: '100',
          dateFilter,
          color: globalColor,
          phase: phaseFilter,
        })
        if (ecoFilter) params.set('eco', ecoFilter)

        const response = await fetch(`/api/recurring-mistakes?${params}`)
        if (!response.ok) throw new Error('Failed to fetch recurring mistakes')
        const data = await response.json()
        setPositions(data)

        const openingsMap = new Map<string, { eco: string; name: string }>()
        for (const pos of data) {
          for (const opening of pos.openings) {
            if (opening.eco) openingsMap.set(opening.eco, { eco: opening.eco, name: opening.name })
          }
        }
        setAvailableOpenings(Array.from(openingsMap.values()).sort((a, b) => a.eco.localeCompare(b.eco)))

        if (data.length > 0 && !selectedPosition) setSelectedPosition(data[0])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchPositions()
  }, [minOccurrences, dateFilter, globalColor, phaseFilter, ecoFilter])

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

  const handleSelectGameInstance = (move: PositionMove) => {
    setSelectedGameMove(move)
    fetchGameMoves(move.game_id, move.ply)
  }

  const groupedMoves = selectedPosition?.moves.reduce((acc, move) => {
    if (!acc[move.move_san]) {
      acc[move.move_san] = {
        move_san: move.move_san, count: 0,
        classifications: { good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
        total_eval_delta: 0, moves: [], best_moves: new Set<string>(), last_mistake_date: null as string | null,
      }
    }
    const g = acc[move.move_san]
    g.count++
    g.classifications[move.classification as keyof typeof g.classifications]++
    g.total_eval_delta += move.eval_delta
    g.moves.push(move)
    if (move.best_move_san && move.best_move_san !== move.move_san) g.best_moves.add(move.best_move_san)
    if (move.classification === 'mistake' || move.classification === 'blunder') {
      if (!g.last_mistake_date || move.played_at > g.last_mistake_date) g.last_mistake_date = move.played_at
    }
    return acc
  }, {} as Record<string, { move_san: string; count: number; classifications: { good: number; inaccuracy: number; mistake: number; blunder: number }; total_eval_delta: number; moves: PositionMove[]; best_moves: Set<string>; last_mistake_date: string | null }>) || {}

  const sortedGroupedMoves = Object.values(groupedMoves).sort((a, b) => {
    const aP = a.classifications.blunder * 3 + a.classifications.mistake * 2 + a.classifications.inaccuracy
    const bP = b.classifications.blunder * 3 + b.classifications.mistake * 2 + b.classifications.inaccuracy
    return bP !== aP ? bP - aP : b.count - a.count
  })

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Mode toggle */}
      <div className="flex items-center gap-1 p-1 bg-[var(--bg-tertiary)] rounded-lg w-fit border border-[var(--border-color)]">
        <button
          onClick={() => setMode('position')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === 'position'
              ? 'bg-[var(--accent-primary)] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          By Position
        </button>
        <button
          onClick={() => setMode('pattern')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            mode === 'pattern'
              ? 'bg-[var(--accent-primary)] text-white shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          By Pattern
        </button>
      </div>

      {/* Shared Filters */}
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
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Phase</label>
            <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none">
              <option value="all">All phases</option>
              <option value="opening">Opening</option>
              <option value="middlegame">Middlegame</option>
              <option value="endgame">Endgame</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Opening</label>
            <select value={ecoFilter} onChange={(e) => setEcoFilter(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none min-w-[200px]">
              <option value="">All openings</option>
              <option value="A">A - Flank Openings</option>
              <option value="B">B - Semi-Open (1.e4)</option>
              <option value="C">C - Open Games (1.e4 e5)</option>
              <option value="D">D - Closed Games (1.d4 d5)</option>
              <option value="E">E - Indian Defenses</option>
              {availableOpenings.length > 0 && (
                <>
                  <option disabled>---</option>
                  {availableOpenings.map(o => (
                    <option key={o.eco} value={o.eco}>{o.eco} - {o.name}</option>
                  ))}
                </>
              )}
            </select>
          </div>
          {mode === 'position' && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Min Seen</label>
              <select value={minOccurrences} onChange={(e) => setMinOccurrences(parseInt(e.target.value))}
                className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none">
                <option value={2}>2+ times</option>
                <option value={3}>3+ times</option>
                <option value={5}>5+ times</option>
              </select>
            </div>
          )}
          {mode === 'position' && (
            <div className="ml-auto text-sm text-[var(--text-muted)]">
              {positions.length} recurring mistake{positions.length !== 1 ? 's' : ''} found
            </div>
          )}
        </div>
      </div>

      {mode === 'pattern' ? (
        <PatternMistakesView
          dateFilter={dateFilter}
          phaseFilter={phaseFilter}
          ecoFilter={ecoFilter}
          colorFilter={globalColor}
        />
      ) : (
      <>
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-400">{error}</div>
      )}

      {positions.length === 0 && !error ? (
        <div className="card p-8 text-center">
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No recurring mistakes found</h3>
          <p className="text-[var(--text-secondary)]">
            {dateFilter !== 'all' ? 'Try expanding the date range or adjusting other filters.' : 'No repeated mistakes detected.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Position List */}
          <div className="lg:col-span-1 card">
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Trouble Spots</h2>
            </div>
            <div className="max-h-[700px] overflow-y-auto">
              {positions.map((position, index) => {
                const recencyBadge = getRecencyBadge(position.last_mistake_date)
                return (
                  <button
                    key={position.position_fen}
                    onClick={() => { setSelectedPosition(position); setSelectedMoveGroup(null); setSelectedGameMove(null); setPreviousMoves([]) }}
                    className={`w-full text-left p-4 border-b border-[var(--divider-color)] hover:bg-[var(--bg-hover)] transition-colors ${
                      selectedPosition?.position_fen === position.position_fen ? 'bg-[var(--accent-primary)]/10 border-l-4 border-l-[var(--accent-primary)]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-[var(--text-muted)]">#{index + 1}</span>
                          {recencyBadge && (
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${recencyBadge.color}`}>{recencyBadge.text}</span>
                          )}
                        </div>
                        <div className="font-medium text-[var(--text-primary)] truncate">{position.primary_opening?.name || 'Unknown Opening'}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {position.primary_opening?.eco || ''} &middot; {position.phase} &middot; as {position.user_color}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-[var(--text-secondary)]">{position.occurrence_count}x seen</span>
                      <span className={`font-semibold ${getMistakeRateColor(position.mistake_rate)}`}>{position.mistake_rate}% fail</span>
                    </div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {position.blunder_count > 0 && <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs font-medium">{position.blunder_count} blunder{position.blunder_count > 1 ? 's' : ''}</span>}
                      {position.mistake_count > 0 && <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs font-medium">{position.mistake_count} mistake{position.mistake_count > 1 ? 's' : ''}</span>}
                    </div>
                    {position.last_mistake_date && (
                      <div className="text-xs text-[var(--text-muted)] mt-2">Last mistake: {formatDate(position.last_mistake_date)}</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Position Details */}
          <div className="lg:col-span-2">
            {selectedPosition ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="card p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-[var(--text-primary)]">{selectedPosition.primary_opening?.name || 'Unknown Opening'}</h2>
                      <div className="text-sm text-[var(--text-secondary)] flex items-center gap-2 mt-1">
                        <span className="font-mono bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-color)]">{selectedPosition.primary_opening?.eco || '?'}</span>
                        <span>&middot;</span>
                        <span className="capitalize">{selectedPosition.phase}</span>
                        <span>&middot;</span>
                        <span>Playing as {selectedPosition.user_color}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getMistakeRateColor(selectedPosition.mistake_rate)}`}>{selectedPosition.mistake_rate}%</div>
                      <div className="text-xs text-[var(--text-muted)]">mistake rate</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 p-3 bg-[var(--bg-tertiary)] rounded-lg text-center border border-[var(--border-color)]">
                    <div><div className="text-lg font-bold text-[var(--text-primary)]">{selectedPosition.occurrence_count}</div><div className="text-xs text-[var(--text-muted)]">times seen</div></div>
                    <div><div className="text-lg font-bold text-red-400">{selectedPosition.blunder_count + selectedPosition.mistake_count}</div><div className="text-xs text-[var(--text-muted)]">mistakes</div></div>
                    <div><div className="text-lg font-bold text-green-400">{selectedPosition.good_count}</div><div className="text-xs text-[var(--text-muted)]">correct</div></div>
                    <div><div className="text-lg font-bold text-[var(--text-secondary)]">{(selectedPosition.avg_eval_delta / 100).toFixed(1)}</div><div className="text-xs text-[var(--text-muted)]">avg loss</div></div>
                  </div>
                </div>

                {/* Board + Moves */}
                <div className="card p-5">
                  <div className="flex flex-col xl:flex-row gap-6">
                    <div className="flex-shrink-0">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                        Position Analysis
                        {selectedMoveGroup && <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">- {selectedMoveGroup}</span>}
                      </h3>
                      {selectedMoveGroup && (() => {
                        const group = sortedGroupedMoves.find(g => g.move_san === selectedMoveGroup)
                        if (!group || group.moves.length <= 1) return null
                        return (
                          <div className="mb-3 flex items-center gap-2 text-sm">
                            <span className="text-[var(--text-muted)]">Game:</span>
                            <div className="flex flex-wrap gap-1">
                              {group.moves.slice(0, 5).map((move) => (
                                <button key={move.id} onClick={() => handleSelectGameInstance(move)}
                                  className={`px-2 py-1 rounded text-xs ${selectedGameMove?.id === move.id ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border-color)]'}`}>
                                  {formatDate(move.played_at)}
                                </button>
                              ))}
                              {group.moves.length > 5 && <span className="text-xs text-[var(--text-muted)] self-center">+{group.moves.length - 5} more</span>}
                            </div>
                            {loadingGame && <span className="text-[var(--text-muted)] text-xs">loading...</span>}
                          </div>
                        )
                      })()}
                      <AnalysisBoard
                        fen={selectedPosition.position_fen}
                        width={450}
                        orientation={selectedPosition.user_color}
                        yourMove={selectedMoveGroup ? sanToUci(selectedPosition.position_fen, selectedMoveGroup) : null}
                        bestMove={(() => {
                          const group = selectedMoveGroup
                            ? sortedGroupedMoves.find(g => g.move_san === selectedMoveGroup)
                            : sortedGroupedMoves.find(g => g.best_moves.size > 0)
                          if (group && group.best_moves.size > 0) return sanToUci(selectedPosition.position_fen, Array.from(group.best_moves)[0])
                          return null
                        })()}
                        previousMoves={previousMoves}
                        showAnalysis={true}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Your Moves</h3>
                      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {sortedGroupedMoves.map((group) => {
                          const hasProblems = group.classifications.blunder + group.classifications.mistake + group.classifications.inaccuracy > 0
                          const avgDelta = group.total_eval_delta / group.count
                          const isSelected = selectedMoveGroup === group.move_san
                          return (
                            <button key={group.move_san}
                              onClick={() => {
                                if (isSelected) { setSelectedMoveGroup(null); setSelectedGameMove(null); setPreviousMoves([]) }
                                else { setSelectedMoveGroup(group.move_san); if (group.moves.length > 0) handleSelectGameInstance(group.moves[0]) }
                              }}
                              className={`w-full text-left p-3 rounded-lg border transition-all ${
                                isSelected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 ring-2 ring-[var(--accent-primary)]/30' :
                                hasProblems ? 'border-red-500/30 bg-red-500/10 hover:border-red-500/50' : 'border-green-500/30 bg-green-500/10 hover:border-green-500/50'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className="font-mono text-lg font-bold text-[var(--text-primary)]">{group.move_san}</span>
                                  <span className="text-xs text-[var(--text-muted)]">{group.count}x</span>
                                  {hasProblems && (
                                    <span className={`text-sm font-semibold ${avgDelta < -200 ? 'text-red-400' : avgDelta < -100 ? 'text-orange-400' : avgDelta < -50 ? 'text-yellow-400' : 'text-[var(--text-muted)]'}`}>
                                      {avgDelta > 0 ? '+' : ''}{(avgDelta / 100).toFixed(2)} avg
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {group.classifications.blunder > 0 && <span className="px-2 py-0.5 bg-red-600 text-white rounded text-xs font-medium">{group.classifications.blunder} blunder{group.classifications.blunder > 1 ? 's' : ''}</span>}
                                  {group.classifications.mistake > 0 && <span className="px-2 py-0.5 bg-orange-500 text-white rounded text-xs font-medium">{group.classifications.mistake} mistake{group.classifications.mistake > 1 ? 's' : ''}</span>}
                                  {group.classifications.good > 0 && !hasProblems && <span className="px-2 py-0.5 bg-green-500 text-white rounded text-xs font-medium">{group.classifications.good} good</span>}
                                </div>
                              </div>
                              {hasProblems && group.best_moves.size > 0 && (
                                <div className="mt-2 flex items-center gap-2 text-sm">
                                  <span className="text-[var(--text-muted)]">Better:</span>
                                  {Array.from(group.best_moves).slice(0, 2).map(bm => (
                                    <span key={bm} className="font-mono font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded">{bm}</span>
                                  ))}
                                </div>
                              )}
                              {hasProblems && (
                                <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                                  {group.moves.filter(m => m.classification !== 'good').sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime()).slice(0, 4).map(move => (
                                    <Link key={move.id} href={`/games/${move.game_id}?move=${move.id}`}
                                      className={`px-2 py-1 rounded text-xs font-medium ${classificationColors[move.classification]} hover:opacity-80 transition-opacity`}
                                      title={`${move.opening_name} - ${formatDate(move.played_at)}`}>
                                      {formatDate(move.played_at)} &rarr;
                                    </Link>
                                  ))}
                                  {group.moves.filter(m => m.classification !== 'good').length > 4 && (
                                    <span className="text-xs text-[var(--text-muted)] self-center">+{group.moves.filter(m => m.classification !== 'good').length - 4} more</span>
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

                {/* Study recommendation */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-400 mb-2">Study Recommendation</h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {selectedPosition.mistake_rate >= 75 ? (
                      <>This is a critical weak spot - you fail here {selectedPosition.mistake_rate}% of the time. Consider adding this to your drill routine.</>
                    ) : selectedPosition.mistake_rate >= 50 ? (
                      <>You struggle here more often than not. Review the games where you went wrong.</>
                    ) : (
                      <>You sometimes miss the best move here. Check what separates your good games from the mistakes.</>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="card p-8 text-center text-[var(--text-muted)]">Select a position from the list</div>
            )}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}
