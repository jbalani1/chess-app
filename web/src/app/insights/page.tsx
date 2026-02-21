'use client'

import { useState } from 'react'
import { Zap, Target, Castle, BarChart3 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Breadcrumbs from '@/components/layout/Breadcrumbs'
import TacticalInsights from '@/components/insights/TacticalInsights'
import PositionalInsights from '@/components/insights/PositionalInsights'
import MistakePatterns from '@/components/insights/MistakePatterns'
import BlunderCategories from '@/components/insights/BlunderCategories'
import RecurringPatterns from '@/components/insights/RecurringPatterns'

type InsightCategory = 'blunders' | 'tactical' | 'positional' | 'patterns' | 'recurring' | null

const categories = [
  {
    id: 'blunders' as const,
    title: 'Blunder Categories',
    description: 'Understand why you make mistakes - hanging pieces, calculation errors, time pressure, and more',
    icon: Zap,
  },
  {
    id: 'recurring' as const,
    title: 'Recurring Patterns',
    description: 'Your most persistent weaknesses across games — the patterns worth focusing on to improve fastest',
    icon: '🔄',
    color: 'amber',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    hoverColor: 'hover:border-amber-400',
    textColor: 'text-amber-900',
    subtextColor: 'text-amber-700',
  },
  {
    id: 'tactical' as const,
    title: 'Tactical Insights',
    description: 'Identify recurring tactical motifs like pins, forks, skewers, and discovered attacks',
    icon: Target,
  },
  {
    id: 'positional' as const,
    title: 'Positional Insights',
    description: 'Learn about pawn structure, piece placement, king safety, and strategic patterns',
    icon: Castle,
  },
  {
    id: 'patterns' as const,
    title: 'Mistake Patterns',
    description: 'See which pieces and game phases cause you the most trouble',
    icon: BarChart3,
  },
]

export default function InsightsPage() {
  const [selectedCategory, setSelectedCategory] = useState<InsightCategory>(null)

  const renderCategoryContent = () => {
    switch (selectedCategory) {
      case 'blunders':
        return <BlunderCategories />
      case 'recurring':
        return <RecurringPatterns />
      case 'tactical':
        return <TacticalInsights />
      case 'positional':
        return <PositionalInsights />
      case 'patterns':
        return <MistakePatterns />
      default:
        return null
    }
  }

  const selectedCategoryData = categories.find(c => c.id === selectedCategory)

  return (
    <div className="max-w-6xl mx-auto animate-fadeIn">
      {/* Header */}
      <div className="mb-6">
        {selectedCategory ? (
          <Breadcrumbs items={[
            { label: 'Insights', href: '#', onClick: () => setSelectedCategory(null) },
            { label: selectedCategoryData?.title || '' }
          ]} />
        ) : (
          <Breadcrumbs items={[{ label: 'Insights' }]} />
        )}
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          {selectedCategory ? selectedCategoryData?.title : 'Chess Insights & Analysis'}
        </h1>
        <p className="text-[var(--text-secondary)] mt-1">
          {selectedCategory
            ? selectedCategoryData?.description
            : 'Discover patterns in your play and get actionable recommendations to improve your chess.'}
        </p>
      </div>

      {/* Category Grid or Selected Content */}
      {selectedCategory ? (
        <div>
          {renderCategoryContent()}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className="card p-5 text-left transition-all hover:scale-[1.02] hover:border-[var(--accent-primary)]/50"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary)] flex items-center justify-center text-white flex-shrink-0">
                  <category.icon size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">
                    {category.title}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {category.description}
                  </p>
                  <div className="mt-3 text-sm font-medium text-[var(--accent-primary)] flex items-center">
                    View Details
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
