'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { buildFilterQueryString, FilterState } from './InsightFilters'

interface TrendBucket {
  period: string
  label: string
  mistakes: number
  blunders: number
  total: number
  avg_eval_loss: number
  by_category: Record<string, number>
}

interface TrendSummary {
  trend_direction: 'improving' | 'worsening' | 'stable'
  recent_avg: number
  earlier_avg: number
  percent_change: number
}

interface TemporalTrendsProps {
  filters: FilterState
}

const BLUNDER_CATEGORIES = [
  { key: 'hanging_piece', label: 'Hanging Piece', color: '#EF4444' },
  { key: 'calculation_error', label: 'Calculation Error', color: '#8B5CF6' },
  { key: 'greedy_capture', label: 'Greedy Capture', color: '#F59E0B' },
  { key: 'missed_tactic', label: 'Missed Tactic', color: '#F97316' },
  { key: 'opening_principle', label: 'Opening Principle', color: '#22C55E' },
  { key: 'endgame_technique', label: 'Endgame Technique', color: '#3B82F6' },
  { key: 'overlooked_check', label: 'Overlooked Check', color: '#DC2626' },
  { key: 'back_rank', label: 'Back Rank', color: '#EC4899' },
  { key: 'time_pressure', label: 'Time Pressure', color: '#6B7280' },
  { key: 'positional_collapse', label: 'Positional Collapse', color: '#6366F1' },
]

export default function TemporalTrends({ filters }: TemporalTrendsProps) {
  const [buckets, setBuckets] = useState<TrendBucket[]>([])
  const [summary, setSummary] = useState<TrendSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [granularity, setGranularity] = useState<'week' | 'month'>('week')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    fetchTrends()
  }, [filters, granularity, selectedCategory])

  const fetchTrends = async () => {
    setLoading(true)
    try {
      const filterQS = buildFilterQueryString(filters)
      const params = new URLSearchParams(filterQS)
      params.set('granularity', granularity)
      if (selectedCategory !== 'all') {
        params.set('category', selectedCategory)
      }
      const response = await fetch(`/api/insights/trends?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch trends')
      const data = await response.json()
      setBuckets(data.buckets || [])
      setSummary(data.summary || null)
    } catch {
      setBuckets([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }

  const trendBadge = () => {
    if (!summary || buckets.length < 4) return null

    const bgColor = summary.trend_direction === 'improving'
      ? 'bg-green-100 text-green-800 border-green-200'
      : summary.trend_direction === 'worsening'
      ? 'bg-red-100 text-red-800 border-red-200'
      : 'bg-gray-100 text-gray-700 border-gray-200'

    const arrow = summary.trend_direction === 'improving' ? '↓' : summary.trend_direction === 'worsening' ? '↑' : '→'
    const pctText = Math.abs(summary.percent_change)

    let message: string
    if (summary.trend_direction === 'improving') {
      message = `Mistakes down ${pctText}% recently`
    } else if (summary.trend_direction === 'worsening') {
      message = `Mistakes up ${pctText}% recently`
    } else {
      message = 'Mistake rate is stable'
    }

    return (
      <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${bgColor}`}>
        <span className="mr-1.5">{arrow}</span>
        {message}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center">
            <span className="mr-2">📈</span>
            Mistake Trends
          </h3>
          {trendBadge() && <div className="mt-2">{trendBadge()}</div>}
        </div>
        <div className="flex items-center space-x-3">
          {/* Category filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-sm border rounded-md px-2 py-1 text-gray-700 bg-white"
          >
            <option value="all">All Categories</option>
            {BLUNDER_CATEGORIES.map(cat => (
              <option key={cat.key} value={cat.key}>{cat.label}</option>
            ))}
          </select>
          {/* Granularity toggle */}
          <div className="flex bg-gray-100 rounded-md p-0.5">
            <button
              onClick={() => setGranularity('week')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                granularity === 'week'
                  ? 'bg-white shadow text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setGranularity('month')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                granularity === 'month'
                  ? 'bg-white shadow text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="h-[250px] flex items-center justify-center">
          <div className="animate-pulse text-gray-400">Loading trends...</div>
        </div>
      ) : buckets.length < 2 ? (
        <div className="h-[250px] flex items-center justify-center text-gray-500 text-sm">
          Not enough data for trend visualization. Play and analyze more games!
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={buckets} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#6B7280' }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => [value, name]}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line
              type="monotone"
              dataKey="mistakes"
              stroke="#F59E0B"
              name="Mistakes"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="blunders"
              stroke="#EF4444"
              name="Blunders"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
