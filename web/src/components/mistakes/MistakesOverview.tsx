'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useGlobalFilters } from '@/contexts/FilterContext'
import { TrendingDown, Crown, BookOpen, AlertTriangle } from 'lucide-react'

interface OverviewStats {
  totalMistakes: number
  totalBlunders: number
  mistakeRate: number
  worstPiece: { piece: string; rate: number } | null
  worstOpening: { name: string; rate: number } | null
  recentBlunders: { id: string; game_id: string; move_san: string; eval_delta: number; played_at: string }[]
}

const pieceNames: Record<string, string> = {
  P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King'
}

export default function MistakesOverview() {
  const { buildFilterParams } = useGlobalFilters()
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true)
      try {
        const params = buildFilterParams()
        params.set('limit', '5')

        const [mistakesRes, piecesRes, openingsRes] = await Promise.all([
          fetch(`/api/mistakes/list?${params.toString()}`),
          fetch('/api/mistakes?groupBy=piece'),
          fetch('/api/openings'),
        ])

        const mistakesData = await mistakesRes.json()
        const piecesData = await piecesRes.ok ? await piecesRes.json() : []
        const openingsData = await openingsRes.ok ? await openingsRes.json() : []

        const pieces = Array.isArray(piecesData) ? piecesData : piecesData.data || []
        const openings = Array.isArray(openingsData) ? openingsData : openingsData.data || []

        const worstPiece = pieces.length > 0
          ? { piece: pieces[0].piece_moved, rate: pieces[0].mistake_rate }
          : null

        const sortedOpenings = [...openings].filter((o: { total_moves: number }) => o.total_moves >= 10).sort((a: { mistake_rate: number }, b: { mistake_rate: number }) => b.mistake_rate - a.mistake_rate)
        const worstOpening = sortedOpenings.length > 0
          ? { name: sortedOpenings[0].opening_name, rate: sortedOpenings[0].mistake_rate }
          : null

        const mistakes = mistakesData.data || []
        const blunders = mistakes.filter((m: { classification: string }) => m.classification === 'blunder')

        setStats({
          totalMistakes: mistakesData.total || 0,
          totalBlunders: blunders.length,
          mistakeRate: 0,
          worstPiece,
          worstOpening,
          recentBlunders: blunders.slice(0, 5).map((b: { id: string; game_id: string; move_san: string; eval_delta: number; games: { played_at: string } }) => ({
            id: b.id,
            game_id: b.game_id,
            move_san: b.move_san,
            eval_delta: b.eval_delta,
            played_at: b.games?.played_at || '',
          })),
        })
      } catch (error) {
        console.error('Error fetching overview:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchOverview()
  }, [buildFilterParams])

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-mistake)]/20 flex items-center justify-center">
              <AlertTriangle size={20} className="text-[var(--color-mistake)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalMistakes}</p>
              <p className="text-sm text-[var(--text-secondary)]">Total Mistakes</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-blunder)]/20 flex items-center justify-center">
              <TrendingDown size={20} className="text-[var(--color-blunder)]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalBlunders}</p>
              <p className="text-sm text-[var(--text-secondary)]">Blunders</p>
            </div>
          </div>
        </div>
        {stats.worstPiece && (
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-secondary)]/20 flex items-center justify-center">
                <Crown size={20} className="text-[var(--accent-secondary)]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{pieceNames[stats.worstPiece.piece] || stats.worstPiece.piece}</p>
                <p className="text-sm text-[var(--text-secondary)]">Worst Piece ({stats.worstPiece.rate}%)</p>
              </div>
            </div>
          </div>
        )}
        {stats.worstOpening && (
          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-tertiary)]/20 flex items-center justify-center">
                <BookOpen size={20} className="text-[var(--accent-tertiary)]" />
              </div>
              <div>
                <p className="text-lg font-bold text-[var(--text-primary)] truncate max-w-[150px]" title={stats.worstOpening.name}>{stats.worstOpening.name}</p>
                <p className="text-sm text-[var(--text-secondary)]">Worst Opening ({stats.worstOpening.rate}%)</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recent blunders */}
      {stats.recentBlunders.length > 0 && (
        <div className="card">
          <div className="px-5 py-4 border-b border-[var(--border-color)]">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Recent Blunders</h3>
          </div>
          <div className="divide-y divide-[var(--divider-color)]">
            {stats.recentBlunders.map((b) => (
              <div key={b.id} className="px-5 py-3 flex items-center justify-between hover:bg-[var(--bg-hover)] transition-colors">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-red-500/20 text-red-400">
                    Blunder
                  </span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">{b.move_san}</span>
                  <span className="text-sm text-[var(--color-blunder)] font-semibold">
                    {(b.eval_delta / 100).toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {b.played_at && (
                    <span className="text-sm text-[var(--text-muted)]">
                      {new Date(b.played_at).toLocaleDateString()}
                    </span>
                  )}
                  <Link
                    href={`/games/${b.game_id}?move=${b.id}`}
                    className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] text-sm font-medium"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
