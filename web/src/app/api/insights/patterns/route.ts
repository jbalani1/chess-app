import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseAdmin
    
    // Get mistake patterns from the view
    const { data: mistakePatterns, error } = await supabase
      .from('mistake_patterns')
      .select('*')
      .order('mistake_rate', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching mistake patterns:', error)
      return NextResponse.json({ error: 'Failed to fetch mistake patterns' }, { status: 500 })
    }

    return NextResponse.json(mistakePatterns)
  } catch (error) {
    console.error('Error in mistake patterns API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
