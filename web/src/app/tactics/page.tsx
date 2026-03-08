'use client'

import { useState, useEffect, useCallback } from 'react'
import TacticCard, { TACTIC_ICONS, TACTIC_NAMES } from '@/components/TacticCard'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { TacticType, MissedTacticsResponse } from '@/app/api/tactics/missed/route'
import SectionHeader from '@/components/ui/SectionHeader'

// Tactic types in display order
const TACTIC_TYPES: TacticType[] = [
  'fork',
  'pin',
  'skewer',
  'discovered_attack',
  'back_rank',
  'removal_of_defender',
  'zwischenzug',
  'deflection'
]

// Training recommendations for each tactic type
const TACTIC_RECOMMENDATIONS: Record<TacticType, string> = {
  fork: 'Practice knight forks especially - they\'re the most common. Look for squares where your piece can attack two valuable targets.',
  pin: 'Pins are powerful because the attacked piece cannot move. Look for opportunities to pin pieces to the king or queen.',
  skewer: 'A skewer is the opposite of a pin - attack a valuable piece to win the one behind it. Most common with rooks and bishops.',
  discovered_attack: 'Discovered attacks are devastating. Move a piece to reveal an attack from another piece, especially discovered checks.',
  back_rank: 'Always ensure your king has an escape square (luft). Look for back rank threats when the opponent\'s king is castled.',
  removal_of_defender: 'If a piece is defending something valuable, consider capturing it first. This often wins material.',
  zwischenzug: 'Before making an expected move, check if there\'s a stronger "in-between" move, especially a check.',
  deflection: 'Force a defender away from its duty by attacking it. The defender must move, leaving its target unprotected.'
}

interface TacticSummaryCardProps {
  type: TacticType
  count: number
  isSelected: boolean
  onClick: () => void
}

function TacticSummaryCard({ type, count, isSelected, onClick }: TacticSummaryCardProps) {
  const icon = TACTIC_ICONS[type]
  const name = TACTIC_NAMES[type]

  return (
    <button
      onClick={onClick}
      className={`
        p-3 rounded-lg border transition-all text-left w-full
        ${isSelected
          ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
          : 'border-[var(--border-color)] bg-[var(--bg-tertiary)] hover:border-[var(--bg-hover)] hover:bg-[var(--bg-hover)]'
        }
      `}
    >
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-primary)]">{icon}</span>
        <div className="min-w-0">
          <div className="font-medium text-[var(--text-primary)] text-sm truncate">{name}</div>
          <div className={`text-xs ${count > 0 ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>
            {count} missed
          </div>
        </div>
      </div>
    </button>
  )
}

export default function TacticsPage() {
  const [data, setData] = useState<MissedTacticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<TacticType | 'all'>('all')

  // Filters
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [colorFilter, setColorFilter] = useState<string>('all')
  const [phaseFilter, setPhaseFilter] = useState<string>('all')
  const [ecoFilter, setEcoFilter] = useState<string>('')

  const fetchTactics = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        limit: '100',
        dateFilter,
        color: colorFilter,
        phase: phaseFilter,
      })
      if (ecoFilter) params.set('eco', ecoFilter)
      if (selectedType !== 'all') params.set('tacticType', selectedType)

      const response = await fetch(`/api/tactics/missed?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch tactics')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [dateFilter, colorFilter, phaseFilter, ecoFilter, selectedType])

  useEffect(() => {
    fetchTactics()
  }, [fetchTactics])

  // Filter tactics based on selected type (client-side for UI responsiveness)
  const filteredTactics = data?.tactics.filter(t =>
    selectedType === 'all' || t.tactic_type === selectedType
  ) || []

  // Get recommendation for selected type
  const recommendation = selectedType !== 'all'
    ? TACTIC_RECOMMENDATIONS[selectedType]
    : 'Click on a tactic type above to see focused training tips.'

  const clearFilters = () => {
    setDateFilter('all')
    setColorFilter('all')
    setPhaseFilter('all')
    setEcoFilter('')
    setSelectedType('all')
  }

  const hasActiveFilters = dateFilter !== 'all' || colorFilter !== 'all' || phaseFilter !== 'all' || ecoFilter !== ''

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Breadcrumbs items={[{ label: 'Tactics' }]} />
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mt-2">Missed Tactics</h1>
        <p className="text-[var(--text-secondary)] text-lg">
          Tactical opportunities you had but played a different move
        </p>
      </div>

      {/* Filters */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Filters</h2>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
            >
              Clear All
            </button>
          )}
        </div>
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
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Your Color</label>
            <select
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="all">Both</option>
              <option value="white">White</option>
              <option value="black">Black</option>
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
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Opening</label>
            <select
              value={ecoFilter}
              onChange={(e) => setEcoFilter(e.target.value)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none min-w-[180px]"
            >
              <option value="">All openings</option>
              <option value="A">A - Flank Openings</option>
              <option value="B">B - Semi-Open (1.e4)</option>
              <option value="C">C - Open Games (1.e4 e5)</option>
              <option value="D">D - Closed Games (1.d4 d5)</option>
              <option value="E">E - Indian Defenses</option>
            </select>
          </div>
          <div className="ml-auto text-sm text-[var(--text-muted)]">
            {data?.summary.total || 0} missed tactic{(data?.summary.total || 0) !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)] mx-auto"></div>
          <p className="mt-3 text-[var(--text-secondary)]">Analyzing your missed tactics...</p>
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <div className="text-[var(--color-blunder)] mb-2 text-lg">Error loading tactics</div>
          <p className="text-[var(--text-secondary)]">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Tactic Type Cards */}
          <div className="card p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                By Tactic Type
              </h2>
              <button
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedType === 'all'
                    ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)]'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                Show All
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {TACTIC_TYPES.map(type => (
                <TacticSummaryCard
                  key={type}
                  type={type}
                  count={data.summary.by_type[type] || 0}
                  isSelected={selectedType === type}
                  onClick={() => setSelectedType(type)}
                />
              ))}
            </div>
          </div>

          {/* Training Recommendation */}
          {selectedType !== 'all' && (
            <div className="card p-4 mb-6 border-l-4 border-l-[var(--accent-primary)]">
              <div className="flex items-start gap-3">
                <span className="text-[var(--accent-primary)]">{TACTIC_ICONS[selectedType]}</span>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">
                    Training Tip: {TACTIC_NAMES[selectedType]}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">{recommendation}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tactics Grid */}
          <div className="card">
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <SectionHeader
                title={selectedType === 'all' ? 'All Missed Tactics' : `Missed ${TACTIC_NAMES[selectedType]}s`}
                subtitle={`${filteredTactics.length} positions`}
              />
            </div>

            <div className="p-4">
              {filteredTactics.length === 0 ? (
                <div className="text-center py-12 text-[var(--text-muted)]">
                  {data.summary.total === 0
                    ? 'No missed tactics found with current filters. Try adjusting your filters or run the backfill script to analyze your games.'
                    : `No ${TACTIC_NAMES[selectedType as TacticType]}s found with current filters.`}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredTactics.map(tactic => (
                    <TacticCard
                      key={tactic.move_id}
                      moveId={tactic.move_id}
                      gameId={tactic.game_id}
                      ply={tactic.ply}
                      moveSan={tactic.move_san}
                      bestMoveSan={tactic.best_move_san}
                      evalDelta={tactic.eval_delta}
                      positionFen={tactic.position_fen_before}
                      tacticType={tactic.tactic_type}
                      tacticDescription={tactic.tactic_description}
                      phase={tactic.phase}
                      userColor={tactic.user_color}
                      game={{
                        whitePlayer: tactic.game.white_player,
                        blackPlayer: tactic.game.black_player,
                        playedAt: tactic.game.played_at,
                        timeControl: tactic.game.time_control,
                        openingName: tactic.game.opening_name,
                        eco: tactic.game.eco
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Instructions if no data */}
          {data.summary.total === 0 && !hasActiveFilters && (
            <div className="mt-6 card p-4 border-l-4 border-l-[var(--accent-secondary)]">
              <h3 className="font-semibold text-[var(--text-primary)]">No missed tactics found</h3>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                To populate missed tactics, run the backfill script:
              </p>
              <code className="block mt-2 bg-[var(--bg-secondary)] px-3 py-2 rounded text-sm text-[var(--accent-primary)] font-mono">
                cd worker && python backfill_missed_tactics.py
              </code>
            </div>
          )}
        </>
      )}
    </div>
  )
}
