'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { slugToOpeningName } from '@/lib/openings'
import { Game } from '@/lib/types'

export default function OpeningDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const openingName = slugToOpeningName(slug)

  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGames = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ opening_family: openingName })
      const res = await fetch(`/api/games?${params}`)
      if (!res.ok) throw new Error('Failed to fetch games')
      const data = await res.json()
      setGames(data.games || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [openingName])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  function isUserWhite(game: Game): boolean {
    return game.white_player?.toLowerCase() === game.username?.toLowerCase()
  }

  // Compute stats
  const stats = games.reduce(
    (acc, g) => {
      const isWhite = isUserWhite(g)
      if (g.result === '1-0') {
        isWhite ? acc.wins++ : acc.losses++
      } else if (g.result === '0-1') {
        isWhite ? acc.losses++ : acc.wins++
      } else {
        acc.draws++
      }
      return acc
    },
    { wins: 0, losses: 0, draws: 0 }
  )
  const winRate = games.length > 0 ? Math.round((stats.wins / games.length) * 1000) / 10 : 0

  // Unique variations
  const variations = [...new Set(games.map(g => g.opening_name).filter(Boolean))]

  function resultLabel(game: Game): { text: string; className: string } {
    const isWhite = isUserWhite(game)
    if (game.result === '1-0') {
      return isWhite
        ? { text: 'Won', className: 'text-[var(--color-good)]' }
        : { text: 'Lost', className: 'text-[var(--color-blunder)]' }
    }
    if (game.result === '0-1') {
      return isWhite
        ? { text: 'Lost', className: 'text-[var(--color-blunder)]' }
        : { text: 'Won', className: 'text-[var(--color-good)]' }
    }
    return { text: 'Draw', className: 'text-[var(--text-muted)]' }
  }

  function opponentName(game: Game): string {
    return isUserWhite(game) ? game.black_player : game.white_player
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto animate-fadeIn">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[var(--bg-tertiary)] rounded w-1/4"></div>
          <div className="h-10 bg-[var(--bg-tertiary)] rounded w-1/2"></div>
          <div className="h-64 bg-[var(--bg-tertiary)] rounded w-full"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <Link href="/openings" className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] text-sm">
          &larr; Back to Openings
        </Link>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mt-2">{openingName}</h1>
        <p className="text-[var(--text-secondary)] text-lg">
          {games.length} game{games.length !== 1 ? 's' : ''} played
        </p>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-400 mb-6">
          {error}
        </div>
      )}

      {/* Stats bar */}
      <div className="card p-5 mb-6">
        <div className="flex flex-wrap gap-6 items-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--text-primary)]">{games.length}</div>
            <div className="text-xs text-[var(--text-muted)]">Games</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${
              winRate >= 60 ? 'text-[var(--color-good)]' :
              winRate >= 45 ? 'text-[var(--text-primary)]' :
              'text-[var(--color-blunder)]'
            }`}>{winRate}%</div>
            <div className="text-xs text-[var(--text-muted)]">Win rate</div>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[var(--color-good)]">+{stats.wins}</span>
            <span className="text-[var(--text-muted)]">={stats.draws}</span>
            <span className="text-[var(--color-blunder)]">&minus;{stats.losses}</span>
          </div>

          {/* Win/Loss/Draw bar */}
          {games.length > 0 && (
            <div className="flex-1 min-w-[120px]">
              <div className="flex rounded-full overflow-hidden h-2 bg-[var(--bg-tertiary)]">
                {stats.wins > 0 && (
                  <div className="bg-[var(--color-good)]" style={{ width: `${(stats.wins / games.length) * 100}%` }} />
                )}
                {stats.draws > 0 && (
                  <div className="bg-[var(--text-muted)]" style={{ width: `${(stats.draws / games.length) * 100}%` }} />
                )}
                {stats.losses > 0 && (
                  <div className="bg-[var(--color-blunder)]" style={{ width: `${(stats.losses / games.length) * 100}%` }} />
                )}
              </div>
            </div>
          )}

          {variations.length > 1 && (
            <div className="text-sm text-[var(--text-muted)] ml-auto">
              {variations.length} variation{variations.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Game List */}
      <div className="card">
        <div className="px-5 py-3 border-b border-[var(--border-color)]">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Games</h2>
        </div>

        {games.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)]">
            No games found for this opening.
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto_1fr] gap-4 px-5 py-2 text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border-color)]">
              <span>Opponent</span>
              <span>Result</span>
              <span>Color</span>
              <span>Time</span>
              <span>Variation</span>
            </div>

            {games.map((game) => {
              const result = resultLabel(game)
              const isWhite = isUserWhite(game)

              return (
                <Link
                  key={game.id}
                  href={`/games/${game.id}`}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_1fr] gap-2 sm:gap-4 px-5 py-3 border-b border-[var(--divider-color)] hover:bg-[var(--bg-hover)] transition-colors items-center"
                >
                  {/* Opponent */}
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--text-primary)]">
                      {opponentName(game)}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] sm:hidden">
                      {new Date(game.played_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Result */}
                  <span className={`font-semibold text-sm ${result.className}`}>
                    {result.text}
                  </span>

                  {/* Color */}
                  <span className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
                    <span className={`inline-block w-3 h-3 rounded-full border border-[var(--border-color)] ${isWhite ? 'bg-white' : 'bg-gray-800'}`} />
                    {isWhite ? 'W' : 'B'}
                  </span>

                  {/* Time control */}
                  <span className="text-sm text-[var(--text-muted)]">
                    {game.time_control}
                  </span>

                  {/* Variation + Date */}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-xs text-[var(--text-muted)] truncate">
                      {game.opening_name !== openingName ? game.opening_name : ''}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] hidden sm:inline shrink-0">
                      {new Date(game.played_at).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
