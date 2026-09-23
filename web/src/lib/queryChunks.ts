// PostgREST encodes `.in('column', ids)` into the request URL. When the id list
// is large (this app routinely has 600+ games per user), the URL grows past the
// server's length limit and the request fails outright with "TypeError: fetch
// failed" — which is why several routes that fetch moves for *all* of a user's
// games were erroring.
//
// `fetchInGameIdChunks` runs the same query in batches of game ids and
// concatenates the rows. It also paginates within each batch so a batch can
// exceed PostgREST's default 1000-row response cap without silently truncating.
//
// The caller supplies a `buildQuery(chunk)` that returns a Supabase query with
// `.in('game_id', chunk)` already applied (plus any other filters/order it
// wants). Do NOT call `.range()` in the builder — this helper owns pagination.

// Keep the URL comfortably short: ~60 UUIDs ≈ 2.6 KB of query string.
const GAME_ID_CHUNK = 60
// PostgREST's maximum rows returned per request. This is a server-side cap:
// `.limit(50000)` does not raise it, the response is simply cut at 1000 rows
// with no error.
const PAGE_SIZE = 1000

export interface RangeableQuery<T> {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }>
}

// Fetches every row of a query, one PAGE_SIZE page at a time, `concurrency`
// pages per round trip. Use this for any query whose result can pass 1000 rows.
//
// The builder MUST apply an `.order()` on a unique column (e.g. `id`). Offset
// pagination over an unordered result is not stable in Postgres, so pages can
// overlap or skip rows — and with concurrent pages that is not hypothetical.
export async function fetchAllRows<T>(
  buildQuery: () => RangeableQuery<T>,
  concurrency = 1,
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE * concurrency) {
    const pages = await Promise.all(
      Array.from({ length: concurrency }, (_, i) => {
        const start = from + i * PAGE_SIZE
        return buildQuery().range(start, start + PAGE_SIZE - 1)
      }),
    )

    for (const { data, error } of pages) {
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < PAGE_SIZE) return rows
    }
  }
}

export async function fetchInGameIdChunks<T>(
  gameIds: string[],
  buildQuery: (chunk: string[]) => RangeableQuery<T>,
): Promise<T[]> {
  const rows: T[] = []

  for (let i = 0; i < gameIds.length; i += GAME_ID_CHUNK) {
    const chunk = gameIds.slice(i, i + GAME_ID_CHUNK)
    rows.push(...(await fetchAllRows(() => buildQuery(chunk))))
  }

  return rows
}
