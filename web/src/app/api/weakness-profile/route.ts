import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// --- Type definitions ---

interface MotifVulnerability {
  tactic_type: string
  count: number
  total_eval_loss: number
  avg_eval_loss: number
  recent_count: number
  older_count: number
  trend: 'improving' | 'stable' | 'worsening'
  top_openings: { eco: string; opening_name: string; count: number }[]
  phases: { phase: string; count: number }[]
}

interface OpeningMotifLink {
  eco: string
  opening_name: string
  games_played: number
  motifs: { tactic_type: string; count: number; avg_eval_loss: number }[]
  total_missed: number
  worst_motif: string
}

interface StudyPosition {
  move_id: string
  game_id: string
  position_fen: string
  move_san: string
  best_move_san: string | null
  best_move_uci: string | null
  eval_delta: number
  tactic_type: string
  tactic_description: string
  tactic_squares: string[]
  phase: string
  user_color: 'white' | 'black'
  opening_name: string
  eco: string
  played_at: string
  priority_score: number
}

interface WeaknessProfile {
  motifs: MotifVulnerability[]
  opening_motifs: OpeningMotifLink[]
  study_queue: StudyPosition[]
}

// --- Helpers ---

interface GameData {
  id: string
  white_player: string
  black_player: string
  result: string
  opening_name: string
  eco: string
  time_control: string
  played_at: string
  username: string
}

interface BlunderDetails {
  missed_tactic_type?: string
  missed_tactic_description?: string
  missed_tactic_squares?: string[]
}

function parseBlunderDetails(raw: unknown): BlunderDetails {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return (raw as BlunderDetails) || {}
}

function computeDateCutoff(dateFilter: string): Date | null {
  const now = new Date()
  switch (dateFilter) {
    case '7days':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30days':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90days':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    default:
      return null
  }
}

function computeRecencyWeight(playedAt: string): number {
  const now = Date.now()
  const played = new Date(playedAt).getTime()
  const daysAgo = (now - played) / (1000 * 60 * 60 * 24)
  if (daysAgo <= 7) return 1.0
  if (daysAgo <= 30) return 0.8
  return 0.5
}

// --- Main handler ---

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin
    const searchParams = request.nextUrl.searchParams

    const dateFilter = searchParams.get('dateFilter') || 'all'
    const colorFilter = searchParams.get('color') || 'all'
    const phaseFilter = searchParams.get('phase') || 'all'

    const dateCutoff = computeDateCutoff(dateFilter)

    // Build query: moves with missed tactics joined to games
    let query = supabase
      .from('moves')
      .select(`
        id,
        game_id,
        ply,
        move_san,
        best_move_san,
        best_move_uci,
        eval_delta,
        classification,
        phase,
        position_fen,
        position_fen_before,
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
      .in('classification', ['inaccuracy', 'mistake', 'blunder'])
      .not('blunder_details->missed_tactic_type', 'is', null)

    if (phaseFilter !== 'all') {
      query = query.eq('phase', phaseFilter)
    }

    if (dateCutoff) {
      query = query.gte('games.played_at', dateCutoff.toISOString())
    }

    const { data: moves, error } = await query.limit(10000)

    if (error) {
      console.error('Error fetching weakness profile data:', error)
      return NextResponse.json({ error: 'Failed to fetch weakness profile data' }, { status: 500 })
    }

    if (!moves || moves.length === 0) {
      const empty: WeaknessProfile = { motifs: [], opening_motifs: [], study_queue: [] }
      return NextResponse.json(empty)
    }

    // Filter to user's own moves and apply color filter
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    interface ProcessedMove {
      move_id: string
      game_id: string
      ply: number
      move_san: string
      best_move_san: string | null
      best_move_uci: string | null
      eval_delta: number
      classification: string
      phase: string
      position_fen: string
      position_fen_before: string
      tactic_type: string
      tactic_description: string
      tactic_squares: string[]
      user_color: 'white' | 'black'
      opening_name: string
      eco: string
      played_at: string
    }

    const processedMoves: ProcessedMove[] = []

    for (const move of moves) {
      const game = move.games as unknown as GameData
      const username = game.username?.toLowerCase()
      const whitePlayer = game.white_player?.toLowerCase()
      const blackPlayer = game.black_player?.toLowerCase()

      const userIsWhite = username === whitePlayer
      const userIsBlack = username === blackPlayer

      const isWhiteMove = move.ply % 2 === 1
      const isBlackMove = move.ply % 2 === 0

      const isUserMove = (userIsWhite && isWhiteMove) || (userIsBlack && isBlackMove)
      if (!isUserMove) continue

      const userColor: 'white' | 'black' = userIsWhite ? 'white' : 'black'

      if (colorFilter !== 'all' && userColor !== colorFilter) continue

      const details = parseBlunderDetails(move.blunder_details)
      const tacticType = details.missed_tactic_type
      if (!tacticType) continue

      processedMoves.push({
        move_id: move.id,
        game_id: move.game_id,
        ply: move.ply,
        move_san: move.move_san,
        best_move_san: move.best_move_san,
        best_move_uci: move.best_move_uci,
        eval_delta: move.eval_delta,
        classification: move.classification,
        phase: move.phase,
        position_fen: move.position_fen,
        position_fen_before: move.position_fen_before,
        tactic_type: tacticType,
        tactic_description: details.missed_tactic_description || '',
        tactic_squares: details.missed_tactic_squares || [],
        user_color: userColor,
        opening_name: game.opening_name || 'Unknown Opening',
        eco: game.eco || '',
        played_at: game.played_at,
      })
    }

    if (processedMoves.length === 0) {
      const empty: WeaknessProfile = { motifs: [], opening_motifs: [], study_queue: [] }
      return NextResponse.json(empty)
    }

    // ---- Build MotifVulnerability[] ----

    const motifMap = new Map<string, {
      count: number
      total_eval_loss: number
      recent_count: number
      older_count: number
      openings: Map<string, { eco: string; opening_name: string; count: number }>
      phases: Map<string, number>
    }>()

    for (const m of processedMoves) {
      let entry = motifMap.get(m.tactic_type)
      if (!entry) {
        entry = {
          count: 0,
          total_eval_loss: 0,
          recent_count: 0,
          older_count: 0,
          openings: new Map(),
          phases: new Map(),
        }
        motifMap.set(m.tactic_type, entry)
      }

      entry.count++
      entry.total_eval_loss += Math.abs(m.eval_delta)

      const playedDate = new Date(m.played_at)
      if (playedDate >= thirtyDaysAgo) {
        entry.recent_count++
      } else if (playedDate >= sixtyDaysAgo) {
        entry.older_count++
      }

      // Track openings per motif
      const openingKey = `${m.eco}|${m.opening_name}`
      const existing = entry.openings.get(openingKey)
      if (existing) {
        existing.count++
      } else {
        entry.openings.set(openingKey, { eco: m.eco, opening_name: m.opening_name, count: 1 })
      }

      // Track phases per motif
      entry.phases.set(m.phase, (entry.phases.get(m.phase) || 0) + 1)
    }

    const motifs: MotifVulnerability[] = Array.from(motifMap.entries())
      .map(([tactic_type, data]) => {
        const avg_eval_loss = data.count > 0 ? Math.round(data.total_eval_loss / data.count) : 0

        let trend: 'improving' | 'stable' | 'worsening' = 'stable'
        if (data.older_count > 0) {
          if (data.recent_count > data.older_count * 1.2) {
            trend = 'worsening'
          } else if (data.recent_count < data.older_count * 0.8) {
            trend = 'improving'
          }
        } else if (data.recent_count > 0) {
          // No older data but recent occurrences: treat as stable (not enough history)
          trend = 'stable'
        }

        const top_openings = Array.from(data.openings.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)

        const phases = Array.from(data.phases.entries())
          .map(([phase, count]) => ({ phase, count }))
          .sort((a, b) => b.count - a.count)

        return {
          tactic_type,
          count: data.count,
          total_eval_loss: Math.round(data.total_eval_loss),
          avg_eval_loss,
          recent_count: data.recent_count,
          older_count: data.older_count,
          trend,
          top_openings,
          phases,
        }
      })
      // Rank by impact: count * avg_eval_loss descending
      .sort((a, b) => (b.count * b.avg_eval_loss) - (a.count * a.avg_eval_loss))

    // ---- Build OpeningMotifLink[] ----

    const openingMap = new Map<string, {
      eco: string
      opening_name: string
      game_ids: Set<string>
      motifs: Map<string, { count: number; total_eval_loss: number }>
    }>()

    for (const m of processedMoves) {
      const openingKey = `${m.eco}|${m.opening_name}`
      let entry = openingMap.get(openingKey)
      if (!entry) {
        entry = {
          eco: m.eco,
          opening_name: m.opening_name,
          game_ids: new Set(),
          motifs: new Map(),
        }
        openingMap.set(openingKey, entry)
      }

      entry.game_ids.add(m.game_id)

      const motifEntry = entry.motifs.get(m.tactic_type)
      if (motifEntry) {
        motifEntry.count++
        motifEntry.total_eval_loss += Math.abs(m.eval_delta)
      } else {
        entry.motifs.set(m.tactic_type, { count: 1, total_eval_loss: Math.abs(m.eval_delta) })
      }
    }

    const opening_motifs: OpeningMotifLink[] = Array.from(openingMap.values())
      .map((data) => {
        const motifList = Array.from(data.motifs.entries())
          .map(([tactic_type, stats]) => ({
            tactic_type,
            count: stats.count,
            avg_eval_loss: stats.count > 0 ? Math.round(stats.total_eval_loss / stats.count) : 0,
          }))
          .sort((a, b) => b.count - a.count)

        const total_missed = motifList.reduce((sum, m) => sum + m.count, 0)
        const worst_motif = motifList.length > 0
          ? motifList.reduce((worst, cur) =>
              (cur.count * cur.avg_eval_loss) > (worst.count * worst.avg_eval_loss) ? cur : worst
            ).tactic_type
          : ''

        return {
          eco: data.eco,
          opening_name: data.opening_name,
          games_played: data.game_ids.size,
          motifs: motifList,
          total_missed,
          worst_motif,
        }
      })
      .sort((a, b) => b.total_missed - a.total_missed)

    // ---- Build StudyPosition[] (top 20) ----

    const studyCandidates: StudyPosition[] = processedMoves.map((m) => {
      const recencyWeight = computeRecencyWeight(m.played_at)
      const priority_score = Math.round(Math.abs(m.eval_delta) * recencyWeight * 100) / 100

      return {
        move_id: m.move_id,
        game_id: m.game_id,
        position_fen: m.position_fen_before,
        move_san: m.move_san,
        best_move_san: m.best_move_san,
        best_move_uci: m.best_move_uci,
        eval_delta: m.eval_delta,
        tactic_type: m.tactic_type,
        tactic_description: m.tactic_description,
        tactic_squares: m.tactic_squares,
        phase: m.phase,
        user_color: m.user_color,
        opening_name: m.opening_name,
        eco: m.eco,
        played_at: m.played_at,
        priority_score,
      }
    })

    const study_queue = studyCandidates
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, 200)

    // ---- Response ----

    const profile: WeaknessProfile = {
      motifs,
      opening_motifs,
      study_queue,
    }

    return NextResponse.json(profile)
  } catch (error) {
    console.error('Error in weakness-profile API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
