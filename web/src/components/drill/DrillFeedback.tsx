"use client"

import { DrillAttemptResult } from '@/lib/types'

interface DrillFeedbackProps {
  result: DrillAttemptResult
  userMove: string
  onNext: () => void
  onViewGame?: () => void
  isLastPosition?: boolean
}

export default function DrillFeedback({
  result,
  userMove,
  onNext,
  onViewGame,
  isLastPosition = false
}: DrillFeedbackProps) {
  const isCorrect = result.is_correct

  return (
    <div className={`rounded-lg p-6 ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
      {/* Result header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`text-3xl ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
          {isCorrect ? '✓' : '✗'}
        </div>
        <div>
          <h3 className={`text-xl font-bold ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </h3>
          <p className="text-sm text-gray-600">
            {isCorrect
              ? `You'll see this again in ${result.interval_days} day${result.interval_days > 1 ? 's' : ''}`
              : "You'll see this again tomorrow"}
          </p>
        </div>
      </div>

      {/* Move comparison */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className={`p-3 rounded ${isCorrect ? 'bg-green-100' : 'bg-red-100'}`}>
          <div className="text-xs text-gray-500 mb-1">You played</div>
          <div className={`font-mono text-lg font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
            {userMove}
          </div>
        </div>
        <div className="p-3 rounded bg-green-100">
          <div className="text-xs text-gray-500 mb-1">Best move</div>
          <div className="font-mono text-lg font-bold text-green-700">
            {result.correct_move_san}
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="bg-white rounded p-4 mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2">Why this was wrong:</div>
        <p className="text-gray-600">{result.explanation}</p>
        <div className="mt-2 text-sm text-gray-500">
          Eval loss: <span className="font-mono text-red-600">{result.eval_delta} centipawns</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {onViewGame && (
          <button
            onClick={onViewGame}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            View in Game
          </button>
        )}
        <button
          onClick={onNext}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          {isLastPosition ? 'Finish Session' : 'Next Position →'}
        </button>
      </div>
    </div>
  )
}
