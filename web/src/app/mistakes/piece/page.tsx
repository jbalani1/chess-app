import { supabase } from '@/lib/supabase'
import MistakeChart from '@/components/charts/MistakeChart'

async function getMistakesByPiece() {
  const { data, error } = await supabase
    .from('mistakes_by_piece')
    .select('*')
    .order('mistake_rate', { ascending: false })
  
  if (error) {
    console.error('Error fetching mistakes by piece:', error)
    return []
  }
  
  return data || []
}

export default async function MistakesByPiecePage() {
  const mistakesByPiece = await getMistakesByPiece()

  const pieceNames = {
    'P': 'Pawn',
    'N': 'Knight', 
    'B': 'Bishop',
    'R': 'Rook',
    'Q': 'Queen',
    'K': 'King'
  }

  const formattedData = mistakesByPiece.map(item => ({
    ...item,
    piece_name: pieceNames[item.piece_moved as keyof typeof pieceNames] || item.piece_moved
  }))

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <a href="/" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </a>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Mistakes by Piece</h1>
          <p className="mt-2 text-gray-600">
            Analyze which pieces are causing the most mistakes in your games
          </p>
        </div>

        {/* Chart */}
        <div className="mb-8">
          <MistakeChart
            data={formattedData}
            type="bar"
            title="Mistake Rate by Piece"
            xKey="piece_name"
            yKey="mistake_rate"
          />
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Detailed Analysis</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Piece
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Moves
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Good Moves
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inaccuracies
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mistakes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Blunders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mistake Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Eval Loss
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {formattedData.map((item) => (
                  <tr key={item.piece_moved} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 bg-gray-200 rounded flex items-center justify-center">
                            <span className="text-sm font-bold text-gray-700">
                              {item.piece_moved}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {item.piece_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.total_moves}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {item.good_moves}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {item.inaccuracies}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        {item.mistakes}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {item.blunders}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-red-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(item.mistake_rate, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium">
                          {item.mistake_rate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={item.avg_eval_delta < 0 ? 'text-red-600' : 'text-green-600'}>
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
        {formattedData.length > 0 && (
          <div className="mt-8 bg-blue-50 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-4">Key Insights</h3>
            <div className="space-y-2 text-blue-800">
              {(() => {
                const worstPiece = formattedData[0]
                const bestPiece = formattedData[formattedData.length - 1]
                
                return (
                  <>
                    <p>
                      • <strong>{worstPiece.piece_name}</strong> has the highest mistake rate at {worstPiece.mistake_rate}%
                    </p>
                    <p>
                      • <strong>{bestPiece.piece_name}</strong> has the lowest mistake rate at {bestPiece.mistake_rate}%
                    </p>
                    <p>
                      • Consider focusing on improving your {worstPiece.piece_name.toLowerCase()} play
                    </p>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
