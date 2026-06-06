import { createClient } from '@/lib/supabase/server'

export type FinancialSummary = {
  revenueTotal: number
  outstandingTotal: number
  outstandingCount: number
  partsCostTotal: number
  inventoryValueTotal: number
}

function throwOnError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

export async function getFinancialSummary(): Promise<FinancialSummary> {
  const supabase = await createClient()

  const { data: revenueRows, error: revenueError } = await supabase
    .from('invoices')
    .select('total')
    .in('status', ['Issued', 'Paid'])
  throwOnError(revenueError, 'Failed to sum revenue')
  const revenueTotal = (revenueRows ?? []).reduce(
    (sum, row) => sum + Number(row.total),
    0,
  )

  const { data: outstandingRows, error: outstandingError } = await supabase
    .from('invoices')
    .select('total')
    .eq('status', 'Issued')
  throwOnError(outstandingError, 'Failed to sum outstanding invoices')
  const outstandingTotal = (outstandingRows ?? []).reduce(
    (sum, row) => sum + Number(row.total),
    0,
  )
  const outstandingCount = outstandingRows?.length ?? 0

  const { data: partsRows, error: partsError } = await supabase
    .from('parts')
    .select('quantity_on_hand, unit_cost')
  throwOnError(partsError, 'Failed to load parts for cost total')
  const partsCostTotal = (partsRows ?? []).reduce((sum, row) => {
    const quantity = Number(row.quantity_on_hand)
    const unitCost = row.unit_cost != null ? Number(row.unit_cost) : 0
    return sum + quantity * unitCost
  }, 0)

  const { data: applianceRows, error: appliancesError } = await supabase
    .from('appliances')
    .select('price')
    .neq('lifecycle_state', 'Retired')
  throwOnError(appliancesError, 'Failed to load appliances for inventory value')
  const applianceValueTotal = (applianceRows ?? []).reduce(
    (sum, row) => sum + Number(row.price),
    0,
  )
  const inventoryValueTotal = applianceValueTotal + partsCostTotal

  return {
    revenueTotal,
    outstandingTotal,
    outstandingCount,
    partsCostTotal,
    inventoryValueTotal,
  }
}
