'use client'

import { useState } from 'react'
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
    icon: '💥',
    color: 'red',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    hoverColor: 'hover:border-red-400',
    textColor: 'text-red-900',
    subtextColor: 'text-red-700',
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
    icon: '🎯',
    color: 'blue',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:border-blue-400',
    textColor: 'text-blue-900',
    subtextColor: 'text-blue-700',
  },
  {
    id: 'positional' as const,
    title: 'Positional Insights',
    description: 'Learn about pawn structure, piece placement, king safety, and strategic patterns',
    icon: '🏗️',
    color: 'green',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    hoverColor: 'hover:border-green-400',
    textColor: 'text-green-900',
    subtextColor: 'text-green-700',
  },
  {
    id: 'patterns' as const,
    title: 'Mistake Patterns',
    description: 'See which pieces and game phases cause you the most trouble',
    icon: '📊',
    color: 'orange',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    hoverColor: 'hover:border-orange-400',
    textColor: 'text-orange-900',
    subtextColor: 'text-orange-700',
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          {selectedCategory ? (
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-blue-600 hover:text-blue-800 mb-4 flex items-center"
            >
              ← Back to Insights
            </button>
          ) : null}
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {selectedCategory ? selectedCategoryData?.title : 'Chess Insights & Analysis'}
          </h1>
          <p className="text-gray-600">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`${category.bgColor} ${category.borderColor} ${category.hoverColor} border-2 rounded-xl p-6 text-left transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.99]`}
              >
                <div className="flex items-start space-x-4">
                  <div className="text-4xl">{category.icon}</div>
                  <div className="flex-1">
                    <h2 className={`text-xl font-bold ${category.textColor} mb-2`}>
                      {category.title}
                    </h2>
                    <p className={`text-sm ${category.subtextColor}`}>
                      {category.description}
                    </p>
                    <div className={`mt-4 text-sm font-medium ${category.textColor} flex items-center`}>
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
    </div>
  )
}
