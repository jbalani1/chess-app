'use client'

import { useState, useEffect } from 'react'
import TacticalInsightModal from '../TacticalInsightModal'
import InsightFilters, { FilterState, buildFilterQueryString } from './InsightFilters'

interface TacticalInsight {
  motif_type: string
  description: string
  severity: string
  piece_involved: string
  frequency: number
  avg_eval_delta: number
  mistakes_count: number
}

const severityColors = {
  minor: 'bg-blue-100 text-blue-800 border-blue-200',
  major: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200'
}

const motifIcons = {
  pin: '📌',
  fork: '🍴',
  skewer: '⚡',
  discovered_attack: '💥',
  deflection: '🎯',
  decoy: '🎭'
}

export default function TacticalInsights() {
  const [insights, setInsights] = useState<TacticalInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedInsight, setSelectedInsight] = useState<TacticalInsight | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    timeControl: 'all',
    dateRange: 'all',
  })

  useEffect(() => {
    fetchInsights()
  }, [filters])

  const fetchInsights = async () => {
    setLoading(true)
    try {
      const queryString = buildFilterQueryString(filters)
      const url = `/api/insights/tactical${queryString ? `?${queryString}` : ''}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch tactical insights')
      }
      const data = await response.json()
      setInsights(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleInsightClick = (insight: TacticalInsight) => {
    setSelectedInsight(insight)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedInsight(null)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Tactical Insights</h2>
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Tactical Insights</h2>
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <span className="mr-2">🎯</span>
        Tactical Insights
      </h2>

      {/* Filters */}
      <InsightFilters filters={filters} onChange={setFilters} />

      {insights.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No tactical insights available yet. Play more games to see patterns!
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight, index) => (
            <div 
              key={index} 
              className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer hover:border-blue-300"
              onClick={() => handleInsightClick(insight)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">
                      {motifIcons[insight.motif_type as keyof typeof motifIcons] || '♟️'}
                    </span>
                    <h3 className="font-semibold text-lg">{insight.description}</h3>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs border ${severityColors[insight.severity as keyof typeof severityColors]}`}>
                      {insight.severity}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Frequency:</span> {insight.frequency}
                    </div>
                    <div>
                      <span className="font-medium">Avg Impact:</span> 
                      <span className={insight.avg_eval_delta < 0 ? 'text-red-600' : 'text-green-600'}>
                        {insight.avg_eval_delta > 0 ? '+' : ''}{(insight.avg_eval_delta / 100).toFixed(1)}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Mistakes:</span> {insight.mistakes_count}
                    </div>
                    <div>
                      <span className="font-medium">Piece:</span> {insight.piece_involved}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-3 p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-700">
                  <strong>Insight:</strong> This tactical pattern appears {insight.frequency} times in your games.
                  {insight.avg_eval_delta < -200 && " It's causing significant evaluation drops."}
                  {insight.mistakes_count > 0 && ` You've made ${insight.mistakes_count} mistakes related to this pattern.`}
                </p>
                <p className="text-xs text-blue-600 mt-2 font-medium">
                  Click to see specific games and board positions →
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Modal */}
      {selectedInsight && (
        <TacticalInsightModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          motifType={selectedInsight.motif_type}
          description={selectedInsight.description}
          frequency={selectedInsight.frequency}
        />
      )}
    </div>
  )
}
