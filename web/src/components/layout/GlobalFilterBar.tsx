'use client'

import { Calendar, Clock, Palette, X, SlidersHorizontal } from 'lucide-react'
import { useGlobalFilters } from '@/contexts/FilterContext'

const dateRangeLabels: Record<string, string> = {
  'all': 'All Time',
  '7days': 'Last 7 Days',
  '30days': 'Last 30 Days',
  '90days': 'Last 90 Days',
  'custom': 'Custom',
}

export default function GlobalFilterBar() {
  const {
    dateRange, timeControl, color,
    setDateRange, setTimeControl, setColor,
    clearFilters, activeFilterCount,
    dateFrom, dateTo, setDateFrom, setDateTo,
  } = useGlobalFilters()

  return (
    <div className="h-12 border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex items-center px-4 gap-3 flex-shrink-0">
      <SlidersHorizontal size={16} className="text-[var(--text-muted)] flex-shrink-0" />

      {/* Date Range */}
      <div className="relative">
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as 'all' | '7days' | '30days' | '90days' | 'custom')}
          className="appearance-none bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md px-3 py-1 text-sm text-[var(--text-primary)] pr-7 cursor-pointer hover:border-[var(--accent-primary)] transition-colors focus:outline-none focus:border-[var(--accent-primary)]"
        >
          {Object.entries(dateRangeLabels).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <Calendar size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      </div>

      {/* Custom date inputs */}
      {dateRange === 'custom' && (
        <>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
          <span className="text-[var(--text-muted)] text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
          />
        </>
      )}

      {/* Time Control */}
      <div className="relative">
        <select
          value={timeControl}
          onChange={(e) => setTimeControl(e.target.value)}
          className="appearance-none bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md px-3 py-1 text-sm text-[var(--text-primary)] pr-7 cursor-pointer hover:border-[var(--accent-primary)] transition-colors focus:outline-none focus:border-[var(--accent-primary)]"
        >
          <option value="">All Time Controls</option>
          <option value="bullet">Bullet</option>
          <option value="blitz">Blitz</option>
          <option value="rapid">Rapid</option>
          <option value="daily">Daily</option>
        </select>
        <Clock size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      </div>

      {/* Color */}
      <div className="relative">
        <select
          value={color}
          onChange={(e) => setColor(e.target.value as 'all' | 'white' | 'black')}
          className="appearance-none bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-md px-3 py-1 text-sm text-[var(--text-primary)] pr-7 cursor-pointer hover:border-[var(--accent-primary)] transition-colors focus:outline-none focus:border-[var(--accent-primary)]"
        >
          <option value="all">Both Colors</option>
          <option value="white">White</option>
          <option value="black">Black</option>
        </select>
        <Palette size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
      </div>

      {/* Active filter count + clear */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 ml-auto">
          <span className="bg-[var(--accent-primary)] text-[var(--text-inverse)] text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {activeFilterCount}
          </span>
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={14} />
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
