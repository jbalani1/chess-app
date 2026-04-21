'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Chess } from 'chess.js'
import { useGlobalFilters } from '@/contexts/FilterContext'
import AnalysisBoard from '@/components/AnalysisBoard'
import { TACTIC_ICONS, TACTIC_NAMES, TACTIC_COLORS } from '@/components/TacticCard'
import type { TacticType } from '@/app/api/tactics/missed/route'

// --- Types ---

interface ThrownGame {
  game_id: string
  opening_name: string
  eco: string
  result: string
  peak_eval: number
  eval_swing: number
  turning_point_move: string
  turning_point_fen: string
  best_move: string | null
  turning_point_ply: number
  user_color: 'white' | 'black'
  tactic_type: string | null
  played_at: string
}

interface MotifCount {
  tactic_type: string
  count: number
}

interface ThrownGamesData {
  games: ThrownGame[]
  summary: {
    throw_rate: number
    total_thrown: number
    total_winning: number
    avg_peak_eval: number
    avg_swing: number
    motifs: MotifCount[]
  }
}

// --- Helpers ---

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

function swingSeverityColor(swing: number): string {
  const abSwing = Math.abs(swing)
  if (abSwing >= 500) return 'border-l-red-500 bg-red-500/5'
  if (abSwing >= 300) return 'border-l-orange-500 bg-orange-500/5'
  if (abSwing >= 150) return 'border-l-yellow-500 bg-yellow-500/5'
  return 'border-l-[var(--border-color)]'
}

function evalDisplay(cp: number): string {
  const pawns = cp / 100
  return pawns >= 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2)
}

// --- Component ---

export default function ThrownGamesView() {
  const { color: globalColor } = useGlobalFilters()

  const [data, setData] = useState<ThrownGamesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dateFilter, setDateFilter] = useState<string>('all')
  const [selectedGame, setSelectedGame] = useState<ThrownGame | null>(null)

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          dateFilter,
          color: globalColor,
        })
        const response = await fetch(`/api/thrown-games?${params}`)
        if (!response.ok) throw new Error('Failed to fetch thrown games')
        const result: ThrownGamesData = await response.json()
        setData(result)

        // Auto-select first game
        if (result.games.length > 0 && !selectedGame) {
          setSelectedGame(result.games[0])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [dateFilter, globalColor])

  // Reset selection when filters change
  useEffect(() => {
    setSelectedGame(null)
  }, [dateFilter, globalColor])

  // Auto-select first game when data changes and nothing selected
  useEffect(() => {
    if (data && data.games.length > 0 && !selectedGame) {
      setSelectedGame(data.games[0])
    }
  }, [data, selectedGame])

  // Find the most common motif
  const topMotif = data?.summary.motifs.reduce<MotifCount | null>((best, m) =>
    !best || m.count > best.count ? m : best
  , null)
  const totalMotifCount = data?.summary.motifs.reduce((sum, m) => sum + m.count, 0) || 0

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

  if (!data || data.games.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No thrown games found</h3>
        <p className="text-[var(--text-secondary)]">
          No thrown games found - either you&apos;re converting your advantages, or try expanding the date range.
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
          <div className="ml-auto text-sm text-[var(--text-muted)]">
            {data.games.length} thrown game{data.games.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      {/* Summary Section */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Throw Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          {/* Throw rate */}
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400">{data.summary.throw_rate.toFixed(1)}%</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Throw Rate</div>
            <div className="text-xs text-[var(--text-secondary)]">
              {data.summary.total_thrown} of {data.summary.total_winning} won positions
            </div>
          </div>
          {/* Total thrown */}
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--text-primary)]">{data.summary.total_thrown}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Games Thrown</div>
          </div>
          {/* Avg peak eval */}
          <div className="text-center">
            <div className="text-3xl font-bold text-green-400">{evalDisplay(data.summary.avg_peak_eval)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Avg Peak Eval</div>
          </div>
          {/* Avg swing */}
          <div className="text-center">
            <div className="text-3xl font-bold text-orange-400">{(data.summary.avg_swing / 100).toFixed(1)}</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">Avg Swing (pawns)</div>
          </div>
        </div>

        {/* Turning point motifs bar */}
        {data.summary.motifs.length > 0 && (
          <div>
            <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Common Turning Point Motifs</div>
            <div className="flex rounded-lg overflow-hidden h-6">
              {data.summary.motifs.map((motif) => {
                const pct = totalMotifCount > 0 ? (motif.count / totalMotifCount) * 100 : 0
                const tt = motif.tactic_type as TacticType
                const bgColor = TACTIC_COLORS[tt]?.split(' ')[0] || 'bg-gray-500/20'
                return (
                  <div
                    key={motif.tactic_type}
                    className={`${bgColor} flex items-center justify-center text-xs font-medium text-[var(--text-primary)] transition-all`}
                    style={{ width: `${Math.max(pct, 5)}%` }}
                    title={`${TACTIC_NAMES[tt] || motif.tactic_type}: ${motif.count} (${pct.toFixed(0)}%)`}
                  >
                    {pct >= 10 && (
                      <span className="flex items-center gap-1 truncate px-1">
                        {TACTIC_ICONS[tt]}
                        <span>{motif.count}</span>
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              {data.summary.motifs.map((motif) => {
                const tt = motif.tactic_type as TacticType
                const colorClass = TACTIC_COLORS[tt] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                return (
                  <span
                    key={motif.tactic_type}
                    className={`inline-flex items-center px-2 py-1 rounded border text-xs font-medium ${colorClass}`}
                  >
                    <span className="mr-1">{TACTIC_ICONS[tt]}</span>
                    {TACTIC_NAMES[tt] || motif.tactic_type}: {motif.count}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Two-column layout: Game list + Analysis board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Scrollable game list */}
        <div className="lg:col-span-1 card">
          <div className="px-4 py-3 border-b border-[var(--border-color)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Thrown Games</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Sorted by eval swing (biggest throws first)
            </p>
          </div>
          <div className="max-h-[50vh] md:max-h-[600px] overflow-y-auto">
            {data.games.map((game) => {
              const isSelected = selectedGame?.game_id === game.game_id
              const severityClass = swingSeverityColor(game.eval_swing)
              return (
                <button
                  key={game.game_id}
                  onClick={() => setSelectedGame(game)}
                  className={`w-full text-left p-4 border-b border-l-4 border-b-[var(--divider-color)] hover:bg-[var(--bg-hover)] transition-colors ${severityClass} ${
                    isSelected ? 'bg-[var(--accent-primary)]/10 !border-l-[var(--accent-primary)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)]">
                      {game.eco}
                    </span>
                    <span className="font-medium text-[var(--text-primary)] truncate text-sm">{game.opening_name}</span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${
                      game.result === '0-1' || game.result === '1-0'
                        ? 'text-red-400'
                        : 'text-yellow-400'
                    }`}>
                      {game.result === '1/2-1/2' ? 'Draw' : 'Loss'} ({game.result})
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">{formatDate(game.played_at)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-400">
                      Peak: {evalDisplay(game.peak_eval)}
                    </span>
                    <span className="text-red-400 font-semibold">
                      Swing: {(Math.abs(game.eval_swing) / 100).toFixed(1)} pawns
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1">
                    Turning point: <span className="font-mono">{game.turning_point_move}</span>
                  </div>
                  {game.tactic_type && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs mt-1.5 ${
                      TACTIC_COLORS[game.tactic_type as TacticType] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}>
                      <span className="mr-0.5">{TACTIC_ICONS[game.tactic_type as TacticType]}</span>
                      {TACTIC_NAMES[game.tactic_type as TacticType] || game.tactic_type}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Analysis board */}
        <div className="lg:col-span-2">
          {selectedGame ? (
            <div className="card p-5">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
                Turning Point Analysis
                <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
                  {selectedGame.opening_name}
                </span>
              </h3>
              <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
                <div className="w-full lg:w-auto lg:flex-shrink-0">
                  <AnalysisBoard
                    fen={selectedGame.turning_point_fen}
                    width={400}
                    orientation={selectedGame.user_color}
                    yourMove={sanToUci(selectedGame.turning_point_fen, selectedGame.turning_point_move)}
                    bestMove={selectedGame.best_move ? sanToUci(selectedGame.turning_point_fen, selectedGame.best_move) : null}
                    yourMoveSan={selectedGame.turning_point_move}
                    bestMoveSan={selectedGame.best_move || undefined}
                    showAnalysis={true}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Mistake explanation */}
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg mb-3">
                    <p className="text-sm text-[var(--text-primary)]">
                      You were up <strong className="text-green-400">{evalDisplay(selectedGame.peak_eval)}</strong>, then played{' '}
                      <span className="font-mono font-bold text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">
                        {selectedGame.turning_point_move}
                      </span>
                      {selectedGame.best_move && (
                        <>
                          {' '}instead of{' '}
                          <span className="font-mono font-bold text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">
                            {selectedGame.best_move}
                          </span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-1.5">
                      Eval swing: <span className="text-red-400 font-semibold">{(Math.abs(selectedGame.eval_swing) / 100).toFixed(1)} pawns</span>
                    </p>
                  </div>

                  {/* Tactic badge */}
                  {selectedGame.tactic_type && (
                    <div className="mb-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded border text-xs font-medium ${
                        TACTIC_COLORS[selectedGame.tactic_type as TacticType] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      }`}>
                        <span className="mr-1">{TACTIC_ICONS[selectedGame.tactic_type as TacticType]}</span>
                        {TACTIC_NAMES[selectedGame.tactic_type as TacticType] || selectedGame.tactic_type}
                      </span>
                    </div>
                  )}

                  {/* Game meta */}
                  <div className="p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-lg mb-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-[var(--text-muted)]">Opening:</span>{' '}
                        <span className="text-[var(--text-primary)]">{selectedGame.opening_name}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">ECO:</span>{' '}
                        <span className="font-mono text-[var(--text-primary)]">{selectedGame.eco}</span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Result:</span>{' '}
                        <span className={`font-semibold ${
                          selectedGame.result === '1/2-1/2' ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {selectedGame.result}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)]">Played:</span>{' '}
                        <span className="text-[var(--text-secondary)]">{formatDate(selectedGame.played_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Link to full game */}
                  <Link
                    href={`/games/${selectedGame.game_id}`}
                    className="inline-flex items-center gap-1 text-sm text-[var(--accent-primary)] hover:underline"
                  >
                    View full game &rarr;
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center text-[var(--text-muted)]">
              Select a game from the list to analyze the turning point
            </div>
          )}
        </div>
      </div>

      {/* Key Insight Box */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
        <h3 className="font-semibold text-amber-400 mb-2">Key Insight</h3>
        <p className="text-sm text-[var(--text-secondary)]">
          You threw {data.summary.throw_rate.toFixed(1)}% of your won games.
          {topMotif && (
            <>
              {' '}The most common cause was{' '}
              <strong className="text-[var(--text-primary)]">
                {TACTIC_NAMES[topMotif.tactic_type as TacticType] || topMotif.tactic_type}
              </strong>.
            </>
          )}
          {' '}Focus on maintaining concentration when you&apos;re ahead.
        </p>
      </div>
    </div>
  )
}
