'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { MistakeRow } from './types'
import { EDGE_SHORT, formatCpLost, formatEval, moveUrl, reviewUrl } from './types'

const SORTS = [
  { key: 'impact', label: 'Impact' },
  { key: 'cp_lost', label: 'Cost' },
  { key: 'material', label: 'Material' },
  { key: 'edge', label: 'Edge held' },
  { key: 'move_no', label: 'Move no.' },
  { key: 'date', label: 'Date' },
]

function opponent(r: MistakeRow): string {
  return r.user_color === 'white' ? r.black_player : r.white_player
}

function won(r: MistakeRow): boolean {
  return r.user_color === 'white' ? r.result === '1-0' : r.result === '0-1'
}

function drew(r: MistakeRow): boolean {
  return r.result === '1/2-1/2'
}

function edgeTone(edge: string): string {
  // Errors from a live, winning position are the ones worth reviewing; a
  // slower forced mate is not.
  if (edge === 'winning' || edge === 'better') return 'text-[var(--color-blunder)]'
  if (edge === 'equal') return 'text-[var(--text-secondary)]'
  return 'text-[var(--text-muted)]'
}

export default function MistakeTable({
  rows,
  total,
  sort,
  onSort,
  onLoadMore,
}: {
  rows: MistakeRow[]
  total: number
  sort: string
  onSort: (s: string) => void
  onLoadMore: () => void
}) {
  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--text-muted)]">
        No mistakes match these filters.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[var(--text-muted)]">Sort by</span>
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => onSort(s.key)}
            className={`rounded px-2 py-1 font-medium transition-colors ${
              sort === s.key
                ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border-color)]">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
              {['Move', 'Instead of', 'Edge before', 'Cost', 'Material', 'Opening', 'Game'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]"
                  >
                    {h}
                  </th>
                )
              )}
              {/* Pinned so the link stays reachable however wide the table gets. */}
              <th className="sticky right-0 z-10 bg-[var(--bg-secondary)] px-3 py-2 text-right text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
                Open
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const href = moveUrl(r.game_url, r.ply)
              return (
                <tr
                  key={r.id}
                  className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-hover)]/40"
                >
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link
                      href={reviewUrl(r.game_id, r.id)}
                      className="font-mono font-medium text-[var(--text-primary)] underline decoration-transparent underline-offset-2 transition-colors hover:decoration-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                      title="Open this position on the board"
                    >
                      {r.move_number}
                      {r.user_color === 'black' ? '…' : '.'}
                      {r.move_san}
                    </Link>
                    {r.classification === 'blunder' && (
                      <span className="ml-1.5 text-[var(--color-blunder)]">??</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[var(--accent-primary)]">
                    {r.best_move_san && r.best_move_san !== r.move_san
                      ? r.best_move_san
                      : '—'}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-2 tabular-nums ${edgeTone(r.edge_bucket)}`}
                  >
                    {formatEval(r.eval_before_user)}
                    <span className="ml-1.5 text-[10px] uppercase opacity-70">
                      {EDGE_SHORT[r.edge_bucket]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[var(--text-secondary)]">
                    {formatCpLost(r.cp_lost)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {r.avoidable_loss && r.avoidable_loss >= 2 ? (
                      <span className="text-[var(--accent-secondary)]">
                        −{r.avoidable_loss}p
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td
                    className="max-w-[150px] truncate px-3 py-2 text-[var(--text-muted)]"
                    title={r.opening_clean ?? undefined}
                  >
                    {r.opening_clean ?? r.eco ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-[var(--text-muted)]">
                    <span className="inline-block max-w-[110px] truncate align-bottom">
                      vs {opponent(r)}
                    </span>
                    <span className="ml-1.5 opacity-70">{r.played_at.slice(2, 10)}</span>
                    <span
                      className={`ml-1.5 font-medium ${
                        won(r)
                          ? 'text-[var(--accent-primary)]'
                          : drew(r)
                            ? 'text-[var(--text-secondary)]'
                            : 'text-[var(--color-blunder)]'
                      }`}
                    >
                      {won(r) ? 'W' : drew(r) ? 'D' : 'L'}
                    </span>
                  </td>
                  <td className="sticky right-0 z-10 whitespace-nowrap bg-[var(--bg-primary)] px-3 py-2 text-right">
                    <span className="inline-flex items-center gap-2">
                      <Link
                        href={reviewUrl(r.game_id, r.id)}
                        className="text-xs font-medium text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)]"
                      >
                        Board &rarr;
                      </Link>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--text-muted)] hover:text-[var(--accent-primary)]"
                          title="Open this move on chess.com"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {rows.length < total && (
        <button
          onClick={onLoadMore}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] py-2 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)]"
        >
          Show more — {rows.length} of {total}
        </button>
      )}
    </div>
  )
}
