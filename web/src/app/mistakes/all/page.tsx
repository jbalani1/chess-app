'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface MistakeMove {
  id: string
  game_id: string
  ply: number
  move_san: string
  move_uci: string
  eval_before: number
  eval_after: number
  eval_delta: number
  classification: 'mistake' | 'blunder'
  piece_moved: string
  phase: 'opening' | 'middlegame' | 'endgame'
  position_fen: string
  move_quality: string
  games: {
    id: string
    played_at: string
    white_player: string
    black_player: string
    opening_name: string
    eco: string
    time_control: string
    result: string
  }
}

const pieceNames: Record<string, string> = {
  'P': 'Pawn',
  'N': 'Knight',
  'B': 'Bishop',
  'R': 'Rook',
  'Q': 'Queen',
  'K': 'King'
}

export default function AllMistakesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialClassification = searchParams.get('type') || 'all'
  
  const [mistakes, setMistakes] = useState<MistakeMove[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [timeControls, setTimeControls] = useState<string[]>([])
  
  // Filter state
  const [classification, setClassification] = useState<'all' | 'mistake' | 'blunder'>(initialClassification as any)
  const [pieceMoved, setPieceMoved] = useState<string>('')
  const [phase, setPhase] = useState<string>('')
  const [timeControl, setTimeControl] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  
  // Fetch available time controls on mount
  useEffect(() => {
    const fetchTimeControls = async () => {
      try {
        const response = await fetch('/api/mistakes/time-controls')
        const result = await response.json()
        if (result.timeControls) {
          setTimeControls(result.timeControls)
        }
      } catch (error) {
        console.error('Error fetching time controls:', error)
      }
    }
    fetchTimeControls()
  }, [])
  
  useEffect(() => {
    fetchMistakes()
  }, [classification, pieceMoved, phase, timeControl, dateFrom, dateTo])
  
  const fetchMistakes = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (classification !== 'all') {
        params.append('classification', classification)
      }
      if (pieceMoved) {
        params.append('piece_moved', pieceMoved)
      }
      if (phase) {
        params.append('phase', phase)
      }
      if (timeControl) {
        params.append('time_control', timeControl)
      }
      if (dateFrom) {
        params.append('date_from', dateFrom)
      }
      if (dateTo) {
        params.append('date_to', dateTo)
      }
      params.append('limit', '100')
      
      const response = await fetch(`/api/mistakes/list?${params.toString()}`)
      const result = await response.json()
      
      if (result.data) {
        setMistakes(result.data)
        setTotal(result.total || 0)
      }
    } catch (error) {
      console.error('Error fetching mistakes:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const clearFilters = () => {
    setClassification('all')
    setPieceMoved('')
    setPhase('')
    setTimeControl('')
    setDateFrom('')
    setDateTo('')
  }
  
  const formatEval = (evalValue: number) => {
    const cp = evalValue / 100
    return cp > 0 ? `+${cp.toFixed(1)}` : cp.toFixed(1)
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Link href="/" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">All Mistakes & Blunders</h1>
          <p className="mt-2 text-gray-600">
            Review and analyze all your mistakes and blunders with detailed filters
          </p>
        </div>
        
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Filters</h2>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Clear All
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {/* Classification Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value as any)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="all">All (Mistakes + Blunders)</option>
                <option value="mistake">Mistakes Only</option>
                <option value="blunder">Blunders Only</option>
              </select>
            </div>
            
            {/* Piece Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Piece Moved
              </label>
              <select
                value={pieceMoved}
                onChange={(e) => setPieceMoved(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">All Pieces</option>
                <option value="P">Pawn</option>
                <option value="N">Knight</option>
                <option value="B">Bishop</option>
                <option value="R">Rook</option>
                <option value="Q">Queen</option>
                <option value="K">King</option>
              </select>
            </div>
            
            {/* Phase Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Game Phase
              </label>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">All Phases</option>
                <option value="opening">Opening</option>
                <option value="middlegame">Middlegame</option>
                <option value="endgame">Endgame</option>
              </select>
            </div>
            
            {/* Time Control Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Time Control
              </label>
              <select
                value={timeControl}
                onChange={(e) => setTimeControl(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="">All Time Controls</option>
                {timeControls.map((tc) => (
                  <option key={tc} value={tc}>
                    {tc}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            
            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
          </div>
          
          {/* Results count */}
          <div className="mt-4 text-sm text-gray-600">
            Showing {mistakes.length} of {total} mistakes/blunders
          </div>
        </div>
        
        {/* Mistakes List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Mistakes & Blunders</h3>
          </div>
          
          {loading ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Loading...
            </div>
          ) : mistakes.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No mistakes or blunders found with the current filters.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {mistakes.map((mistake) => (
                <div key={mistake.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          mistake.classification === 'blunder' 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}>
                          {mistake.classification === 'blunder' ? 'Blunder' : 'Mistake'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          Move {mistake.ply}: {mistake.move_san}
                        </span>
                        <span className="text-sm text-gray-500">
                          {pieceNames[mistake.piece_moved] || mistake.piece_moved}
                        </span>
                        <span className="text-sm text-gray-500 capitalize">
                          {mistake.phase}
                        </span>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">{mistake.games.white_player}</span> vs{' '}
                        <span className="font-medium">{mistake.games.black_player}</span>
                        {' • '}
                        {mistake.games.opening_name} ({mistake.games.eco})
                        {' • '}
                        {new Date(mistake.games.played_at).toLocaleDateString()}
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-gray-600">
                          Eval: {formatEval(mistake.eval_before)} → {formatEval(mistake.eval_after)}
                        </span>
                        <span className={`font-medium ${
                          mistake.eval_delta < -300 ? 'text-red-600' : 'text-orange-600'
                        }`}>
                          Δ {formatEval(mistake.eval_delta)}
                        </span>
                        <span className="text-gray-500">
                          {mistake.games.time_control} • {mistake.games.result}
                        </span>
                      </div>
                    </div>
                    
                    <div className="ml-4">
                      <Link
                        href={`/games/${mistake.game_id}?move=${mistake.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        View Game →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

