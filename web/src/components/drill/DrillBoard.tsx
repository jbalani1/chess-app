"use client"

import { useState, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'

// Chess.com style colors
const LIGHT_SQUARE = "#EEEED2"
const DARK_SQUARE = "#769656"
const HIGHLIGHT_YELLOW = "rgba(255, 255, 0, 0.5)"
const HIGHLIGHT_GREEN = "rgba(0, 255, 0, 0.4)"
const HIGHLIGHT_SELECTED = "rgba(255, 255, 0, 0.6)"

interface DrillBoardProps {
  fen: string
  orientation: 'white' | 'black'
  onMove: (move: { from: string; to: string; san: string; uci: string }) => void
  disabled?: boolean
  showHint?: { from?: string; to?: string }
}

export default function DrillBoard({
  fen,
  orientation,
  onMove,
  disabled = false,
  showHint
}: DrillBoardProps) {
  const [moveFrom, setMoveFrom] = useState<string | null>(null)

  // Use full FEN string
  const fenString = fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

  // Extract position part for the board (just the piece placement)
  const positionPart = fenString.trim().split(" ")[0]

  const handlePieceDrop = useCallback(({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }): boolean => {
    if (disabled || !targetSquare) return false

    try {
      const chess = new Chess(fenString)
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // Always promote to queen for simplicity
      })

      if (move) {
        onMove({
          from: sourceSquare,
          to: targetSquare,
          san: move.san,
          uci: sourceSquare + targetSquare + (move.promotion || '')
        })
        return true
      }
    } catch (e) {
      console.error('Invalid move:', e)
    }
    return false
  }, [fenString, disabled, onMove])

  const handleSquareClick = useCallback(({ square }: { piece: unknown; square: string }) => {
    if (disabled) return

    // If we already have a piece selected, try to move it
    if (moveFrom) {
      try {
        const chess = new Chess(fenString)
        const move = chess.move({
          from: moveFrom,
          to: square,
          promotion: 'q'
        })

        if (move) {
          onMove({
            from: moveFrom,
            to: square,
            san: move.san,
            uci: moveFrom + square + (move.promotion || '')
          })
          setMoveFrom(null)
          return
        }
      } catch {
        // Invalid move
      }
      setMoveFrom(null)
      return
    }

    // Otherwise, select this square if it has a piece
    try {
      const chess = new Chess(fenString)
      const piece = chess.get(square as 'a1')
      if (piece) {
        // Only allow selecting pieces of the side to move
        const isWhiteTurn = fenString.includes(' w ')
        if ((isWhiteTurn && piece.color === 'w') || (!isWhiteTurn && piece.color === 'b')) {
          setMoveFrom(square)
        }
      }
    } catch {
      // Invalid
    }
  }, [fenString, moveFrom, disabled, onMove])

  // Build custom square styles for hints and selection
  const squareStyles: Record<string, React.CSSProperties> = {}

  if (moveFrom) {
    squareStyles[moveFrom] = {
      backgroundColor: HIGHLIGHT_SELECTED
    }
  }

  if (showHint?.from) {
    squareStyles[showHint.from] = {
      backgroundColor: HIGHLIGHT_GREEN
    }
  }

  if (showHint?.to) {
    squareStyles[showHint.to] = {
      backgroundColor: HIGHLIGHT_GREEN
    }
  }

  return (
    <div className="flex justify-center rounded-md overflow-hidden shadow-lg" style={{ width: 560 }}>
      <Chessboard
        key={`drill-${positionPart}`}
        options={{
          id: 'drill-board',
          position: positionPart,
          boardOrientation: orientation,
          showNotation: true,
          allowDragging: !disabled,
          onPieceDrop: handlePieceDrop,
          onSquareClick: handleSquareClick,
          showAnimations: false,
          darkSquareStyle: { backgroundColor: DARK_SQUARE },
          lightSquareStyle: { backgroundColor: LIGHT_SQUARE },
          squareStyles: squareStyles,
        }}
      />
    </div>
  )
}
