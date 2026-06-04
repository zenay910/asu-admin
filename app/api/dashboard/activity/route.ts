import { NextResponse } from 'next/server'
import { getRecentDashboardActivity } from '@/lib/data/dashboard-activity'
import { createClient } from '@/lib/supabase/server'

export type DashboardActivityApiSuccess = {
  success: true
  activity: Awaited<ReturnType<typeof getRecentDashboardActivity>>
}

export type DashboardActivityApiError = { success: false; error: string }

async function requireAuth(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return !error && !!user
}

export async function GET(request: Request) {
  if (!(await requireAuth())) {
    return NextResponse.json<DashboardActivityApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { searchParams } = new URL(request.url)
  const limitRaw = searchParams.get('limit')
  const limit =
    limitRaw != null && Number.isFinite(Number(limitRaw))
      ? Number(limitRaw)
      : undefined

  try {
    const activity = await getRecentDashboardActivity(limit)
    return NextResponse.json<DashboardActivityApiSuccess>({
      success: true,
      activity,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load recent activity'
    return NextResponse.json<DashboardActivityApiError>(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
