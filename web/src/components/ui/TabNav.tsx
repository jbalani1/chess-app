'use client'

import { type LucideIcon } from 'lucide-react'

export interface Tab {
  id: string
  label: string
  icon?: LucideIcon
  count?: number
}

interface TabNavProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export default function TabNav({ tabs, activeTab, onTabChange }: TabNavProps) {
  return (
    <div className="border-b border-[var(--border-color)] overflow-x-auto scrollbar-none">
      <nav className="flex gap-0 -mb-px min-w-max">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${isActive
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-[var(--border-color)]'
                }
              `}
            >
              {Icon && <Icon size={16} />}
              {tab.label}
              {tab.count !== undefined && (
                <span className={`
                  ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold
                  ${isActive
                    ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                    : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
                  }
                `}>
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
