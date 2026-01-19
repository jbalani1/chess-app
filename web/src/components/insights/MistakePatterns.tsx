'use client'

import { useState, useEffect } from 'react'
import InsightFilters, { FilterState, buildFilterQueryString } from './InsightFilters'

interface MistakePattern {
  piece_moved: string
  phase: string
  move_quality: string
  total_moves: number
  blunders: number
  mistakes: number
  avg_eval_delta: number
  mistake_rate: number
}

const pieceIcons = {
  P: '♟️',
  N: '♞',
  B: '♝',
  R: '♜',
  Q: '♛',
  K: '♚'
}

const phaseColors = {
  opening: 'bg-green-100 text-green-800',
  middlegame: 'bg-blue-100 text-blue-800',
  endgame: 'bg-purple-100 text-purple-800'
}

const qualityColors = {
  excellent: 'bg-green-100 text-green-800',
  good: 'bg-blue-100 text-blue-800',
  questionable: 'bg-yellow-100 text-yellow-800',
  poor: 'bg-red-100 text-red-800'
}

export default function MistakePatterns() {
  const [patterns, setPatterns] = useState<MistakePattern[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
      const url = `/api/insights/patterns${queryString ? `?${queryString}` : ''}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch mistake patterns')
      }
      const data = await response.json()
      setPatterns(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Mistake Patterns</h2>
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
        <h2 className="text-xl font-bold mb-4">Mistake Patterns</h2>
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <span className="mr-2">📊</span>
        Mistake Patterns
      </h2>

      {/* Filters */}
      <InsightFilters filters={filters} onChange={setFilters} />

      {patterns.length === 0 ? (
        <div className="text-gray-500 text-center py-8">
          No mistake patterns available yet. Play more games to see patterns!
        </div>
      ) : (
        <div className="space-y-4">
          {patterns.map((pattern, index) => (
            <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">
                    {pieceIcons[pattern.piece_moved as keyof typeof pieceIcons] || '♟️'}
                  </span>
                  <div>
                    <h3 className="font-semibold text-lg">
                      {pattern.piece_moved} in {pattern.phase}
                    </h3>
                    <div className="flex gap-2 mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs ${phaseColors[pattern.phase as keyof typeof phaseColors]}`}>
                        {pattern.phase}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs ${qualityColors[pattern.move_quality as keyof typeof qualityColors]}`}>
                        {pattern.move_quality}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-red-600">
                    {pattern.mistake_rate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">mistake rate</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Total Moves:</span> {pattern.total_moves}
                </div>
                <div>
                  <span className="font-medium">Blunders:</span> 
                  <span className="text-red-600 ml-1">{pattern.blunders}</span>
                </div>
                <div>
                  <span className="font-medium">Mistakes:</span> 
                  <span className="text-orange-600 ml-1">{pattern.mistakes}</span>
                </div>
                <div>
                  <span className="font-medium">Avg Impact:</span> 
                  <span className={pattern.avg_eval_delta < 0 ? 'text-red-600' : 'text-green-600'}>
                    {pattern.avg_eval_delta > 0 ? '+' : ''}{(pattern.avg_eval_delta / 100).toFixed(1)}
                  </span>
                </div>
              </div>
              
              <div className="mt-3 p-3 bg-gray-50 rounded">
                <p className="text-sm text-gray-700">
                  <strong>Pattern:</strong> You make mistakes with {pattern.piece_moved} pieces 
                  {pattern.phase === 'opening' && ' in the opening'} 
                  {pattern.phase === 'middlegame' && ' in the middlegame'} 
                  {pattern.phase === 'endgame' && ' in the endgame'} 
                  {pattern.mistake_rate > 20 && ' at a high rate'}.
                  {pattern.avg_eval_delta < -300 && ' These mistakes are causing significant evaluation drops.'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
