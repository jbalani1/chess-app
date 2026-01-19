"use client"

import { Chessboard } from 'react-chessboard'

interface ChessBoardProps {
  fen: string
  onPositionChange?: (fen: string) => void
  width?: number
  showCoordinates?: boolean
  orientation?: 'white' | 'black'
}

export default function ChessBoard({
  fen,
  onPositionChange,
  width = 400,
  showCoordinates = true,
  orientation = 'white',
}: ChessBoardProps) {
  // Extract just the board position part from FEN (first segment)
  const fenString = fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  const position = fenString.trim().split(" ")[0]

  // Debug log to verify position changes
  console.log('ChessBoard render:', { position, orientation })

  return (
    <div className="flex justify-center" style={{ width }}>
      <Chessboard
        key={position}
        options={{
          position: position,
          boardOrientation: orientation,
          showNotation: showCoordinates,
          allowDragging: false,
          showAnimations: false,
          darkSquareStyle: { backgroundColor: "#779556" },
          lightSquareStyle: { backgroundColor: "#ebecd0" },
        }}
      />
    </div>
  )
}
