import Link from 'next/link'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: {
    label: string
    href: string
  }
}

export default function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        {subtitle && (
          <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className="text-sm font-medium text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] transition-colors"
        >
          {action.label} →
        </Link>
      )}
    </div>
  )
}
