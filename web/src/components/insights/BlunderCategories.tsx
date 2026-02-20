'use client'

import { useState, useEffect } from 'react'
import BlunderGalleryModal from '../BlunderGalleryModal'
import InsightFilters, { FilterState, buildFilterQueryString } from './InsightFilters'
import TemporalTrends from './TemporalTrends'

interface BlunderCategoryStats {
  category: string
  count: number
  total_eval_loss: number
  avg_eval_loss: number
  by_phase: Record<string, number>
  by_piece: Record<string, number>
  examples: Array<{ explanation: string; eval_loss: number }>
}

const categoryInfo: Record<string, { icon: string; label: string; color: string; recommendation: string }> = {
  hanging_piece: {
    icon: '👻',
    label: 'Hanging Piece',
    color: 'bg-red-100 text-red-800 border-red-200',
    recommendation: 'Before each move, check: "Are all my pieces defended?"'
  },
  calculation_error: {
    icon: '🧮',
    label: 'Calculation Error',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    recommendation: 'Practice visualization - try to see 3-4 moves ahead'
  },
  greedy_capture: {
    icon: '🪤',
    label: 'Greedy Capture',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    recommendation: 'Ask yourself: "Why is this piece free?" before capturing'
  },
  endgame_technique: {
    icon: '👑',
    label: 'Endgame Technique',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    recommendation: 'Study basic endgames: King+Pawn, Rook endgames, Lucena/Philidor'
  },
  missed_tactic: {
    icon: '🎯',
    label: 'Missed Tactic',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    recommendation: 'Daily tactics training on Lichess or Chess.com'
  },
  opening_principle: {
    icon: '📖',
    label: 'Opening Principle',
    color: 'bg-green-100 text-green-800 border-green-200',
    recommendation: 'Focus on development, center control, and early castling'
  },
  overlooked_check: {
    icon: '⚠️',
    label: 'Overlooked Check',
    color: 'bg-red-100 text-red-800 border-red-200',
    recommendation: 'Always check for checks, captures, and threats (CCT)'
  },
  back_rank: {
    icon: '🏰',
    label: 'Back Rank',
    color: 'bg-pink-100 text-pink-800 border-pink-200',
    recommendation: 'Create "luft" (escape square) for your king early'
  },
  time_pressure: {
    icon: '⏱️',
    label: 'Time Pressure',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    recommendation: 'Practice faster time controls to improve time management'
  },
  positional_collapse: {
    icon: '📉',
    label: 'Positional Collapse',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    recommendation: 'Study strategic concepts and always have a plan'
  }
}

const pieceNames: Record<string, string> = {
  P: 'Pawn',
  N: 'Knight',
  B: 'Bishop',
  R: 'Rook',
  Q: 'Queen',
  K: 'King'
}

export default function BlunderCategories() {
  const [categories, setCategories] = useState<BlunderCategoryStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    timeControl: 'all',
    dateRange: 'all',
  })

  const handleViewGames = (category: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCategory(category)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedCategory(null)
  }

  const handleFiltersChange = (newFilters: FilterState) => {
    setFilters(newFilters)
  }

  useEffect(() => {
    fetchCategories()
  }, [filters])

  const fetchCategories = async () => {
    setLoading(true)
    try {
      const queryString = buildFilterQueryString(filters)
      const url = `/api/insights/blunders${queryString ? `?${queryString}` : ''}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch blunder categories')
      }
      const data = await response.json()
      setCategories(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Blunder Categories</h2>
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Blunder Categories</h2>
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  const totalBlunders = categories.reduce((sum, c) => sum + c.count, 0)

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-2 flex items-center">
        <span className="mr-2">🔍</span>
        Blunder Categories
      </h2>
      <p className="text-gray-600 text-sm mb-4">
        Understanding WHY you blunder helps you improve faster. Click each category to see details.
      </p>

      {/* Filters */}
      <InsightFilters filters={filters} onChange={handleFiltersChange} />

      {/* Temporal Trends */}
      <TemporalTrends filters={filters} />

      {categories.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No blunder data available yet. Analyze more games to see patterns!
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const info = categoryInfo[cat.category] || {
              icon: '❓',
              label: cat.category,
              color: 'bg-gray-100 text-gray-800 border-gray-200',
              recommendation: 'Review these positions carefully'
            }
            const percentage = ((cat.count / totalBlunders) * 100).toFixed(1)
            const isExpanded = expandedCategory === cat.category

            return (
              <div
                key={cat.category}
                className={`border rounded-lg overflow-hidden transition-all ${isExpanded ? 'shadow-md' : 'hover:shadow-sm'}`}
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleExpand(cat.category)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{info.icon}</span>
                      <div>
                        <h3 className="font-semibold text-lg">{info.label}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span>{cat.count} occurrences ({percentage}%)</span>
                          <span className="text-red-600">avg -{cat.avg_eval_loss}cp</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {/* By Phase */}
                      <div>
                        <h4 className="font-medium text-sm text-gray-700 mb-2">By Game Phase</h4>
                        <div className="space-y-1">
                          {Object.entries(cat.by_phase)
                            .sort((a, b) => b[1] - a[1])
                            .map(([phase, count]) => (
                              <div key={phase} className="flex justify-between text-sm">
                                <span className="capitalize">{phase}</span>
                                <span className="text-gray-600">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* By Piece */}
                      <div>
                        <h4 className="font-medium text-sm text-gray-700 mb-2">By Piece</h4>
                        <div className="space-y-1">
                          {Object.entries(cat.by_piece)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 4)
                            .map(([piece, count]) => (
                              <div key={piece} className="flex justify-between text-sm">
                                <span>{pieceNames[piece] || piece}</span>
                                <span className="text-gray-600">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    {/* Recommendation */}
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <h4 className="font-medium text-blue-900 text-sm mb-1">How to Improve</h4>
                      <p className="text-sm text-blue-800">
                        {(() => {
                          const phaseEntries = Object.entries(cat.by_phase).sort((a, b) => b[1] - a[1])
                          const pieceEntries = Object.entries(cat.by_piece).sort((a, b) => b[1] - a[1])
                          const topPhase = phaseEntries[0]
                          const topPiece = pieceEntries[0]
                          const parts: string[] = []
                          if (topPhase && topPhase[1] > cat.count * 0.4) {
                            parts.push(`Most common in the ${topPhase[0]}`)
                          }
                          if (topPiece && topPiece[1] > cat.count * 0.3) {
                            parts.push(`${parts.length ? ', especially' : 'Especially common'} with ${pieceNames[topPiece[0]] || topPiece[0]}s`)
                          }
                          const context = parts.length ? `${parts.join('')}. ` : ''
                          return `${context}${info.recommendation}`
                        })()}
                      </p>
                    </div>

                    {/* View Games Button */}
                    <button
                      onClick={(e) => handleViewGames(cat.category, e)}
                      className="mt-4 w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      View All {cat.count} Games →
                    </button>

                    {/* Examples */}
                    {cat.examples.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium text-sm text-gray-700 mb-2">Recent Examples</h4>
                        <div className="space-y-2">
                          {cat.examples.map((ex, i) => (
                            <div key={i} className="text-sm p-2 bg-white rounded border">
                              <span className="text-red-600">-{ex.eval_loss}cp:</span>{' '}
                              <span className="text-gray-700">{ex.explanation}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Summary */}
      {categories.length > 0 && (
        <div className="mt-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
          <h3 className="font-semibold text-orange-900 mb-2">Top Priority for Improvement</h3>
          <p className="text-sm text-orange-800">
            Your most common blunder type is <strong>{categoryInfo[categories[0]?.category]?.label || categories[0]?.category}</strong> ({categories[0]?.count} times).
            {' '}{categoryInfo[categories[0]?.category]?.recommendation}
          </p>
        </div>
      )}

      {/* Blunder Gallery Modal */}
      {selectedCategory && (
        <BlunderGalleryModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          category={selectedCategory}
          categoryLabel={categoryInfo[selectedCategory]?.label || selectedCategory}
          categoryIcon={categoryInfo[selectedCategory]?.icon || '❓'}
          recommendation={categoryInfo[selectedCategory]?.recommendation || 'Review these positions carefully'}
        />
      )}
    </div>
  )
}
