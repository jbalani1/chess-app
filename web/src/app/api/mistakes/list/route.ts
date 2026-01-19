import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Get filter parameters
    const classification = searchParams.get('classification') // 'mistake', 'blunder', or null for both
    const pieceMoved = searchParams.get('piece_moved') // 'P', 'N', 'B', 'R', 'Q', 'K'
    const phase = searchParams.get('phase') // 'opening', 'middlegame', 'endgame'
    const timeControl = searchParams.get('time_control') // e.g., '10+5'
    const dateFrom = searchParams.get('date_from') // YYYY-MM-DD
    const dateTo = searchParams.get('date_to') // YYYY-MM-DD
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    // If date or time control filtering is needed, get game IDs first
    let gameIds: string[] | null = null
    if (dateFrom || dateTo || timeControl) {
      let gameQuery = supabase.from('games').select('id')
      if (dateFrom) {
        gameQuery = gameQuery.gte('played_at', dateFrom)
      }
      if (dateTo) {
        gameQuery = gameQuery.lte('played_at', dateTo + 'T23:59:59')
      }
      if (timeControl) {
        gameQuery = gameQuery.eq('time_control', timeControl)
      }
      const { data: games } = await gameQuery
      gameIds = games?.map(g => g.id) || []
      if (gameIds.length === 0) {
        return NextResponse.json({ 
          data: [], 
          total: 0,
          limit,
          offset 
        })
      }
    }
    
    // Build query - join moves with games to get date filtering
    let query = supabase
      .from('moves')
      .select(`
        id,
        game_id,
        ply,
        move_san,
        move_uci,
        eval_before,
        eval_after,
        eval_delta,
        classification,
        piece_moved,
        phase,
        position_fen,
        move_quality,
        games!inner (
          id,
          played_at,
          white_player,
          black_player,
          opening_name,
          eco,
          time_control,
          result
        )
      `)
      .in('classification', classification 
        ? [classification] 
        : ['mistake', 'blunder']
      )
    
    // Apply filters
    if (gameIds) {
      query = query.in('game_id', gameIds)
    }
    
    if (pieceMoved) {
      query = query.eq('piece_moved', pieceMoved)
    }
    
    if (phase) {
      query = query.eq('phase', phase)
    }
    
    // Order by most recent games first, then by eval_delta (worst first)
    query = query
      .order('played_at', { foreignTable: 'games', ascending: false })
      .order('eval_delta', { ascending: true })
      .range(offset, offset + limit - 1)
    
    const { data, error, count } = await query
    
    if (error) {
      console.error('Error fetching mistakes:', error)
      return NextResponse.json({ error: 'Failed to fetch mistakes' }, { status: 500 })
    }
    
    // Get total count for pagination - need to use same query structure
    let countQuery = supabase
      .from('moves')
      .select('id', { count: 'exact', head: true })
      .in('classification', classification 
        ? [classification] 
        : ['mistake', 'blunder']
      )
    
    if (gameIds) {
      countQuery = countQuery.in('game_id', gameIds)
    }
    
    if (pieceMoved) {
      countQuery = countQuery.eq('piece_moved', pieceMoved)
    }
    
    if (phase) {
      countQuery = countQuery.eq('phase', phase)
    }
    
    const { count: totalCount } = await countQuery
    
    return NextResponse.json({ 
      data: data || [], 
      total: totalCount || 0,
      limit,
      offset 
    })
    
  } catch (error) {
    console.error('Error in mistakes list API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

