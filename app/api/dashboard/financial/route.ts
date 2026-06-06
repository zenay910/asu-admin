import { NextResponse } from 'next/server'
import { getFinancialSummary } from '@/lib/data/financial-summary'
import { createClient } from '@/lib/supabase/server'

export type FinancialSummaryApiSuccess = {
  success: true
  summary: Awaited<ReturnType<typeof getFinancialSummary>>
}

export type FinancialSummaryApiError = { success: false; error: string }

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
    return NextResponse.json<FinancialSummaryApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    const summary = await getFinancialSummary()
    return NextResponse.json<FinancialSummaryApiSuccess>({
      success: true,
      summary,
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load financial summary'
    return NextResponse.json<FinancialSummaryApiError>(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
