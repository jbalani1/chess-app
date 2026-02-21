'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { openingToSlug } from '@/lib/openings'

interface OpeningFamily {
  base_name: string
  total_games: number
  wins: number
  losses: number
  draws: number
  win_rate: number
  eco_codes: string[]
  variations: string[]
  last_played: string
}

type SortKey = 'games' | 'winrate' | 'name' | 'recent'
type ColorFilter = 'all' | 'white' | 'black'

export default function OpeningsPage() {
  const [openings, setOpenings] = useState<OpeningFamily[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [colorFilter, setColorFilter] = useState<ColorFilter>('all')
  const [sortBy, setSortBy] = useState<SortKey>('games')

  const fetchOpenings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ view: 'browse' })
      if (colorFilter !== 'all') params.set('color', colorFilter)
      const res = await fetch(`/api/openings?${params}`)
      if (!res.ok) throw new Error('Failed to fetch openings')
      const data = await res.json()
      setOpenings(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [colorFilter])

  useEffect(() => {
    fetchOpenings()
  }, [fetchOpenings])

  const sorted = [...openings].sort((a, b) => {
    switch (sortBy) {
      case 'games': return b.total_games - a.total_games
      case 'winrate': return b.win_rate - a.win_rate
      case 'name': return a.base_name.localeCompare(b.base_name)
      case 'recent': return new Date(b.last_played).getTime() - new Date(a.last_played).getTime()
      default: return 0
    }
  })

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto animate-fadeIn">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--bg-tertiary)] rounded w-1/3"></div>
          <div className="h-12 bg-[var(--bg-tertiary)] rounded w-full"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-40 bg-[var(--bg-tertiary)] rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link href="/" className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] text-sm">
          &larr; Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mt-2">Openings</h1>
        <p className="text-[var(--text-secondary)] text-lg">
          Browse your game history by opening family
        </p>
      </div>

      {/* Filters */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Color</label>
            <div className="flex rounded-lg overflow-hidden border border-[var(--border-color)]">
              {(['all', 'white', 'black'] as ColorFilter[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setColorFilter(c)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    colorFilter === c
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {c === 'all' ? 'All' : c === 'white' ? 'White' : 'Black'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-primary)] px-3 py-2 text-sm focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="games">Games played</option>
              <option value="winrate">Win rate</option>
              <option value="name">Name</option>
              <option value="recent">Last played</option>
            </select>
          </div>
          <div className="ml-auto text-sm text-[var(--text-muted)]">
            {openings.length} opening{openings.length !== 1 ? 's' : ''} &middot; {openings.reduce((sum, o) => sum + o.total_games, 0)} games
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Opening Cards Grid */}
      {sorted.length === 0 ? (
        <div className="card p-8 text-center text-[var(--text-muted)]">
          No openings found with the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((opening) => (
            <Link
              key={opening.base_name}
              href={`/openings/${openingToSlug(opening.base_name)}`}
              className="card p-5 hover:border-[var(--accent-primary)] transition-colors group"
            >
              {/* Name & ECO codes */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                  {opening.base_name}
                </h3>
                {opening.eco_codes.length > 0 && (
                  <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded font-mono shrink-0 ml-2">
                    {opening.eco_codes.length <= 3
                      ? opening.eco_codes.join(', ')
                      : `${opening.eco_codes[0]}\u2013${opening.eco_codes[opening.eco_codes.length - 1]}`
                    }
                  </span>
                )}
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 mb-3 text-sm">
                <span className="text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">{opening.total_games}</span> game{opening.total_games !== 1 ? 's' : ''}
                </span>
                <span className={`font-semibold ${
                  opening.win_rate >= 60 ? 'text-[var(--color-good)]' :
                  opening.win_rate >= 45 ? 'text-[var(--text-primary)]' :
                  'text-[var(--color-blunder)]'
                }`}>
                  {opening.win_rate}%
                </span>
              </div>

              {/* Win/Loss/Draw bar */}
              <div className="flex rounded-full overflow-hidden h-2 mb-3 bg-[var(--bg-tertiary)]">
                {opening.wins > 0 && (
                  <div
                    className="bg-[var(--color-good)]"
                    style={{ width: `${(opening.wins / opening.total_games) * 100}%` }}
                  />
                )}
                {opening.draws > 0 && (
                  <div
                    className="bg-[var(--text-muted)]"
                    style={{ width: `${(opening.draws / opening.total_games) * 100}%` }}
                  />
                )}
                {opening.losses > 0 && (
                  <div
                    className="bg-[var(--color-blunder)]"
                    style={{ width: `${(opening.losses / opening.total_games) * 100}%` }}
                  />
                )}
              </div>

              {/* Win/Draw/Loss counts */}
              <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-2">
                <span className="text-[var(--color-good)]">+{opening.wins}</span>
                <span>=  {opening.draws}</span>
                <span className="text-[var(--color-blunder)]">&minus;{opening.losses}</span>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                {opening.variations.length > 0 && (
                  <span>{opening.variations.length} variation{opening.variations.length !== 1 ? 's' : ''}</span>
                )}
                <span className="ml-auto">
                  {new Date(opening.last_played).toLocaleDateString()}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
