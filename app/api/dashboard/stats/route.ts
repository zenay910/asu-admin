import { NextResponse } from 'next/server'
import { getDashboardStats } from '@/lib/data/dashboard-stats'
import { createClient } from '@/lib/supabase/server'

export type DashboardStatsApiSuccess = {
  success: true
  stats: Awaited<ReturnType<typeof getDashboardStats>>
}

export type DashboardStatsApiError = { success: false; error: string }

async function requireAuth(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return !error && !!user
}

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json<DashboardStatsApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    const stats = await getDashboardStats()
    return NextResponse.json<DashboardStatsApiSuccess>({ success: true, stats })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load dashboard stats'
    return NextResponse.json<DashboardStatsApiError>(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
