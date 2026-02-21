import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface TacticalMotif {
  motif_type: string
  description: string
  severity: string
  piece_involved?: string
  pinned_piece?: string
  recommendation?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ motifType: string }> }
) {
  try {
    const { motifType } = await params
    
    // Get games that contain this specific tactical motif
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
        tactical_motifs,
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
      .not('tactical_motifs', 'is', null)
      .limit(20)

    if (error) {
      console.error('Error fetching games for motif:', error)
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 })
    }

    // Process the data to extract specific motif instances
    const processedGames = (games || [])
      .map(move => {
        const motifs = move.tactical_motifs || []
        const relevantMotifs = motifs.filter((motif: TacticalMotif) => motif.motif_type === motifType)
        const topMotif = relevantMotifs[0]
        const pinnedPiece = topMotif?.pinned_piece || topMotif?.piece_involved || null
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
          motifs: relevantMotifs,
          pinnedPiece,
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
      })
      // Keep either clearly bad moves or strong motif flags
      .filter(entry => (
        entry.motifs && entry.motifs.length > 0 && (
          entry.classification === 'mistake' ||
          entry.classification === 'blunder' ||
          entry.motifs.some((m: TacticalMotif) => (m.severity === 'major' || m.severity === 'critical'))
        )
      ))
      // Prefer worse eval drops
      .sort((a, b) => (a.evalDelta ?? 0) - (b.evalDelta ?? 0))

    const totalPositions = processedGames.length
    const byGame: Record<string, typeof processedGames[number]> = {}
    for (const entry of processedGames) {
      const gid = entry.game.id
      // Keep the worst (most negative evalDelta) per game
      if (!byGame[gid] || (entry.evalDelta ?? 0) < (byGame[gid].evalDelta ?? 0)) {
        byGame[gid] = entry
      }
    }
    const items = Object.values(byGame)
      .sort((a, b) => (a.evalDelta ?? 0) - (b.evalDelta ?? 0))
      .slice(0, 20)
    const totalGames = Object.keys(byGame).length

    // Sort by game date (most recent first)
    processedGames.sort((a, b) => 
      new Date(b.game.playedAt).getTime() - new Date(a.game.playedAt).getTime()
    )

    return NextResponse.json({ items, totals: { positions: totalPositions, games: totalGames } })
  } catch (error) {
    console.error('Error in tactical motif games API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
