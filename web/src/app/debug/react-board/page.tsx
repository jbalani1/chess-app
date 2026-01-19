'use client'

import { useState, useEffect } from 'react'
import ReactChessBoardBroken from '@/components/ReactChessBoardBroken'

const FENS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  // legal midgame position (replaces earlier invalid pawn count)
  'r1bqk2r/ppp2pp1/2np1n1p/2b1p3/2B1P3/1P1N1N2/P1PP1PPP/R1BQK2R b KQkq - 0 8'
]

export default function ReactBoardDebugPage() {
  const [idx, setIdx] = useState(0)
  const fen = FENS[idx]

  useEffect(() => {
    try { console.log('[ReactBoardDebug] FEN =>', fen) } catch {}
  }, [fen])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">react-chessboard repaint debug</h1>
        <p className="text-sm text-gray-700">Use the buttons to flip through FENs. If the board does not update, this reproduces the repaint issue.</p>

        <div className="flex items-center gap-3">
          <button
            className="px-3 py-2 bg-blue-600 text-white rounded"
            onClick={() => setIdx((i) => (i + 1) % FENS.length)}
          >
            Next FEN
          </button>
          <button
            className="px-3 py-2 bg-gray-200 rounded"
            onClick={() => setIdx(0)}
          >
            Reset
          </button>
          <span className="text-sm text-gray-600">Index: {idx}</span>
        </div>

        <div className="bg-white rounded shadow p-4">
          <p className="text-sm text-gray-700 mb-3 break-all"><strong>FEN:</strong> {fen}</p>
          <ReactChessBoardBroken fen={fen} width={440} showCoordinates={true} />
        </div>

        <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto">
{`Component under test: web/src/components/ReactChessBoardBroken.tsx
Props passed: { position: FEN, key: FEN, arePiecesDraggable: false, animationDuration: 200 }
Observation: console logs show FEN updates, but board does not repaint.`}
        </pre>
      </div>
    </div>
  )
}


