import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface PositionalPattern {
  pattern_type: string
  description: string
  severity: string
  piece_involved?: string
  recommendation?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ patternType: string }> }
) {
  try {
    const { patternType } = await params
    
    // Get games that contain this specific positional pattern
    const { data: games, error } = await supabaseAdmin
      .from('moves')
      .select(`
        id,
        ply,
        move_san,
        move_uci,
        eval_delta,
        classification,
        position_fen,
        positional_patterns,
        games!inner(
          id,
          white_player,
          black_player,
          played_at,
          result,
          opening_name,
          eco
        )
      `)
      .not('positional_patterns', 'is', null)
      .limit(20)

    if (error) {
      console.error('Error fetching games for pattern:', error)
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 })
    }

    // Process the data to extract specific pattern instances
    const processedGames = games?.map(move => {
      const patterns = move.positional_patterns || []
      const relevantPatterns = patterns.filter((pattern: PositionalPattern) => pattern.pattern_type === patternType)
      const game = move.games as unknown as {
        id: string
        white_player: string
        black_player: string
        played_at: string
        result: string
        opening_name: string
        eco: string
      }

      return {
        moveId: move.id,
        ply: move.ply,
        moveSan: move.move_san,
        moveUci: move.move_uci,
        evalDelta: move.eval_delta,
        classification: move.classification,
        positionFen: move.position_fen,
        patterns: relevantPatterns,
        game: {
          id: game.id,
          whitePlayer: game.white_player,
          blackPlayer: game.black_player,
          playedAt: game.played_at,
          result: game.result,
          openingName: game.opening_name,
          eco: game.eco
        }
      }
    }) || []

    // Sort by game date (most recent first)
    processedGames.sort((a, b) => 
      new Date(b.game.playedAt).getTime() - new Date(a.game.playedAt).getTime()
    )

    return NextResponse.json(processedGames)
  } catch (error) {
    console.error('Error in positional pattern games API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
