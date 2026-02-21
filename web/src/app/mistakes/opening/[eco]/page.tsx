'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import ChessBoard from '@/components/ChessBoard'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import { Move, getEffectiveClassification, isCheckmate } from '@/lib/types'

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
  good: 'bg-green-500/20 text-green-400 border-green-500/30',
  inaccuracy: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  mistake: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  blunder: 'bg-red-500/20 text-red-400 border-red-500/30',
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
    const username = process.env.NEXT_PUBLIC_CHESS_COM_USERNAME || ''
    return selectedGame.black_player.toLowerCase() === username.toLowerCase() ? 'black' : 'white'
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-[var(--bg-tertiary)] rounded w-1/3"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-96 bg-[var(--bg-tertiary)] rounded"></div>
              <div className="h-96 bg-[var(--bg-tertiary)] rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <Breadcrumbs items={[{ label: 'Mistakes', href: '/mistakes' }, { label: 'By Opening', href: '/mistakes?tab=opening' }, { label: data?.opening_name || eco }]} />
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mt-2">
            {data?.opening_name || eco}
          </h1>
          <p className="text-[var(--text-secondary)]">
            ECO: {eco} • {data?.total_games || 0} games • {data?.total_mistakes || 0} mistakes
            {colorParam && ` • Playing as ${colorParam}`}
          </p>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Classification</label>
              <select
                value={classificationFilter}
                onChange={(e) => setClassificationFilter(e.target.value as ClassificationFilter)}
                className="border border-[var(--border-color)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] bg-[var(--bg-tertiary)]"
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
                className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
              >
                Clear dates
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-400 mb-6">
            {error}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chess Board */}
          <div className="card p-4">
            <h2 className="text-lg font-medium text-[var(--text-primary)] mb-4">Position</h2>
            {selectedMove ? (
              <>
                <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
                  <ChessBoard
                    fen={selectedMove.position_fen}
                    orientation={getBoardOrientation()}
                  />
                </div>
                <div className="mt-4 p-4 bg-[var(--bg-tertiary)] rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-lg">
                      {getMoveNumber(selectedMove.ply)} {selectedMove.move_san}
                      {selectedMove.captured_piece && (
                        <span className="text-[var(--text-secondary)] text-base font-normal"> (takes {selectedMove.captured_piece})</span>
                      )}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${
                      classificationColors[getEffectiveClassification(selectedMove)]
                    }`}>
                      {isCheckmate(selectedMove) ? 'Checkmate' : selectedMove.classification}
                    </span>
                  </div>
                  {selectedMove.best_move_san && selectedMove.best_move_san !== selectedMove.move_san && (
                    <div className="mb-3 p-2 bg-green-500/20 border border-green-500/30 rounded">
                      <span className="text-sm text-green-400">
                        Better move: <span className="font-mono font-bold">{selectedMove.best_move_san}</span>
                      </span>
                    </div>
                  )}
                  <div className="text-sm text-[var(--text-secondary)]">
                    <p>Eval: {(selectedMove.eval_after / 100).toFixed(2)}</p>
                    <p>Eval change: {(selectedMove.eval_delta / 100).toFixed(2)}</p>
                    <p>Phase: {selectedMove.phase}</p>
                  </div>
                  {selectedGame && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                      <p className="text-sm text-[var(--text-secondary)]">
                        {selectedGame.white_player} vs {selectedGame.black_player}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {formatDate(selectedGame.played_at)} • {selectedGame.result}
                      </p>
                      <a
                        href={`/games/${selectedGame.id}?move=${selectedMove.id}`}
                        className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] text-sm mt-2 inline-block"
                      >
                        View full game →
                      </a>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-96 bg-[var(--bg-tertiary)] rounded-lg">
                <p className="text-[var(--text-muted)]">Select a mistake to view the position</p>
              </div>
            )}
          </div>

          {/* Mistakes List */}
          <div className="card">
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <h2 className="text-lg font-medium text-[var(--text-primary)]">
                Mistakes in {data?.opening_name || eco}
              </h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {data?.games && data.games.length > 0 ? (
                data.games.map((game) => (
                  <div key={game.id} className="border-b border-[var(--divider-color)]">
                    {/* Game Header */}
                    <div className="px-4 py-3 bg-[var(--bg-tertiary)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-[var(--text-primary)] text-sm">
                            {game.white_player} vs {game.black_player}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            {formatDate(game.played_at)} • {game.time_control} • {game.result}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {game.blunder_count > 0 && (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded text-xs">
                              {game.blunder_count} blunder{game.blunder_count > 1 ? 's' : ''}
                            </span>
                          )}
                          {game.mistake_count > 0 && (
                            <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded text-xs">
                              {game.mistake_count} mistake{game.mistake_count > 1 ? 's' : ''}
                            </span>
                          )}
                          {game.inaccuracy_count > 0 && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
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
                                ? 'ring-2 ring-[var(--accent-primary)] ' + classificationColors[getEffectiveClassification(move)]
                                : classificationColors[getEffectiveClassification(move)] + ' hover:bg-[var(--bg-hover)]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="font-mono font-medium">
                                  {getMoveNumber(move.ply)} {move.move_san}
                                  {move.captured_piece && (
                                    <span className="text-[var(--text-muted)] font-normal"> (takes {move.captured_piece})</span>
                                  )}
                                </span>
                                {move.best_move_san && move.best_move_san !== move.move_san && (
                                  <span className="text-xs font-medium text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">
                                    Better: {move.best_move_san}
                                  </span>
                                )}
                              </div>
                              <div className="text-right flex items-center gap-3">
                                <span className="text-xs text-[var(--text-secondary)] font-medium">
                                  {formatDate(game.played_at)}
                                </span>
                                <span className={`text-sm font-medium ${
                                  move.eval_delta < 0 ? 'text-red-400' : 'text-green-400'
                                }`}>
                                  {move.eval_delta > 0 ? '+' : ''}{(move.eval_delta / 100).toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <p className="text-[var(--text-muted)] text-sm py-2">No mistakes in this game</p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-[var(--text-muted)]">
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
