'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGlobalFilters } from '@/contexts/FilterContext'
import MistakeChart from '@/components/charts/MistakeChart'

interface OpeningStats {
  [key: string]: string | number | undefined
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

export default function MistakesByOpeningTab() {
  const { color } = useGlobalFilters()
  const router = useRouter()
  const [openings, setOpenings] = useState<OpeningStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOpenings = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (color !== 'all') params.set('color', color)
        const url = `/api/openings${params.toString() ? `?${params.toString()}` : ''}`
        const response = await fetch(url)
        if (!response.ok) return
        setOpenings(await response.json())
      } catch (err) {
        console.error('Error fetching openings:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchOpenings()
  }, [color])

  const openingFamilies = openings.reduce((acc, opening) => {
    const family = opening.opening_name.split(':')[0].split(' ').slice(0, 2).join(' ')
    if (!acc[family]) {
      acc[family] = { name: family, games: 0, mistakes: 0, blunders: 0, total_moves: 0 }
    }
    acc[family].games += opening.games_played
    acc[family].mistakes += opening.mistakes
    acc[family].blunders += opening.blunders
    acc[family].total_moves += opening.total_moves
    return acc
  }, {} as Record<string, { name: string; games: number; mistakes: number; blunders: number; total_moves: number }>)

  const sortedFamilies = Object.values(openingFamilies)
    .map(f => ({ ...f, mistake_rate: f.total_moves > 0 ? (f.mistakes + f.blunders) / f.total_moves * 100 : 0 }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 10)

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Opening Families */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Opening Families</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {sortedFamilies.map((family) => (
            <div key={family.name} className="bg-[var(--bg-tertiary)] rounded-lg p-4 border border-[var(--border-color)]">
              <h3 className="font-medium text-[var(--text-primary)] text-sm truncate" title={family.name}>{family.name}</h3>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{family.games}</p>
              <p className="text-xs text-[var(--text-muted)]">games</p>
              <p className={`text-sm font-medium ${family.mistake_rate > 15 ? 'text-red-400' : family.mistake_rate > 10 ? 'text-orange-400' : 'text-green-400'}`}>
                {family.mistake_rate.toFixed(1)}% mistake rate
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <MistakeChart
        data={openings.slice(0, 15)}
        type="bar"
        title={`Mistake Rate by Opening (${color === 'all' ? 'All' : color === 'white' ? 'White' : 'Black'})`}
        xKey="opening_name"
        yKey="mistake_rate"
      />

      {/* Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-[var(--border-color)] flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Opening Performance</h3>
          <span className="text-sm text-[var(--text-muted)]">{openings.length} openings</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--divider-color)]">
            <thead className="bg-[var(--bg-tertiary)]">
              <tr>
                {['Opening', 'ECO', 'Games', 'Moves', 'Good', 'Inaccuracies', 'Mistakes', 'Blunders', 'Mistake Rate'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider-color)]">
              {openings.map((item) => (
                <tr
                  key={`${item.eco}-${item.opening_name}`}
                  className="hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                  onClick={() => {
                    const params = new URLSearchParams()
                    if (color !== 'all') params.set('color', color)
                    router.push(`/mistakes/opening/${item.eco}${params.toString() ? `?${params.toString()}` : ''}`)
                  }}
                >
                  <td className="px-6 py-4">
                    <div className="text-base font-medium text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]">
                      {item.opening_name || 'Unknown Opening'}
                      <span className="ml-2 text-[var(--text-muted)]">&rarr;</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-color)]">
                      {item.eco || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-base font-medium text-[var(--text-primary)]">{item.games_played}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-base text-[var(--text-primary)]">{item.total_moves}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-green-500/20 text-green-400">{item.good_moves}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-yellow-500/20 text-yellow-400">{item.inaccuracies}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-orange-500/20 text-orange-400">{item.mistakes}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-red-500/20 text-red-400">{item.blunders}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1 bg-[var(--bg-tertiary)] rounded-full h-2 mr-2 w-16">
                        <div
                          className={`h-2 rounded-full ${
                            item.mistake_rate > 20 ? 'bg-red-500' : item.mistake_rate > 15 ? 'bg-orange-500' : item.mistake_rate > 10 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(item.mistake_rate * 2, 100)}%` }}
                        />
                      </div>
                      <span className="text-base font-medium text-[var(--text-primary)]">{item.mistake_rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
