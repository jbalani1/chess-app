'use client'

import { useState, useEffect, useCallback } from 'react'
import ChessBoard from './ChessBoard'

interface MotifPattern {
  description: string
  severity: string
  piece_involved?: string
  recommendation?: string
}

interface GameMove {
  moveId: string
  ply: number
  moveSan: string
  moveUci?: string
  evalDelta: number
  classification: string
  positionFen: string
  motifs?: MotifPattern[]
  patterns?: MotifPattern[]
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

  const fetchGames = useCallback(async () => {
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
        setTotals({ positions: data.length, games: new Set(data.map((d: GameMove) => d.game?.id)).size })
      } else {
        setGames(data.items || [])
        setTotals(data.totals || null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [isPositional, motifType])

  useEffect(() => {
    if (isOpen && motifType) {
      fetchGames()
    }
  }, [isOpen, motifType, fetchGames])

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
      case 'blunder': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'mistake': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'inaccuracy': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'good': return 'bg-green-500/20 text-green-400 border-green-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-secondary)] rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden border border-[var(--border-color)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">{description}</h2>
            <p className="text-[var(--text-secondary)] mt-1">
              {totals ? (
                <>Found in {totals.positions} positions across {totals.games} games</>
              ) : (
                <>Found in {frequency} positions across your games</>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-2xl transition-colors"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)] mx-auto"></div>
              <p className="mt-2 text-[var(--text-secondary)]">Loading games...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <div className="text-[var(--color-blunder)] mb-2">Error loading games</div>
              <p className="text-[var(--text-secondary)]">{error}</p>
            </div>
          )}

          {!loading && !error && games.length === 0 && (
            <div className="text-center py-8">
              <p className="text-[var(--text-muted)]">No games found with this tactical pattern</p>
            </div>
          )}

          {!loading && !error && games.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {games.map((gameMove) => (
                <div key={gameMove.moveId} className="card p-4 hover:border-[var(--accent-primary)]/50 transition-all">
                  {/* Game Info */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg text-[var(--text-primary)]">
                        {gameMove.game.whitePlayer} vs {gameMove.game.blackPlayer}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs border ${getClassificationColor(gameMove.classification)}`}>
                        {gameMove.classification}
                      </span>
                    </div>

                    <div className="text-sm text-[var(--text-secondary)] space-y-1">
                      <p><span className="text-[var(--text-muted)]">Date:</span> {formatDate(gameMove.game.playedAt)}</p>
                      <p><span className="text-[var(--text-muted)]">Opening:</span> {gameMove.game.openingName} ({gameMove.game.eco})</p>
                      <p><span className="text-[var(--text-muted)]">Result:</span> {gameMove.game.result}</p>
                      <p><span className="text-[var(--text-muted)]">Move:</span> {gameMove.ply % 2 === 0 ? Math.floor(gameMove.ply / 2) + 1 + '.' : ''}{gameMove.moveSan}</p>
                    </div>
                  </div>

                  {/* Chess Position (after the actual move) */}
                  <div className="mb-4 bg-[var(--bg-tertiary)] p-3 rounded-lg">
                    <ChessBoard
                      fen={`${applyUciToBoard(gameMove.positionFen.split(' ')[0], gameMove.moveUci)} ${gameMove.positionFen.split(' ')[1] || 'w'} - - 0 1`}
                      width={400}
                      showCoordinates={true}
                    />
                  </div>

                  {/* Motif/Pattern Details */}
                  {(gameMove.motifs || gameMove.patterns || []).map((item, itemIndex) => (
                    <div key={itemIndex} className="bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 rounded p-3">
                      <p className="text-sm font-medium text-[var(--text-primary)]">{item.description}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Severity: {item.severity}
                        {item.piece_involved && ` • Piece: ${item.piece_involved}`}
                        {gameMove.pinnedPiece && ` • Pinned: ${gameMove.pinnedPiece}`}
                        {item.recommendation && (
                          <span className="block mt-2">
                            <span className="font-medium">Recommendation:</span> {item.recommendation}
                          </span>
                        )}
                      </p>
                    </div>
                  ))}

                  {/* Game Link */}
                  <div className="mt-4 pt-3 border-t border-[var(--border-color)]">
                    <a
                      href={`/games/${gameMove.game.id}`}
                      className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] text-sm font-medium"
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
