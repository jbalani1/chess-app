'use client'

import { useState, useEffect } from 'react'
import ChessBoard from './ChessBoard'

interface GameMove {
  moveId: string
  ply: number
  moveSan: string
  moveUci?: string
  evalDelta: number
  classification: string
  positionFen: string
  motifs: any[]
  pinnedPiece?: string | null
  game: {
    id: string
    whitePlayer: string
    blackPlayer: string
    playedAt: string
    result: string
    openingName: string
    eco: string
  }
}

interface TacticalInsightModalProps {
  isOpen: boolean
  onClose: () => void
  motifType: string
  description: string
  frequency: number
  isPositional?: boolean
}

export default function TacticalInsightModal({
  isOpen,
  onClose,
  motifType,
  description,
  frequency,
  isPositional = false
}: TacticalInsightModalProps) {
  const [games, setGames] = useState<GameMove[]>([])
  const [totals, setTotals] = useState<{ positions: number; games: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && motifType) {
      fetchGames()
    }
  }, [isOpen, motifType])

  const fetchGames = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const endpoint = isPositional 
        ? `/api/insights/positional/${motifType}/games`
        : `/api/insights/tactical/${motifType}/games`
      
      const response = await fetch(endpoint)
      if (!response.ok) {
        throw new Error('Failed to fetch games')
      }
      const data = await response.json()
      if (Array.isArray(data)) {
        // Backward compat if API returned array
        setGames(data)
        setTotals({ positions: data.length, games: new Set(data.map((d: any) => d.game?.id)).size })
      } else {
        setGames(data.items || [])
        setTotals(data.totals || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Convert FEN board field + UCI move into a board-only string after the move.
  // This is a minimal applicator sufficient for typical insight screenshots.
  const applyUciToBoard = (boardOnly: string, uci?: string): string => {
    if (!uci) return boardOnly
    try {
      const rows = boardOnly.split('/')
      const grid: (string | null)[][] = rows.map(r => {
        const out: (string | null)[] = []
        for (const ch of r) {
          if (/[1-8]/.test(ch)) {
            for (let i = 0; i < Number(ch); i++) out.push(null)
          } else {
            out.push(ch)
          }
        }
        return out
      })

      const fileToCol = (f: string) => 'abcdefgh'.indexOf(f)
      const rankToRow = (r: string) => 8 - Number(r)

      const srcFile = uci[0], srcRank = uci[1]
      const dstFile = uci[2], dstRank = uci[3]
      const promo = uci.length === 5 ? uci[4] : undefined
      const sr = rankToRow(srcRank), sc = fileToCol(srcFile)
      const dr = rankToRow(dstRank), dc = fileToCol(dstFile)

      if (sr < 0 || sc < 0 || dr < 0 || dc < 0) return boardOnly
      const moving = grid[sr][sc]
      if (!moving) return boardOnly

      // Handle castling rook moves (basic)
      if ((moving === 'K' && srcFile === 'e' && (dstFile === 'g' || dstFile === 'c') && sr === 7) ||
          (moving === 'k' && srcFile === 'e' && (dstFile === 'g' || dstFile === 'c') && sr === 0)) {
        // King move already applied below; also slide the rook
        if (dstFile === 'g') {
          // short castle
          const rr = sr, rookFromC = 7, rookToC = 5
          grid[rr][rookFromC] = null
          grid[rr][rookToC] = moving === 'K' ? 'R' : 'r'
        } else if (dstFile === 'c') {
          // long castle
          const rr = sr, rookFromC = 0, rookToC = 3
          grid[rr][rookFromC] = null
          grid[rr][rookToC] = moving === 'K' ? 'R' : 'r'
        }
      }

      // Move piece
      grid[sr][sc] = null
      grid[dr][dc] = promo ? (moving === moving.toUpperCase() ? promo.toUpperCase() : promo.toLowerCase()) : moving

      // Serialize back
      const toRow = (arr: (string | null)[]) => {
        let s = '', run = 0
        for (const cell of arr) {
          if (cell == null) run++
          else {
            if (run > 0) { s += String(run); run = 0 }
            s += cell
          }
        }
        if (run > 0) s += String(run)
        return s
      }
      return grid.map(toRow).join('/')
    } catch {
      return boardOnly
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'blunder': return 'bg-red-100 text-red-800 border-red-200'
      case 'mistake': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'inaccuracy': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'good': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{description}</h2>
            <p className="text-gray-600 mt-1">
              {totals ? (
                <>Found in {totals.positions} positions across {totals.games} games</>
              ) : (
                <>Found in {frequency} positions across your games</>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading games...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-red-600 mb-2">Error loading games</div>
              <p className="text-gray-600">{error}</p>
            </div>
          )}

          {!loading && !error && games.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600">No games found with this tactical pattern</p>
            </div>
          )}

          {!loading && !error && games.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {games.map((gameMove, index) => (
                <div key={gameMove.moveId} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  {/* Game Info */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">
                        {gameMove.game.whitePlayer} vs {gameMove.game.blackPlayer}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs border ${getClassificationColor(gameMove.classification)}`}>
                        {gameMove.classification}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <p><strong>Date:</strong> {formatDate(gameMove.game.playedAt)}</p>
                      <p><strong>Opening:</strong> {gameMove.game.openingName} ({gameMove.game.eco})</p>
                      <p><strong>Result:</strong> {gameMove.game.result}</p>
                      <p><strong>Move:</strong> {gameMove.ply % 2 === 0 ? Math.floor(gameMove.ply / 2) + 1 + '.' : ''}{gameMove.moveSan}</p>
                    </div>
                  </div>

                  {/* Chess Position (after the actual move) */}
                  <div className="mb-4">
                    <ChessBoard 
                      fen={`${applyUciToBoard(gameMove.positionFen.split(' ')[0], gameMove.moveUci)} ${gameMove.positionFen.split(' ')[1] || 'w'} - - 0 1`}
                      width={360}
                      showCoordinates={true}
                    />
                  </div>

                  {/* Motif/Pattern Details */}
                  {(gameMove.motifs || gameMove.patterns || []).map((item, itemIndex) => (
                    <div key={itemIndex} className="bg-blue-50 rounded p-3">
                      <p className="text-sm font-medium text-blue-900">{item.description}</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Severity: {item.severity}
                        {item.piece_involved && ` • Piece: ${item.piece_involved}`}
                        {gameMove.pinnedPiece && ` • Pinned: ${gameMove.pinnedPiece}`}
                        {item.recommendation && (
                          <div className="mt-2">
                            <strong>Recommendation:</strong> {item.recommendation}
                          </div>
                        )}
                      </p>
                    </div>
                  ))}

                  {/* Game Link */}
                  <div className="mt-4 pt-3 border-t">
                    <a
                      href={`/games/${gameMove.game.id}`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View Full Game Analysis →
                    </a>
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
