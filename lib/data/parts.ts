import { createClient } from '@/lib/supabase/server'
import type { Part, PartStatus } from '@/lib/types/inventory'

export type PartListFilters = {
  status?: PartStatus
  category?: string
  brand?: string
  limit?: number
}

export type CreatePartInput = {
  part_number: string
  name: string
  description?: string | null
  brand?: string | null
  category?: string | null
  quantity_on_hand?: number
  reorder_threshold?: number | null
  location?: string | null
  unit_cost?: number | null
  unit_price?: number | null
  status?: PartStatus
}

export type UpdatePartInput = Partial<CreatePartInput>

function mapPart(row: Record<string, unknown>): Part {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    part_number: String(row.part_number),
    name: String(row.name),
    description: row.description != null ? String(row.description) : null,
    brand: row.brand != null ? String(row.brand) : null,
    category: row.category != null ? String(row.category) : null,
    quantity_on_hand: Number(row.quantity_on_hand),
    reorder_threshold:
      row.reorder_threshold != null ? Number(row.reorder_threshold) : null,
    location: row.location != null ? String(row.location) : null,
    unit_cost: row.unit_cost != null ? Number(row.unit_cost) : null,
    unit_price: row.unit_price != null ? Number(row.unit_price) : null,
    status: row.status as PartStatus,
  }
}

function throwOnError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

export async function listParts(filters: PartListFilters = {}): Promise<Part[]> {
  const supabase = await createClient()
  let query = supabase
    .from('parts')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.category) {
    query = query.eq('category', filters.category)
  }
  if (filters.brand) {
    query = query.eq('brand', filters.brand)
  }
  if (filters.limit != null) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  throwOnError(error, 'Failed to list parts')
  return (data ?? []).map((row) => mapPart(row as Record<string, unknown>))
}

export async function getPartById(id: string): Promise<Part | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  throwOnError(error, 'Failed to fetch part')
  if (!data) return null
  return mapPart(data as Record<string, unknown>)
}

export async function createPart(input: CreatePartInput): Promise<Part> {
  const supabase = await createClient()
  const payload = {
    part_number: input.part_number,
    name: input.name,
    description: input.description ?? null,
    brand: input.brand ?? null,
    category: input.category ?? null,
    quantity_on_hand: input.quantity_on_hand ?? 0,
    reorder_threshold: input.reorder_threshold ?? null,
    location: input.location ?? null,
    unit_cost: input.unit_cost ?? null,
    unit_price: input.unit_price ?? null,
    status: input.status ?? 'Active',
  }

  const { data, error } = await supabase
    .from('parts')
    .insert(payload)
    .select('*')
    .single()

  throwOnError(error, 'Failed to create part')
  return mapPart(data as Record<string, unknown>)
}

export async function updatePart(id: string, input: UpdatePartInput): Promise<Part> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('parts')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  throwOnError(error, 'Failed to update part')
  return mapPart(data as Record<string, unknown>)
}

export async function adjustStock(id: string, delta: number): Promise<Part> {
  const current = await getPartById(id)
  if (!current) {
    throw new Error('Part not found')
  }

  const nextQuantity = current.quantity_on_hand + delta
  if (nextQuantity < 0) {
    throw new Error(
      `Stock adjustment would make quantity negative (on hand: ${current.quantity_on_hand}, delta: ${delta})`,
    )
  }

  return updatePart(id, { quantity_on_hand: nextQuantity })
}

export type RecordStockMovementOptions = {
  reason?: string | null
  jobPartId?: string | null
  changedBy?: string | null
}

export type RecordStockMovementResult = {
  quantityOnHand: number
  movementId: string
}

/** Adjusts `quantity_on_hand` and writes an auditable `part_stock_movements` row. */
export async function recordStockMovement(
  partId: string,
  delta: number,
  options: RecordStockMovementOptions = {},
): Promise<RecordStockMovementResult> {
  const part = await getPartById(partId)
  if (!part) {
    throw new Error('Part not found')
  }

  const adjusted = await adjustStock(partId, delta)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('part_stock_movements')
    .insert({
      part_id: partId,
      job_part_id: options.jobPartId ?? null,
      delta,
      quantity_after: adjusted.quantity_on_hand,
      reason: options.reason ?? null,
      changed_by: options.changedBy ?? null,
    })
    .select('id')
    .single()

  if (error || !data) {
    try {
      await adjustStock(partId, -delta)
    } catch {
      throw new Error(
        `Audit log failed and stock rollback failed; manual reconciliation required for part ${partId}: ${error?.message ?? 'unknown error'}`,
      )
    }
    throw new Error(
      `Stock was adjusted but audit log failed; change was rolled back: ${error?.message ?? 'unknown error'}`,
    )
  }

  return {
    quantityOnHand: adjusted.quantity_on_hand,
    movementId: String(data.id),
  }
}

/** Dev-only smoke test for retail/non-job stock drawdown (authenticated context required). */
export async function runRecordStockMovementSmokeTest(): Promise<{
  movementId: string
  quantityOnHand: number
}> {
  const suffix = Date.now()
  const part = await createPart({
    part_number: `C6-SMOKE-${suffix}`,
    name: 'C6 stock movement smoke',
    quantity_on_hand: 10,
  })

  const drawn = await recordStockMovement(part.id, -3, {
    reason: 'C6 retail smoke',
  })
  if (drawn.quantityOnHand !== 7) {
    throw new Error(`Expected quantity_on_hand 7, got ${drawn.quantityOnHand}`)
  }

  const supabase = await createClient()
  const { data: movement, error: movementError } = await supabase
    .from('part_stock_movements')
    .select('delta, quantity_after, job_part_id')
    .eq('id', drawn.movementId)
    .single()
  if (movementError || !movement) {
    throw new Error(`Failed to read movement: ${movementError?.message}`)
  }
  if (
    movement.delta !== -3 ||
    movement.quantity_after !== 7 ||
    movement.job_part_id != null
  ) {
    throw new Error('Movement row does not match retail drawdown')
  }

  const stockBeforeReject = (await getPartById(part.id))?.quantity_on_hand
  const movementCountBefore = (
    await supabase
      .from('part_stock_movements')
      .select('id', { count: 'exact', head: true })
      .eq('part_id', part.id)
  ).count

  try {
    await recordStockMovement(part.id, -100)
    throw new Error('Expected over-draw to throw')
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('negative')) {
      throw error
    }
  }

  const stockAfterReject = (await getPartById(part.id))?.quantity_on_hand
  if (stockAfterReject !== stockBeforeReject) {
    throw new Error('Over-draw must not change quantity_on_hand')
  }

  const { count: movementCountAfter } = await supabase
    .from('part_stock_movements')
    .select('id', { count: 'exact', head: true })
    .eq('part_id', part.id)
  if (movementCountAfter !== movementCountBefore) {
    throw new Error('Over-draw must not insert an additional movement row')
  }

  const { error: deleteError } = await supabase
    .from('parts')
    .delete()
    .eq('id', part.id)
  throwOnError(deleteError, 'Failed to clean up smoke-test part')

  return {
    movementId: drawn.movementId,
    quantityOnHand: drawn.quantityOnHand,
  }
}

/** Dev-only accessor smoke test (authenticated server context required). */
export async function runPartsAccessorSmokeTest(): Promise<{
  createdId: string
  adjustedQuantity: number
}> {
  const suffix = Date.now()
  const created = await createPart({
    part_number: `C5-SMOKE-${suffix}`,
    name: 'C5 accessor smoke',
    category: 'Belt',
    quantity_on_hand: 10,
  })

  const fetched = await getPartById(created.id)
  if (!fetched || fetched.part_number !== created.part_number) {
    throw new Error('getPartById round-trip failed')
  }

  const listed = await listParts({ category: 'Belt' })
  if (!listed.some((row) => row.id === created.id)) {
    throw new Error('listParts filter did not return created row')
  }

  const updated = await updatePart(created.id, { name: 'C5 accessor smoke updated' })
  if (updated.name !== 'C5 accessor smoke updated') {
    throw new Error('updatePart failed')
  }

  const adjusted = await adjustStock(created.id, -3)
  if (adjusted.quantity_on_hand !== 7) {
    throw new Error(`adjustStock expected 7, got ${adjusted.quantity_on_hand}`)
  }

  const qtyBeforeReject = adjusted.quantity_on_hand
  try {
    await adjustStock(created.id, -100)
    throw new Error('Expected negative adjustStock to throw')
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes('negative')
    ) {
      throw error
    }
  }

  const afterReject = await getPartById(created.id)
  if (afterReject?.quantity_on_hand !== qtyBeforeReject) {
    throw new Error('Negative adjustStock must not change quantity_on_hand')
  }

  const supabase = await createClient()
  const { error: deleteError } = await supabase
    .from('parts')
    .delete()
    .eq('id', created.id)
  throwOnError(deleteError, 'Failed to clean up smoke-test row')

  return {
    createdId: created.id,
    adjustedQuantity: adjusted.quantity_on_hand,
  }
}
