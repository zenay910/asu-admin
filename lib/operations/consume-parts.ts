'use server'

import { revalidatePath } from 'next/cache'
import { createJob, getJobById } from '@/lib/data/jobs'
import {
  createPart,
  getPartById,
  recordStockMovement,
} from '@/lib/data/parts'
import { createClient } from '@/lib/supabase/server'

export type ConsumePartsForJobResult =
  | {
      success: true
      jobPartId: string
      quantityOnHand: number
    }
  | { success: false; error: string }

function consumeError(message: string): ConsumePartsForJobResult {
  return { success: false, error: message }
}

export async function consumePartsForJob(
  jobId: string,
  partId: string,
  quantity: number,
  options?: { reason?: string },
): Promise<ConsumePartsForJobResult> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return consumeError('Quantity must be a positive whole number.')
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return consumeError('You must be signed in to consume parts for a job.')
  }

  const job = await getJobById(jobId)
  if (!job) {
    return consumeError('Job not found.')
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

  const { data: jobPart, error: jobPartError } = await supabase
    .from('job_parts')
    .insert({
      job_id: jobId,
      part_id: partId,
      quantity,
      unit_price: unitPrice,
    })
    .select('id')
    .single()

  if (jobPartError || !jobPart) {
    return consumeError(
      `Could not record parts for job: ${jobPartError?.message ?? 'unknown error'}`,
    )
  }

  const jobPartId = String(jobPart.id)

  let quantityAfter: number
  try {
    const movement = await recordStockMovement(partId, -quantity, {
      jobPartId,
      reason: options?.reason ?? null,
      changedBy: user.id,
    })
    quantityAfter = movement.quantityOnHand
  } catch (error) {
    await supabase.from('job_parts').delete().eq('id', jobPartId)
    const message =
      error instanceof Error ? error.message : 'Stock adjustment failed.'
    return consumeError(message)
  }

  revalidatePath('/dashboard')

  return {
    success: true,
    jobPartId,
    quantityOnHand: quantityAfter,
  }
}

/** Dev smoke test: consumption updates stock and audit; oversell is a no-op. */
export async function runConsumePartsForJobSmokeTest(): Promise<{
  jobPartId: string
  quantityOnHand: number
}> {
  const suffix = Date.now()
  const part = await createPart({
    part_number: `C5-SMOKE-${suffix}`,
    name: 'C5 consume smoke',
    quantity_on_hand: 10,
    unit_price: 12.5,
  })

  const job = await createJob({
    job_class: 'Customer',
    job_type: 'Repair',
    summary: 'C5 consume smoke',
  })

  const consumed = await consumePartsForJob(job.id, part.id, 3, {
    reason: 'C5 smoke valid',
  })
  if (!consumed.success) {
    throw new Error(`Expected consumption to succeed: ${consumed.error}`)
  }
  if (consumed.quantityOnHand !== 7) {
    throw new Error(`Expected quantity_on_hand 7, got ${consumed.quantityOnHand}`)
  }

  const supabase = await createClient()
  const { data: jobParts, error: jobPartsError } = await supabase
    .from('job_parts')
    .select('id, quantity, unit_price')
    .eq('job_id', job.id)
  if (jobPartsError) {
    throw new Error(`Failed to read job_parts: ${jobPartsError.message}`)
  }
  if ((jobParts?.length ?? 0) !== 1) {
    throw new Error(`Expected 1 job_parts row, got ${jobParts?.length ?? 0}`)
  }
  if (jobParts![0].quantity !== 3 || Number(jobParts![0].unit_price) !== 12.5) {
    throw new Error('job_parts row does not match consumption')
  }

  const { data: movements, error: movementsError } = await supabase
    .from('part_stock_movements')
    .select('delta, quantity_after, job_part_id')
    .eq('job_part_id', consumed.jobPartId)
  if (movementsError) {
    throw new Error(`Failed to read movements: ${movementsError.message}`)
  }
  if ((movements?.length ?? 0) !== 1) {
    throw new Error(`Expected 1 movement row, got ${movements?.length ?? 0}`)
  }
  const movement = movements![0]
  if (movement.delta !== -3 || movement.quantity_after !== 7) {
    throw new Error('Movement row does not match consumption')
  }

  const stockBeforeReject = (await getPartById(part.id))?.quantity_on_hand
  const oversell = await consumePartsForJob(job.id, part.id, 100)
  if (oversell.success) {
    throw new Error('Expected oversell to be rejected')
  }

  const stockAfterReject = (await getPartById(part.id))?.quantity_on_hand
  if (stockAfterReject !== stockBeforeReject) {
    throw new Error('Oversell must not change quantity_on_hand')
  }

  const { data: jobPartsAfterReject } = await supabase
    .from('job_parts')
    .select('id')
    .eq('job_id', job.id)
  if ((jobPartsAfterReject?.length ?? 0) !== 1) {
    throw new Error('Oversell must not insert additional job_parts rows')
  }

  const { data: movementsAfterReject } = await supabase
    .from('part_stock_movements')
    .select('id')
    .eq('part_id', part.id)
  if ((movementsAfterReject?.length ?? 0) !== 1) {
    throw new Error('Oversell must not insert additional movement rows')
  }

  const { error: deleteJobError } = await supabase
    .from('jobs')
    .delete()
    .eq('id', job.id)
  if (deleteJobError) {
    throw new Error(`Failed to clean up job: ${deleteJobError.message}`)
  }

  const { error: deletePartError } = await supabase
    .from('parts')
    .delete()
    .eq('id', part.id)
  if (deletePartError) {
    throw new Error(`Failed to clean up part: ${deletePartError.message}`)
  }

  return {
    jobPartId: consumed.jobPartId,
    quantityOnHand: consumed.quantityOnHand,
  }
}
