'use client'

import { useState, useEffect } from 'react'
import SimpleBoard from '@/components/SimpleBoard'

const FENS = [
  // Initial position (6-field FEN)
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  // After 1.e4 e5 2.Nf3 Nc6 (white to move)
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  // A random midgame FEN (black to move)
  'r1bqk2r/pppp1pp1/2np1n1p/2b1p3/2B1P3/1P1N1N2/P1PP1PPP/R1BQK2R b KQkq - 0 8'
]

export default function DebugBoardPage() {
  const [idx, setIdx] = useState(0)
  const fen = FENS[idx]

  useEffect(() => {
    try { console.log('[DebugBoard] render FEN =>', fen) } catch {}
  }, [fen])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">ChessBoard Debug</h1>

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
          <SimpleBoard key={fen} fen={fen} size={440} />
        </div>

        <p className="text-sm text-gray-600">Go to another page and come back if you want to ensure a fresh mount.</p>
      </div>
    </div>
  )
}


