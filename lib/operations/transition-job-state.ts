'use server'

import { revalidatePath } from 'next/cache'
import { createJob, getJobById } from '@/lib/data/jobs'
import {
  canTransitionJob,
  getAllowedJobTransitions,
} from '@/lib/operations/job-lifecycle'
import { createClient } from '@/lib/supabase/server'
import type { Job, JobState } from '@/lib/types/operations'

export type TransitionJobStateResult =
  | { success: true; job: Job }
  | { success: false; error: string }

function transitionError(message: string): TransitionJobStateResult {
  return { success: false, error: message }
}

function friendlyTransitionError(from: JobState, to: JobState): string {
  const allowed = getAllowedJobTransitions(from)
  if (allowed.length === 0) {
    return `This job is ${from} and cannot be moved to another state.`
  }
  return `Cannot move from ${from} to ${to}. Allowed next states: ${allowed.join(', ')}.`
}

export async function transitionJobState(
  jobId: string,
  toState: JobState,
  options?: { reason?: string },
): Promise<TransitionJobStateResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return transitionError('You must be signed in to change job state.')
  }

  const current = await getJobById(jobId)
  if (!current) {
    return transitionError('Job not found.')
  }

  const fromState = current.state
  if (fromState === toState) {
    return transitionError(`This job is already ${toState}.`)
  }

  if (!canTransitionJob(fromState, toState)) {
    return transitionError(friendlyTransitionError(fromState, toState))
  }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({ state: toState })
    .eq('id', jobId)
    .select('id')
    .single()

  if (updateError) {
    return transitionError(`Could not update job state: ${updateError.message}`)
  }

  const { error: historyError } = await supabase
    .from('job_state_history')
    .insert({
      job_id: jobId,
      from_state: fromState,
      to_state: toState,
      changed_by: user.id,
      reason: options?.reason ?? null,
    })

  if (historyError) {
    await supabase.from('jobs').update({ state: fromState }).eq('id', jobId)
    return transitionError(
      `State updated but audit log failed; change was rolled back: ${historyError.message}`,
    )
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/jobs')
  revalidatePath(`/dashboard/jobs/${jobId}`)

  const job = await getJobById(jobId)
  if (!job) {
    return transitionError('Job not found after update.')
  }

  return { success: true, job }
}

/** Dev smoke test: valid transition writes history; invalid transition is a no-op. */
export async function runTransitionJobStateSmokeTest(): Promise<{
  jobId: string
  historyRows: number
}> {
  const created = await createJob({
    job_class: 'Customer',
    job_type: 'Repair',
    summary: 'C4 transition smoke',
  })

  const valid = await transitionJobState(created.id, 'In Progress', {
    reason: 'C4 smoke valid',
  })
  if (!valid.success) {
    throw new Error(`Expected valid transition: ${valid.error}`)
  }
  if (valid.job.state !== 'In Progress') {
    throw new Error('Valid transition did not update state')
  }

  const supabase = await createClient()
  const { data: history, error: historyReadError } = await supabase
    .from('job_state_history')
    .select('id, from_state, to_state')
    .eq('job_id', created.id)

  if (historyReadError) {
    throw new Error(`Failed to read history: ${historyReadError.message}`)
  }
  if ((history?.length ?? 0) !== 1) {
    throw new Error(`Expected 1 history row, got ${history?.length ?? 0}`)
  }
  const row = history![0]
  if (row.from_state !== 'Open' || row.to_state !== 'In Progress') {
    throw new Error('History row does not match transition')
  }

  const invalid = await transitionJobState(created.id, 'Open')
  if (invalid.success) {
    throw new Error('Expected invalid transition to be rejected')
  }

  const afterInvalid = await getJobById(created.id)
  if (afterInvalid?.state !== 'In Progress') {
    throw new Error('Invalid transition must not change state')
  }

  const { data: historyAfterInvalid } = await supabase
    .from('job_state_history')
    .select('id')
    .eq('job_id', created.id)
  if ((historyAfterInvalid?.length ?? 0) !== 1) {
    throw new Error('Invalid transition must not insert history')
  }

  const { error: deleteError } = await supabase
    .from('jobs')
    .delete()
    .eq('id', created.id)
  if (deleteError) {
    throw new Error(`Cleanup failed: ${deleteError.message}`)
  }

  return { jobId: created.id, historyRows: 1 }
}
