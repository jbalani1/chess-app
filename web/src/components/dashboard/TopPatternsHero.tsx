import Link from 'next/link'
import { ArrowRight, Target } from 'lucide-react'
import SimpleBoard from '@/components/SimpleBoard'
import { categoryMeta, severityPhrase, severityColorVar } from '@/lib/mistakeCategories'

export interface TopPattern {
  category: string
  count: number
  avgEvalLoss: number
  exampleFen: string | null
  exampleGameId: string | null
}

// The dashboard hero: the 2–3 habits costing this player the most games, in
// plain language, each with a board to look at and a clear next action.
// See docs/PERSONA.md (principles #2 lead with the pattern, #3 show the board,
// #5 end in an action, #6 quantify impact).
export default function TopPatternsHero({ patterns }: { patterns: TopPattern[] }) {
  if (patterns.length === 0) return null

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Your top mistake patterns
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            The handful of habits costing you the most games — fix these first.
          </p>
        </div>
        <Link
          href="/mistakes?tab=recurring"
          className="text-sm text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] whitespace-nowrap"
        >
          See all trouble spots →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {patterns.map((p, i) => {
          const meta = categoryMeta(p.category)
          const color = severityColorVar(p.avgEvalLoss)
          return (
            <Link
              key={p.category}
              href="/mistakes?tab=recurring"
              className="card p-4 flex flex-col group hover:bg-[var(--bg-hover)] transition-colors"
              style={{ borderLeft: `3px solid ${color}` }}
            >
              <div className="flex items-start gap-3">
                {p.exampleFen ? (
                  <div className="shrink-0 rounded overflow-hidden border border-[var(--border-color)]">
                    <SimpleBoard fen={p.exampleFen} size={72} showCoordinates={false} />
                  </div>
                ) : (
                  <div className="shrink-0 w-[72px] h-[72px] rounded bg-[var(--bg-tertiary)] flex items-center justify-center">
                    <Target size={24} className="text-[var(--text-muted)]" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text-muted)]">#{i + 1}</span>
                    <h3 className="font-semibold text-[var(--text-primary)] truncate">{meta.label}</h3>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">{meta.blurb}</p>
                </div>
              </div>

              <p className="text-sm mt-3">
                <span className="font-semibold" style={{ color }}>
                  {p.count.toLocaleString()} times
                </span>
                <span className="text-[var(--text-secondary)]"> — {severityPhrase(p.avgEvalLoss)}</span>
              </p>

              <p className="text-sm text-[var(--text-secondary)] mt-2 flex-1">💡 {meta.tip}</p>

              <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--accent-primary)] mt-3 group-hover:gap-2 transition-all">
                Drill this <ArrowRight size={14} />
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
