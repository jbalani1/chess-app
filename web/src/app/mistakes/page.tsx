'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { BarChart3, PieChart, BookOpen, List, RefreshCcw, BookMarked, Crosshair } from 'lucide-react'
import TabNav, { type Tab } from '@/components/ui/TabNav'
import MistakesOverview from '@/components/mistakes/MistakesOverview'
import MistakesByPieceTab from '@/components/mistakes/MistakesByPieceTab'
import MistakesByOpeningTab from '@/components/mistakes/MistakesByOpeningTab'
import AllMistakesTab from '@/components/mistakes/AllMistakesTab'
import RecurringMistakesTab from '@/components/mistakes/RecurringMistakesTab'
import OpeningPrepTab from '@/components/mistakes/OpeningPrepTab'
import WeaknessProfileTab from '@/components/mistakes/WeaknessProfileTab'

const tabs: Tab[] = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'weakness', label: 'Weakness Profile', icon: Crosshair },
  { id: 'piece', label: 'By Piece', icon: PieChart },
  { id: 'opening', label: 'By Opening', icon: BookOpen },
  { id: 'all', label: 'All Moves', icon: List },
  { id: 'recurring', label: 'Recurring', icon: RefreshCcw },
  { id: 'opening-prep', label: 'Opening Prep', icon: BookMarked },
]

function MistakesHubContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = searchParams.get('tab') || 'overview'

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tabId === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', tabId)
    }
    const qs = params.toString()
    router.push(`/mistakes${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mistakes</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Analyze and improve your weakest areas
        </p>
      </div>

      <div className="mb-6">
        <TabNav tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} />
      </div>

      {activeTab === 'overview' && <MistakesOverview />}
      {activeTab === 'weakness' && <WeaknessProfileTab />}
      {activeTab === 'piece' && <MistakesByPieceTab />}
      {activeTab === 'opening' && <MistakesByOpeningTab />}
      {activeTab === 'all' && <AllMistakesTab />}
      {activeTab === 'recurring' && <RecurringMistakesTab />}
      {activeTab === 'opening-prep' && <OpeningPrepTab />}
    </div>
  )
}

export default function MistakesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--accent-primary)]" />
      </div>
    }>
      <MistakesHubContent />
    </Suspense>
  )
}
