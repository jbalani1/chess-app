import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const gameId = params.gameId
    
    if (!gameId) {
      return NextResponse.json({ error: 'Game ID is required' }, { status: 400 })
    }
    
    // Fetch game details
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()
    
    if (gameError) {
      console.error('Error fetching game:', gameError)
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }
    
    // Fetch all moves for the game
    const { data: moves, error: movesError } = await supabase
      .from('moves')
      .select('*')
      .eq('game_id', gameId)
      .order('ply', { ascending: true })
    
    if (movesError) {
      console.error('Error fetching moves:', movesError)
      return NextResponse.json({ error: 'Failed to fetch moves' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      game,
      moves: moves || []
    })
    
  } catch (error) {
    console.error('Error in analysis API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
