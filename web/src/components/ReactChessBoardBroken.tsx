'use client'

import { Chessboard } from 'react-chessboard'
import { useEffect } from 'react'

interface Props {
  fen: string
  width?: number
  showCoordinates?: boolean
}

// A minimal wrapper that reproduces the repaint issue reported
export default function ReactChessBoardBroken({ fen, width = 440, showCoordinates = true }: Props) {
  // Normalize FEN to ensure the library gets a stable shape
  const normalizedFen = (() => {
    try {
      const parts = (fen || '').trim().split(' ')
      if (parts.length === 6) return fen
      if (parts.length === 4) return `${parts.join(' ')} 0 1`
      if (parts.length === 2) return `${parts[0]} ${parts[1]} - - 0 1`
      return fen
    } catch {
      return fen
    }
  })()

  useEffect(() => {
    try { console.log('[ReactChessBoardBroken] render FEN =>', normalizedFen) } catch {}
  }, [normalizedFen])

  // Lightweight validation so invalid FENs don't freeze the visual state
  const safeFen = (() => {
    try {
      const parts = normalizedFen.split(' ')
      if (parts.length < 6) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      const board = parts[0]
      const ranks = board.split('/')
      if (ranks.length !== 8) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      let wp = 0, bp = 0
      for (const r of ranks) {
        let sum = 0
        for (const ch of r) {
          if (/[1-8]/.test(ch)) sum += Number(ch)
          else if (/[prnbqkPRNBQK]/.test(ch)) {
            sum += 1
            if (ch === 'p') bp++
            if (ch === 'P') wp++
          } else return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        }
        if (sum !== 8) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      }
      if (wp > 8 || bp > 8) return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      return normalizedFen
    } catch {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    }
  })()

  const boardOnly = safeFen.split(' ')[0]

  return (
    <div className="flex justify-center">
      <Chessboard
        options={{
          position: boardOnly,
          showNotation: showCoordinates,
          animationDurationInMs: 200,
          allowDragging: false,
          darkSquareStyle: { backgroundColor: '#779556' },
          lightSquareStyle: { backgroundColor: '#ebecd0' },
          boardStyle: { width, height: width }
        }}
      />
    </div>
  )
}


