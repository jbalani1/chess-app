import { supabase } from '@/lib/supabase'
import MistakeChart from '@/components/charts/MistakeChart'
import Link from 'next/link'

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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Chess Analysis Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Analyze your chess games and identify patterns in your mistakes
          </p>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold">G</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Total Games</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total_games}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold">✓</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Accuracy</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.accuracy_percentage}%</p>
                </div>
              </div>
            </div>

            <Link href="/mistakes/all?type=all" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold">!</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Mistakes</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.mistakes + stats.blunders}</p>
                </div>
              </div>
            </Link>

            <Link href="/mistakes/all?type=blunder" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                    <span className="text-white font-bold">X</span>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Blunders</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.blunders}</p>
                </div>
              </div>
            </Link>
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <MistakeChart
            data={mistakesByPhase}
            type="bar"
            title="Mistakes by Game Phase"
            xKey="phase"
            yKey="mistake_rate"
          />
          
          <MistakeChart
            data={mistakesByTimeControl}
            type="bar"
            title="Mistakes by Time Control"
            xKey="time_control"
            yKey="mistake_rate"
          />
        </div>

        {/* Recent Games */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Games</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {recentGames.length > 0 ? (
              recentGames.map((game) => (
                <div key={game.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {game.white_player} vs {game.black_player}
                          </p>
                          <p className="text-sm text-gray-500">
                            {game.opening_name} ({game.eco}) • {game.time_control}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">{game.result}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(game.played_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="ml-4">
                      <a
                        href={`/games/${game.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Analysis →
                      </a>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                No games analyzed yet. Run the worker to analyze your Chess.com games.
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <a
              href="/insights"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">🎯</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Chess Insights</p>
                <p className="text-sm text-gray-500">Tactical & positional patterns</p>
              </div>
            </a>

            <a
              href="/mistakes/piece"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">♟</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Mistakes by Piece</p>
                <p className="text-sm text-gray-500">See which pieces cause most mistakes</p>
              </div>
            </a>

            <a
              href="/mistakes/opening"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-indigo-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">♔</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Mistakes by Opening</p>
                <p className="text-sm text-gray-500">Analyze opening performance</p>
              </div>
            </a>

            <a
              href="/insights"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">🔍</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Blunder Categories</p>
                <p className="text-sm text-gray-500">Why you make mistakes</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}