'use server'

import { revalidatePath } from 'next/cache'
import { getApplianceById } from '@/lib/data/appliances'
import { getBayById } from '@/lib/data/bays'
import {
  createRefurbishment,
  getRefurbishmentById,
} from '@/lib/data/refurbishments'
import { createClient } from '@/lib/supabase/server'
import type { Refurbishment } from '@/lib/types/refurbishment'

export type AssignRefurbishmentBayResult =
  | { success: true; refurbishment: Refurbishment }
  | { success: false; error: string }

export type UnassignRefurbishmentBayResult =
  | { success: true; refurbishment: Refurbishment }
  | { success: false; error: string }

function assignError(message: string): AssignRefurbishmentBayResult {
  return { success: false, error: message }
}

function unassignError(message: string): UnassignRefurbishmentBayResult {
  return { success: false, error: message }
}

export async function assignRefurbishmentToBay(
  refurbishmentId: string,
  bayId: string,
): Promise<AssignRefurbishmentBayResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return assignError('You must be signed in to assign a bay.')
  }

  const refurbishment = await getRefurbishmentById(refurbishmentId)
  if (!refurbishment) {
    return assignError('Refurbishment not found.')
  }

  if (refurbishment.status === 'completed') {
    return assignError('Completed refurbishments cannot be assigned to a bay.')
  }

  const bay = await getBayById(bayId)
  if (!bay) {
    return assignError('Bay not found.')
  }

  const appliance = await getApplianceById(refurbishment.appliance_id)
  if (!appliance) {
    return assignError('Appliance not found.')
  }

  if (appliance.type !== bay.machine_type) {
    return assignError(
      `Appliance type ${appliance.type ?? 'unknown'} cannot occupy a ${bay.machine_type} bay.`,
    )
  }

  const fromState = refurbishment.status
  const advancingFromStaging = fromState === 'staging'
  const updatePayload: Record<string, unknown> = {
    bay_id: bayId,
  }
  if (advancingFromStaging) {
    updatePayload.status = 'diagnostic'
  }

  const { error: updateError } = await supabase
    .from('refurbishments')
    .update(updatePayload)
    .eq('id', refurbishmentId)
    .select('id')
    .single()

  if (updateError) {
    return assignError(`Could not assign bay: ${updateError.message}`)
  }

  if (advancingFromStaging) {
    const { error: historyError } = await supabase
      .from('refurbishment_state_history')
      .insert({
        refurbishment_id: refurbishmentId,
        from_state: fromState,
        to_state: 'diagnostic',
        changed_by: user.id,
        reason: 'Assigned to bay',
      })

    if (historyError) {
      await supabase
        .from('refurbishments')
        .update({
          bay_id: refurbishment.bay_id,
          status: fromState,
        })
        .eq('id', refurbishmentId)
      return assignError(
        `Bay assigned but audit log failed; change was rolled back: ${historyError.message}`,
      )
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/refurbishments')

  const updated = await getRefurbishmentById(refurbishmentId)
  if (!updated) {
    return assignError('Refurbishment not found after assign.')
  }

  return { success: true, refurbishment: updated }
}

export async function unassignRefurbishmentFromBay(
  refurbishmentId: string,
): Promise<UnassignRefurbishmentBayResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return unassignError('You must be signed in to unassign a bay.')
  }

  const refurbishment = await getRefurbishmentById(refurbishmentId)
  if (!refurbishment) {
    return unassignError('Refurbishment not found.')
  }

  if (!refurbishment.bay_id) {
    return unassignError('This refurbishment is not assigned to a bay.')
  }

  if (refurbishment.status === 'completed') {
    return unassignError('Completed refurbishments are already unassigned.')
  }

  const { error: updateError } = await supabase
    .from('refurbishments')
    .update({ bay_id: null })
    .eq('id', refurbishmentId)
    .select('id')
    .single()

  if (updateError) {
    return unassignError(`Could not unassign bay: ${updateError.message}`)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/refurbishments')

  const updated = await getRefurbishmentById(refurbishmentId)
  if (!updated) {
    return unassignError('Refurbishment not found after unassign.')
  }

  return { success: true, refurbishment: updated }
}

/** Dev smoke test: assign validates type and advances staging → diagnostic. */
export async function runRefurbishmentBayActionsSmokeTest(): Promise<{
  refurbishmentId: string
}> {
  const supabase = await createClient()

  const { data: applianceRow, error: applianceError } = await supabase
    .from('appliances')
    .insert({
      title: 'C1c bay assign smoke',
      brand: 'Test',
      price: 0,
      model_number: 'BAY1',
      type: 'Dryer',
      lifecycle_state: 'Refurbishment',
      status: 'Draft',
    })
    .select('id')
    .single()
  if (applianceError || !applianceRow) {
    throw new Error(`Failed to create appliance: ${applianceError?.message}`)
  }
  const applianceId = String(applianceRow.id)

  const refurbishment = await createRefurbishment({
    appliance_id: applianceId,
    status: 'staging',
  })

  const { data: dryerBay, error: dryerBayError } = await supabase
    .from('bays')
    .select('id')
    .eq('machine_type', 'Dryer')
    .eq('position', 1)
    .single()
  if (dryerBayError || !dryerBay) {
    throw new Error(`Failed to fetch dryer bay: ${dryerBayError?.message}`)
  }

  const { data: washerBay, error: washerBayError } = await supabase
    .from('bays')
    .select('id')
    .eq('machine_type', 'Washer')
    .eq('position', 1)
    .single()
  if (washerBayError || !washerBay) {
    throw new Error(`Failed to fetch washer bay: ${washerBayError?.message}`)
  }

  const mismatch = await assignRefurbishmentToBay(
    refurbishment.id,
    String(washerBay.id),
  )
  if (mismatch.success) {
    throw new Error('Expected type mismatch assign to be rejected')
  }

  const assigned = await assignRefurbishmentToBay(
    refurbishment.id,
    String(dryerBay.id),
  )
  if (!assigned.success) {
    throw new Error(`Expected assign to succeed: ${assigned.error}`)
  }
  if (
    assigned.refurbishment.bay_id !== String(dryerBay.id) ||
    assigned.refurbishment.status !== 'diagnostic'
  ) {
    throw new Error('Assign did not set bay or advance staging → diagnostic')
  }

  const { data: history, error: historyError } = await supabase
    .from('refurbishment_state_history')
    .select('from_state, to_state')
    .eq('refurbishment_id', refurbishment.id)
  if (historyError) {
    throw new Error(`Failed to read history: ${historyError.message}`)
  }
  if ((history?.length ?? 0) !== 1) {
    throw new Error(`Expected 1 history row after assign, got ${history?.length ?? 0}`)
  }
  if (history![0].from_state !== 'staging' || history![0].to_state !== 'diagnostic') {
    throw new Error('Assign history row does not match staging → diagnostic')
  }

  const unassigned = await unassignRefurbishmentFromBay(refurbishment.id)
  if (!unassigned.success) {
    throw new Error(`Expected unassign to succeed: ${unassigned.error}`)
  }
  if (unassigned.refurbishment.bay_id !== null) {
    throw new Error('Unassign did not clear bay_id')
  }

  const { error: deleteApplianceError } = await supabase
    .from('appliances')
    .delete()
    .eq('id', applianceId)
  if (deleteApplianceError) {
    throw new Error(`Cleanup failed: ${deleteApplianceError.message}`)
  }

  return { refurbishmentId: refurbishment.id }
}
