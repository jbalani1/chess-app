'use client'

import { useState, useEffect } from 'react'
import { useGlobalFilters } from '@/contexts/FilterContext'
import type { TimePerformanceResponse } from '@/app/api/time-performance/route'

// --- Helpers ---

const TC_LABELS: Record<string, string> = {
  bullet: 'Bullet',
  blitz: 'Blitz',
  rapid: 'Rapid',
}

const TC_ICONS: Record<string, string> = {
  bullet: '\u26A1',
  blitz: '\u23F1\uFE0F',
  rapid: '\u231B',
}

function accuracyColor(accuracy: number): string {
  if (accuracy >= 80) return '#81B64C'
  if (accuracy >= 60) return '#F5A623'
  return '#CA3431'
}

function accuracyTextClass(accuracy: number): string {
  if (accuracy >= 80) return 'text-green-400'
  if (accuracy >= 60) return 'text-yellow-400'
  return 'text-red-400'
}

const INSIGHT_STYLE = { border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400', icon: '\u2192' }

// --- Component ---

export default function TimePerformanceView() {
  const { color: globalColor } = useGlobalFilters()

  const [data, setData] = useState<TimePerformanceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dateFilter, setDateFilter] = useState<string>('all')
  const [selectedTC, setSelectedTC] = useState<string | null>(null)

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
        const response = await fetch(`/api/time-performance?${params}`)
        if (!response.ok) throw new Error('Failed to fetch time performance data')
        const result: TimePerformanceResponse = await response.json()
        setData(result)

        // Auto-select first time control if none selected
        if (result.performances.length > 0 && !selectedTC) {
          setSelectedTC(result.performances[0].time_control_category)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [dateFilter, globalColor])

  const selectedData = data?.performances.find((tc) => tc.time_control_category === selectedTC) || null

  // Loading state
  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  // Error state
  if (error) {
    return <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-400">{error}</div>
  }

  // Empty state
  if (!data || data.performances.length === 0) {
    return (
      <div className="card p-8 text-center">
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No time performance data</h3>
        <p className="text-[var(--text-secondary)]">
          {dateFilter !== 'all'
            ? 'Try expanding the date range to see performance data.'
            : 'No analyzed games found. Play some games to see how your accuracy changes across game phases.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Date Filter */}
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
            {data.performances.reduce((sum, tc) => sum + tc.games_played, 0)} games across{' '}
            {data.performances.length} time control{data.performances.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Time Control Tabs */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Time Controls</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {data.performances.map((tc) => {
            const isSelected = selectedTC === tc.time_control_category
            const label = TC_LABELS[tc.time_control_category] || tc.time_control_category
            const icon = TC_ICONS[tc.time_control_category] || '\u23F0'
            return (
              <button
                key={tc.time_control_category}
                onClick={() => setSelectedTC(isSelected ? null : tc.time_control_category)}
                className={`flex-shrink-0 w-52 p-4 rounded-lg border transition-all text-left ${
                  isSelected
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 ring-2 ring-[var(--accent-primary)]/30'
                    : 'border-[var(--border-color)] bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)]/50'
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{icon}</span>
                  <span className="text-base font-semibold text-[var(--text-primary)]">{label}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-[var(--text-muted)] mb-0.5">Win Rate</div>
                    <div className="text-lg font-bold text-[var(--text-primary)]">{tc.win_rate.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--text-muted)] mb-0.5">Accuracy</div>
                    <div className={`text-lg font-bold ${accuracyTextClass(tc.overall_accuracy)}`}>
                      {tc.overall_accuracy.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[var(--text-muted)] mt-2">
                  {tc.games_played} game{tc.games_played !== 1 ? 's' : ''}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected TC detail view */}
      {selectedTC && selectedData ? (
        <div className="space-y-6">
          {/* Accuracy Curve Visualization */}
          <div className="card p-5">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
              Accuracy by Game Phase
              <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
                {TC_LABELS[selectedData.time_control_category] || selectedData.time_control_category}
              </span>
            </h2>
            <p className="text-xs text-[var(--text-muted)] mb-5">
              How your accuracy changes across different move ranges
            </p>

            <div className="space-y-3">
              {selectedData.segments.map((seg) => (
                <div key={seg.segment} className="flex items-center gap-3">
                  <div className="w-20 flex-shrink-0 text-right">
                    <span className="text-sm font-mono text-[var(--text-secondary)]">{seg.segment}</span>
                  </div>
                  <div className="flex-1 bg-[var(--bg-tertiary)] rounded-lg overflow-hidden h-7 relative">
                    <div
                      className="h-7 rounded-lg transition-all duration-500 ease-out"
                      style={{
                        width: `${Math.max(seg.accuracy, 2)}%`,
                        backgroundColor: accuracyColor(seg.accuracy),
                      }}
                    />
                    <span className="absolute inset-y-0 right-2 flex items-center text-xs font-semibold text-[var(--text-primary)]">
                      {seg.accuracy.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-16 flex-shrink-0 text-right">
                    <span className="text-xs text-[var(--text-muted)]">{seg.total_moves} moves</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-[var(--divider-color)]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#81B64C' }} />
                <span className="text-xs text-[var(--text-muted)]">&gt;80% (Strong)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#F5A623' }} />
                <span className="text-xs text-[var(--text-muted)]">60-80% (Average)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#CA3431' }} />
                <span className="text-xs text-[var(--text-muted)]">&lt;60% (Weak)</span>
              </div>
            </div>
          </div>

          {/* Segment Detail Cards */}
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Segment Breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {selectedData.segments.map((seg) => (
                <div
                  key={seg.segment}
                  className="card p-4 border-t-2"
                  style={{ borderTopColor: accuracyColor(seg.accuracy) }}
                >
                  <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                    Moves {seg.segment}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mb-3">{seg.total_moves} total moves</div>

                  <div className="grid grid-cols-2 gap-y-2 gap-x-3 mb-3">
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Accuracy</div>
                      <div className={`text-base font-bold ${accuracyTextClass(seg.accuracy)}`}>
                        {seg.accuracy.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Mistake Rate</div>
                      <div className="text-base font-bold text-[var(--text-primary)]">
                        {seg.mistake_rate.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[var(--divider-color)] pt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-green-400">Good</span>
                      <span className="font-mono text-[var(--text-primary)]">{seg.good_moves}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-yellow-400">Inaccuracy</span>
                      <span className="font-mono text-[var(--text-primary)]">{seg.inaccuracies}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-orange-400">Mistake</span>
                      <span className="font-mono text-[var(--text-primary)]">{seg.mistakes}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-red-400">Blunder</span>
                      <span className="font-mono text-[var(--text-primary)]">{seg.blunders}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Comparison view when no TC selected */
        <div className="card p-5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Accuracy Comparison Across Time Controls
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Segment</th>
                  {data.performances.map((tc) => (
                    <th
                      key={tc.time_control_category}
                      className="text-center py-2 px-3 text-[var(--text-muted)] font-medium"
                    >
                      {TC_ICONS[tc.time_control_category] || ''}{' '}
                      {TC_LABELS[tc.time_control_category] || tc.time_control_category}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Overall row */}
                <tr className="border-b border-[var(--divider-color)] bg-[var(--bg-tertiary)]/50">
                  <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">Overall</td>
                  {data.performances.map((tc) => (
                    <td key={tc.time_control_category} className="py-2 px-3 text-center">
                      <span className={`font-bold ${accuracyTextClass(tc.overall_accuracy)}`}>
                        {tc.overall_accuracy.toFixed(1)}%
                      </span>
                    </td>
                  ))}
                </tr>
                {/* Segment rows - use first TC's segments as the reference */}
                {data.performances[0].segments.map((refSeg) => (
                  <tr key={refSeg.segment} className="border-b border-[var(--divider-color)]">
                    <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">{refSeg.segment}</td>
                    {data.performances.map((tc) => {
                      const seg = tc.segments.find((s) => s.segment === refSeg.segment)
                      if (!seg) {
                        return (
                          <td key={tc.time_control_category} className="py-2 px-3 text-center text-[var(--text-muted)]">
                            --
                          </td>
                        )
                      }
                      return (
                        <td key={tc.time_control_category} className="py-2 px-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: accuracyColor(seg.accuracy) }}
                            />
                            <span className={`font-semibold ${accuracyTextClass(seg.accuracy)}`}>
                              {seg.accuracy.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">{seg.total_moves} moves</div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {/* Win rate row */}
                <tr className="bg-[var(--bg-tertiary)]/50">
                  <td className="py-2 px-3 font-semibold text-[var(--text-primary)]">Win Rate</td>
                  {data.performances.map((tc) => (
                    <td key={tc.time_control_category} className="py-2 px-3 text-center">
                      <span className="font-bold text-[var(--text-primary)]">{tc.win_rate.toFixed(1)}%</span>
                      <div className="text-xs text-[var(--text-muted)]">{tc.games_played} games</div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insights Section */}
      {data.insights.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.insights.map((insight, i) => {
              const style = INSIGHT_STYLE
              return (
                <div
                  key={i}
                  className={`rounded-lg p-4 border ${style.border} ${style.bg}`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`text-lg font-bold ${style.text} flex-shrink-0 mt-0.5`}>
                      {style.icon}
                    </span>
                    <p className="text-sm text-[var(--text-secondary)]">{insight}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
