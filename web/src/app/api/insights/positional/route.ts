import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin
    
    // Get positional insights from the view
    const { data: positionalInsights, error } = await supabase
      .from('positional_insights')
      .select('*')
      .order('frequency', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching positional insights:', error)
      return NextResponse.json({ error: 'Failed to fetch positional insights' }, { status: 500 })
    }

    return NextResponse.json(positionalInsights)
  } catch (error) {
    console.error('Error in positional insights API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
