import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Fetch game details
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', id)
      .single()
    
    if (gameError || !game) {
      console.error('Error fetching game:', gameError)
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }
    
    // Fetch all moves for the game
    const { data: moves, error: movesError } = await supabaseAdmin
      .from('moves')
      .select('*')
      .eq('game_id', id)
      .order('ply', { ascending: true })
    
    if (movesError) {
      console.error('Error fetching moves:', movesError)
      return NextResponse.json({ game, moves: [] })
    }
    
    return NextResponse.json({ game, moves: moves || [] })
  } catch (error) {
    console.error('Error in games API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
