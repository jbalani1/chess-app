import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Game, GameFilters } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const filters: GameFilters = {
      username: searchParams.get('username') || undefined,
      time_control: searchParams.get('time_control') || undefined,
      date_from: searchParams.get('date_from') || undefined,
      date_to: searchParams.get('date_to') || undefined,
      eco: searchParams.get('eco') || undefined,
    }
    
    // Build query
    let query = supabase
      .from('games')
      .select('*')
      .order('played_at', { ascending: false })
      .limit(100)
    
    // Apply filters
    if (filters.username) {
      query = query.eq('username', filters.username)
    }
    
    if (filters.time_control) {
      query = query.eq('time_control', filters.time_control)
    }
    
    if (filters.eco) {
      query = query.eq('eco', filters.eco)
    }

    const openingFamily = searchParams.get('opening_family')
    if (openingFamily) {
      query = query.ilike('opening_name', `${openingFamily}%`)
    }
    
    if (filters.date_from) {
      query = query.gte('played_at', filters.date_from)
    }

    if (filters.date_to) {
      query = query.lte('played_at', filters.date_to)
    }

    const color = searchParams.get('color')
    if (color === 'white' || color === 'black') {
      const playerCol = color === 'white' ? 'white_player' : 'black_player'
      query = query.ilike(playerCol, filters.username || process.env.CHESS_COM_USERNAME || '')
    }
    
    const { data: games, error } = await query
    
    if (error) {
      console.error('Error fetching games:', error)
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 })
    }
    
    return NextResponse.json({ games })
    
  } catch (error) {
    console.error('Error in games API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, year, month } = body
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 })
    }
    
    // For now, just return a success message
    // In a real implementation, you might queue a job or call the Python worker
    return NextResponse.json({ 
      message: `Analysis queued for ${username}${year ? ` (${year}-${month || 1})` : ''}`,
      username,
      year,
      month
    })
    
  } catch (error) {
    console.error('Error in games POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
