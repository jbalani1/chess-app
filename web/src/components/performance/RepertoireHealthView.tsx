'use client'

import { useState, useEffect, useMemo } from 'react'
import { useGlobalFilters } from '@/contexts/FilterContext'

// --- Types ---

interface CommonMistake {
  move_san: string
  count: number
  avg_eval_delta: number
}

interface OpeningHealth {
  eco: string
  opening_name: string
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  health_score: number
  win_rate: number
  accuracy: number
  games_played: number
  games_as_white: number
  games_as_black: number
  trend: 'improving' | 'stable' | 'worsening'
  common_mistakes: CommonMistake[]
}

interface RepertoireHealthData {
  openings: OpeningHealth[]
  total_openings: number
  average_health: number
}

// --- Constants ---

const gradeColors: Record<string, string> = {
  A: 'bg-green-500/20 text-green-400 border-green-500/30',
  B: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  C: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  D: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  F: 'bg-red-500/20 text-red-400 border-red-500/30',
}

const gradeBarColors: Record<string, string> = {
  A: 'bg-green-500',
  B: 'bg-teal-500',
  C: 'bg-yellow-500',
  D: 'bg-orange-500',
  F: 'bg-red-500',
}

const trendInfo: Record<string, { arrow: string; color: string; label: string }> = {
  improving: { arrow: '\u2191', color: 'text-green-400', label: 'Improving' },
  stable: { arrow: '\u2192', color: 'text-yellow-400', label: 'Stable' },
  worsening: { arrow: '\u2193', color: 'text-red-400', label: 'Worsening' },
}

type SortKey = 'health_score' | 'games_played' | 'win_rate' | 'accuracy'

const sortLabels: Record<SortKey, string> = {
  health_score: 'Health Score',
  games_played: 'Games Played',
  win_rate: 'Win Rate',
  accuracy: 'Accuracy',
}

// --- Component ---

export default function RepertoireHealthView() {
  const { color: globalColor } = useGlobalFilters()

  const [data, setData] = useState<RepertoireHealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [minGames, setMinGames] = useState<number>(3)
  const [sortBy, setSortBy] = useState<SortKey>('health_score')

  // Expansion state
  const [expandedOpening, setExpandedOpening] = useState<string | null>(null)

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          dateFilter,
          color: globalColor,
          minGames: minGames.toString(),
        })
        const response = await fetch(`/api/repertoire-health?${params}`)
        if (!response.ok) throw new Error('Failed to fetch repertoire health data')
        const result: RepertoireHealthData = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [dateFilter, globalColor, minGames])

  // Sorted openings
  const sortedOpenings = useMemo(() => {
    if (!data) return []
    return [...data.openings].sort((a, b) => {
      if (sortBy === 'health_score') return b.health_score - a.health_score
      if (sortBy === 'games_played') return b.games_played - a.games_played
      if (sortBy === 'win_rate') return b.win_rate - a.win_rate
      if (sortBy === 'accuracy') return b.accuracy - a.accuracy
      return 0
    })
  }, [data, sortBy])

  // Derived summary
  const healthiest = useMemo(() => {
    if (!sortedOpenings.length) return null
    return sortedOpenings.reduce((best, o) => o.health_score > best.health_score ? o : best, sortedOpenings[0])
  }, [sortedOpenings])

  const weakest = useMemo(() => {
    if (!sortedOpenings.length) return null
    return sortedOpenings.reduce((worst, o) => o.health_score < worst.health_score ? o : worst, sortedOpenings[0])
  }, [sortedOpenings])

  const toggleExpand = (key: string) => {
    setExpandedOpening(prev => prev === key ? null : key)
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

  if (!data || data.openings.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No openings with enough games found</h3>
        <p className="text-[var(--text-secondary)]">
          Try lowering the minimum games filter.
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
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Min Games</label>
            <select
              value={minGames}
              onChange={(e) => setMinGames(parseInt(e.target.value))}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value={3}>3+ games</option>
              <option value={5}>5+ games</option>
              <option value={10}>10+ games</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none"
            >
              {(Object.keys(sortLabels) as SortKey[]).map((key) => (
                <option key={key} value={key}>{sortLabels[key]}</option>
              ))}
            </select>
          </div>
          <div className="ml-auto text-sm text-[var(--text-muted)]">
            {data.openings.length} opening{data.openings.length !== 1 ? 's' : ''} tracked
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="card p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{data.total_openings}</div>
            <div className="text-xs text-[var(--text-muted)]">Openings Tracked</div>
          </div>
          {healthiest && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-0.5">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded border text-sm font-bold ${gradeColors[healthiest.grade]}`}>
                  {healthiest.grade}
                </span>
                <span className="text-sm font-semibold text-green-400 truncate max-w-[120px]">{healthiest.opening_name}</span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">Healthiest Opening</div>
            </div>
          )}
          {weakest && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-0.5">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded border text-sm font-bold ${gradeColors[weakest.grade]}`}>
                  {weakest.grade}
                </span>
                <span className="text-sm font-semibold text-red-400 truncate max-w-[120px]">{weakest.opening_name}</span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">Weakest Opening</div>
            </div>
          )}
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{data.average_health}<span className="text-sm font-normal text-[var(--text-muted)]">/100</span></div>
            <div className="text-xs text-[var(--text-muted)]">Average Health</div>
          </div>
        </div>
      </div>

      {/* Opening List */}
      <div className="space-y-3">
        {sortedOpenings.map((opening) => {
          const key = `${opening.eco}-${opening.opening_name}`
          const isExpanded = expandedOpening === key
          const trend = trendInfo[opening.trend]

          return (
            <div key={key} className="card overflow-hidden">
              {/* Card Header */}
              <button
                onClick={() => toggleExpand(key)}
                className="w-full text-left p-5 hover:bg-[var(--bg-hover)] transition-colors"
              >
                <div className="flex items-start gap-4">
                  {/* Grade Badge */}
                  <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border text-lg font-bold flex-shrink-0 ${gradeColors[opening.grade]}`}>
                    {opening.grade}
                  </span>

                  {/* Opening Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[var(--text-primary)] truncate">{opening.opening_name}</span>
                      <span className="font-mono text-xs bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)] flex-shrink-0">
                        {opening.eco}
                      </span>
                      <span className={`text-sm font-semibold flex-shrink-0 ${trend.color}`} title={trend.label}>
                        {trend.arrow} {trend.label}
                      </span>
                    </div>

                    {/* Health Score Bar */}
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden border border-[var(--border-color)]">
                        <div
                          className={`h-full rounded-full transition-all ${gradeBarColors[opening.grade]}`}
                          style={{ width: `${opening.health_score}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-[var(--text-primary)] w-10 text-right flex-shrink-0">{opening.health_score}</span>
                    </div>

                    {/* Stats Row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">{opening.win_rate}%</span> win rate
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">{opening.accuracy}%</span> accuracy
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">{opening.games_played}</span> games
                      </span>
                      <span className="text-[var(--text-muted)] text-xs">
                        {opening.games_as_white}W / {opening.games_as_black}B
                      </span>
                    </div>
                  </div>

                  {/* Expand indicator */}
                  <span className={`text-[var(--text-muted)] transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}>
                    &#9660;
                  </span>
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-[var(--border-color)] p-5 bg-[var(--bg-tertiary)]/50 animate-fadeIn">
                  {/* Full Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] text-center">
                      <div className="text-lg font-bold text-[var(--text-primary)]">{opening.health_score}</div>
                      <div className="text-xs text-[var(--text-muted)]">Health Score</div>
                    </div>
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] text-center">
                      <div className="text-lg font-bold text-[var(--text-primary)]">{opening.win_rate}%</div>
                      <div className="text-xs text-[var(--text-muted)]">Win Rate</div>
                    </div>
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] text-center">
                      <div className="text-lg font-bold text-[var(--text-primary)]">{opening.accuracy}%</div>
                      <div className="text-xs text-[var(--text-muted)]">Accuracy</div>
                    </div>
                    <div className="p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] text-center">
                      <div className="text-lg font-bold text-[var(--text-primary)]">{opening.games_played}</div>
                      <div className="text-xs text-[var(--text-muted)]">Games Played</div>
                    </div>
                  </div>

                  {/* Color Split */}
                  <div className="mb-5">
                    <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Color Distribution</div>
                    <div className="flex h-3 rounded-full overflow-hidden border border-[var(--border-color)]">
                      {opening.games_as_white > 0 && (
                        <div
                          className="bg-gray-200"
                          style={{ width: `${(opening.games_as_white / opening.games_played) * 100}%` }}
                          title={`${opening.games_as_white} as White`}
                        />
                      )}
                      {opening.games_as_black > 0 && (
                        <div
                          className="bg-gray-600"
                          style={{ width: `${(opening.games_as_black / opening.games_played) * 100}%` }}
                          title={`${opening.games_as_black} as Black`}
                        />
                      )}
                    </div>
                    <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                      <span>{opening.games_as_white} as White</span>
                      <span>{opening.games_as_black} as Black</span>
                    </div>
                  </div>

                  {/* Common Mistakes */}
                  {opening.common_mistakes.length > 0 ? (
                    <div className="mb-5">
                      <div className="text-sm font-medium text-[var(--text-secondary)] mb-2">Common Mistakes</div>
                      <div className="space-y-1.5">
                        {opening.common_mistakes.map((mistake, i) => (
                          <div
                            key={`${mistake.move_san}-${i}`}
                            className="flex items-center justify-between p-2.5 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]"
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-red-400 bg-red-500/20 px-2 py-0.5 rounded">
                                {mistake.move_san}
                              </span>
                              <span className="text-sm text-[var(--text-secondary)]">
                                {mistake.count} time{mistake.count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <span className="text-sm text-red-400 font-semibold">
                              {(Math.abs(mistake.avg_eval_delta) / 100).toFixed(1)} avg pawn loss
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-5 p-3 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)] text-sm text-[var(--text-muted)] text-center">
                      No common mistakes recorded for this opening.
                    </div>
                  )}

                  {/* Study Recommendation */}
                  <div className={`rounded-lg p-4 border ${
                    opening.grade === 'A' || opening.grade === 'B'
                      ? 'bg-green-500/10 border-green-500/30'
                      : opening.grade === 'C'
                        ? 'bg-yellow-500/10 border-yellow-500/30'
                        : 'bg-red-500/10 border-red-500/30'
                  }`}>
                    <h4 className={`font-semibold mb-1 ${
                      opening.grade === 'A' || opening.grade === 'B'
                        ? 'text-green-400'
                        : opening.grade === 'C'
                          ? 'text-yellow-400'
                          : 'text-red-400'
                    }`}>
                      Study Recommendation
                    </h4>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {opening.grade === 'A' && 'This opening is in great shape. Keep playing it confidently and maintain your preparation.'}
                      {opening.grade === 'B' && 'Solid performance overall. Review the occasional mistakes to push this toward an A grade.'}
                      {opening.grade === 'C' && `This opening needs attention. Focus on the ${opening.common_mistakes.length} common mistake pattern${opening.common_mistakes.length !== 1 ? 's' : ''} above to improve your results.`}
                      {opening.grade === 'D' && `The ${opening.opening_name} is a liability in your repertoire. Dedicate study time to understanding the key positions, or consider switching to a different line.`}
                      {opening.grade === 'F' && `Serious problems with this opening. You should either invest significant study time into the ${opening.opening_name} or replace it with a more reliable alternative.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
