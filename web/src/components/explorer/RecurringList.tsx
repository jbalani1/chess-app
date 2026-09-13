'use client'

import { ExternalLink, Repeat } from 'lucide-react'
import type { RecurringGroup } from './types'
import Link from 'next/link'
import { EDGE_SHORT, moveUrl, reviewUrl } from './types'

/**
 * The same move played wrong more than once inside the current filter.
 * A list of one-off errors is history; a list of repeats is a training plan.
 */
export default function RecurringList({ groups }: { groups: RecurringGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="py-10 text-center">
        <Repeat size={22} className="mx-auto mb-2 text-[var(--text-muted)]" />
        <p className="text-sm text-[var(--text-muted)]">
          No move repeats inside this filter — widen it, or the mistakes here
          are one-offs rather than a habit.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {groups.map((g) => {
        const examples = (g.examples ?? []).slice(0, 6)
        const better = (g.better ?? []).filter((b) => b !== g.move_san).slice(0, 4)
        return (
          <div
            key={`${g.move_san}-${g.piece}`}
            className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-base font-semibold text-[var(--text-primary)]">
                {g.move_san}
              </span>
              <span className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-xs font-medium tabular-nums text-[var(--text-secondary)]">
                ×{g.n}
              </span>
              {g.blunders > 0 && (
                <span className="text-xs font-medium text-[var(--color-blunder)]">
                  {g.blunders} blunder{g.blunders === 1 ? '' : 's'}
                </span>
              )}
              <span className="text-xs tabular-nums text-[var(--text-muted)]">
                avg −{(g.avg_cp / 100).toFixed(1)}
              </span>
              {g.drops > 0 && (
                <span className="text-xs text-[var(--accent-secondary)]">
                  {g.drops} dropped material
                </span>
              )}
              <span className="text-xs text-[var(--text-muted)]">
                moves {g.first_move_no}–{g.last_move_no}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
              {g.phases && g.phases.length > 0 && (
                <span>
                  Phase:{' '}
                  <span className="text-[var(--text-secondary)]">
                    {g.phases.join(', ')}
                  </span>
                </span>
              )}
              {g.edges && g.edges.length > 0 && (
                <span>
                  Position:{' '}
                  <span className="text-[var(--text-secondary)]">
                    {g.edges.map((e) => EDGE_SHORT[e] ?? e).join(', ')}
                  </span>
                </span>
              )}
              {better.length > 0 && (
                <span>
                  Engine wanted:{' '}
                  <span className="font-mono text-[var(--accent-primary)]">
                    {better.join(', ')}
                  </span>
                </span>
              )}
            </div>

            {examples.length > 0 && (
              <div className="mt-2">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  Every time you played it
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {examples.map((ex, i) => {
                    const chessCom = moveUrl(ex.url, ex.ply)
                    return (
                      <span
                        key={`${ex.game_id}-${ex.ply}-${i}`}
                        className="inline-flex items-center overflow-hidden rounded border border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[11px]"
                      >
                        <Link
                          href={reviewUrl(ex.game_id, ex.move_id)}
                          className="px-2 py-0.5 font-mono text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--accent-primary)]"
                          title="Open this position on the board"
                        >
                          move {ex.move_no}
                          {ex.opponent && (
                            <span className="ml-1.5 font-sans text-[var(--text-muted)]">
                              vs {ex.opponent}
                            </span>
                          )}
                        </Link>
                        {chessCom && (
                          <a
                            href={chessCom}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border-l border-[var(--border-color)] px-1.5 py-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--accent-primary)]"
                            title="Open this move on chess.com"
                          >
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
