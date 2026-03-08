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
          <div className="page-content">
            <main className="p-6">
              {children}
            </main>
          </div>
        </div>
      </FilterProvider>
    </Suspense>
  )
}
