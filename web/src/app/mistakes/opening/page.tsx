'use client'

import { useState, useEffect } from 'react'
import MistakeChart from '@/components/charts/MistakeChart'

interface OpeningStats {
  eco: string
  opening_name: string
  games_played: number
  total_moves: number
  good_moves: number
  inaccuracies: number
  mistakes: number
  blunders: number
  mistake_rate: number
  avg_eval_delta: number
}

type ColorFilter = 'all' | 'white' | 'black'

export default function MistakesByOpeningPage() {
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all')
  const [openings, setOpenings] = useState<OpeningStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOpenings()
  }, [colorFilter])

  const fetchOpenings = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (colorFilter !== 'all') {
        params.set('color', colorFilter)
      }
      const url = `/api/openings${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch openings')
      }
      const data = await response.json()
      setOpenings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Group openings by family for summary
  const openingFamilies = openings.reduce((acc, opening) => {
    // Extract opening family (first word or main name)
    const family = opening.opening_name.split(':')[0].split(' ').slice(0, 2).join(' ')
    if (!acc[family]) {
      acc[family] = {
        name: family,
        games: 0,
        mistakes: 0,
        blunders: 0,
        total_moves: 0
      }
    }
    acc[family].games += opening.games_played
    acc[family].mistakes += opening.mistakes
    acc[family].blunders += opening.blunders
    acc[family].total_moves += opening.total_moves
    return acc
  }, {} as Record<string, { name: string; games: number; mistakes: number; blunders: number; total_moves: number }>)

  const sortedFamilies = Object.values(openingFamilies)
    .map(f => ({
      ...f,
      mistake_rate: f.total_moves > 0 ? ((f.mistakes + f.blunders) / f.total_moves * 100) : 0
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 10)

  const getColorDescription = () => {
    switch (colorFilter) {
      case 'white':
        return "Your openings when playing White"
      case 'black':
        return "Openings you face when playing Black"
      default:
        return "All openings across all games"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <a href="/" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </a>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Opening Analysis</h1>
          <p className="mt-2 text-gray-600">
            Analyze your performance in different chess openings
          </p>
        </div>

        {/* Color Filter Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setColorFilter('all')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  colorFilter === 'all'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Games
              </button>
              <button
                onClick={() => setColorFilter('white')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  colorFilter === 'white'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="w-4 h-4 bg-white border border-gray-300 rounded mr-2"></span>
                As White
              </button>
              <button
                onClick={() => setColorFilter('black')}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  colorFilter === 'black'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="w-4 h-4 bg-gray-800 rounded mr-2"></span>
                As Black
              </button>
            </nav>
          </div>
          <p className="mt-2 text-sm text-gray-500">{getColorDescription()}</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {/* Opening Families Summary */}
        <div className="mb-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Opening Families</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {sortedFamilies.map((family) => (
              <div key={family.name} className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 text-sm truncate" title={family.name}>
                  {family.name}
                </h3>
                <p className="text-2xl font-bold text-gray-900">{family.games}</p>
                <p className="text-xs text-gray-500">games</p>
                <p className={`text-sm ${family.mistake_rate > 15 ? 'text-red-600' : family.mistake_rate > 10 ? 'text-orange-600' : 'text-green-600'}`}>
                  {family.mistake_rate.toFixed(1)}% mistake rate
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="mb-8">
          <MistakeChart
            data={openings.slice(0, 15)}
            type="bar"
            title={`Mistake Rate by Opening (${colorFilter === 'all' ? 'All' : colorFilter === 'white' ? 'White' : 'Black'})`}
            xKey="opening_name"
            yKey="mistake_rate"
          />
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Opening Performance</h3>
            <span className="text-sm text-gray-500">{openings.length} openings</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opening
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ECO
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Games
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Moves
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Good
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inaccuracies
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mistakes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Blunders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mistake Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {openings.map((item) => (
                  <tr
                    key={`${item.eco}-${item.opening_name}`}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => {
                      const params = new URLSearchParams()
                      if (colorFilter !== 'all') params.set('color', colorFilter)
                      window.location.href = `/mistakes/opening/${item.eco}${params.toString() ? `?${params.toString()}` : ''}`
                    }}
                  >
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-blue-600 hover:text-blue-800">
                        {item.opening_name || 'Unknown Opening'}
                        <span className="ml-2 text-gray-400">→</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {item.eco || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                      {item.games_played}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.total_moves}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {item.good_moves}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {item.inaccuracies}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {item.mistakes}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {item.blunders}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2 w-16">
                          <div
                            className={`h-2 rounded-full ${
                              item.mistake_rate > 20 ? 'bg-red-500' :
                              item.mistake_rate > 15 ? 'bg-orange-500' :
                              item.mistake_rate > 10 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(item.mistake_rate * 2, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">
                          {item.mistake_rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights */}
        {openings.length > 0 && (
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-4">
              Key Insights {colorFilter !== 'all' && `(${colorFilter === 'white' ? 'As White' : 'As Black'})`}
            </h3>
            <div className="space-y-2 text-blue-800">
              {(() => {
                const sortedByMistakeRate = [...openings].filter(o => o.total_moves >= 10).sort((a, b) => b.mistake_rate - a.mistake_rate)
                const worstOpening = sortedByMistakeRate[0]
                const bestOpening = sortedByMistakeRate[sortedByMistakeRate.length - 1]
                const mostPlayed = openings[0] // Already sorted by games

                return (
                  <>
                    {mostPlayed && (
                      <p>
                        • Your most played opening is <strong>{mostPlayed.opening_name}</strong> ({mostPlayed.games_played} games)
                      </p>
                    )}
                    {worstOpening && (
                      <p>
                        • <strong>{worstOpening.opening_name}</strong> has your highest mistake rate at {worstOpening.mistake_rate}%
                      </p>
                    )}
                    {bestOpening && bestOpening !== worstOpening && (
                      <p>
                        • <strong>{bestOpening.opening_name}</strong> has your lowest mistake rate at {bestOpening.mistake_rate}%
                      </p>
                    )}
                    {colorFilter === 'white' && (
                      <p>
                        • These are openings YOU choose to play - focus on understanding the ones with high mistake rates
                      </p>
                    )}
                    {colorFilter === 'black' && (
                      <p>
                        • These are openings you FACE from opponents - study responses to the ones giving you trouble
                      </p>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
