"use client"

import { useState, useEffect, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'
import { useStockfish, parseUciMove } from '@/hooks/useStockfish'

// Chess.com style colors
const LIGHT_SQUARE = "#EEEED2"
const DARK_SQUARE = "#769656"
const HIGHLIGHT_COLOR = "rgba(255, 255, 0, 0.5)"

// Arrow colors
const BEST_MOVE_COLOR = "rgba(0, 150, 50, 0.8)" // Green for best move
const YOUR_MOVE_COLOR = "rgba(200, 50, 50, 0.8)" // Red for your move
const RESPONSE_COLOR = "rgba(50, 100, 200, 0.8)" // Blue for opponent response

interface PreviousMove {
  fen: string // Position AFTER this move
  san: string // The move in SAN notation
  ply: number
}

interface AnalysisBoardProps {
  fen: string // The position where the mistake was made (before the move)
  fenAfter?: string | null // The position after the move (for animation)
  orientation?: 'white' | 'black'
  width?: number
  yourMove?: { from: string; to: string } | null // The move you played
  bestMove?: { from: string; to: string } | null // The best move (pre-computed)
  yourMoveSan?: string // SAN notation of your move (e.g. "Ng6")
  bestMoveSan?: string // SAN notation of the best move (e.g. "Bd5")
  showAnalysis?: boolean
  previousMoves?: PreviousMove[] // Moves leading UP TO this position (in order)
  onMoveSelect?: (move: { from: string; to: string; san: string }) => void
  animateMove?: boolean // Whether to animate the yourMove when component mounts
  isUserMove?: boolean // Whether this is the user's move (not opponent's)
}

interface Arrow {
  startSquare: string
  endSquare: string
  color: string
}

export default function AnalysisBoard({
  fen,
  fenAfter = null,
  orientation = 'white',
  width = 560,
  yourMove = null,
  bestMove = null,
  yourMoveSan,
  bestMoveSan,
  showAnalysis = true,
  previousMoves = [],
  onMoveSelect,
  animateMove = true,
  isUserMove = true,
}: AnalysisBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [arrows, setArrows] = useState<Arrow[]>([])
  const [currentFen, setCurrentFen] = useState(fen)
  const [forwardMoves, setForwardMoves] = useState<{ fen: string; move: string }[]>([])
  // historyIndex: 0 = mistake position, negative = previous moves, positive = forward moves
  const [historyIndex, setHistoryIndex] = useState(0)
  // Animation state: 0 = no animation, 200 = animate
  const [animationDuration, setAnimationDuration] = useState(0)
  // Track if we should show position after the move (for animation)
  const [showAfterPosition, setShowAfterPosition] = useState(false)

  const { isReady, analysis, analyze, getBestMove } = useStockfish({ depth: 20 })

  // Calculate the actual FEN for the current history index
  const getPositionAtIndex = useCallback((index: number): string => {
    if (index < 0) {
      // Going back through previous moves
      const prevIndex = previousMoves.length + index
      if (prevIndex >= 0 && prevIndex < previousMoves.length) {
        return previousMoves[prevIndex].fen
      }
      // If we're before all previous moves, return starting position
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    } else if (index === 0) {
      return fen
    } else {
      // Forward moves
      const fwdIndex = index - 1
      if (fwdIndex >= 0 && fwdIndex < forwardMoves.length) {
        return forwardMoves[fwdIndex].fen
      }
      return fen
    }
  }, [fen, previousMoves, forwardMoves])

  // Sync with prop changes and animate the move
  useEffect(() => {
    // Reset state
    setForwardMoves([])
    setHistoryIndex(0)

    // Start with position before the move (no animation)
    setCurrentFen(fen)
    setAnimationDuration(0)
    setShowAfterPosition(false)

    // If we have a position after and animation is enabled, animate to it
    if (animateMove && fenAfter && yourMove) {
      // Small delay to ensure the "before" position renders first
      const timer = setTimeout(() => {
        setAnimationDuration(300) // Enable animation
        setCurrentFen(fenAfter)
        setShowAfterPosition(true)

        // After animation completes, return to "before" position for proper analysis
        const returnTimer = setTimeout(() => {
          setAnimationDuration(0) // No animation for return
          setCurrentFen(fen) // Back to position before the move
          setShowAfterPosition(false)
        }, 600) // Wait for animation to complete

        return () => clearTimeout(returnTimer)
      }, 50)

      return () => clearTimeout(timer)
    }
  }, [fen, fenAfter, yourMove, animateMove])

  // Analyze position when FEN changes
  useEffect(() => {
    if (showAnalysis && isReady && currentFen) {
      analyze(currentFen)
    }
  }, [currentFen, isReady, showAnalysis, analyze])

  // Build arrows based on analysis and props
  useEffect(() => {
    const newArrows: Arrow[] = []

    // At the mistake position (index 0), show your move vs best move
    if (historyIndex === 0) {
      // Check if your move is the same as the best move
      const movesAreSame = yourMove && bestMove &&
        yourMove.from === bestMove.from && yourMove.to === bestMove.to

      if (movesAreSame) {
        // Your move was the best move - show green arrow only
        newArrows.push({ startSquare: yourMove.from, endSquare: yourMove.to, color: BEST_MOVE_COLOR })
      } else {
        // Show "your move" (if provided) in red - but only if this is actually the user's move
        if (yourMove && isUserMove) {
          newArrows.push({ startSquare: yourMove.from, endSquare: yourMove.to, color: YOUR_MOVE_COLOR })
        }

        // Show pre-computed best move (if different from your move) in green
        if (bestMove) {
          newArrows.push({ startSquare: bestMove.from, endSquare: bestMove.to, color: BEST_MOVE_COLOR })
        }
      }

      // Show opponent's best response (ponder move) in blue if available
      if (analysis.ponderMove) {
        newArrows.push({ startSquare: analysis.ponderMove.from, endSquare: analysis.ponderMove.to, color: RESPONSE_COLOR })
      }
    } else {
      // At any other position, show engine's best move
      if (analysis.bestMove) {
        newArrows.push({ startSquare: analysis.bestMove.from, endSquare: analysis.bestMove.to, color: BEST_MOVE_COLOR })
      }

      // Show engine's ponder (opponent's expected response) in blue
      if (analysis.ponderMove) {
        newArrows.push({ startSquare: analysis.ponderMove.from, endSquare: analysis.ponderMove.to, color: RESPONSE_COLOR })
      }
    }

    setArrows(newArrows)
  }, [yourMove, bestMove, analysis, historyIndex, isUserMove])

  // Handle clicking on a square to make a move
  const handleSquareClick = useCallback(({ square }: { piece: unknown; square: string }) => {
    if (!selectedSquare) {
      // Select piece
      try {
        const chess = new Chess(currentFen)
        const piece = chess.get(square as 'a1')
        if (piece) {
          const isWhiteTurn = currentFen.includes(' w ')
          if ((isWhiteTurn && piece.color === 'w') || (!isWhiteTurn && piece.color === 'b')) {
            setSelectedSquare(square)
          }
        }
      } catch {
        // Invalid
      }
      return
    }

    // Try to make move
    try {
      const chess = new Chess(currentFen)
      const move = chess.move({
        from: selectedSquare,
        to: square,
        promotion: 'q',
      })

      if (move) {
        const newFen = chess.fen()
        // When making a forward move, clear any forward moves after current position
        const forwardIndex = Math.max(0, historyIndex)
        setForwardMoves(prev => [...prev.slice(0, forwardIndex), { fen: newFen, move: move.san }])
        setHistoryIndex(forwardIndex + 1)
        setCurrentFen(newFen)
        onMoveSelect?.({ from: selectedSquare, to: square, san: move.san })
      }
    } catch {
      // Invalid move
    }

    setSelectedSquare(null)
  }, [currentFen, selectedSquare, historyIndex, onMoveSelect])

  // Handle drag and drop
  const handlePieceDrop = useCallback(({ sourceSquare, targetSquare }: { piece: unknown; sourceSquare: string; targetSquare: string | null }): boolean => {
    if (!targetSquare) return false
    try {
      const chess = new Chess(currentFen)
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      })

      if (move) {
        const newFen = chess.fen()
        const forwardIndex = Math.max(0, historyIndex)
        setForwardMoves(prev => [...prev.slice(0, forwardIndex), { fen: newFen, move: move.san }])
        setHistoryIndex(forwardIndex + 1)
        setCurrentFen(newFen)
        onMoveSelect?.({ from: sourceSquare, to: targetSquare, san: move.san })
        return true
      }
    } catch {
      // Invalid move
    }
    return false
  }, [currentFen, historyIndex, onMoveSelect])

  // Navigation: minimum index is negative of previousMoves length
  const minIndex = -previousMoves.length
  const maxIndex = forwardMoves.length

  const goBack = useCallback(() => {
    if (historyIndex > minIndex) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setCurrentFen(getPositionAtIndex(newIndex))
    }
  }, [historyIndex, minIndex, getPositionAtIndex])

  const goForward = useCallback(() => {
    if (historyIndex < maxIndex) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setCurrentFen(getPositionAtIndex(newIndex))
    }
  }, [historyIndex, maxIndex, getPositionAtIndex])

  const goToStart = useCallback(() => {
    setHistoryIndex(minIndex)
    setCurrentFen(getPositionAtIndex(minIndex))
  }, [minIndex, getPositionAtIndex])

  const goToMistake = useCallback(() => {
    setHistoryIndex(0)
    setCurrentFen(fen)
  }, [fen])

  const goToEnd = useCallback(() => {
    setHistoryIndex(maxIndex)
    setCurrentFen(getPositionAtIndex(maxIndex))
  }, [maxIndex, getPositionAtIndex])

  // Play best move
  const playBestMove = useCallback(async () => {
    if (!isReady) return

    try {
      const best = await getBestMove(currentFen, 18)
      const chess = new Chess(currentFen)
      const move = chess.move({
        from: best.from,
        to: best.to,
        promotion: best.promotion || 'q',
      })

      if (move) {
        const newFen = chess.fen()
        const forwardIndex = Math.max(0, historyIndex)
        setForwardMoves(prev => [...prev.slice(0, forwardIndex), { fen: newFen, move: move.san }])
        setHistoryIndex(forwardIndex + 1)
        setCurrentFen(newFen)
      }
    } catch (e) {
      console.error('Failed to get best move:', e)
    }
  }, [currentFen, isReady, getBestMove, historyIndex])

  // Play your move (the mistake)
  const playYourMove = useCallback(() => {
    if (!yourMove) return

    try {
      const chess = new Chess(fen)
      const move = chess.move({
        from: yourMove.from,
        to: yourMove.to,
        promotion: 'q',
      })

      if (move) {
        const newFen = chess.fen()
        setForwardMoves([{ fen: newFen, move: move.san }])
        setHistoryIndex(1)
        setCurrentFen(newFen)
      }
    } catch (e) {
      console.error('Failed to play your move:', e)
    }
  }, [fen, yourMove])

  // Format evaluation for display
  const formatEval = (cp: number | null, mate: number | null): string => {
    if (mate !== null) {
      return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`
    }
    if (cp !== null) {
      const pawnValue = cp / 100
      return pawnValue >= 0 ? `+${pawnValue.toFixed(1)}` : pawnValue.toFixed(1)
    }
    return '...'
  }

  // Build square styles
  const squareStyles: Record<string, React.CSSProperties> = {}
  if (selectedSquare) {
    squareStyles[selectedSquare] = { backgroundColor: HIGHLIGHT_COLOR }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Eval bar and depth */}
      {showAnalysis && (
        <div className="flex items-center justify-between px-2 text-sm">
          <div className="flex items-center gap-2">
            <span className={`font-mono font-bold ${
              (analysis.evaluation ?? 0) >= 0 ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            }`}>
              {formatEval(analysis.evaluation, analysis.mate)}
            </span>
            {analysis.isAnalyzing && (
              <span className="text-[var(--text-muted)] text-xs">analyzing...</span>
            )}
          </div>
          <span className="text-[var(--text-muted)] text-xs">depth {analysis.depth}</span>
        </div>
      )}

      {/* Board */}
      <div className="rounded-md overflow-hidden shadow-lg" style={{ width }}>
        <Chessboard
          options={{
            position: currentFen.split(' ')[0],
            boardOrientation: orientation,
            onSquareClick: handleSquareClick,
            onPieceDrop: handlePieceDrop,
            arrows: arrows,
            darkSquareStyle: { backgroundColor: DARK_SQUARE },
            lightSquareStyle: { backgroundColor: LIGHT_SQUARE },
            squareStyles: squareStyles,
            showNotation: true,
            allowDragging: !showAfterPosition, // Disable dragging during animation
            animationDurationInMs: animationDuration,
          }}
        />
      </div>

      {/* Move history display - shows previous moves, mistake position, and forward moves */}
      {(previousMoves.length > 0 || forwardMoves.length > 0) && (
        <div className="flex flex-wrap items-center gap-1 px-2 text-sm max-h-20 overflow-y-auto">
          {/* Previous moves leading to the position */}
          {previousMoves.map((item, i) => {
            const index = i - previousMoves.length // negative index
            const moveNum = Math.floor((item.ply + 1) / 2)
            const isWhiteMove = item.ply % 2 === 1
            return (
              <button
                key={`prev-${i}`}
                onClick={() => {
                  setHistoryIndex(index)
                  setCurrentFen(item.fen)
                }}
                className={`px-1.5 py-0.5 rounded font-mono text-xs ${
                  index === historyIndex
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {isWhiteMove ? `${moveNum}.` : ''}{item.san}
              </button>
            )
          })}

          {/* Mistake position marker */}
          <button
            onClick={goToMistake}
            className={`px-2 py-0.5 rounded-full font-medium text-xs transition-colors ${
              historyIndex === 0
                ? 'bg-red-500 text-white'
                : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            }`}
            title="The position where the mistake was made"
          >
            {historyIndex === 0 ? '⚑ Mistake Position' : '⚑ Back to Mistake'}
          </button>

          {/* Forward moves (played after mistake position) */}
          {forwardMoves.map((item, i) => {
            const index = i + 1 // positive index starting at 1
            return (
              <button
                key={`fwd-${i}`}
                onClick={() => {
                  setHistoryIndex(index)
                  setCurrentFen(item.fen)
                }}
                className={`px-1.5 py-0.5 rounded font-mono text-xs ${
                  index === historyIndex
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {item.move}
              </button>
            )
          })}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 px-2">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={goToStart}
            className="p-1.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] disabled:opacity-40"
            disabled={historyIndex <= minIndex}
            title="Go to start of game"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goBack}
            className="p-1.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] disabled:opacity-40"
            disabled={historyIndex <= minIndex}
            title="Previous move"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToMistake}
            className={`p-1.5 rounded transition-colors ${historyIndex === 0 ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
            title="Go to mistake position"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
          <button
            onClick={goForward}
            className="p-1.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] disabled:opacity-40"
            disabled={historyIndex >= maxIndex}
            title="Next move"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={goToEnd}
            className="p-1.5 rounded bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] disabled:opacity-40"
            disabled={historyIndex >= maxIndex}
            title="Go to end"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="h-6 w-px bg-[var(--border-color)]" />

        {/* Action buttons */}
        {yourMove && historyIndex === 0 && (
          <button
            onClick={playYourMove}
            className="px-3 py-1.5 text-sm font-medium rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
            title="Play the move you made"
          >
            Play Your Move{yourMoveSan ? ` (${yourMoveSan})` : ''}
          </button>
        )}

        {bestMove && historyIndex === 0 && (
          <button
            onClick={playBestMove}
            className="px-3 py-1.5 text-sm font-medium rounded bg-green-500/20 text-green-400 hover:bg-green-500/30"
            title="Play the best move"
          >
            Play Best Move{bestMoveSan ? ` (${bestMoveSan})` : ''}
          </button>
        )}

        {historyIndex !== 0 && (
          <button
            onClick={playBestMove}
            disabled={!isReady || analysis.isAnalyzing}
            className="px-3 py-1.5 text-sm font-medium rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
            title="Play engine's best response"
          >
            {analysis.isAnalyzing ? 'Thinking...' : 'Play Best Response'}
          </button>
        )}
      </div>

      {/* Contextual hint text */}
      {historyIndex === 0 && yourMoveSan && bestMoveSan && yourMoveSan !== bestMoveSan && (
        <p className="px-2 text-xs text-[var(--text-secondary)]">
          You played <strong className="text-red-400">{yourMoveSan}</strong> (red). The best move was <strong className="text-green-400">{bestMoveSan}</strong> (green). Blue shows the expected reply.
        </p>
      )}

      {/* Contextual legend */}
      <div className="flex items-center gap-4 px-2 text-xs text-[var(--text-muted)]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: BEST_MOVE_COLOR }} />
          <span>{historyIndex === 0 ? 'Best move' : 'Engine suggestion'}</span>
        </div>
        {historyIndex === 0 && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: YOUR_MOVE_COLOR }} />
            <span>Your move</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: RESPONSE_COLOR }} />
          <span>Expected reply</span>
        </div>
      </div>
    </div>
  )
}
