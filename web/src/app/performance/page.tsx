'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { TrendingDown, Clock, BookOpen } from 'lucide-react'
import TabNav, { type Tab } from '@/components/ui/TabNav'
import ThrownGamesView from '@/components/performance/ThrownGamesView'
import TimePerformanceView from '@/components/performance/TimePerformanceView'
import RepertoireHealthView from '@/components/performance/RepertoireHealthView'

const tabs: Tab[] = [
  { id: 'thrown', label: 'Thrown Games', icon: TrendingDown },
  { id: 'time', label: 'Time & Accuracy', icon: Clock },
  { id: 'repertoire', label: 'Repertoire Health', icon: BookOpen },
]

function PerformanceContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'thrown'

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tabId === 'thrown') {
      params.delete('tab')
    } else {
      params.set('tab', tabId)
    }
    const qs = params.toString()
    router.push(`/performance${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Performance</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Understand where you win and lose elo
        </p>
      </div>

      <div className="mb-6">
        <TabNav tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {activeTab === 'thrown' && <ThrownGamesView />}
      {activeTab === 'time' && <TimePerformanceView />}
      {activeTab === 'repertoire' && <RepertoireHealthView />}
    </div>
  )
}

export default function PerformancePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)]" />
      </div>
    }>
      <PerformanceContent />
    </Suspense>
  )
}
