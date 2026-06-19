'use server'

import { revalidatePath } from 'next/cache'
import { createAppliance } from '@/lib/data/appliances'
import {
  createRefurbishment,
  getRefurbishmentById,
} from '@/lib/data/refurbishments'
import {
  canAdvance,
  nextStatus,
} from '@/lib/operations/refurbishment-lifecycle'
import { transitionApplianceState } from '@/lib/inventory/transition-appliance-state'
import { createClient } from '@/lib/supabase/server'
import type {
  Refurbishment,
  RefurbishmentStatus,
} from '@/lib/types/refurbishment'

export type AdvanceRefurbishmentFields = {
  source?: string | null
  cost?: number | null
  initial_symptoms?: string | null
  error_codes?: string | null
  work_needed?: string | null
  cleaning_status?: string | null
  test_mode_used?: string | null
  final_results?: string | null
  reason?: string | null
}

export type AdvanceRefurbishmentResult =
  | { success: true; refurbishment: Refurbishment }
  | { success: false; error: string }

function advanceError(message: string): AdvanceRefurbishmentResult {
  return { success: false, error: message }
}

function friendlyAdvanceError(from: RefurbishmentStatus): string {
  const next = nextStatus(from)
  if (!next) {
    return 'This refurbishment is already completed and cannot be advanced.'
  }
  return `Cannot advance from ${from}. The next stage is ${next}.`
}

export async function advanceRefurbishment(
  refurbishmentId: string,
  fields: AdvanceRefurbishmentFields = {},
): Promise<AdvanceRefurbishmentResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return advanceError('You must be signed in to advance a refurbishment.')
  }

  const current = await getRefurbishmentById(refurbishmentId)
  if (!current) {
    return advanceError('Refurbishment not found.')
  }

  const fromState = current.status
  const toState = nextStatus(fromState)
  if (!toState || !canAdvance(fromState, toState)) {
    return advanceError(friendlyAdvanceError(fromState))
  }

  const { reason, ...stageFields } = fields
  const updatePayload: Record<string, unknown> = {
    ...stageFields,
    status: toState,
  }
  if (toState === 'completed') {
    updatePayload.bay_id = null
  }

  const { error: updateError } = await supabase
    .from('refurbishments')
    .update(updatePayload)
    .eq('id', refurbishmentId)
    .select('id')
    .single()

  if (updateError) {
    return advanceError(
      `Could not advance refurbishment: ${updateError.message}`,
    )
  }

  const { error: historyError } = await supabase
    .from('refurbishment_state_history')
    .insert({
      refurbishment_id: refurbishmentId,
      from_state: fromState,
      to_state: toState,
      changed_by: user.id,
      reason: reason ?? null,
    })

  if (historyError) {
    await supabase
      .from('refurbishments')
      .update({
        status: fromState,
        bay_id: current.bay_id,
      })
      .eq('id', refurbishmentId)
    return advanceError(
      `State updated but audit log failed; change was rolled back: ${historyError.message}`,
    )
  }

  if (toState === 'completed') {
    const applianceTransition = await transitionApplianceState(
      current.appliance_id,
      'Listed',
      { reason: reason ?? 'Refurbishment completed' },
    )
    if (!applianceTransition.success) {
      await supabase
        .from('refurbishment_state_history')
        .delete()
        .eq('refurbishment_id', refurbishmentId)
        .eq('from_state', fromState)
        .eq('to_state', toState)
      await supabase
        .from('refurbishments')
        .update({
          status: fromState,
          bay_id: current.bay_id,
        })
        .eq('id', refurbishmentId)
      return advanceError(
        `Refurbishment completed but appliance promotion failed; change was rolled back: ${applianceTransition.error}`,
      )
    }

    revalidatePath('/dashboard/inventory')
    revalidatePath('/dashboard/inventory/view')
    revalidatePath(`/dashboard/inventory/${current.appliance_id}`)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/refurbishments')

  const refurbishment = await getRefurbishmentById(refurbishmentId)
  if (!refurbishment) {
    return advanceError('Refurbishment not found after update.')
  }

  return { success: true, refurbishment }
}

/** Dev smoke test: advancing saves fields + history; invalid advance is a no-op. */
export async function runAdvanceRefurbishmentSmokeTest(): Promise<{
  refurbishmentId: string
  historyRows: number
}> {
  const appliance = await createAppliance({
    title: 'C1c advance smoke',
    price: 0,
    type: 'Dryer',
    lifecycle_state: 'Refurbishment',
    status: 'Draft',
  })

  const refurbishment = await createRefurbishment({
    appliance_id: appliance.id,
    status: 'diagnostic',
  })

  const valid = await advanceRefurbishment(refurbishment.id, {
    initial_symptoms: 'Smoke symptom',
    error_codes: 'E01',
    reason: 'C1c smoke valid',
  })
  if (!valid.success) {
    throw new Error(`Expected valid advance: ${valid.error}`)
  }
  if (
    valid.refurbishment.status !== 'repair' ||
    valid.refurbishment.initial_symptoms !== 'Smoke symptom' ||
    valid.refurbishment.error_codes !== 'E01'
  ) {
    throw new Error('Valid advance did not persist fields and status')
  }

  const supabase = await createClient()
  const { data: history, error: historyReadError } = await supabase
    .from('refurbishment_state_history')
    .select('id, from_state, to_state')
    .eq('refurbishment_id', refurbishment.id)

  if (historyReadError) {
    throw new Error(`Failed to read history: ${historyReadError.message}`)
  }
  if ((history?.length ?? 0) !== 1) {
    throw new Error(`Expected 1 history row, got ${history?.length ?? 0}`)
  }
  const row = history![0]
  if (row.from_state !== 'diagnostic' || row.to_state !== 'repair') {
    throw new Error('History row does not match advance')
  }

  const invalid = await advanceRefurbishment(refurbishment.id, {
    reason: 'skip to completed',
  })
  if (invalid.success) {
    throw new Error('Expected invalid advance to be rejected')
  }

  const afterInvalid = await getRefurbishmentById(refurbishment.id)
  if (afterInvalid?.status !== 'repair') {
    throw new Error('Invalid advance must not change status')
  }

  const { data: historyAfterInvalid } = await supabase
    .from('refurbishment_state_history')
    .select('id')
    .eq('refurbishment_id', refurbishment.id)
  if ((historyAfterInvalid?.length ?? 0) !== 1) {
    throw new Error('Invalid advance must not insert history')
  }

  const { error: deleteApplianceError } = await supabase
    .from('appliances')
    .delete()
    .eq('id', appliance.id)
  if (deleteApplianceError) {
    throw new Error(`Cleanup failed: ${deleteApplianceError.message}`)
  }

  return { refurbishmentId: refurbishment.id, historyRows: 1 }
}

/** Dev smoke test: graduation frees bay, completes refurbishment, promotes to Listed. */
export async function runGraduationSmokeTest(): Promise<{
  refurbishmentId: string
  applianceId: string
}> {
  return runCompleteRefurbishmentSmokeTest()
}

/** Dev smoke test: completing frees bay and promotes appliance to Listed. */
export async function runCompleteRefurbishmentSmokeTest(): Promise<{
  refurbishmentId: string
  applianceId: string
}> {
  const supabase = await createClient()
  const appliance = await createAppliance({
    title: 'C1c complete smoke',
    price: 0,
    type: 'Washer',
    lifecycle_state: 'Refurbishment',
    status: 'Draft',
  })

  const { data: bayRow, error: bayError } = await supabase
    .from('bays')
    .select('id')
    .eq('machine_type', 'Washer')
    .eq('position', 3)
    .single()
  if (bayError || !bayRow) {
    throw new Error(`Failed to fetch washer bay: ${bayError?.message}`)
  }

  const refurbishment = await createRefurbishment({
    appliance_id: appliance.id,
    bay_id: String(bayRow.id),
    status: 'testing',
  })

  const completed = await advanceRefurbishment(refurbishment.id, {
    test_mode_used: 'Spin',
    final_results: 'Pass',
    reason: 'C1c complete smoke',
  })
  if (!completed.success) {
    throw new Error(`Expected completion to succeed: ${completed.error}`)
  }
  if (
    completed.refurbishment.status !== 'completed' ||
    completed.refurbishment.bay_id !== null
  ) {
    throw new Error('Completion did not set completed status or clear bay')
  }

  const { data: applianceRow, error: applianceError } = await supabase
    .from('appliances')
    .select('lifecycle_state')
    .eq('id', appliance.id)
    .single()
  if (applianceError || !applianceRow) {
    throw new Error(`Failed to read appliance: ${applianceError?.message}`)
  }
  if (applianceRow.lifecycle_state !== 'Listed') {
    throw new Error('Completion did not promote appliance to Listed')
  }

  const { error: deleteApplianceError } = await supabase
    .from('appliances')
    .delete()
    .eq('id', appliance.id)
  if (deleteApplianceError) {
    throw new Error(`Cleanup failed: ${deleteApplianceError.message}`)
  }

  return {
    refurbishmentId: refurbishment.id,
    applianceId: appliance.id,
  }
}
