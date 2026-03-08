"use client"

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  Ghost, Eye, Castle, Beef, BookOpen, Crown, Zap,
  Calculator, TrendingDown, Timer, BookMarked, BarChart3, Target, Flame
} from 'lucide-react'
import { DrillStats, BlunderCategory } from '@/lib/types'
import StatCard from '@/components/ui/StatCard'

const CATEGORY_INFO: Record<BlunderCategory, { icon: ReactNode; description: string }> = {
  hanging_piece: { icon: <Ghost size={20} />, description: 'Pieces left undefended or attacked' },
  overlooked_check: { icon: <Eye size={20} />, description: 'Missed checks or check sequences' },
  back_rank: { icon: <Castle size={20} />, description: 'Back rank mate vulnerabilities' },
  greedy_capture: { icon: <Beef size={20} />, description: 'Capturing material that loses more' },
  opening_principle: { icon: <BookOpen size={20} />, description: 'Violating opening principles' },
  endgame_technique: { icon: <Crown size={20} />, description: 'Poor endgame decisions' },
  missed_tactic: { icon: <Zap size={20} />, description: 'Failed to see tactical opportunities' },
  calculation_error: { icon: <Calculator size={20} />, description: 'Miscalculated positions' },
  positional_collapse: { icon: <TrendingDown size={20} />, description: 'Position deteriorated gradually' },
  time_pressure: { icon: <Timer size={20} />, description: 'Errors under time pressure' }
}

const CATEGORY_ORDER: BlunderCategory[] = [
  'hanging_piece',
  'endgame_technique',
  'calculation_error',
  'positional_collapse',
  'greedy_capture',
  'overlooked_check',
  'opening_principle',
  'missed_tactic',
  'back_rank',
  'time_pressure'
]

function formatCategoryName(cat: string): string {
  return cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default function DrillDashboard() {
  const [stats, setStats] = useState<DrillStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/drill/stats')
        if (!response.ok) throw new Error('Failed to fetch stats')
        const data = await response.json()
        setStats(data)
      } catch (e) {
        setError('Failed to load drill statistics')
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)]"></div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-blunder)]">{error || 'Failed to load'}</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Drill Your Mistakes</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Practice positions where you previously blundered. Spaced repetition helps you remember.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<BookMarked size={24} />}
          label="Due for Review"
          value={stats.positions_due}
          accentColor="orange"
        />
        <StatCard
          icon={<BarChart3 size={24} />}
          label="Total Positions"
          value={stats.total_positions}
          accentColor="blue"
        />
        <StatCard
          icon={<Target size={24} />}
          label="Accuracy"
          value={`${stats.accuracy_rate}%`}
          accentColor="green"
        />
        <StatCard
          icon={<Flame size={24} />}
          label="Current Streak"
          value={stats.current_streak}
          accentColor="purple"
        />
      </div>

      {/* Quick Start */}
      <div className="card p-5 mb-6 border-l-4 border-l-[var(--accent-primary)]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Quick Start</h2>
            <p className="text-[var(--text-secondary)]">
              {stats.positions_due > 0
                ? `You have ${stats.positions_due} positions due for review`
                : 'Start drilling your most costly mistakes'}
            </p>
          </div>
          <Link
            href="/drill/session"
            className="btn-primary px-6 py-3"
          >
            Start Drill
          </Link>
        </div>
      </div>

      {/* Category Cards */}
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Drill by Category</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {CATEGORY_ORDER.map(cat => {
          const catStats = stats.by_category[cat]
          if (!catStats || catStats.total === 0) return null

          const info = CATEGORY_INFO[cat]
          const progressPct = catStats.total > 0
            ? Math.round((catStats.mastered / catStats.total) * 100)
            : 0

          return (
            <div key={cat} className="card p-4 hover:border-[var(--accent-primary)]/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-primary)]">{info.icon}</div>
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)]">{formatCategoryName(cat)}</h3>
                    <p className="text-sm text-[var(--text-muted)]">{info.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-[var(--text-primary)]">{catStats.total}</div>
                  <div className="text-xs text-[var(--text-muted)]">positions</div>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-sm mb-3">
                <span className="text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--accent-primary)]">{catStats.mastered}</span> mastered
                </span>
                <span className="text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--accent-secondary)]">{catStats.due_count}</span> due
                </span>
                {catStats.accuracy > 0 && (
                  <span className="text-[var(--text-secondary)]">
                    <span className="font-medium">{catStats.accuracy}%</span> accuracy
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-[var(--bg-secondary)] rounded-full h-2 mb-3">
                <div
                  className="bg-[var(--accent-primary)] h-2 rounded-full transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              <Link
                href={`/drill/session?category=${cat}`}
                className="block w-full text-center px-4 py-2 text-sm font-medium text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 rounded-lg hover:bg-[var(--accent-primary)]/20 transition-colors"
              >
                Drill This Category
              </Link>
            </div>
          )
        })}
      </div>

      {/* Progress section */}
      <div className="card p-5">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Your Progress</h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--text-primary)]">{stats.total_attempts}</div>
            <div className="text-sm text-[var(--text-muted)]">Total Attempts</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--accent-primary)]">{stats.positions_mastered}</div>
            <div className="text-sm text-[var(--text-muted)]">Positions Mastered</div>
            <div className="text-xs text-[var(--text-muted)] mt-1">3+ correct, 7+ day interval</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--accent-tertiary)]">
              {stats.total_positions > 0
                ? Math.round((stats.positions_mastered / stats.total_positions) * 100)
                : 0}%
            </div>
            <div className="text-sm text-[var(--text-muted)]">Mastery Rate</div>
          </div>
        </div>
      </div>
    </div>
  )
}
