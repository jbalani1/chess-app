'use client'

import { X } from 'lucide-react'
import type { FacetValue, Filters } from './types'
import { EDGE_ORDER, EDGE_SHORT, PIECE_LABEL, RECENCY_OPTIONS } from './types'

interface Group {
  key: string
  label: string
  /** Fixed display order; anything else follows by count. */
  order?: readonly string[]
  render?: (v: string) => string
  max?: number
}

const GROUPS: Group[] = [
  { key: 'color', label: 'You played', render: (v) => (v === 'white' ? 'White' : 'Black') },
  { key: 'vs_first_move', label: 'Game opened', render: (v) => `1.${v}`, max: 6 },
  { key: 'opening_family', label: 'Opening', max: 8 },
  { key: 'phase', label: 'Phase', order: ['opening', 'middlegame', 'endgame'],
    render: (v) => v[0].toUpperCase() + v.slice(1) },
  { key: 'edge', label: 'Your position before the move', order: EDGE_ORDER,
    render: (v) => EDGE_SHORT[v] ?? v },
  { key: 'classification', label: 'Severity', order: ['blunder', 'mistake'],
    render: (v) => v[0].toUpperCase() + v.slice(1) },
  { key: 'piece', label: 'Piece moved', order: ['K', 'Q', 'R', 'B', 'N', 'P'],
    render: (v) => PIECE_LABEL[v] ?? v },
  { key: 'time_control', label: 'Time control', max: 5 },
]

function sortValues(values: FacetValue[], group: Group): FacetValue[] {
  if (!group.order) {
    const sorted = [...values].sort((a, b) => b.count - a.count)
    return group.max ? sorted.slice(0, group.max) : sorted
  }
  const rank = new Map(group.order.map((v, i) => [v, i]))
  return [...values].sort(
    (a, b) => (rank.get(a.value) ?? 99) - (rank.get(b.value) ?? 99)
  )
}

function Chip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  tone?: 'good' | 'bad'
  onClick: () => void
}) {
  const toneRing =
    tone === 'bad'
      ? 'border-[var(--color-blunder)]/50'
      : tone === 'good'
        ? 'border-[var(--accent-primary)]/50'
        : 'border-[var(--border-color)]'

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium
        transition-colors border
        ${active
          ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)] border-[var(--accent-primary)]'
          : `bg-[var(--bg-tertiary)] text-[var(--text-secondary)] ${toneRing}
             hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)]`
        }`}
    >
      <span>{label}</span>
      <span
        className={`tabular-nums ${
          active ? 'opacity-80' : 'text-[var(--text-muted)]'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

export default function FacetRail({
  facets,
  filters,
  onToggle,
  onClear,
}: {
  facets: Record<string, FacetValue[]>
  filters: Filters
  onToggle: (key: string, value: string) => void
  onClear: () => void
}) {
  const activeKeys = Object.keys(filters).filter(
    (k) => !['sort', 'limit', 'offset', 'view'].includes(k) && filters[k]
  )

  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]">
      <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Filters
        </h2>
        {activeKeys.length > 0 && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X size={13} />
            Clear {activeKeys.length}
          </button>
        )}
      </div>

      <div className="divide-y divide-[var(--border-color)]">
        <div className="px-4 py-2.5">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Recency
          </div>
          <div className="flex flex-wrap gap-1.5">
            {RECENCY_OPTIONS.map((o) => {
              const active = filters[o.key] === o.value
              return (
                <button
                  key={`${o.key}-${o.value}`}
                  onClick={() => onToggle(o.key, o.value)}
                  aria-pressed={active}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
                    ${active
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-inverse)]'
                      : 'border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                    }`}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>

        {GROUPS.map((group) => {
          const values = facets[group.key] ?? []
          if (values.length === 0) return null
          const shown = sortValues(values, group)
          // A single remaining option carries no information to click.
          if (shown.length < 2 && !filters[group.key]) return null

          return (
            <div key={group.key} className="px-4 py-2.5">
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                {group.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {shown.map((v) => (
                  <Chip
                    key={v.value}
                    label={group.render ? group.render(v.value) : v.value}
                    count={v.count}
                    active={filters[group.key] === v.value}
                    tone={
                      group.key === 'edge' && ['winning', 'better'].includes(v.value)
                        ? 'bad'
                        : undefined
                    }
                    onClick={() => onToggle(group.key, v.value)}
                  />
                ))}
              </div>
            </div>
          )
        })}

        <div className="px-4 py-2.5">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Material given away
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { v: '1', label: 'A pawn or more' },
              { v: '2', label: 'A piece or more' },
              { v: '5', label: 'A rook or more' },
            ].map((o) => (
              <button
                key={o.v}
                onClick={() => onToggle('min_loss', o.v)}
                aria-pressed={filters.min_loss === o.v}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors
                  ${filters.min_loss === o.v
                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-inverse)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]'
                  }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
