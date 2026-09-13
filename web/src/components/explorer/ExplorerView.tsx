'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import FacetRail from './FacetRail'
import Breakdown from './Breakdown'
import RecurringList from './RecurringList'
import MistakeTable from './MistakeTable'
import type { ExplorerResponse, Filters } from './types'
import { EDGE_SHORT, PIECE_LABEL, RECENCY_KEYS, RECENCY_OPTIONS } from './types'

const PAGE = 50

/** One-click routes into the questions worth asking most often. */
const PRESETS: { label: string; hint: string; filters: Filters }[] = [
  {
    label: 'Games you threw away',
    hint: 'Errors played from a winning position',
    filters: { edge: 'winning' },
  },
  {
    label: 'Free material',
    hint: 'Moves that hung a piece or more',
    filters: { min_loss: '2' },
  },
  {
    label: 'Black vs 1.d4',
    hint: 'Your replies to the queen’s pawn',
    filters: { color: 'black', vs_first_move: 'd4' },
  },
  {
    label: 'Black vs 1.e4',
    hint: 'Your replies to the king’s pawn',
    filters: { color: 'black', vs_first_move: 'e4' },
  },
  {
    label: 'Opening only',
    hint: 'Where preparation would pay',
    filters: { phase: 'opening' },
  },
  {
    label: 'Last 50 games',
    hint: 'How you are playing lately',
    filters: { last_games: '50' },
  },
]

const VIEWS = [
  { key: 'breakdown', label: 'Breakdown' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'list', label: 'Every mistake' },
] as const

function Stat({
  value,
  label,
  sub,
  tone,
}: {
  value: string | number
  label: string
  sub?: string
  tone?: 'bad' | 'warn'
}) {
  const color =
    tone === 'bad'
      ? 'text-[var(--color-blunder)]'
      : tone === 'warn'
        ? 'text-[var(--accent-secondary)]'
        : 'text-[var(--text-primary)]'
  return (
    <div className="min-w-0 flex-1 px-4 py-3">
      <div className={`text-2xl font-semibold tabular-nums leading-none ${color}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-[var(--text-secondary)]">{label}</div>
      {sub && <div className="text-[11px] text-[var(--text-muted)]">{sub}</div>}
    </div>
  )
}

export default function ExplorerView() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const filters: Filters = useMemo(() => {
    const f: Filters = {}
    searchParams.forEach((v, k) => {
      if (v) f[k] = v
    })
    return f
  }, [searchParams])

  const view = filters.view ?? 'breakdown'
  const sort = filters.sort ?? 'impact'

  const [data, setData] = useState<ExplorerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)

  const setParams = useCallback(
    (next: Filters) => {
      const p = new URLSearchParams()
      Object.entries(next).forEach(([k, v]) => {
        if (v) p.set(k, v)
      })
      const qs = p.toString()
      router.replace(qs ? `/explorer?${qs}` : '/explorer', { scroll: false })
    },
    [router]
  )

  /** Clicking an active chip clears it, so every filter is its own toggle. */
  const toggle = useCallback(
    (key: string, value: string) => {
      const next = { ...filters }
      if (next[key] === value) {
        delete next[key]
      } else {
        next[key] = value
        // Recency is one choice with two spellings; keep only the newest.
        if ((RECENCY_KEYS as readonly string[]).includes(key)) {
          RECENCY_KEYS.forEach((k) => {
            if (k !== key) delete next[k]
          })
        }
      }
      setLimit(PAGE)
      setParams(next)
    },
    [filters, setParams]
  )

  const applyPreset = useCallback(
    (preset: Filters) => {
      setLimit(PAGE)
      setParams({ ...preset, view: filters.view ?? 'breakdown' })
    },
    [filters.view, setParams]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const p = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v && k !== 'view') p.set(k, v)
    })
    p.set('limit', String(limit))

    fetch(`/api/explorer?${p.toString()}`)
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body?.detail || body?.error || 'Request failed')
        return body as ExplorerResponse
      })
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [filters, limit])

  const summary = data?.summary
  const total = data?.total ?? 0
  const thrownShare =
    summary && total > 0 ? Math.round((summary.from_winning / total) * 100) : 0

  // A sentence describing the current filter, so the numbers are never ambiguous.
  const scope = useMemo(() => {
    const parts: string[] = []
    if (filters.color) parts.push(`as ${filters.color[0].toUpperCase()}${filters.color.slice(1)}`)
    if (filters.vs_first_move) parts.push(`in games opening 1.${filters.vs_first_move}`)
    if (filters.opening_family) parts.push(`in the ${filters.opening_family}`)
    if (filters.phase) parts.push(`in the ${filters.phase}`)
    if (filters.edge) parts.push(`from a ${EDGE_SHORT[filters.edge].toLowerCase()} position`)
    if (filters.classification) parts.push(`(${filters.classification}s only)`)
    if (filters.piece) parts.push(`moving the ${(PIECE_LABEL[filters.piece] ?? '').toLowerCase()}`)
    if (filters.min_loss) parts.push(`dropping ${filters.min_loss}+ pawns`)
    if (filters.time_control) parts.push(`at ${filters.time_control}`)
    const recency = RECENCY_OPTIONS.find(
      (o) => filters[o.key] === o.value
    )
    if (recency) parts.push(`in your ${recency.label.toLowerCase()}`)
    return parts.length ? parts.join(' ') : 'across every game'
  }, [filters])

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">
          Mistake Explorer
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Every mistake you have made, filtered by the edge you held going into
          it, the opening it came from and the colour you played.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.filters)}
            title={p.hint}
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--color-blunder)]/40 bg-[var(--color-blunder)]/10 px-4 py-3 text-sm text-[var(--text-primary)]">
          Could not load mistakes: {error}
        </div>
      )}

      {summary && (
        <>
          <div className="flex flex-wrap divide-x divide-[var(--border-color)] rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <Stat
              value={total}
              label="mistakes"
              sub={`in ${summary.games} of ${summary.games_in_scope} games`}
            />
            <Stat
              value={summary.clean_games}
              label="games with none of these"
              sub={
                summary.games_in_scope > 0
                  ? `${Math.round((summary.clean_games / summary.games_in_scope) * 100)}% of the window`
                  : undefined
              }
            />
            <Stat value={summary.blunders} label="blunders" tone="bad" />
            <Stat
              value={`${thrownShare}%`}
              label="from a winning or better position"
              sub={`${summary.from_winning} of ${total}`}
              tone="bad"
            />
            <Stat
              value={summary.material_drops}
              label="gave away a piece or more"
              sub={`${summary.pawns_dropped} pawns total`}
              tone="warn"
            />
            <Stat
              value={`−${(summary.avg_cp_lost / 100).toFixed(1)}`}
              label="average cost per mistake"
            />
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Showing mistakes {scope}
            {summary.window_from && summary.window_to
              ? ` — ${summary.window_from} to ${summary.window_to}`
              : ''}
            .
          </p>
        </>
      )}

      <div className="grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <FacetRail
            facets={data?.facets ?? {}}
            filters={filters}
            onToggle={toggle}
            onClear={() => setParams({ view: filters.view ?? 'breakdown' })}
          />
        </div>

        <div className="min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-1 border-b border-[var(--border-color)] px-3 py-2">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                onClick={() => setParams({ ...filters, view: v.key })}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === v.key
                    ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {v.label}
                {v.key === 'recurring' && data && data.recurring.length > 0 && (
                  <span className="ml-1.5 text-xs text-[var(--text-muted)]">
                    {data.recurring.length}
                  </span>
                )}
              </button>
            ))}
            {loading && (
              <Loader2
                size={15}
                className="ml-auto animate-spin text-[var(--text-muted)]"
              />
            )}
          </div>

          <div className="p-4">
            {!data && loading && (
              <p className="py-10 text-center text-sm text-[var(--text-muted)]">
                Loading…
              </p>
            )}

            {data && view === 'breakdown' && (
              <Breakdown
                cells={data.breakdown}
                filters={filters}
                onSelect={(phase, edge) => {
                  const next = { ...filters }
                  if (next.phase === phase && next.edge === edge) {
                    delete next.phase
                    delete next.edge
                    setParams(next)
                  } else {
                    // Clicking a number means "show me these", so drop straight
                    // into the list where each row links to the game.
                    next.phase = phase
                    next.edge = edge
                    next.view = 'list'
                    setLimit(PAGE)
                    setParams(next)
                  }
                }}
              />
            )}

            {data && view === 'recurring' && (
              <RecurringList groups={data.recurring} />
            )}

            {data && view === 'list' && (
              <MistakeTable
                rows={data.rows}
                total={data.total}
                sort={sort}
                onSort={(s) => setParams({ ...filters, sort: s })}
                onLoadMore={() => setLimit((n) => n + PAGE)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
