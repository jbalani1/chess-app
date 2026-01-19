import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin
    
    // Get tactical insights from the view
    const { data: tacticalInsights, error } = await supabase
      .from('tactical_insights')
      .select('*')
      .order('frequency', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching tactical insights:', error)
      return NextResponse.json({ error: 'Failed to fetch tactical insights' }, { status: 500 })
    }

    return NextResponse.json(tacticalInsights)
  } catch (error) {
    console.error('Error in tactical insights API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
