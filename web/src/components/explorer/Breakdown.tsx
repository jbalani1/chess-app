'use client'

import type { BreakdownCell, Filters } from './types'
import { EDGE_ORDER, EDGE_SHORT, PHASE_ORDER } from './types'

/**
 * Phase x edge matrix.
 *
 * This is the view that answers "what do I do in the opening versus the
 * middlegame", and crossing it with the edge you held turns it into something
 * sharper: most errors land in the columns where the position was already won.
 * Every cell is also a filter, so the chart doubles as navigation.
 */
export default function Breakdown({
  cells,
  filters,
  onSelect,
}: {
  cells: BreakdownCell[]
  filters: Filters
  onSelect: (phase: string, edge: string) => void
}) {
  const lookup = new Map(cells.map((c) => [`${c.phase}|${c.edge}`, c]))
  const edges = EDGE_ORDER.filter((e) => cells.some((c) => c.edge === e))
  const phases = PHASE_ORDER.filter((p) => cells.some((c) => c.phase === p))
  const max = Math.max(1, ...cells.map((c) => c.n))
  const total = cells.reduce((s, c) => s + c.n, 0)

  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--text-muted)]">
        No mistakes match these filters.
      </p>
    )
  }

  const colTotal = (edge: string) =>
    cells.filter((c) => c.edge === edge).reduce((s, c) => s + c.n, 0)
  const rowTotal = (phase: string) =>
    cells.filter((c) => c.phase === phase).reduce((s, c) => s + c.n, 0)

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="pb-3 text-left text-xs text-[var(--text-muted)]">
            Each cell is the number of mistakes; the shade is its share of the
            worst cell. Click any cell to filter down to it.
          </caption>
          <thead>
            <tr>
              <th className="w-28 px-2 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Phase
              </th>
              {edges.map((e) => (
                <th
                  key={e}
                  className="px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]"
                >
                  {EDGE_SHORT[e]}
                  <div className="font-normal normal-case tracking-normal text-[var(--text-muted)]/70">
                    {colTotal(e)}
                  </div>
                </th>
              ))}
              <th className="px-2 py-1.5 text-right text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                All
              </th>
            </tr>
          </thead>
          <tbody>
            {phases.map((p) => (
              <tr key={p}>
                <th className="px-2 py-1.5 text-left text-sm font-medium capitalize text-[var(--text-secondary)]">
                  {p}
                </th>
                {edges.map((e) => {
                  const cell = lookup.get(`${p}|${e}`)
                  const n = cell?.n ?? 0
                  const intensity = n / max
                  const active =
                    filters.phase === p && filters.edge === e
                  // Errors from a won position are the interesting ones, so they
                  // read warm; everything else stays cool.
                  const warm = e === 'winning' || e === 'better'
                  return (
                    <td key={e} className="p-0.5">
                      <button
                        onClick={() => onSelect(p, e)}
                        disabled={n === 0}
                        title={
                          n === 0
                            ? 'None'
                            : `${n} mistakes · avg −${(cell!.avg_cp / 100).toFixed(1)} · ${cell!.drops} dropped material`
                        }
                        className={`flex h-14 w-full flex-col items-center justify-center rounded transition-all
                          ${n === 0 ? 'cursor-default opacity-30' : 'cursor-pointer hover:ring-2 hover:ring-[var(--accent-primary)]'}
                          ${active ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
                        style={{
                          backgroundColor:
                            n === 0
                              ? 'var(--bg-tertiary)'
                              : warm
                                ? `color-mix(in srgb, var(--color-blunder) ${12 + intensity * 62}%, var(--bg-tertiary))`
                                : `color-mix(in srgb, var(--accent-tertiary) ${10 + intensity * 55}%, var(--bg-tertiary))`,
                        }}
                      >
                        <span className="text-base font-semibold tabular-nums text-[var(--text-primary)]">
                          {n || '·'}
                        </span>
                        {n > 0 && (
                          <span className="text-[10px] tabular-nums text-[var(--text-primary)]/70">
                            −{(cell!.avg_cp / 100).toFixed(1)} avg
                          </span>
                        )}
                      </button>
                    </td>
                  )
                })}
                <td className="px-2 text-right text-sm font-medium tabular-nums text-[var(--text-secondary)]">
                  {rowTotal(p)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-[var(--text-muted)]">
        Columns to the left are positions you were already winning or better in.
        Mistakes there cost you games you had; mistakes on the right are damage
        control in positions already going wrong.
      </p>
    </div>
  )
}
