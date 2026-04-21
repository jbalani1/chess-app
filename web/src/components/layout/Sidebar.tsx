'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Target,
  AlertTriangle,
  GraduationCap,
  Lightbulb,
  Crosshair,
  BookOpen,
  ChevronDown,
  User,
  Search,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  matchPrefixes?: string[]
}

const mainNavItems: NavItem[] = [
  {
    href: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/tactics',
    label: 'Tactics',
    icon: Target,
  },
  {
    href: '/mistakes',
    label: 'Mistakes',
    icon: AlertTriangle,
    matchPrefixes: ['/mistakes'],
  },
  {
    href: '/drill',
    label: 'Drill',
    icon: GraduationCap,
    matchPrefixes: ['/drill'],
  },
  {
    href: '/performance',
    label: 'Performance',
    icon: TrendingUp,
    matchPrefixes: ['/performance'],
  },
  {
    href: '/insights',
    label: 'Insights',
    icon: Lightbulb,
  },
]

const exploreNavItems: NavItem[] = [
  {
    href: '/positions',
    label: 'Positions',
    icon: Crosshair,
  },
  {
    href: '/openings',
    label: 'Openings',
    icon: BookOpen,
    matchPrefixes: ['/openings'],
  },
]

// Bottom nav shows a subset of the most important items
const bottomNavItems: NavItem[] = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/tactics', label: 'Tactics', icon: Target },
  { href: '/mistakes', label: 'Mistakes', icon: AlertTriangle, matchPrefixes: ['/mistakes'] },
  { href: '/performance', label: 'Perf', icon: TrendingUp, matchPrefixes: ['/performance'] },
  { href: '/drill', label: 'Drill', icon: GraduationCap, matchPrefixes: ['/drill'] },
]

function NavItemComponent({ item, isActive }: { item: NavItem; isActive: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
        transition-all duration-150 group relative
        ${isActive
          ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full before:bg-[var(--accent-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
        }
      `}
    >
      <Icon size={18} className={isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'} />
      <span>{item.label}</span>
    </Link>
  )
}

function SectionHeader({ children, collapsed, onToggle }: { children: React.ReactNode; collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
    >
      <span>{children}</span>
      <ChevronDown size={14} className={`transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
    </button>
  )
}

function BottomNav({ isActive }: { isActive: (item: NavItem) => boolean }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-secondary)] border-t border-[var(--border-color)] bottom-nav md:hidden">
      <div className="flex items-center justify-around h-16 px-1">
        {bottomNavItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-colors ${
                active
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const [exploreCollapsed, setExploreCollapsed] = useState(false)

  const isActive = (item: NavItem) => {
    if (item.href === '/') return pathname === '/'
    if (item.matchPrefixes) {
      return item.matchPrefixes.some(prefix => pathname.startsWith(prefix))
    }
    return pathname === item.href || pathname.startsWith(item.href + '/')
  }

  return (
    <>
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[var(--sidebar-width)] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] flex-col z-40">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-[var(--border-color)]">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[var(--accent-primary)] rounded-lg flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.17A3 3 0 0 1 18 21H6a3 3 0 0 1-2.83-2H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73A2 2 0 0 1 12 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">Chess Insights</h1>
            </div>
          </Link>
        </div>

        {/* Search trigger */}
        <div className="px-3 py-3">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-sm text-[var(--text-muted)] hover:border-[var(--accent-primary)] transition-colors">
            <Search size={15} />
            <span className="flex-1 text-left">Search</span>
            <kbd className="text-xs bg-[var(--bg-hover)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">⌘K</kbd>
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-1">
          <div className="space-y-0.5">
            {mainNavItems.map((item) => (
              <NavItemComponent
                key={item.href}
                item={item}
                isActive={isActive(item)}
              />
            ))}
          </div>

          {/* Explore Section */}
          <div className="mt-5">
            <SectionHeader collapsed={exploreCollapsed} onToggle={() => setExploreCollapsed(!exploreCollapsed)}>
              Explore
            </SectionHeader>
            {!exploreCollapsed && (
              <div className="space-y-0.5 mt-0.5">
                {exploreNavItems.map((item) => (
                  <NavItemComponent
                    key={item.href}
                    item={item}
                    isActive={isActive(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
            <div className="w-8 h-8 bg-[var(--bg-tertiary)] rounded-full flex items-center justify-center border border-[var(--border-color)]">
              <User size={16} className="text-[var(--text-muted)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {process.env.NEXT_PUBLIC_CHESS_USERNAME || 'Player'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <BottomNav isActive={isActive} />
    </>
  )
}
