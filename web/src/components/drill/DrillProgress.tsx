"use client"

interface DrillProgressProps {
  current: number
  total: number
  correct: number
  category?: string
  startTime?: Date
}

export default function DrillProgress({
  current,
  total,
  correct,
  category,
  startTime
}: DrillProgressProps) {
  const progress = total > 0 ? (current / total) * 100 : 0
  const accuracy = current > 0 ? Math.round((correct / current) * 100) : 0

  // Calculate elapsed time
  const elapsed = startTime ? Math.floor((Date.now() - startTime.getTime()) / 1000) : 0
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  // Format category name for display
  const categoryDisplay = category
    ? category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : 'All Categories'

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-500">
            Position {current} of {total}
          </span>
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
            {categoryDisplay}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">
            <span className="font-medium text-green-600">{correct}</span>
            <span className="text-gray-400"> / {current > 0 ? current : '-'}</span>
            {current > 0 && (
              <span className="ml-1 text-gray-400">({accuracy}%)</span>
            )}
          </span>
          {startTime && (
            <span className="text-gray-400 font-mono">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
