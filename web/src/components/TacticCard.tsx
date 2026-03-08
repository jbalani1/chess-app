'use client'

import { type ReactNode } from 'react'
import {
  Swords, Pin, ArrowLeftRight, Zap, Castle, ShieldOff, Timer, CornerDownRight
} from 'lucide-react'
import ChessBoard from './ChessBoard'
import { TacticType } from '@/app/api/tactics/missed/route'

interface TacticCardProps {
  moveId: string
  gameId: string
  ply: number
  moveSan: string
  bestMoveSan: string | null
  evalDelta: number
  positionFen: string
  tacticType: TacticType
  tacticDescription: string
  phase?: string
  userColor?: 'white' | 'black'
  game: {
    whitePlayer: string
    blackPlayer: string
    playedAt: string
    timeControl: string
    openingName?: string
    eco?: string
  }
}

// Icons for each tactic type
const TACTIC_ICONS: Record<TacticType, ReactNode> = {
  fork: <Swords size={14} />,
  pin: <Pin size={14} />,
  skewer: <ArrowLeftRight size={14} />,
  discovered_attack: <Zap size={14} />,
  back_rank: <Castle size={14} />,
  removal_of_defender: <ShieldOff size={14} />,
  zwischenzug: <Timer size={14} />,
  deflection: <CornerDownRight size={14} />
}

// Friendly names for tactic types
const TACTIC_NAMES: Record<TacticType, string> = {
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  discovered_attack: 'Discovered Attack',
  back_rank: 'Back Rank',
  removal_of_defender: 'Removal of Defender',
  zwischenzug: 'Zwischenzug',
  deflection: 'Deflection'
}

// Colors for tactic type badges (dark theme)
const TACTIC_COLORS: Record<TacticType, string> = {
  fork: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  pin: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  skewer: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  discovered_attack: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  back_rank: 'bg-red-500/20 text-red-400 border-red-500/30',
  removal_of_defender: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  zwischenzug: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  deflection: 'bg-green-500/20 text-green-400 border-green-500/30'
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

function timeAgo(dateString: string) {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`
  return `${Math.floor(diffDays / 365)}y ago`
}

function getMoveNumber(ply: number) {
  const moveNum = Math.ceil(ply / 2)
  const isBlack = ply % 2 === 0
  return isBlack ? `${moveNum}...` : `${moveNum}.`
}

export default function TacticCard({
  moveId,
  gameId,
  ply,
  moveSan,
  bestMoveSan,
  evalDelta,
  positionFen,
  tacticType,
  tacticDescription,
  phase,
  userColor,
  game
}: TacticCardProps) {
  const icon = TACTIC_ICONS[tacticType] || '?'
  const name = TACTIC_NAMES[tacticType] || tacticType
  const colorClass = TACTIC_COLORS[tacticType] || 'bg-gray-500/20 text-gray-400'

  // Determine board orientation
  const orientation = userColor || 'white'

  return (
    <a
      href={`/games/${gameId}?move=${moveId}`}
      className="block card overflow-hidden hover:scale-[1.02] transition-all duration-200"
    >
      {/* Chess Position */}
      <div className="p-2 bg-[var(--bg-secondary)]">
        <ChessBoard
          fen={positionFen}
          width={180}
          showCoordinates={false}
          orientation={orientation}
        />
      </div>

      {/* Card Content */}
      <div className="p-3">
        {/* Date last seen */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[var(--text-muted)]">{formatDate(game.playedAt)}</span>
          <span className="text-xs font-medium text-[var(--text-secondary)]">{timeAgo(game.playedAt)}</span>
        </div>

        {/* Tactic Type Badge + Phase */}
        <div className="flex items-center justify-between mb-2">
          <span className={`inline-flex items-center px-2 py-1 rounded border text-xs font-medium ${colorClass}`}>
            <span className="mr-1">{icon}</span>
            {name}
          </span>
          <div className="flex items-center gap-2">
            {phase && (
              <span className="text-xs text-[var(--text-muted)] capitalize">{phase}</span>
            )}
            <span className="text-[var(--color-blunder)] font-semibold text-sm">
              {evalDelta > 0 ? '-' : ''}{Math.abs(evalDelta)}cp
            </span>
          </div>
        </div>

        {/* Moves */}
        <div className="mb-2 space-y-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-muted)]">Played:</span>
            <span className="font-mono font-bold text-[var(--color-blunder)]">
              {getMoveNumber(ply)} {moveSan}
            </span>
          </div>
          {bestMoveSan && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[var(--text-muted)]">Best:</span>
              <span className="font-mono font-bold text-[var(--accent-primary)]">
                {getMoveNumber(ply)} {bestMoveSan}
              </span>
            </div>
          )}
        </div>

        {/* Tactic Description */}
        {tacticDescription && (
          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mb-2">
            {tacticDescription}
          </p>
        )}

        {/* Game Info */}
        <div className="text-xs text-[var(--text-muted)] space-y-0.5">
          <p className="truncate">
            {game.whitePlayer} vs {game.blackPlayer}
            {userColor && (
              <span className="ml-1">
                (as {userColor === 'white' ? '♔' : '♚'})
              </span>
            )}
          </p>
          {game.openingName && (
            <p className="truncate text-[var(--text-secondary)]">
              {game.eco && <span className="font-mono mr-1">{game.eco}</span>}
              {game.openingName}
            </p>
          )}
          <p>{game.timeControl}</p>
        </div>
      </div>
    </a>
  )
}

// Export constants for use in the tactics page
export { TACTIC_ICONS, TACTIC_NAMES, TACTIC_COLORS }
