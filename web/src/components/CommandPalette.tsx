'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  LayoutDashboard, Target, AlertTriangle, GraduationCap,
  Lightbulb, Crosshair, Search, PieChart, BookOpen, List, RefreshCcw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Route {
  label: string
  href: string
  icon: LucideIcon
  keywords: string[]
}

const routes: Route[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, keywords: ['home', 'main', 'dashboard'] },
  { label: 'Tactics', href: '/tactics', icon: Target, keywords: ['tactics', 'missed', 'puzzles'] },
  { label: 'Mistakes', href: '/mistakes', icon: AlertTriangle, keywords: ['mistakes', 'errors', 'blunders'] },
  { label: 'Mistakes - By Piece', href: '/mistakes?tab=piece', icon: PieChart, keywords: ['piece', 'knight', 'bishop', 'rook', 'queen', 'pawn'] },
  { label: 'Mistakes - By Opening', href: '/mistakes?tab=opening', icon: BookOpen, keywords: ['opening', 'eco', 'defense'] },
  { label: 'Mistakes - All Moves', href: '/mistakes?tab=all', icon: List, keywords: ['all', 'moves', 'list'] },
  { label: 'Mistakes - Recurring', href: '/mistakes?tab=recurring', icon: RefreshCcw, keywords: ['recurring', 'repeated', 'patterns'] },
  { label: 'Drill Mode', href: '/drill', icon: GraduationCap, keywords: ['drill', 'practice', 'train'] },
  { label: 'Insights', href: '/insights', icon: Lightbulb, keywords: ['insights', 'analysis', 'patterns'] },
  { label: 'Positions', href: '/positions', icon: Crosshair, keywords: ['positions', 'common', 'best move'] },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const filtered = query.trim()
    ? routes.filter(r => {
        const q = query.toLowerCase()
        return r.label.toLowerCase().includes(q) || r.keywords.some(k => k.includes(q))
      })
    : routes

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const navigate = useCallback((href: string) => {
    close()
    router.push(href)
  }, [close, router])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [close])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      navigate(filtered[selectedIndex].href)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={close}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden animate-slideIn"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-color)]">
          <Search size={18} className="text-[var(--text-muted)] flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            className="flex-1 bg-transparent text-[var(--text-primary)] text-base placeholder:text-[var(--text-muted)] focus:outline-none"
          />
          <kbd className="text-xs bg-[var(--bg-hover)] text-[var(--text-muted)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-[var(--text-muted)]">No results found</div>
          ) : (
            filtered.map((route, i) => {
              const Icon = route.icon
              const isSelected = i === selectedIndex
              return (
                <button
                  key={route.href}
                  onClick={() => navigate(route.href)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <Icon size={18} className={isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'} />
                  <span className="text-sm font-medium">{route.label}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
