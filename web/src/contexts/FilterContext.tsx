'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

interface FilterState {
  dateRange: 'all' | '7days' | '30days' | '90days' | 'custom'
  dateFrom: string
  dateTo: string
  timeControl: string
  color: 'all' | 'white' | 'black'
}

interface FilterContextType extends FilterState {
  setDateRange: (range: FilterState['dateRange']) => void
  setDateFrom: (date: string) => void
  setDateTo: (date: string) => void
  setTimeControl: (tc: string) => void
  setColor: (color: FilterState['color']) => void
  clearFilters: () => void
  activeFilterCount: number
  buildFilterParams: () => URLSearchParams
}

const defaultFilters: FilterState = {
  dateRange: 'all',
  dateFrom: '',
  dateTo: '',
  timeControl: '',
  color: 'all',
}

const FilterContext = createContext<FilterContextType | null>(null)

export function useGlobalFilters() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useGlobalFilters must be used within FilterProvider')
  return ctx
}

function getDateRangeBounds(range: FilterState['dateRange']): { from: string; to: string } {
  if (range === 'all' || range === 'custom') return { from: '', to: '' }
  const now = new Date()
  const to = now.toISOString().split('T')[0]
  const days = range === '7days' ? 7 : range === '30days' ? 30 : 90
  const from = new Date(now.getTime() - days * 86400000).toISOString().split('T')[0]
  return { from, to }
}

export function FilterProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Initialize from URL params
  const [filters, setFilters] = useState<FilterState>(() => {
    const dr = searchParams.get('dateRange') as FilterState['dateRange'] | null
    return {
      dateRange: dr || 'all',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      timeControl: searchParams.get('timeControl') || '',
      color: (searchParams.get('color') as FilterState['color']) || 'all',
    }
  })

  const syncToUrl = useCallback((next: FilterState) => {
    const params = new URLSearchParams(searchParams.toString())
    // Remove old filter params
    ;['dateRange', 'dateFrom', 'dateTo', 'timeControl', 'color'].forEach(k => params.delete(k))

    if (next.dateRange !== 'all') params.set('dateRange', next.dateRange)
    if (next.dateFrom) params.set('dateFrom', next.dateFrom)
    if (next.dateTo) params.set('dateTo', next.dateTo)
    if (next.timeControl) params.set('timeControl', next.timeControl)
    if (next.color !== 'all') params.set('color', next.color)

    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }, [router, pathname, searchParams])

  const update = useCallback((partial: Partial<FilterState>) => {
    setFilters(prev => {
      const next = { ...prev, ...partial }
      syncToUrl(next)
      return next
    })
  }, [syncToUrl])

  const setDateRange = useCallback((range: FilterState['dateRange']) => {
    if (range !== 'custom') {
      const { from, to } = getDateRangeBounds(range)
      update({ dateRange: range, dateFrom: from, dateTo: to })
    } else {
      update({ dateRange: range })
    }
  }, [update])

  const clearFilters = useCallback(() => {
    const next = { ...defaultFilters }
    setFilters(next)
    syncToUrl(next)
  }, [syncToUrl])

  const activeFilterCount =
    (filters.dateRange !== 'all' ? 1 : 0) +
    (filters.timeControl ? 1 : 0) +
    (filters.color !== 'all' ? 1 : 0)

  const buildFilterParams = useCallback(() => {
    const p = new URLSearchParams()
    if (filters.dateFrom) p.set('date_from', filters.dateFrom)
    if (filters.dateTo) p.set('date_to', filters.dateTo)
    if (filters.timeControl) p.set('time_control', filters.timeControl)
    if (filters.color !== 'all') p.set('color', filters.color)
    return p
  }, [filters])

  return (
    <FilterContext.Provider value={{
      ...filters,
      setDateRange,
      setDateFrom: (d) => update({ dateFrom: d }),
      setDateTo: (d) => update({ dateTo: d }),
      setTimeControl: (tc) => update({ timeControl: tc }),
      setColor: (c) => update({ color: c }),
      clearFilters,
      activeFilterCount,
      buildFilterParams,
    }}>
      {children}
    </FilterContext.Provider>
  )
}
