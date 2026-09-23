// `games.time_control` is stored in two shapes, because the ingesters rewrite
// Chess.com's "300+5" (seconds) into "5+5" (minutes) but leave increment-free
// values alone:
//
//   "5+5", "3+2", "10+5"  base in MINUTES, increment in seconds
//   "60", "600"           base in SECONDS, no increment
//   "1/86400"             daily (seconds per move)
//
// Anything reading the raw string has to know that, so do it here once.

export type TimeControlCategory = 'bullet' | 'blitz' | 'rapid' | 'daily'

export const TIME_CONTROL_CATEGORIES: readonly TimeControlCategory[] = ['bullet', 'blitz', 'rapid', 'daily']

export function isTimeControlCategory(value: string): value is TimeControlCategory {
  return (TIME_CONTROL_CATEGORIES as readonly string[]).includes(value)
}

// Categorises by estimated game length, base + 40 × increment, the usual
// convention (it puts 2+1 in bullet, 3+2 and 5+5 in blitz, 10+5 in rapid).
export function timeControlCategory(timeControl: string | null | undefined): TimeControlCategory | null {
  if (!timeControl) return null
  if (timeControl.includes('/')) return 'daily'

  const match = timeControl.match(/^(\d+)(?:\+(\d+))?$/)
  if (!match) return null

  const base = parseInt(match[1], 10)
  const increment = match[2] !== undefined ? parseInt(match[2], 10) : null

  // With an increment the base is minutes — unless it is implausibly large,
  // which means an un-rewritten Chess.com value like "180+2".
  const baseSeconds = increment !== null && base < 60 ? base * 60 : base
  const estimated = baseSeconds + 40 * (increment ?? 0)

  if (estimated < 180) return 'bullet'
  if (estimated < 600) return 'blitz'
  return 'rapid'
}
