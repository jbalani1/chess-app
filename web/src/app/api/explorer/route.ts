import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * Faceted mistake search.
 *
 * All filtering, counting and grouping happens in `explorer_query` so the page
 * is a single round trip and the numbers on the filter chips always describe
 * the set a click would produce. Earlier mistake endpoints fetched every move
 * for the user and sliced it in JS, which got slower with every game played.
 */

const FILTER_KEYS = [
  'color',
  'vs_first_move',
  'user_reply',
  'opening_family',
  'eco',
  'phase',
  'edge',
  'classification',
  'piece',
  'time_control',
  'min_loss',
  'date_from',
  'date_to',
  'last_games',
  'last_days',
  'search',
  'sort',
  'limit',
  'offset',
] as const

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const filters: Record<string, string> = {
      username:
        searchParams.get('username') ||
        process.env.NEXT_PUBLIC_CHESS_USERNAME ||
        'negrilmannings',
    }

    for (const key of FILTER_KEYS) {
      const value = searchParams.get(key)
      if (value !== null && value !== '') filters[key] = value
    }

    const { data, error } = await supabase.rpc('explorer_query', { f: filters })

    if (error) {
      console.error('explorer_query failed:', error)
      return NextResponse.json(
        { error: 'Query failed', detail: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data ?? {}, {
      headers: { 'Cache-Control': 'private, max-age=30' },
    })
  } catch (err) {
    console.error('Error in explorer API:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
