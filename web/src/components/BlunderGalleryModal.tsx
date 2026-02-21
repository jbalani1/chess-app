'use client'

import { useState, useEffect } from 'react'
import ChessBoard from './ChessBoard'

interface BlunderMove {
  move_id: string
  game_id: string
  ply: number
  move_san: string
  eval_loss: number
  classification: string
  piece_moved: string
  phase: string
  position_fen: string
  explanation: string
  confidence: number
  game: {
    id: string
    white_player: string
    black_player: string
    result: string
    opening_name: string
    eco: string
    time_control: string
    played_at: string
    username: string
  }
}

interface BlunderGalleryModalProps {
  isOpen: boolean
  onClose: () => void
  category: string
  categoryLabel: string
  categoryIcon: string
  recommendation: string
}

const pieceNames: Record<string, string> = {
  P: 'Pawn',
  N: 'Knight',
  B: 'Bishop',
  R: 'Rook',
  Q: 'Queen',
  K: 'King'
}

export default function BlunderGalleryModal({
  isOpen,
  onClose,
  category,
  categoryLabel,
  categoryIcon,
  recommendation
}: BlunderGalleryModalProps) {
  const [blunders, setBlunders] = useState<BlunderMove[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && category) {
      fetchBlunders()
    }
  }, [isOpen, category])

  const fetchBlunders = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/insights/blunders/${category}`)
      if (!response.ok) {
        throw new Error('Failed to fetch blunders')
      }
      const data = await response.json()
      setBlunders(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getMoveNumber = (ply: number) => {
    const moveNum = Math.ceil(ply / 2)
    const isBlack = ply % 2 === 0
    return isBlack ? `${moveNum}...` : `${moveNum}.`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <div>
            <div className="flex items-center space-x-3">
              <span className="text-3xl">{categoryIcon}</span>
              <h2 className="text-2xl font-bold text-gray-900">{categoryLabel}</h2>
            </div>
            <p className="text-gray-600 mt-2">
              {blunders.length} positions where this blunder type occurred
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl font-light"
          >
            ×
          </button>
        </div>

        {/* Recommendation Banner */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <p className="text-sm text-blue-800">
            <strong>How to improve:</strong> {recommendation}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-3 text-gray-600">Loading blunders...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="text-red-600 mb-2 text-lg">Error loading blunders</div>
              <p className="text-gray-600">{error}</p>
            </div>
          )}

          {!loading && !error && blunders.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">No blunders found in this category</p>
            </div>
          )}

          {!loading && !error && blunders.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {blunders.map((blunder) => (
                <a
                  key={blunder.move_id}
                  href={`/games/${blunder.game_id}?move=${blunder.move_id}`}
                  className="block border rounded-lg overflow-hidden hover:shadow-lg transition-all hover:border-blue-300 bg-white"
                >
                  {/* Chess Position */}
                  <div className="p-2 bg-gray-700">
                    <ChessBoard
                      fen={blunder.position_fen}
                      width={220}
                      showCoordinates={false}
                    />
                  </div>

                  {/* Move Info */}
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-lg">
                        {getMoveNumber(blunder.ply)} {blunder.move_san}
                      </span>
                      <span className="text-red-600 font-semibold text-sm">
                        -{blunder.eval_loss}cp
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 space-y-1">
                      <p className="truncate">
                        {blunder.game.white_player} vs {blunder.game.black_player}
                      </p>
                      <p>
                        {formatDate(blunder.game.played_at)} • {blunder.game.time_control}
                      </p>
                      <div className="flex items-center space-x-2">
                        <span className="capitalize bg-gray-100 px-2 py-0.5 rounded">
                          {blunder.phase}
                        </span>
                        <span className="bg-gray-100 px-2 py-0.5 rounded">
                          {pieceNames[blunder.piece_moved] || blunder.piece_moved}
                        </span>
                      </div>
                    </div>

                    {/* Explanation */}
                    <p className="text-xs text-gray-600 mt-2 line-clamp-2">
                      {blunder.explanation}
                    </p>

                    {/* Click hint */}
                    <p className="text-xs text-blue-600 mt-2 font-medium">
                      Click to view game →
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
