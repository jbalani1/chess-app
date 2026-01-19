'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import ChessBoard from '@/components/ChessBoard'
import MoveList from '@/components/MoveList'
import { Game, Move, getEffectiveClassification, isCheckmate } from '@/lib/types'

async function getGame(gameId: string): Promise<{ game: Game; moves: Move[] } | null> {
  try {
    const response = await fetch(`/api/games/${gameId}`)
    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error('Failed to fetch game')
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching game:', error)
    return null
  }
}

// Helper function to format evaluation
const formatEval = (evaluation: number) => {
  if (evaluation > 10000) return 'M+' + (10000 - evaluation)
  if (evaluation < -10000) return 'M' + (evaluation + 10000)
  return (evaluation > 0 ? '+' : '') + (evaluation / 100).toFixed(1)
}

export default function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams()
  const [gameData, setGameData] = useState<{ game: Game; moves: Move[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentFen, setCurrentFen] = useState<string>('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const [selectedMoveId, setSelectedMoveId] = useState<string | null>(null)
  const [classificationFilter, setClassificationFilter] = useState<'inaccuracy' | 'mistake' | 'blunder' | null>(null)

  useEffect(() => {
    async function fetchGame() {
      try {
        const { id } = await params
        const data = await getGame(id)
        setGameData(data)
        if (data && data.moves && data.moves.length > 0) {
          // Check if there's a move parameter in the URL
          const moveIdFromUrl = searchParams.get('move')
          
          if (moveIdFromUrl) {
            // Find the move by ID
            const targetMove = data.moves.find(m => m.id === moveIdFromUrl)
            if (targetMove) {
              setCurrentFen(targetMove.position_fen)
              setSelectedMoveId(targetMove.id)
              // Scroll to the move in the list after a short delay
              setTimeout(() => {
                const moveElement = document.getElementById(`move-${targetMove.id}`)
                if (moveElement) {
                  moveElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              }, 100)
            } else {
              // Fallback to first move if move not found
              setCurrentFen(data.moves[0].position_fen)
              setSelectedMoveId(data.moves[0].id)
            }
          } else {
            // Set initial board to the position after the first move
            setCurrentFen(data.moves[0].position_fen)
            setSelectedMoveId(data.moves[0].id)
          }
        }
      } catch (err) {
        setError('Failed to fetch game data.')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchGame()
  }, [params, searchParams])

  const handleMoveClick = (moveId: string, fen: string) => {
    console.log('handleMoveClick', { moveId, fen })
    setSelectedMoveId(moveId)
    setCurrentFen(fen)
  }

  // Navigation functions
  const getCurrentMoveIndex = () => {
    if (!gameData || !selectedMoveId) return -1
    return gameData.moves.findIndex(m => m.id === selectedMoveId)
  }

  const goToFirstMove = () => {
    if (!gameData || gameData.moves.length === 0) return
    const firstMove = gameData.moves[0]
    setSelectedMoveId(firstMove.id)
    setCurrentFen(firstMove.position_fen)
  }

  const goToPrevMove = () => {
    if (!gameData) return
    const currentIndex = getCurrentMoveIndex()
    if (currentIndex > 0) {
      const prevMove = gameData.moves[currentIndex - 1]
      setSelectedMoveId(prevMove.id)
      setCurrentFen(prevMove.position_fen)
    }
  }

  const goToNextMove = () => {
    if (!gameData) return
    const currentIndex = getCurrentMoveIndex()
    if (currentIndex < gameData.moves.length - 1) {
      const nextMove = gameData.moves[currentIndex + 1]
      setSelectedMoveId(nextMove.id)
      setCurrentFen(nextMove.position_fen)
    }
  }

  const goToLastMove = () => {
    if (!gameData || gameData.moves.length === 0) return
    const lastMove = gameData.moves[gameData.moves.length - 1]
    setSelectedMoveId(lastMove.id)
    setCurrentFen(lastMove.position_fen)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading game...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-red-600 mb-4">{error}</p>
          <a href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    )
  }

  if (!gameData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Game Not Found</h1>
          <p className="text-gray-600 mb-4">The requested game could not be found.</p>
          <a href="/" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    )
  }

  const { game, moves } = gameData

  // Determine board orientation based on which color the user played
  const userPlayedBlack = game.username?.toLowerCase() === game.black_player?.toLowerCase()
  const userPlayedWhite = !userPlayedBlack
  const boardOrientation: 'white' | 'black' = userPlayedBlack ? 'black' : 'white'

  // Helper to determine if a move is by the user
  const isUserMove = (move: Move) => {
    // Odd ply = white's move, even ply = black's move
    const isWhiteMove = move.ply % 2 === 1
    return (userPlayedWhite && isWhiteMove) || (userPlayedBlack && !isWhiteMove)
  }

  // Calculate game statistics separated by user vs opponent
  // Use getEffectiveClassification to properly handle checkmate moves
  const totalMoves = moves.length
  const userMoves = moves.filter(isUserMove)
  const opponentMoves = moves.filter(m => !isUserMove(m))

  const goodMoves = userMoves.filter(m => getEffectiveClassification(m) === 'good').length
  const accuracy = userMoves.length > 0 ? Math.round((goodMoves / userMoves.length) * 100) : 0

  // User stats (using effective classification to handle checkmate)
  const userInaccuracies = userMoves.filter(m => getEffectiveClassification(m) === 'inaccuracy').length
  const userMistakes = userMoves.filter(m => getEffectiveClassification(m) === 'mistake').length
  const userBlunders = userMoves.filter(m => getEffectiveClassification(m) === 'blunder').length

  // Opponent stats
  const opponentInaccuracies = opponentMoves.filter(m => getEffectiveClassification(m) === 'inaccuracy').length
  const opponentMistakes = opponentMoves.filter(m => getEffectiveClassification(m) === 'mistake').length
  const opponentBlunders = opponentMoves.filter(m => getEffectiveClassification(m) === 'blunder').length

  // Toggle filter function
  const toggleFilter = (type: 'inaccuracy' | 'mistake' | 'blunder') => {
    setClassificationFilter(prev => prev === type ? null : type)
  }

  // Filter moves for the Move Analysis section (using effective classification)
  const filteredMoves = classificationFilter
    ? moves.filter(m => getEffectiveClassification(m) === classificationFilter && isUserMove(m))
    : moves.filter(m => getEffectiveClassification(m) !== 'good' && isUserMove(m))

  // Get current move details
  const currentMove = moves.find(move => move.id === selectedMoveId)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <a href="/" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </a>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Game Analysis</h1>
          <p className="mt-2 text-gray-600">
            {game.white_player} vs {game.black_player} • {game.result}
          </p>
        </div>

        {/* Game Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Opening</h3>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {game.opening_name || 'Unknown'}
              </p>
              <p className="text-sm text-gray-600">{game.eco || 'N/A'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Time Control</h3>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {game.time_control || 'N/A'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Date</h3>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {new Date(game.played_at).toLocaleDateString()}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500">Result</h3>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                {game.result}
              </p>
            </div>
          </div>
        </div>

        {/* Game Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">M</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Moves</p>
                <p className="text-2xl font-semibold text-gray-900">{totalMoves}</p>
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
                <p className="text-2xl font-semibold text-gray-900">{accuracy}%</p>
              </div>
            </div>
          </div>

          {/* Inaccuracies - Clickable */}
          <button
            onClick={() => toggleFilter('inaccuracy')}
            className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-md ${
              classificationFilter === 'inaccuracy' ? 'ring-2 ring-yellow-500' : ''
            }`}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">!</span>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Inaccuracies</p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-semibold text-gray-900">{userInaccuracies}</span>
                  <span className="text-sm text-gray-400">vs {opponentInaccuracies}</span>
                </div>
              </div>
            </div>
          </button>

          {/* Mistakes - Clickable */}
          <button
            onClick={() => toggleFilter('mistake')}
            className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-md ${
              classificationFilter === 'mistake' ? 'ring-2 ring-orange-500' : ''
            }`}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">?</span>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Mistakes</p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-semibold text-gray-900">{userMistakes}</span>
                  <span className="text-sm text-gray-400">vs {opponentMistakes}</span>
                </div>
              </div>
            </div>
          </button>

          {/* Blunders - Clickable */}
          <button
            onClick={() => toggleFilter('blunder')}
            className={`bg-white rounded-lg shadow p-6 text-left transition-all hover:shadow-md ${
              classificationFilter === 'blunder' ? 'ring-2 ring-red-500' : ''
            }`}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold">??</span>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-medium text-gray-500">Blunders</p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-semibold text-gray-900">{userBlunders}</span>
                  <span className="text-sm text-gray-400">vs {opponentBlunders}</span>
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Chess Board and Move List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Chess Board */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Position
              <span className="ml-2 text-sm font-normal text-gray-500">
                (You played as {boardOrientation === 'black' ? 'Black' : 'White'})
              </span>
            </h3>
            <div>
              <ChessBoard
                key={currentFen}
                fen={currentFen}
                width={400}
                showCoordinates={true}
                orientation={boardOrientation}
              />
            </div>

            {/* Navigation Buttons */}
            <div className="mt-4 flex justify-center items-center space-x-2">
              <button
                onClick={goToFirstMove}
                disabled={getCurrentMoveIndex() <= 0}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                title="First move"
              >
                ⏮
              </button>
              <button
                onClick={goToPrevMove}
                disabled={getCurrentMoveIndex() <= 0}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
                title="Previous move"
              >
                ← Prev
              </button>
              <span className="px-3 py-2 text-sm text-gray-600">
                {getCurrentMoveIndex() + 1} / {moves.length}
              </span>
              <button
                onClick={goToNextMove}
                disabled={getCurrentMoveIndex() >= moves.length - 1}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors font-medium"
                title="Next move"
              >
                Next →
              </button>
              <button
                onClick={goToLastMove}
                disabled={getCurrentMoveIndex() >= moves.length - 1}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
                title="Last move"
              >
                ⏭
              </button>
            </div>

            {currentMove && (() => {
              const effectiveClass = getEffectiveClassification(currentMove)
              const isCheckmateMove = isCheckmate(currentMove)
              return (
                <div className="mt-4 text-center">
                  <p className="text-lg font-semibold">
                    Move: {Math.ceil(currentMove.ply / 2)}. {currentMove.ply % 2 === 0 ? '...' : ''}{currentMove.move_san}
                  </p>
                  <div className="flex items-center justify-center space-x-2 mt-1">
                    <span className={`text-sm ${isCheckmateMove ? 'text-green-600 font-bold' : currentMove.eval_delta < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {isCheckmateMove ? 'Checkmate!' : `Eval: ${formatEval(currentMove.eval_after)}`}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      effectiveClass === 'good' ? 'bg-green-100 text-green-800' :
                      effectiveClass === 'inaccuracy' ? 'bg-yellow-100 text-yellow-800' :
                      effectiveClass === 'mistake' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {isCheckmateMove ? 'Checkmate' :
                       effectiveClass === 'good' ? 'Good' :
                       effectiveClass === 'inaccuracy' ? 'Inaccuracy' :
                       effectiveClass === 'mistake' ? 'Mistake' : 'Blunder'}
                    </span>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Move List */}
          <div>
            <MoveList 
              moves={moves}
              onMoveClick={handleMoveClick}
              selectedMoveId={selectedMoveId}
            />
          </div>
        </div>

        {/* Move Analysis */}
        {moves.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Your Move Analysis
                {classificationFilter && (
                  <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    classificationFilter === 'inaccuracy' ? 'bg-yellow-100 text-yellow-800' :
                    classificationFilter === 'mistake' ? 'bg-orange-100 text-orange-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {classificationFilter}s only
                  </span>
                )}
              </h3>
              {classificationFilter && (
                <button
                  onClick={() => setClassificationFilter(null)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Clear filter
                </button>
              )}
            </div>
            <div className="p-6">
              {filteredMoves.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  {classificationFilter
                    ? `No ${classificationFilter}s found in your moves.`
                    : 'No inaccuracies, mistakes, or blunders in your moves!'}
                </p>
              ) : (
                <div className="space-y-4">
                  {filteredMoves.map((move) => (
                    <button
                      key={move.id}
                      onClick={() => handleMoveClick(move.id, move.position_fen)}
                      className={`w-full text-left border rounded-lg p-4 transition-colors hover:bg-gray-50 ${
                        selectedMoveId === move.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-4">
                          <span className="text-sm font-medium text-gray-500">
                            Move {Math.ceil(move.ply / 2)}
                          </span>
                          <span className="font-mono text-lg font-bold">
                            {move.move_san}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            move.classification === 'inaccuracy' ? 'bg-yellow-100 text-yellow-800' :
                            move.classification === 'mistake' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {move.classification}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          Eval: {formatEval(move.eval_after)}
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        <p>Phase: {move.phase} • Piece: {move.piece_moved}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}