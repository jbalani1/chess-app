import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { MistakeFilters } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const groupBy = searchParams.get('groupBy') as 'piece' | 'opening' | 'phase' | 'time_control'
    const time_control = searchParams.get('time_control')
    const date_from = searchParams.get('date_from')
    const date_to = searchParams.get('date_to')
    const phase = searchParams.get('phase')
    
    if (!groupBy) {
      return NextResponse.json({ error: 'groupBy parameter is required' }, { status: 400 })
    }
    
    let query
    let tableName = ''
    
    // Determine which view to query based on groupBy
    switch (groupBy) {
      case 'piece':
        tableName = 'mistakes_by_piece'
        query = supabase.from(tableName).select('*').order('mistake_rate', { ascending: false })
        break
        
      case 'opening':
        tableName = 'mistakes_by_opening'
        query = supabase.from(tableName).select('*').order('mistake_rate', { ascending: false })
        break
        
      case 'phase':
        tableName = 'mistakes_by_phase'
        query = supabase.from(tableName).select('*').order('phase')
        break
        
      case 'time_control':
        tableName = 'mistakes_by_time_control'
        query = supabase.from(tableName).select('*').order('mistake_rate', { ascending: false })
        break
        
      default:
        return NextResponse.json({ error: 'Invalid groupBy parameter' }, { status: 400 })
    }
    
    // Apply additional filters if needed
    // Note: Some filters might require joining with the games table
    if (time_control && (groupBy === 'piece' || groupBy === 'phase')) {
      // For piece and phase, we need to filter by time_control from games table
      // This would require a more complex query or a custom view
      // For now, we'll return all data and filter on the frontend
    }
    
    if (date_from || date_to) {
      // Similar to above, would need to join with games table for date filtering
    }
    
    if (phase && groupBy === 'piece') {
      // Filter moves by phase - would need to join with moves table
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error(`Error fetching ${tableName}:`, error)
      return NextResponse.json({ error: 'Failed to fetch mistake data' }, { status: 500 })
    }
    
    return NextResponse.json({ data, groupBy })
    
  } catch (error) {
    console.error('Error in mistakes API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
