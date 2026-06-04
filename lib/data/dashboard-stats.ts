import { createClient } from '@/lib/supabase/server'
import type { LifecycleState } from '@/lib/types/inventory'

const LIFECYCLE_STATES: readonly LifecycleState[] = [
  'Intake',
  'Refurbishment',
  'Listed',
  'Retired',
]

export type DashboardStats = {
  appliancesByLifecycle: Record<LifecycleState, number>
  lowStockPartsCount: number
  openJobsCount: number
  draftInvoicesCount: number
  issuedInvoicesCount: number
  revenueTotal: number
}

function throwOnError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient()

  const appliancesByLifecycle = Object.fromEntries(
    LIFECYCLE_STATES.map((state) => [state, 0]),
  ) as Record<LifecycleState, number>

  for (const state of LIFECYCLE_STATES) {
    const { count, error } = await supabase
      .from('appliances')
      .select('*', { count: 'exact', head: true })
      .eq('lifecycle_state', state)
    throwOnError(error, `Failed to count appliances in ${state}`)
    appliancesByLifecycle[state] = count ?? 0
  }

  const { data: partsRows, error: partsError } = await supabase
    .from('parts')
    .select('quantity_on_hand, reorder_threshold')
    .not('reorder_threshold', 'is', null)
  throwOnError(partsError, 'Failed to load parts for low-stock count')
  const lowStockPartsCount = (partsRows ?? []).filter(
    (row) => Number(row.quantity_on_hand) <= Number(row.reorder_threshold),
  ).length

  const { count: openJobsCount, error: openJobsError } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .neq('state', 'Closed')
  throwOnError(openJobsError, 'Failed to count open jobs')

  const { count: draftInvoicesCount, error: draftError } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Draft')
  throwOnError(draftError, 'Failed to count draft invoices')

  const { count: issuedInvoicesCount, error: issuedError } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'Issued')
  throwOnError(issuedError, 'Failed to count issued invoices')

  const { data: revenueRows, error: revenueError } = await supabase
    .from('invoices')
    .select('total')
    .in('status', ['Issued', 'Paid'])
  throwOnError(revenueError, 'Failed to sum revenue')
  const revenueTotal = (revenueRows ?? []).reduce(
    (sum, row) => sum + Number(row.total),
    0,
  )

  return {
    appliancesByLifecycle,
    lowStockPartsCount,
    openJobsCount: openJobsCount ?? 0,
    draftInvoicesCount: draftInvoicesCount ?? 0,
    issuedInvoicesCount: issuedInvoicesCount ?? 0,
    revenueTotal,
  }
}
