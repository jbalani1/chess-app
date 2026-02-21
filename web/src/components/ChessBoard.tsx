"use client"

import { Chessboard } from 'react-chessboard'

interface ChessBoardProps {
  fen: string
  onPositionChange?: (fen: string) => void
  width?: number
  showCoordinates?: boolean
  orientation?: 'white' | 'black'
  lastMove?: { from: string; to: string } | null
}

// Chess.com style colors
const LIGHT_SQUARE = "#EEEED2"
const DARK_SQUARE = "#769656"
const HIGHLIGHT_COLOR = "rgba(255, 255, 0, 0.5)"

export default function ChessBoard({
  fen,
  onPositionChange,
  width = 560,
  showCoordinates = true,
  orientation = 'white',
  lastMove = null,
}: ChessBoardProps) {
  // Extract just the board position part from FEN (first segment)
  const fenString = fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  const position = fenString.trim().split(" ")[0]

  // Build square styles for last move highlighting
  const squareStyles: Record<string, React.CSSProperties> = {}
  if (lastMove) {
    squareStyles[lastMove.from] = { backgroundColor: HIGHLIGHT_COLOR }
    squareStyles[lastMove.to] = { backgroundColor: HIGHLIGHT_COLOR }
  }

  return (
    <div className="flex justify-center rounded-md overflow-hidden shadow-lg" style={{ width }}>
      <Chessboard
        key={position}
        options={{
          position: position,
          boardOrientation: orientation,
          showNotation: showCoordinates,
          allowDragging: false,
          showAnimations: false,
          darkSquareStyle: { backgroundColor: DARK_SQUARE },
          lightSquareStyle: { backgroundColor: LIGHT_SQUARE },
          squareStyles: squareStyles,
        }}
      />
    </div>
  )
}
