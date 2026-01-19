import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get distinct time controls from games table
    const { data, error } = await supabase
      .from('games')
      .select('time_control')
      .not('time_control', 'is', null)
    
    if (error) {
      console.error('Error fetching time controls:', error)
      return NextResponse.json({ error: 'Failed to fetch time controls' }, { status: 500 })
    }
    
    // Get unique time controls and sort them
    const uniqueTimeControls = Array.from(
      new Set(data?.map(g => g.time_control).filter(Boolean))
    ).sort()
    
    return NextResponse.json({ timeControls: uniqueTimeControls })
    
  } catch (error) {
    console.error('Error in time controls API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

