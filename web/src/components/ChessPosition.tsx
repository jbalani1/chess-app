'use client'

interface ChessPositionProps {
  fen: string
  moveSan: string
  evalDelta: number
  className?: string
}

const pieceSymbols = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
}

export default function ChessPosition({ fen, moveSan, evalDelta, className = '' }: ChessPositionProps) {
  // Parse FEN to get board position
  const parseFen = (fen: string) => {
    const [boardPart] = fen.split(' ')
    const rows = boardPart.split('/')
    const board: (string | null)[][] = []
    
    for (const row of rows) {
      const boardRow: (string | null)[] = []
      for (const char of row) {
        if (isNaN(Number(char))) {
          boardRow.push(char)
        } else {
          for (let i = 0; i < Number(char); i++) {
            boardRow.push(null)
          }
        }
      }
      board.push(boardRow)
    }
    
    return board
  }

  const board = parseFen(fen)
  const evalColor = evalDelta < 0 ? 'text-red-600' : 'text-green-600'
  const evalText = evalDelta > 0 ? `+${(evalDelta / 100).toFixed(1)}` : `${(evalDelta / 100).toFixed(1)}`

  return (
    <div className={`bg-white border rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-lg font-semibold">{moveSan}</div>
        <div className={`text-sm font-medium ${evalColor}`}>
          {evalText}
        </div>
      </div>
      
      <div className="grid grid-cols-8 gap-0 border-2 border-gray-800 w-64 h-64 mx-auto">
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`
                flex items-center justify-center text-2xl font-bold
                ${(rowIndex + colIndex) % 2 === 0 ? 'bg-amber-100' : 'bg-amber-200'}
                hover:bg-blue-200 transition-colors
              `}
            >
              {piece ? pieceSymbols[piece as keyof typeof pieceSymbols] || piece : ''}
            </div>
          ))
        )}
      </div>
      
      <div className="mt-2 text-xs text-gray-500 text-center">
        a b c d e f g h
      </div>
    </div>
  )
}
