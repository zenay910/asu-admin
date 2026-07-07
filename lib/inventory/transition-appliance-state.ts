'use server'

import { revalidatePath } from 'next/cache'
import { createAppliance, getApplianceById } from '@/lib/data/appliances'
import { applianceToProductMirrorPayload } from '@/lib/inventory/appliance-product-mirror'
import { syncGoogleMerchantOnStatusChange } from '@/lib/google-merchant'
import { canTransition, getAllowedTransitions } from '@/lib/inventory/lifecycle'
import { createClient } from '@/lib/supabase/server'
import type {
  Appliance,
  ApplianceStatus,
  LifecycleState,
} from '@/lib/types/inventory'

export type TransitionApplianceStateResult =
  | { success: true; appliance: Appliance }
  | { success: false; error: string }

function transitionError(message: string): TransitionApplianceStateResult {
  return { success: false, error: message }
}

function friendlyTransitionError(
  from: LifecycleState,
  to: LifecycleState,
): string {
  const allowed = getAllowedTransitions(from)
  if (allowed.length === 0) {
    return `This appliance is ${from} and cannot be moved to another lifecycle stage.`
  }
  return `Cannot move from ${from} to ${to}. Allowed next stages: ${allowed.join(', ')}.`
}

/** Keeps `status='Published'` only when `lifecycle_state='Listed'`. */
function resolveStatusForTransition(
  currentStatus: ApplianceStatus | null,
  fromState: LifecycleState,
  toState: LifecycleState,
  requestedStatus?: ApplianceStatus | null,
): ApplianceStatus | null {
  let nextStatus =
    requestedStatus !== undefined ? requestedStatus : currentStatus

  if (toState !== 'Listed' && currentStatus === 'Published') {
    nextStatus = toState === 'Retired' ? 'Sold' : 'Draft'
  }

  if (fromState === 'Listed' && toState === 'Retired' && nextStatus === 'Published') {
    nextStatus = 'Sold'
  }

  if (nextStatus === 'Published' && toState !== 'Listed') {
    throw new Error(
      'Published status is only allowed when the appliance is in the Listed lifecycle stage.',
    )
  }

  return nextStatus
}

export async function transitionApplianceState(
  applianceId: string,
  toState: LifecycleState,
  options?: { reason?: string; status?: ApplianceStatus | null },
): Promise<TransitionApplianceStateResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return transitionError('You must be signed in to change appliance lifecycle state.')
  }

  const current = await getApplianceById(applianceId)
  if (!current) {
    return transitionError('Appliance not found.')
  }

  const fromState = current.lifecycle_state
  if (fromState === toState) {
    return transitionError(`This appliance is already in ${toState}.`)
  }

  if (!canTransition(fromState, toState)) {
    return transitionError(friendlyTransitionError(fromState, toState))
  }

  let nextStatus: ApplianceStatus | null
  try {
    nextStatus = resolveStatusForTransition(
      current.status,
      fromState,
      toState,
      options?.status,
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid status for this transition.'
    return transitionError(message)
  }

  const { error: updateError } = await supabase
    .from('appliances')
    .update({
      lifecycle_state: toState,
      status: nextStatus,
    })
    .eq('id', applianceId)
    .select('id')
    .single()

  if (updateError) {
    return transitionError(
      `Could not update appliance lifecycle state: ${updateError.message}`,
    )
  }

  const { error: historyError } = await supabase
    .from('appliance_state_history')
    .insert({
      appliance_id: applianceId,
      from_state: fromState,
      to_state: toState,
      changed_by: user.id,
      reason: options?.reason ?? null,
    })

  if (historyError) {
    await supabase
      .from('appliances')
      .update({
        lifecycle_state: fromState,
        status: current.status,
      })
      .eq('id', applianceId)
    return transitionError(
      `Lifecycle updated but audit log failed; change was rolled back: ${historyError.message}`,
    )
  }

  const appliance = await getApplianceById(applianceId)
  if (!appliance) {
    return transitionError('Appliance not found after update.')
  }

  const mirrorPayload = applianceToProductMirrorPayload(appliance)
  const { error: mirrorError } = await supabase
    .from('products')
    .update(mirrorPayload)
    .eq('id', applianceId)

  if (mirrorError) {
    await supabase
      .from('appliances')
      .update({
        lifecycle_state: fromState,
        status: current.status,
      })
      .eq('id', applianceId)
    await supabase
      .from('appliance_state_history')
      .delete()
      .eq('appliance_id', applianceId)
      .eq('to_state', toState)
      .eq('from_state', fromState)
    return transitionError(
      `Lifecycle updated but storefront mirror failed; change was rolled back: ${mirrorError.message}`,
    )
  }

  await syncGoogleMerchantOnStatusChange(applianceId, current.status, nextStatus)

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/inventory')
  revalidatePath('/dashboard/inventory/view')
  revalidatePath(`/dashboard/inventory/${applianceId}`)

  return { success: true, appliance }
}

/** Dev smoke test: valid transition writes history; invalid transition is a no-op. */
export async function runTransitionApplianceStateSmokeTest(): Promise<{
  applianceId: string
  historyRows: number
}> {
  const created = await createAppliance({
    title: 'C4 transition smoke',
    price: 1,
    lifecycle_state: 'Intake',
    status: 'Draft',
  })

  const valid = await transitionApplianceState(created.id, 'Refurbishment', {
    reason: 'C4 smoke valid',
  })
  if (!valid.success) {
    throw new Error(`Expected valid transition: ${valid.error}`)
  }

  const supabase = await createClient()
  const { data: history, error: historyReadError } = await supabase
    .from('appliance_state_history')
    .select('id, from_state, to_state')
    .eq('appliance_id', created.id)

  if (historyReadError) {
    throw new Error(`Failed to read history: ${historyReadError.message}`)
  }
  if ((history?.length ?? 0) !== 1) {
    throw new Error(`Expected 1 history row, got ${history?.length ?? 0}`)
  }
  const row = history![0]
  if (row.from_state !== 'Intake' || row.to_state !== 'Refurbishment') {
    throw new Error('History row does not match transition')
  }

  const invalid = await transitionApplianceState(created.id, 'Intake')
  if (invalid.success) {
    throw new Error('Expected invalid transition to be rejected')
  }

  const afterInvalid = await getApplianceById(created.id)
  if (afterInvalid?.lifecycle_state !== 'Refurbishment') {
    throw new Error('Invalid transition must not change lifecycle_state')
  }

  const { data: historyAfterInvalid } = await supabase
    .from('appliance_state_history')
    .select('id')
    .eq('appliance_id', created.id)
  if ((historyAfterInvalid?.length ?? 0) !== 1) {
    throw new Error('Invalid transition must not insert history')
  }

  const { error: deleteError } = await supabase
    .from('appliances')
    .delete()
    .eq('id', created.id)
  if (deleteError) {
    throw new Error(`Cleanup failed: ${deleteError.message}`)
  }

  return { applianceId: created.id, historyRows: 1 }
}
