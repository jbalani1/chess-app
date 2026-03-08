'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useGlobalFilters } from '@/contexts/FilterContext'
import FilterChips from '@/components/mistakes/FilterChips'

interface MistakeMove {
  id: string
  game_id: string
  ply: number
  move_san: string
  move_uci: string
  eval_before: number
  eval_after: number
  eval_delta: number
  classification: 'mistake' | 'blunder'
  piece_moved: string
  phase: 'opening' | 'middlegame' | 'endgame'
  position_fen: string
  move_quality: string
  games: {
    id: string
    played_at: string
    white_player: string
    black_player: string
    opening_name: string
    eco: string
    time_control: string
    result: string
  }
}

const pieceNames: Record<string, string> = {
  P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King'
}

interface AllMistakesTabProps {
  initialClassification?: 'all' | 'mistake' | 'blunder'
}

export default function AllMistakesTab({ initialClassification = 'all' }: AllMistakesTabProps) {
  const { buildFilterParams } = useGlobalFilters()
  const [mistakes, setMistakes] = useState<MistakeMove[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  // Tab-specific filters (not global)
  const [classification, setClassification] = useState<'all' | 'mistake' | 'blunder'>(initialClassification)
  const [pieceMoved, setPieceMoved] = useState('')
  const [phase, setPhase] = useState('')

  // Pagination
  const [offset, setOffset] = useState(0)
  const limit = 50

  // Sort
  const [sortBy, setSortBy] = useState<string>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Search
  const [searchTerm, setSearchTerm] = useState('')

  // Quick filter chips
  const [activeChips, setActiveChips] = useState<string[]>([])

  const toggleChip = (chipId: string) => {
    setActiveChips(prev => prev.includes(chipId) ? prev.filter(c => c !== chipId) : [...prev, chipId])
  }

  const quickFilterChips = [
    { id: 'blunders', label: 'Blunders Only', apply: () => setClassification(activeChips.includes('blunders') ? 'all' : 'blunder') },
    { id: 'opening', label: 'Opening Phase', apply: () => setPhase(activeChips.includes('opening') ? '' : 'opening') },
    { id: 'endgame', label: 'Endgame', apply: () => setPhase(activeChips.includes('endgame') ? '' : 'endgame') },
    { id: 'queen', label: 'Queen Moves', apply: () => setPieceMoved(activeChips.includes('queen') ? '' : 'Q') },
  ]

  const fetchMistakes = useCallback(async () => {
    setLoading(true)
    try {
      const params = buildFilterParams()
      if (classification !== 'all') params.set('classification', classification)
      if (pieceMoved) params.set('piece_moved', pieceMoved)
      if (phase) params.set('phase', phase)
      if (sortBy) params.set('sortBy', sortBy)
      if (sortDir) params.set('sortDir', sortDir)
      params.set('limit', limit.toString())
      params.set('offset', offset.toString())

      const response = await fetch(`/api/mistakes/list?${params.toString()}`)
      const result = await response.json()

      if (result.data) {
        setMistakes(result.data)
        setTotal(result.total || 0)
      }
    } catch (error) {
      console.error('Error fetching mistakes:', error)
    } finally {
      setLoading(false)
    }
  }, [buildFilterParams, classification, pieceMoved, phase, sortBy, sortDir, offset])

  useEffect(() => {
    fetchMistakes()
  }, [fetchMistakes])

  useEffect(() => {
    setOffset(0)
  }, [classification, pieceMoved, phase, sortBy, sortDir])

  const formatEval = (evalValue: number) => {
    const cp = evalValue / 100
    return cp > 0 ? `+${cp.toFixed(1)}` : cp.toFixed(1)
  }

  const clearTabFilters = () => {
    setClassification('all')
    setPieceMoved('')
    setPhase('')
    setSearchTerm('')
  }

  // Client-side search filtering
  const filteredMistakes = searchTerm
    ? mistakes.filter(m =>
        m.move_san.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.games.opening_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.games.white_player?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.games.black_player?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : mistakes

  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Tab-specific filters */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Type</label>
            <select
              value={classification}
              onChange={(e) => setClassification(e.target.value as 'all' | 'mistake' | 'blunder')}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="mistake">Mistakes Only</option>
              <option value="blunder">Blunders Only</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Piece</label>
            <select
              value={pieceMoved}
              onChange={(e) => setPieceMoved(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="">All Pieces</option>
              {Object.entries(pieceNames).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Phase</label>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="">All Phases</option>
              <option value="opening">Opening</option>
              <option value="middlegame">Middlegame</option>
              <option value="endgame">Endgame</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="date">Date</option>
              <option value="eval_delta">Eval Loss</option>
              <option value="phase">Phase</option>
              <option value="piece">Piece</option>
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by move, opening, player..."
              className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
          <button
            onClick={clearTabFilters}
            className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] pb-2"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Quick filter chips */}
      <FilterChips chips={quickFilterChips} activeChips={activeChips} onToggle={toggleChip} />

      {/* Results count + pagination info */}
      <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
        <span>
          Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} mistakes
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-3 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-hover)] transition-colors text-sm"
            >
              Previous
            </button>
            <span className="text-[var(--text-secondary)]">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= total}
              className="px-3 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--bg-hover)] transition-colors text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Mistakes list */}
      <div className="card">
        {loading ? (
          <div className="px-5 py-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)] mx-auto" />
            <p className="mt-3 text-[var(--text-secondary)]">Loading mistakes...</p>
          </div>
        ) : filteredMistakes.length === 0 ? (
          <div className="px-5 py-12 text-center text-[var(--text-muted)]">
            No mistakes found with the current filters.
          </div>
        ) : (
          <div className="divide-y divide-[var(--divider-color)]">
            {filteredMistakes.map((mistake) => (
              <div key={mistake.id} className="px-5 py-4 hover:bg-[var(--bg-hover)] transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium ${
                        mistake.classification === 'blunder' ? 'bg-red-500/20 text-red-400' : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {mistake.classification === 'blunder' ? 'Blunder' : 'Mistake'}
                      </span>
                      <span className="text-base font-semibold text-[var(--text-primary)]">
                        Move {mistake.ply}: {mistake.move_san}
                      </span>
                      <span className="text-sm text-[var(--text-secondary)]">
                        {pieceNames[mistake.piece_moved] || mistake.piece_moved}
                      </span>
                      <span className="text-sm text-[var(--text-muted)] capitalize">{mistake.phase}</span>
                    </div>
                    <div className="text-sm text-[var(--text-secondary)] mb-2">
                      <span className="font-medium text-[var(--text-primary)]">{mistake.games.white_player}</span>
                      <span className="text-[var(--text-muted)]"> vs </span>
                      <span className="font-medium text-[var(--text-primary)]">{mistake.games.black_player}</span>
                      <span className="text-[var(--text-muted)]"> &bull; </span>
                      {mistake.games.opening_name} ({mistake.games.eco})
                      <span className="text-[var(--text-muted)]"> &bull; </span>
                      {new Date(mistake.games.played_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-[var(--text-secondary)]">
                        Eval: {formatEval(mistake.eval_before)} &rarr; {formatEval(mistake.eval_after)}
                      </span>
                      <span className={`font-semibold ${mistake.eval_delta < -300 ? 'text-[var(--color-blunder)]' : 'text-[var(--color-mistake)]'}`}>
                        &Delta; {formatEval(mistake.eval_delta)}
                      </span>
                      <span className="text-[var(--text-muted)]">
                        {mistake.games.time_control} &bull; {mistake.games.result}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <Link
                      href={`/games/${mistake.game_id}?move=${mistake.id}`}
                      className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] text-sm font-medium"
                    >
                      View Game &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
