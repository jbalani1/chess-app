import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { JoinedGameData } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params
    const supabase = supabaseAdmin

    // Get all blunders for this category with game info
    const { data: blunders, error } = await supabase
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
        blunder_category,
        blunder_details,
        games!inner (
          id,
          white_player,
          black_player,
          result,
          opening_name,
          eco,
          time_control,
          played_at,
          username
        )
      `)
      .eq('blunder_category', category)
      .order('eval_delta', { ascending: true })
      .limit(50)

    if (error) {
      console.error('Error fetching blunders by category:', error)
      return NextResponse.json({ error: 'Failed to fetch blunders' }, { status: 500 })
    }

    // Transform and filter to only include USER's blunders (not opponent's)
    // In chess: even ply (0,2,4...) = White's move, odd ply (1,3,5...) = Black's move
    const result = (blunders || [])
      .filter(blunder => {
        const game = blunder.games as unknown as JoinedGameData
        const username = game.username?.toLowerCase()
        const whitePlayer = game.white_player?.toLowerCase()
        const blackPlayer = game.black_player?.toLowerCase()

        // Determine if user was white or black
        const userIsWhite = username === whitePlayer
        const userIsBlack = username === blackPlayer

        // Filter: only include moves made by the user
        // Even ply = White's move, Odd ply = Black's move
        const isWhiteMove = blunder.ply % 2 === 1  // ply 1,3,5 = white's 1st,2nd,3rd move
        const isBlackMove = blunder.ply % 2 === 0  // ply 2,4,6 = black's 1st,2nd,3rd move

        return (userIsWhite && isWhiteMove) || (userIsBlack && isBlackMove)
      })
      .map(blunder => {
        const game = blunder.games as unknown as JoinedGameData
        const details = typeof blunder.blunder_details === 'string'
          ? JSON.parse(blunder.blunder_details)
          : blunder.blunder_details

        return {
          move_id: blunder.id,
          game_id: blunder.game_id,
          ply: blunder.ply,
          move_san: blunder.move_san,
          eval_loss: Math.abs(blunder.eval_delta || 0),
          classification: blunder.classification,
          piece_moved: blunder.piece_moved,
          phase: blunder.phase,
          position_fen: blunder.position_fen,
          explanation: details?.explanation || 'No explanation available',
          confidence: details?.confidence || 0,
          game: {
            id: game.id,
            white_player: game.white_player,
            black_player: game.black_player,
            result: game.result,
            opening_name: game.opening_name,
            eco: game.eco,
            time_control: game.time_control,
            played_at: game.played_at,
            username: game.username
          }
        }
      })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in blunders by category API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
