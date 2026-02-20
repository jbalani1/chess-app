'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import BlunderGalleryModal from '../BlunderGalleryModal'
import InsightFilters, { FilterState, buildFilterQueryString } from './InsightFilters'

interface RecurringPattern {
  id: string
  category: string
  phase: string
  piece_involved: string
  piece_name: string
  occurrence_count: number
  total_eval_loss: number
  avg_eval_loss: number
  example_game_ids: string[]
  example_fens: string[]
  first_seen: string
  last_seen: string
  priority_score: number
  training_recommendation: string
  resource_link: string | null
}

interface FocusArea {
  category: string
  total_count: number
  avg_eval_loss: number
  priority_score: number
  phases: string[]
  pieces: string[]
  training: { recommendation: string; resource_link: string | null }
}

const categoryInfo: Record<string, { icon: string; label: string; color: string }> = {
  hanging_piece: { icon: '👻', label: 'Hanging Piece', color: 'bg-red-100 text-red-800 border-red-200' },
  calculation_error: { icon: '🧮', label: 'Calculation Error', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  greedy_capture: { icon: '🪤', label: 'Greedy Capture', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  endgame_technique: { icon: '👑', label: 'Endgame Technique', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  missed_tactic: { icon: '🎯', label: 'Missed Tactic', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  opening_principle: { icon: '📖', label: 'Opening Principle', color: 'bg-green-100 text-green-800 border-green-200' },
  overlooked_check: { icon: '⚠️', label: 'Overlooked Check', color: 'bg-red-100 text-red-800 border-red-200' },
  back_rank: { icon: '🏰', label: 'Back Rank', color: 'bg-pink-100 text-pink-800 border-pink-200' },
  time_pressure: { icon: '⏱️', label: 'Time Pressure', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  positional_collapse: { icon: '📉', label: 'Positional Collapse', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
}

const phaseColors: Record<string, string> = {
  opening: 'bg-green-100 text-green-700',
  middlegame: 'bg-blue-100 text-blue-700',
  endgame: 'bg-purple-100 text-purple-700',
}

export default function RecurringPatterns() {
  const [patterns, setPatterns] = useState<RecurringPattern[]>([])
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    timeControl: 'all',
    dateRange: 'all',
  })

  useEffect(() => {
    fetchPatterns()
  }, [filters])

  const fetchPatterns = async () => {
    setLoading(true)
    try {
      const queryString = buildFilterQueryString(filters)
      const url = `/api/insights/recurring${queryString ? `?${queryString}` : ''}`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch recurring patterns')
      const data = await response.json()
      setPatterns(data.patterns || [])
      setFocusAreas(data.focus_areas || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleViewGames = (category: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCategory(category)
    setIsModalOpen(true)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Recurring Patterns</h2>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Recurring Patterns</h2>
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  const maxPriority = patterns.length > 0 ? patterns[0].priority_score : 1

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-2 flex items-center">
        <span className="mr-2">🔄</span>
        Recurring Patterns
      </h2>
      <p className="text-gray-600 text-sm mb-4">
        Patterns that repeat across your games — these are your biggest opportunities for improvement.
      </p>

      <InsightFilters filters={filters} onChange={setFilters} />

      {/* Top Focus Areas */}
      {focusAreas.length > 0 && (
        <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
          <h3 className="font-semibold text-orange-900 mb-3">Top Focus Areas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {focusAreas.map((area, i) => {
              const info = categoryInfo[area.category] || { icon: '❓', label: area.category, color: 'bg-gray-100 text-gray-800' }
              return (
                <div key={area.category} className="flex items-center space-x-3 p-3 bg-white rounded-lg border">
                  <span className="text-2xl">{info.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900">
                      {i + 1}. {info.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {area.total_count} times, avg -{area.avg_eval_loss}cp
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {patterns.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No recurring patterns found yet. Run the pattern aggregation script after analyzing games.
        </div>
      ) : (
        <div className="space-y-3">
          {patterns.map((pattern) => {
            const info = categoryInfo[pattern.category] || {
              icon: '❓', label: pattern.category, color: 'bg-gray-100 text-gray-800 border-gray-200'
            }
            const isExpanded = expandedId === pattern.id
            const severityPct = Math.min((pattern.priority_score / maxPriority) * 100, 100)

            return (
              <div
                key={pattern.id}
                className={`border rounded-lg overflow-hidden transition-all ${isExpanded ? 'shadow-md' : 'hover:shadow-sm'}`}
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setExpandedId(isExpanded ? null : pattern.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold">{info.label}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${phaseColors[pattern.phase] || 'bg-gray-100 text-gray-700'}`}>
                            {pattern.phase}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            {pattern.piece_name}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span>{pattern.occurrence_count} occurrences</span>
                          <span className="text-red-600">avg -{pattern.avg_eval_loss}cp</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: `${severityPct}%` }}
                        />
                      </div>
                      <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t bg-gray-50">
                    {/* Training Recommendation */}
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-900 text-sm mb-1">How to Improve</h4>
                      <p className="text-sm text-blue-800">{pattern.training_recommendation}</p>
                      {pattern.resource_link && (
                        <a
                          href={pattern.resource_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 mt-1 inline-block"
                        >
                          Practice Resource →
                        </a>
                      )}
                    </div>

                    {/* Timeline */}
                    <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
                      <span>First seen: {new Date(pattern.first_seen).toLocaleDateString()}</span>
                      <span>Last seen: {new Date(pattern.last_seen).toLocaleDateString()}</span>
                    </div>

                    {/* Example Positions */}
                    {pattern.example_game_ids.length > 0 && (
                      <div className="mt-3">
                        <h4 className="font-medium text-sm text-gray-700 mb-2">
                          Example Games ({pattern.example_game_ids.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {pattern.example_game_ids.map((gameId, i) => (
                            <Link
                              key={`${gameId}-${i}`}
                              href={`/games/${gameId}`}
                              className="text-xs px-3 py-1.5 bg-white border rounded hover:bg-blue-50 hover:border-blue-300 transition-colors"
                            >
                              Game {i + 1}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* View All Games */}
                    <button
                      onClick={(e) => handleViewGames(pattern.category, e)}
                      className="mt-4 w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      View All {info.label} Games →
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Blunder Gallery Modal */}
      {selectedCategory && (
        <BlunderGalleryModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setSelectedCategory(null) }}
          category={selectedCategory}
          categoryLabel={categoryInfo[selectedCategory]?.label || selectedCategory}
          categoryIcon={categoryInfo[selectedCategory]?.icon || '❓'}
          recommendation={categoryInfo[selectedCategory]?.label ? `Review your ${categoryInfo[selectedCategory].label} patterns` : 'Review these positions'}
        />
      )}
    </div>
  )
}
