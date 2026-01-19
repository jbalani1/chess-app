'use client'

import { useState } from 'react'

export interface FilterState {
  timeControl: string
  dateRange: string
  customStartDate?: string
  customEndDate?: string
}

interface InsightFiltersProps {
  filters: FilterState
  onChange: (filters: FilterState) => void
}

const timeControlOptions = [
  { value: 'all', label: 'All Time Controls' },
  { value: 'bullet', label: 'Bullet' },
  { value: 'blitz', label: 'Blitz' },
  { value: 'rapid', label: 'Rapid' },
  { value: 'classical', label: 'Classical' },
]

const dateRangeOptions = [
  { value: 'all', label: 'All Time' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' },
]

export default function InsightFilters({ filters, onChange }: InsightFiltersProps) {
  const [showCustomDates, setShowCustomDates] = useState(filters.dateRange === 'custom')

  const handleTimeControlChange = (value: string) => {
    onChange({ ...filters, timeControl: value })
  }

  const handleDateRangeChange = (value: string) => {
    setShowCustomDates(value === 'custom')
    onChange({ ...filters, dateRange: value })
  }

  const handleCustomDateChange = (field: 'customStartDate' | 'customEndDate', value: string) => {
    onChange({ ...filters, [field]: value })
  }

  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
      <div className="flex flex-wrap items-center gap-4">
        {/* Time Control Filter */}
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Time Control:</label>
          <select
            value={filters.timeControl}
            onChange={(e) => handleTimeControlChange(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {timeControlOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center space-x-2">
          <label className="text-sm font-medium text-gray-700">Date Range:</label>
          <select
            value={filters.dateRange}
            onChange={(e) => handleDateRangeChange(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {dateRangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Custom Date Range */}
        {showCustomDates && (
          <div className="flex items-center space-x-2">
            <input
              type="date"
              value={filters.customStartDate || ''}
              onChange={(e) => handleCustomDateChange('customStartDate', e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={filters.customEndDate || ''}
              onChange={(e) => handleCustomDateChange('customEndDate', e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Active Filters Indicator */}
        {(filters.timeControl !== 'all' || filters.dateRange !== 'all') && (
          <button
            onClick={() => onChange({ timeControl: 'all', dateRange: 'all' })}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
          >
            Clear filters
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// Helper function to build query string from filters
export function buildFilterQueryString(filters: FilterState): string {
  const params = new URLSearchParams()

  if (filters.timeControl !== 'all') {
    params.set('timeControl', filters.timeControl)
  }

  if (filters.dateRange !== 'all') {
    if (filters.dateRange === 'custom') {
      if (filters.customStartDate) params.set('startDate', filters.customStartDate)
      if (filters.customEndDate) params.set('endDate', filters.customEndDate)
    } else {
      params.set('dateRange', filters.dateRange)
    }
  }

  return params.toString()
}
