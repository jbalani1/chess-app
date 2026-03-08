'use client'

import Link from 'next/link'
import { type ReactNode } from 'react'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: string | number
  subtext?: string
  href?: string
  trend?: 'up' | 'down' | 'neutral'
  accentColor?: 'green' | 'orange' | 'red' | 'blue' | 'purple'
}

const accentColors = {
  green: 'bg-[#81B64C]',
  orange: 'bg-[#F5A623]',
  red: 'bg-[#CA3431]',
  blue: 'bg-[#5D9BEC]',
  purple: 'bg-[#9B59B6]',
}

export default function StatCard({
  icon,
  label,
  value,
  subtext,
  href,
  accentColor = 'green',
}: StatCardProps) {
  const content = (
    <div className="card p-4 flex items-center gap-4 h-full">
      <div className={`w-12 h-12 ${accentColors[accentColor]} rounded-xl flex items-center justify-center flex-shrink-0 text-white`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
        <p className="text-sm text-[var(--text-secondary)] truncate">{label}</p>
        {subtext && (
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtext}</p>
        )}
      </div>
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block hover:scale-[1.02] transition-transform">
        {content}
      </Link>
    )
  }

  return content
}
