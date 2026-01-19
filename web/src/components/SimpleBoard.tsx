'use client'

interface SimpleBoardProps {
  fen: string
  size?: number
  showCoordinates?: boolean
}

const PIECE: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟︎',
}

function parseBoard(fen: string): (string | null)[][] {
  const [boardPart] = fen.split(' ')
  const rows = boardPart.split('/')
  const out: (string | null)[][] = []
  for (const row of rows) {
    const acc: (string | null)[] = []
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        const n = Number(ch)
        for (let i = 0; i < n; i++) acc.push(null)
      } else {
        acc.push(ch)
      }
    }
    out.push(acc)
  }
  return out
}

export default function SimpleBoard({ fen, size = 400, showCoordinates = true }: SimpleBoardProps) {
  const grid = parseBoard(fen)
  const square = Math.floor(size / 8)
  return (
    <div style={{ width: size }} className="border-2 border-gray-800 relative select-none">
      {grid.map((row, r) => (
        <div key={r} style={{ display: 'flex' }}>
          {row.map((cell, c) => (
            <div
              key={`${r}-${c}`}
              style={{
                width: square,
                height: square,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: (r + c) % 2 === 0 ? '#ebecd0' : '#779556',
                color: (r + c) % 2 === 0 ? '#000' : '#fff',
                fontSize: square * 0.7,
              }}
            >
              {cell ? PIECE[cell] ?? '' : ''}
            </div>
          ))}
        </div>
      ))}

      {showCoordinates && (
        <>
          {/* files */}
          <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, display: 'flex' }}>
            {'abcdefgh'.split('').map((f, i) => (
              <div key={f} style={{ width: square, textAlign: 'center', fontSize: 10, color: '#444' }}>{f}</div>
            ))}
          </div>
          {/* ranks */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 2, display: 'flex', flexDirection: 'column' }}>
            {'87654321'.split('').map((r, i) => (
              <div key={r} style={{ height: square, display: 'flex', alignItems: 'center', fontSize: 10, color: '#444' }}>{r}</div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}


