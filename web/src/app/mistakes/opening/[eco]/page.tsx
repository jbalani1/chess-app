'use client'

import { useState, useEffect, use } from 'react'
import { useSearchParams } from 'next/navigation'
import ChessBoard from '@/components/ChessBoard'
import { Move, MoveClassification, getEffectiveClassification, isCheckmate } from '@/lib/types'

interface Game {
  id: string
  eco: string
  opening_name: string
  white_player: string
  black_player: string
  result: string
  played_at: string
  time_control: string
  mistakes: Move[]
  mistake_count: number
  blunder_count: number
  inaccuracy_count: number
}

interface OpeningData {
  eco: string
  opening_name: string
  games: Game[]
  total_games: number
  total_mistakes: number
}

type ClassificationFilter = 'all' | 'inaccuracy' | 'mistake' | 'blunder'

const classificationColors = {
  good: 'bg-green-100 text-green-800 border-green-300',
  inaccuracy: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  mistake: 'bg-orange-100 text-orange-800 border-orange-300',
  blunder: 'bg-red-100 text-red-800 border-red-300',
}

export default function OpeningDetailPage({ params }: { params: Promise<{ eco: string }> }) {
  const { eco } = use(params)
  const searchParams = useSearchParams()
  const colorParam = searchParams.get('color')

  const [data, setData] = useState<OpeningData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>('all')

  // Selected move for board display
  const [selectedMove, setSelectedMove] = useState<Move | null>(null)
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)

  useEffect(() => {
    fetchData()
  }, [eco, colorParam, startDate, endDate, classificationFilter])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (colorParam) params.set('color', colorParam)
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (classificationFilter !== 'all') params.set('classification', classificationFilter)

      const url = `/api/openings/${eco}${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch opening data')

      const result = await response.json()
      setData(result)

      // Auto-select first mistake if available
      if (result.games?.length > 0 && result.games[0].mistakes?.length > 0) {
        setSelectedGame(result.games[0])
        setSelectedMove(result.games[0].mistakes[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleMoveClick = (game: Game, move: Move) => {
    setSelectedGame(game)
    setSelectedMove(move)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getMoveNumber = (ply: number) => {
    const moveNum = Math.ceil(ply / 2)
    const isWhite = ply % 2 === 1
    return `${moveNum}.${isWhite ? '' : '..'}`
  }

  const getBoardOrientation = (): 'white' | 'black' => {
    if (!selectedGame) return 'white'
    const username = 'negrilmannings'
    return selectedGame.black_player.toLowerCase() === username.toLowerCase() ? 'black' : 'white'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-96 bg-gray-200 rounded"></div>
              <div className="h-96 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <a href="/mistakes/opening" className="text-blue-600 hover:text-blue-800 text-sm">
            ← Back to Opening Analysis
          </a>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            {data?.opening_name || eco}
          </h1>
          <p className="text-gray-600">
            ECO: {eco} • {data?.total_games || 0} games • {data?.total_mistakes || 0} mistakes
            {colorParam && ` • Playing as ${colorParam}`}
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classification</label>
              <select
                value={classificationFilter}
                onChange={(e) => setClassificationFilter(e.target.value as ClassificationFilter)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white"
              >
                <option value="all">All Mistakes</option>
                <option value="inaccuracy">Inaccuracies</option>
                <option value="mistake">Mistakes</option>
                <option value="blunder">Blunders</option>
              </select>
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-6">
            {error}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chess Board */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Position</h2>
            {selectedMove ? (
              <>
                <ChessBoard
                  fen={selectedMove.position_fen}
                  width={400}
                  orientation={getBoardOrientation()}
                />
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-lg">
                      {getMoveNumber(selectedMove.ply)} {selectedMove.move_san}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${
                      classificationColors[getEffectiveClassification(selectedMove)]
                    }`}>
                      {isCheckmate(selectedMove) ? 'Checkmate' : selectedMove.classification}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Eval: {(selectedMove.eval_after / 100).toFixed(2)}</p>
                    <p>Eval change: {(selectedMove.eval_delta / 100).toFixed(2)}</p>
                    <p>Phase: {selectedMove.phase}</p>
                  </div>
                  {selectedGame && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm text-gray-600">
                        {selectedGame.white_player} vs {selectedGame.black_player}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(selectedGame.played_at)} • {selectedGame.result}
                      </p>
                      <a
                        href={`/games/${selectedGame.id}?move=${selectedMove.id}`}
                        className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
                      >
                        View full game →
                      </a>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
                <p className="text-gray-500">Select a mistake to view the position</p>
              </div>
            )}
          </div>

          {/* Mistakes List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">
                Mistakes in {data?.opening_name || eco}
              </h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {data?.games && data.games.length > 0 ? (
                data.games.map((game) => (
                  <div key={game.id} className="border-b border-gray-100">
                    {/* Game Header */}
                    <div className="px-4 py-3 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">
                            {game.white_player} vs {game.black_player}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(game.played_at)} • {game.time_control} • {game.result}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {game.blunder_count > 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs">
                              {game.blunder_count} blunder{game.blunder_count > 1 ? 's' : ''}
                            </span>
                          )}
                          {game.mistake_count > 0 && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs">
                              {game.mistake_count} mistake{game.mistake_count > 1 ? 's' : ''}
                            </span>
                          )}
                          {game.inaccuracy_count > 0 && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                              {game.inaccuracy_count} inaccuracy
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mistakes */}
                    <div className="px-4 py-2 space-y-2">
                      {game.mistakes.length > 0 ? (
                        game.mistakes.map((move) => (
                          <button
                            key={move.id}
                            onClick={() => handleMoveClick(game, move)}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${
                              selectedMove?.id === move.id
                                ? 'ring-2 ring-blue-500 ' + classificationColors[getEffectiveClassification(move)]
                                : classificationColors[getEffectiveClassification(move)] + ' hover:shadow-md'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-medium">
                                  {getMoveNumber(move.ply)} {move.move_san}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {move.piece_moved} • {move.phase}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className={`text-sm font-medium ${
                                  move.eval_delta < 0 ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {move.eval_delta > 0 ? '+' : ''}{(move.eval_delta / 100).toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-gray-500 text-sm py-2">No mistakes in this game</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  No games found with this opening and the selected filters.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
