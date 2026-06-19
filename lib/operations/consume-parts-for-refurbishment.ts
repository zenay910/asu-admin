'use server'

import { revalidatePath } from 'next/cache'
import { createAppliance } from '@/lib/data/appliances'
import {
  createPart,
  getPartById,
  recordStockMovement,
} from '@/lib/data/parts'
import {
  createRefurbishment,
  getRefurbishmentById,
} from '@/lib/data/refurbishments'
import { createClient } from '@/lib/supabase/server'

export type ConsumePartsForRefurbishmentResult =
  | {
      success: true
      refurbishmentPartId: string
      quantityOnHand: number
    }
  | { success: false; error: string }

function consumeError(message: string): ConsumePartsForRefurbishmentResult {
  return { success: false, error: message }
}

export async function consumePartsForRefurbishment(
  refurbishmentId: string,
  partId: string,
  quantity: number,
  options?: { reason?: string },
): Promise<ConsumePartsForRefurbishmentResult> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return consumeError('Quantity must be a positive whole number.')
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return consumeError('You must be signed in to consume parts for a refurbishment.')
  }

  const refurbishment = await getRefurbishmentById(refurbishmentId)
  if (!refurbishment) {
    return consumeError('Refurbishment not found.')
  }

  const part = await getPartById(partId)
  if (!part) {
    return consumeError('Part not found.')
  }

  if (part.quantity_on_hand < quantity) {
    return consumeError(
      `Not enough stock (on hand: ${part.quantity_on_hand}, requested: ${quantity}).`,
    )
  }

  const unitPrice = part.unit_price ?? 0

  const { data: refurbishmentPart, error: refurbishmentPartError } =
    await supabase
      .from('refurbishment_parts')
      .insert({
        refurbishment_id: refurbishmentId,
        part_id: partId,
        quantity,
        unit_price: unitPrice,
      })
      .select('id')
      .single()

  if (refurbishmentPartError || !refurbishmentPart) {
    return consumeError(
      `Could not record parts for refurbishment: ${refurbishmentPartError?.message ?? 'unknown error'}`,
    )
  }

  const refurbishmentPartId = String(refurbishmentPart.id)

  let quantityAfter: number
  try {
    const movement = await recordStockMovement(partId, -quantity, {
      refurbishmentPartId,
      reason: options?.reason ?? null,
      changedBy: user.id,
    })
    quantityAfter = movement.quantityOnHand
  } catch (error) {
    await supabase
      .from('refurbishment_parts')
      .delete()
      .eq('id', refurbishmentPartId)
    const message =
      error instanceof Error ? error.message : 'Stock adjustment failed.'
    return consumeError(message)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/refurbishments')
  revalidatePath('/dashboard/parts')

  return {
    success: true,
    refurbishmentPartId,
    quantityOnHand: quantityAfter,
  }
}

/** Dev smoke test: consumption updates stock and audit with refurbishment_part_id. */
export async function runConsumePartsForRefurbishmentSmokeTest(): Promise<{
  refurbishmentPartId: string
  quantityOnHand: number
}> {
  const suffix = Date.now()
  const part = await createPart({
    part_number: `C1C-SMOKE-${suffix}`,
    name: 'C1c refurb consume smoke',
    quantity_on_hand: 10,
    unit_price: 8.25,
  })

  const appliance = await createAppliance({
    title: 'C1c consume smoke appliance',
    price: 0,
    type: 'Dryer',
    lifecycle_state: 'Refurbishment',
    status: 'Draft',
  })

  const refurbishment = await createRefurbishment({
    appliance_id: appliance.id,
    status: 'repair',
  })

  const consumed = await consumePartsForRefurbishment(
    refurbishment.id,
    part.id,
    4,
    { reason: 'C1c smoke valid' },
  )
  if (!consumed.success) {
    throw new Error(`Expected consumption to succeed: ${consumed.error}`)
  }
  if (consumed.quantityOnHand !== 6) {
    throw new Error(`Expected quantity_on_hand 6, got ${consumed.quantityOnHand}`)
  }

  const supabase = await createClient()
  const { data: refurbParts, error: refurbPartsError } = await supabase
    .from('refurbishment_parts')
    .select('id, quantity, unit_price')
    .eq('refurbishment_id', refurbishment.id)
  if (refurbPartsError) {
    throw new Error(`Failed to read refurbishment_parts: ${refurbPartsError.message}`)
  }
  if ((refurbParts?.length ?? 0) !== 1) {
    throw new Error(
      `Expected 1 refurbishment_parts row, got ${refurbParts?.length ?? 0}`,
    )
  }
  if (
    refurbParts![0].quantity !== 4 ||
    Number(refurbParts![0].unit_price) !== 8.25
  ) {
    throw new Error('refurbishment_parts row does not match consumption')
  }

  const { data: movements, error: movementsError } = await supabase
    .from('part_stock_movements')
    .select('delta, quantity_after, refurbishment_part_id, job_part_id')
    .eq('refurbishment_part_id', consumed.refurbishmentPartId)
  if (movementsError) {
    throw new Error(`Failed to read movements: ${movementsError.message}`)
  }
  if ((movements?.length ?? 0) !== 1) {
    throw new Error(`Expected 1 movement row, got ${movements?.length ?? 0}`)
  }
  const movement = movements![0]
  if (
    movement.delta !== -4 ||
    movement.quantity_after !== 6 ||
    movement.job_part_id != null
  ) {
    throw new Error('Movement row does not match refurbishment consumption')
  }

  const stockBeforeReject = (await getPartById(part.id))?.quantity_on_hand
  const oversell = await consumePartsForRefurbishment(
    refurbishment.id,
    part.id,
    100,
  )
  if (oversell.success) {
    throw new Error('Expected oversell to be rejected')
  }

  const stockAfterReject = (await getPartById(part.id))?.quantity_on_hand
  if (stockAfterReject !== stockBeforeReject) {
    throw new Error('Oversell must not change quantity_on_hand')
  }

  const { data: refurbPartsAfterReject } = await supabase
    .from('refurbishment_parts')
    .select('id')
    .eq('refurbishment_id', refurbishment.id)
  if ((refurbPartsAfterReject?.length ?? 0) !== 1) {
    throw new Error('Oversell must not insert additional refurbishment_parts rows')
  }

  const { error: deleteApplianceError } = await supabase
    .from('appliances')
    .delete()
    .eq('id', appliance.id)
  if (deleteApplianceError) {
    throw new Error(`Failed to clean up appliance: ${deleteApplianceError.message}`)
  }

  const { error: deletePartError } = await supabase
    .from('parts')
    .delete()
    .eq('id', part.id)
  if (deletePartError) {
    throw new Error(`Failed to clean up part: ${deletePartError.message}`)
  }

  return {
    refurbishmentPartId: consumed.refurbishmentPartId,
    quantityOnHand: consumed.quantityOnHand,
  }
}
