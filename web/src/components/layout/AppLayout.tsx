'use client'

import { Suspense } from 'react'
import Sidebar from './Sidebar'
import CommandPalette from '@/components/CommandPalette'
import { FilterProvider } from '@/contexts/FilterContext'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <Suspense fallback={null}>
      <FilterProvider>
        <div className="min-h-screen bg-[var(--bg-primary)]">
          <Sidebar />
          <CommandPalette />
          {/* Mobile header — visible only on small screens */}
          <header className="md:hidden sticky top-0 z-30 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] px-4 py-3 flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[var(--accent-primary)] rounded-lg flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.17A3 3 0 0 1 18 21H6a3 3 0 0 1-2.83-2H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 12 2z" />
              </svg>
            </div>
            <h1 className="text-base font-bold text-[var(--text-primary)]">Chess Insights</h1>
          </header>
          <div className="page-content">
            <main className="p-4 md:p-6">
              {children}
            </main>
          </div>
        </div>
      </FilterProvider>
    </Suspense>
  )
}
