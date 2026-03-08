"use client"

import { useEffect, useRef, useState, useCallback } from 'react'

interface StockfishAnalysis {
  bestMove: { from: string; to: string; promotion?: string } | null
  ponderMove: { from: string; to: string; promotion?: string } | null
  evaluation: number | null // in centipawns, positive = white advantage
  mate: number | null // moves to mate, positive = white mates
  depth: number
  pv: string[] // principal variation (best line)
  isAnalyzing: boolean
}

interface UseStockfishOptions {
  depth?: number
  multiPv?: number // number of lines to analyze
}

export function useStockfish(options: UseStockfishOptions = {}) {
  const { depth = 20, multiPv = 1 } = options
  const workerRef = useRef<Worker | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [analysis, setAnalysis] = useState<StockfishAnalysis>({
    bestMove: null,
    ponderMove: null,
    evaluation: null,
    mate: null,
    depth: 0,
    pv: [],
    isAnalyzing: false,
  })

  // Initialize Stockfish worker
  useEffect(() => {
    // Use single-threaded lite version (~7MB) to avoid CORS complexity
    const workerPath = '/stockfish/stockfish.js'

    try {
      const worker = new Worker(workerPath)
      workerRef.current = worker

      worker.onmessage = (e: MessageEvent) => {
        const line = e.data as string

        // Engine ready
        if (line === 'uciok') {
          // Configure engine
          worker.postMessage('setoption name MultiPV value ' + multiPv)
          worker.postMessage('isready')
        }

        if (line === 'readyok') {
          setIsReady(true)
        }

        // Parse info lines during analysis
        if (line.startsWith('info depth')) {
          const parsed = parseInfoLine(line)
          if (parsed.depth > 0) {
            setAnalysis(prev => ({
              ...prev,
              depth: parsed.depth,
              evaluation: parsed.scoreCp ?? prev.evaluation,
              mate: parsed.scoreMate ?? prev.mate,
              pv: parsed.pv.length > 0 ? parsed.pv : prev.pv,
            }))
          }
        }

        // Parse bestmove
        if (line.startsWith('bestmove')) {
          const match = line.match(/^bestmove\s+([a-h][1-8])([a-h][1-8])([qrbn])?(?:\s+ponder\s+([a-h][1-8])([a-h][1-8])([qrbn])?)?/)
          if (match) {
            setAnalysis(prev => ({
              ...prev,
              bestMove: {
                from: match[1],
                to: match[2],
                promotion: match[3],
              },
              ponderMove: match[4] ? {
                from: match[4],
                to: match[5],
                promotion: match[6],
              } : null,
              isAnalyzing: false,
            }))
          }
        }
      }

      worker.onerror = (e) => {
        console.error('Stockfish worker error:', e)
      }

      // Initialize UCI
      worker.postMessage('uci')

    } catch (error) {
      console.error('Failed to initialize Stockfish:', error)
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.postMessage('quit')
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [multiPv])

  // Analyze a position
  const analyze = useCallback((fen: string) => {
    if (!workerRef.current || !isReady) return

    setAnalysis(prev => ({
      ...prev,
      isAnalyzing: true,
      bestMove: null,
      ponderMove: null,
      evaluation: null,
      mate: null,
      depth: 0,
      pv: [],
    }))

    workerRef.current.postMessage('stop')
    workerRef.current.postMessage('ucinewgame')
    workerRef.current.postMessage(`position fen ${fen}`)
    workerRef.current.postMessage(`go depth ${depth}`)
  }, [isReady, depth])

  // Stop analysis
  const stop = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage('stop')
      setAnalysis(prev => ({ ...prev, isAnalyzing: false }))
    }
  }, [])

  // Get best move for a position (promise-based)
  const getBestMove = useCallback((fen: string, searchDepth?: number): Promise<{ from: string; to: string; promotion?: string }> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current || !isReady) {
        reject(new Error('Stockfish not ready'))
        return
      }

      const handleMessage = (e: MessageEvent) => {
        const line = e.data as string
        if (line.startsWith('bestmove')) {
          const match = line.match(/^bestmove\s+([a-h][1-8])([a-h][1-8])([qrbn])?/)
          if (match) {
            workerRef.current?.removeEventListener('message', handleMessage)
            resolve({
              from: match[1],
              to: match[2],
              promotion: match[3],
            })
          }
        }
      }

      workerRef.current.addEventListener('message', handleMessage)
      workerRef.current.postMessage('stop')
      workerRef.current.postMessage(`position fen ${fen}`)
      workerRef.current.postMessage(`go depth ${searchDepth ?? depth}`)

      // Timeout after 10 seconds
      setTimeout(() => {
        workerRef.current?.removeEventListener('message', handleMessage)
        reject(new Error('Stockfish timeout'))
      }, 10000)
    })
  }, [isReady, depth])

  return {
    isReady,
    analysis,
    analyze,
    stop,
    getBestMove,
  }
}

// Parse Stockfish info line
function parseInfoLine(line: string): {
  depth: number
  scoreCp: number | null
  scoreMate: number | null
  pv: string[]
} {
  const result = {
    depth: 0,
    scoreCp: null as number | null,
    scoreMate: null as number | null,
    pv: [] as string[],
  }

  // Parse depth
  const depthMatch = line.match(/depth\s+(\d+)/)
  if (depthMatch) result.depth = parseInt(depthMatch[1])

  // Parse score in centipawns
  const cpMatch = line.match(/score cp\s+(-?\d+)/)
  if (cpMatch) result.scoreCp = parseInt(cpMatch[1])

  // Parse mate score
  const mateMatch = line.match(/score mate\s+(-?\d+)/)
  if (mateMatch) result.scoreMate = parseInt(mateMatch[1])

  // Parse principal variation
  const pvMatch = line.match(/\spv\s+(.+)$/)
  if (pvMatch) result.pv = pvMatch[1].trim().split(/\s+/)

  return result
}

// Convert UCI move (e2e4) to from/to object
export function parseUciMove(uci: string): { from: string; to: string; promotion?: string } | null {
  const match = uci.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/)
  if (!match) return null
  return {
    from: match[1],
    to: match[2],
    promotion: match[3],
  }
}
