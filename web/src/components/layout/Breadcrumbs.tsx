'use client'

import Link from 'next/link'
import { ChevronRight, Home } from 'lucide-react'

export interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm mb-4">
      <Link
        href="/"
        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <Home size={14} />
      </Link>
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            <ChevronRight size={12} className="text-[var(--text-muted)]" />
            {isLast && !item.onClick ? (
              <span className="text-[var(--text-secondary)]">{item.label}</span>
            ) : item.onClick ? (
              <button
                onClick={item.onClick}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {item.label}
              </button>
            ) : item.href ? (
              <Link
                href={item.href}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-[var(--text-secondary)]">{item.label}</span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
