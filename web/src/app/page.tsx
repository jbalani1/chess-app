import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Gamepad2, Target, AlertTriangle, Zap, RefreshCcw, GraduationCap, Lightbulb } from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import SectionHeader from '@/components/ui/SectionHeader'
import ActionCard from '@/components/ui/ActionCard'
import MistakeChart from '@/components/charts/MistakeChart'

async function getGameStatistics() {
  const { data, error } = await supabase
    .from('game_statistics')
    .select('*')
    .single()

  if (error) {
    console.error('Error fetching game statistics:', error)
    return null
  }

  return data
}

async function getMistakesByPhase() {
  const { data, error } = await supabase
    .from('mistakes_by_phase')
    .select('*')
    .order('phase')

  if (error) {
    console.error('Error fetching mistakes by phase:', error)
    return []
  }

  return data || []
}

async function getMistakesByTimeControl() {
  const { data, error } = await supabase
    .from('mistakes_by_time_control')
    .select('*')
    .order('mistake_rate', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching mistakes by time control:', error)
    return []
  }

  return data || []
}

async function getRecentGames() {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('played_at', { ascending: false })
    .limit(5)

  if (error) {
    console.error('Error fetching recent games:', error)
    return []
  }

  return data || []
}

export default async function HomePage() {
  const [stats, mistakesByPhase, mistakesByTimeControl, recentGames] = await Promise.all([
    getGameStatistics(),
    getMistakesByPhase(),
    getMistakesByTimeControl(),
    getRecentGames()
  ])

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Your chess analysis at a glance
        </p>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={<Gamepad2 size={24} />}
            label="Total Games"
            value={stats.total_games}
            accentColor="blue"
          />
          <StatCard
            icon={<Target size={24} />}
            label="Accuracy"
            value={`${stats.accuracy_percentage}%`}
            accentColor="green"
          />
          <StatCard
            icon={<AlertTriangle size={24} />}
            label="Mistakes"
            value={stats.mistakes + stats.blunders}
            href="/mistakes?tab=all"
            accentColor="orange"
          />
          <StatCard
            icon={<Zap size={24} />}
            label="Blunders"
            value={stats.blunders}
            href="/mistakes?tab=all"
            accentColor="red"
          />
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8">
        <SectionHeader title="Quick Actions" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <ActionCard
            title="Missed Tactics"
            subtitle="Tactical opportunities"
            href="/tactics"
            icon={<Target size={36} />}
            accentColor="purple"
          />
          <ActionCard
            title="Recurring Mistakes"
            subtitle="Patterns you repeat"
            href="/mistakes?tab=recurring"
            icon={<RefreshCcw size={36} />}
            accentColor="amber"
          />
          <ActionCard
            title="Drill Mode"
            subtitle="Practice positions"
            href="/drill"
            icon={<GraduationCap size={36} />}
            accentColor="green"
          />
          <ActionCard
            title="Chess Insights"
            subtitle="Patterns & analysis"
            href="/insights"
            icon={<Lightbulb size={36} />}
            accentColor="blue"
          />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Recent Games - Takes 2 columns */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <SectionHeader
                title="Recent Games"
                action={{ label: 'View All', href: '/games' }}
              />
            </div>
            <div className="divide-y divide-[var(--divider-color)]">
              {recentGames.length > 0 ? (
                recentGames.map((game) => (
                  <Link
                    key={game.id}
                    href={`/games/${game.id}`}
                    className="block px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[var(--text-primary)] truncate">
                          {game.white_player} vs {game.black_player}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)] truncate">
                          {game.opening_name} • {game.time_control}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className={`font-medium ${
                          game.result === '1-0' ? 'text-[var(--accent-primary)]' :
                          game.result === '0-1' ? 'text-[var(--color-blunder)]' :
                          'text-[var(--text-secondary)]'
                        }`}>
                          {game.result}
                        </p>
                        <p className="text-xs text-[var(--text-muted)]">
                          {new Date(game.played_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No games analyzed yet. Run the worker to analyze your Chess.com games.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats - Takes 1 column */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="font-semibold text-[var(--text-primary)] mb-3">Analysis Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">By Piece</span>
                <Link href="/mistakes?tab=piece" className="text-[var(--accent-primary)] text-sm">
                  View &rarr;
                </Link>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">By Opening</span>
                <Link href="/mistakes?tab=opening" className="text-[var(--accent-primary)] text-sm">
                  View &rarr;
                </Link>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-secondary)]">Common Positions</span>
                <Link href="/positions" className="text-[var(--accent-primary)] text-sm">
                  View →
                </Link>
              </div>
            </div>
          </div>

          {stats && (
            <div className="card p-4">
              <h3 className="font-semibold text-[var(--text-primary)] mb-3">Move Quality</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Good Moves</span>
                  <span className="text-[var(--accent-primary)] font-medium">{stats.good_moves}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Inaccuracies</span>
                  <span className="text-[var(--color-inaccuracy)] font-medium">{stats.inaccuracies}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Mistakes</span>
                  <span className="text-[var(--color-mistake)] font-medium">{stats.mistakes}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-secondary)]">Blunders</span>
                  <span className="text-[var(--color-blunder)] font-medium">{stats.blunders}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-4">
          <MistakeChart
            data={mistakesByPhase}
            type="bar"
            title="Mistakes by Game Phase"
            xKey="phase"
            yKey="mistake_rate"
          />
        </div>

        <div className="card p-4">
          <MistakeChart
            data={mistakesByTimeControl}
            type="bar"
            title="Mistakes by Time Control"
            xKey="time_control"
            yKey="mistake_rate"
          />
        </div>
      </div>
    </div>
  )
}
