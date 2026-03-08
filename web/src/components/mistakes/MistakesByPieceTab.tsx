'use client'

import { useState, useEffect } from 'react'
import MistakeChart from '@/components/charts/MistakeChart'

interface PieceStats {
  [key: string]: string | number | undefined
  piece_moved: string
  piece_name: string
  total_moves: number
  good_moves: number
  inaccuracies: number
  mistakes: number
  blunders: number
  mistake_rate: number
  avg_eval_delta: number
}

const pieceNames: Record<string, string> = {
  P: 'Pawn', N: 'Knight', B: 'Bishop', R: 'Rook', Q: 'Queen', K: 'King'
}

export default function MistakesByPieceTab() {
  const [data, setData] = useState<PieceStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/mistakes?groupBy=piece')
        if (!res.ok) return
        const raw = await res.json()
        const items = Array.isArray(raw) ? raw : raw.data || []
        setData(items.map((item: PieceStats) => ({
          ...item,
          piece_name: pieceNames[item.piece_moved] || item.piece_moved,
        })))
      } catch (err) {
        console.error('Error fetching piece data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)]" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Chart */}
      <MistakeChart
        data={data}
        type="bar"
        title="Mistake Rate by Piece"
        xKey="piece_name"
        yKey="mistake_rate"
      />

      {/* Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Detailed Analysis</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--divider-color)]">
            <thead className="bg-[var(--bg-tertiary)]">
              <tr>
                {['Piece', 'Total Moves', 'Good', 'Inaccuracies', 'Mistakes', 'Blunders', 'Mistake Rate', 'Avg Eval Loss'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider-color)]">
              {data.map((item) => (
                <tr key={item.piece_moved} className="hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-[var(--bg-tertiary)] rounded-lg flex items-center justify-center border border-[var(--border-color)]">
                        <span className="text-base font-bold text-[var(--text-primary)]">{item.piece_moved}</span>
                      </div>
                      <span className="text-base font-medium text-[var(--text-primary)]">{item.piece_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-base text-[var(--text-primary)]">{item.total_moves}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-green-500/20 text-green-400">{item.good_moves}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-yellow-500/20 text-yellow-400">{item.inaccuracies}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-orange-500/20 text-orange-400">{item.mistakes}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-red-500/20 text-red-400">{item.blunders}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-1 bg-[var(--bg-tertiary)] rounded-full h-2 mr-2 w-16">
                        <div
                          className={`h-2 rounded-full ${
                            item.mistake_rate > 20 ? 'bg-red-500' :
                            item.mistake_rate > 15 ? 'bg-orange-500' :
                            item.mistake_rate > 10 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(item.mistake_rate * 2, 100)}%` }}
                        />
                      </div>
                      <span className="text-base font-medium text-[var(--text-primary)]">{item.mistake_rate}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-base">
                    <span className={item.avg_eval_delta < 0 ? 'text-red-400' : 'text-green-400'}>
                      {item.avg_eval_delta > 0 ? '+' : ''}{item.avg_eval_delta}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Insights */}
      {data.length > 0 && (
        <div className="bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--accent-primary)] mb-4">Key Insights</h3>
          <div className="space-y-2 text-[var(--text-secondary)]">
            <p>
              <strong className="text-[var(--text-primary)]">{data[0]?.piece_name}</strong> has the highest mistake rate at{' '}
              <span className="text-red-400 font-semibold">{data[0]?.mistake_rate}%</span>
            </p>
            {data.length > 1 && (
              <p>
                <strong className="text-[var(--text-primary)]">{data[data.length - 1]?.piece_name}</strong> has the lowest mistake rate at{' '}
                <span className="text-green-400 font-semibold">{data[data.length - 1]?.mistake_rate}%</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
