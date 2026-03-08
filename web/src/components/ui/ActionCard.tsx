import Link from 'next/link'
import { type ReactNode } from 'react'
import ChessBoard from '@/components/ChessBoard'

interface ActionCardProps {
  title: string
  subtitle?: string
  href: string
  icon?: ReactNode
  fen?: string
  accentColor?: 'green' | 'orange' | 'red' | 'blue' | 'purple' | 'amber'
}

const borderColors = {
  green: 'border-[#81B64C] hover:border-[#9BC962]',
  orange: 'border-[#F5A623] hover:border-[#FFB84D]',
  red: 'border-[#CA3431] hover:border-[#E5484D]',
  blue: 'border-[#5D9BEC] hover:border-[#7AAFFF]',
  purple: 'border-[#9B59B6] hover:border-[#B07CC6]',
  amber: 'border-[#F5A623] hover:border-[#FFB84D]',
}

const iconBgColors = {
  green: 'bg-[#81B64C]',
  orange: 'bg-[#F5A623]',
  red: 'bg-[#CA3431]',
  blue: 'bg-[#5D9BEC]',
  purple: 'bg-[#9B59B6]',
  amber: 'bg-[#F5A623]',
}

export default function ActionCard({
  title,
  subtitle,
  href,
  icon,
  fen,
  accentColor = 'green',
}: ActionCardProps) {
  return (
    <Link
      href={href}
      className={`
        block card border-2 ${borderColors[accentColor]}
        hover:scale-[1.02] transition-all duration-200
        overflow-hidden
      `}
    >
      {fen ? (
        <div className="p-2 bg-[var(--bg-hover)]">
          <ChessBoard fen={fen} width={160} showCoordinates={false} />
        </div>
      ) : icon ? (
        <div className={`p-4 ${iconBgColors[accentColor]} flex items-center justify-center text-white`}>
          {icon}
        </div>
      ) : null}
      <div className="p-3">
        <p className="font-semibold text-[var(--text-primary)]">{title}</p>
        {subtitle && (
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
        )}
      </div>
    </Link>
  )
}
