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
// PostgREST's default maximum rows returned per request.
const PAGE_SIZE = 1000

export interface RangeableQuery<T> {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: unknown }>
}

export async function fetchInGameIdChunks<T>(
  gameIds: string[],
  buildQuery: (chunk: string[]) => RangeableQuery<T>,
): Promise<T[]> {
  const rows: T[] = []

  for (let i = 0; i < gameIds.length; i += GAME_ID_CHUNK) {
    const chunk = gameIds.slice(i, i + GAME_ID_CHUNK)

    let from = 0
    for (;;) {
      const { data, error } = await buildQuery(chunk).range(from, from + PAGE_SIZE - 1)
      if (error) throw error
      if (!data || data.length === 0) break

      rows.push(...data)
      if (data.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }
  }

  return rows
}
