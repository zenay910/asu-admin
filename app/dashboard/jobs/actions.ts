'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { buildDetailsFromFormData } from '@/lib/jobs/job-form-details'
import { isValidJobTypeForClass } from '@/lib/operations/job-lifecycle'
import type { JobClass, JobType } from '@/lib/types/operations'
import {
  initialJobFormValues,
  type JobFormFieldErrors,
  type JobFormState,
  type JobFormValues,
} from './types'

function extractValues(formData: FormData): JobFormValues {
  const job_class = formData.get('job_class')
  const job_type = formData.get('job_type')

  return {
    job_class:
      job_class === 'Customer' ? 'Customer' : ('Internal' as JobClass),
    job_type:
      typeof job_type === 'string' ? (job_type as JobType) : 'Intake',
    appliance_id:
      typeof formData.get('appliance_id') === 'string'
        ? String(formData.get('appliance_id'))
        : '',
    customer_id:
      typeof formData.get('customer_id') === 'string'
        ? String(formData.get('customer_id'))
        : '',
    summary:
      typeof formData.get('summary') === 'string'
        ? String(formData.get('summary'))
        : '',
    labor_cost:
      typeof formData.get('labor_cost') === 'string'
        ? String(formData.get('labor_cost'))
        : '0',
  }
}

function buildFieldErrors(message: string): JobFormFieldErrors {
  const fieldErrors: JobFormFieldErrors = {}
  if (message.includes('Invalid job type')) {
    fieldErrors.job_type = message
    return fieldErrors
  }
  if (message.includes('must reference an appliance')) {
    fieldErrors.appliance_id = message
    return fieldErrors
  }
  const missingMatch = message.match(/Missing required field: ([a-z_]+)/i)
  if (missingMatch) {
    const field = missingMatch[1] as keyof JobFormFieldErrors
    fieldErrors[field] = 'This field is required.'
  }
  return fieldErrors
}

function toFriendlyErrorMessage(message: string) {
  if (message.includes('Invalid job type')) {
    return 'That job type is not allowed for the selected class.'
  }
  if (message.includes('must reference an appliance')) {
    return 'Internal jobs must be linked to an appliance.'
  }
  const missingMatch = message.match(/Missing required field: ([a-z_]+)/i)
  if (missingMatch) {
    return 'Please fill in the required fields and try again.'
  }
  return message
}

function validateBeforeApi(values: JobFormValues): string | null {
  if (!isValidJobTypeForClass(values.job_class, values.job_type)) {
    return `Invalid job type "${values.job_type}" for class "${values.job_class}"`
  }
  if (values.job_class === 'Internal' && !values.appliance_id.trim()) {
    return 'Internal jobs must reference an appliance'
  }
  return null
}

async function jobsApiFetch(
  path: string,
  init: RequestInit,
): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string; status: number }
> {
  const headerStore = await headers()
  const host = headerStore.get('host')
  if (!host) {
    return { ok: false, error: 'Could not resolve request host.', status: 500 }
  }
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const cookie = headerStore.get('cookie') ?? ''

  const response = await fetch(`${protocol}://${host}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      cookie,
      ...(init.headers as Record<string, string> | undefined),
    },
  })

  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null

  if (!response.ok) {
    const message =
      typeof body?.error === 'string'
        ? body.error
        : `Request failed (${response.status})`
    return { ok: false, error: message, status: response.status }
  }
  return { ok: true, body: body ?? {} }
}

function revalidateJobPaths(jobId?: string) {
  revalidatePath('/dashboard/jobs')
  if (jobId) {
    revalidatePath(`/dashboard/jobs/${jobId}`)
  }
}

export async function createJobItem(
  _prevState: JobFormState,
  formData: FormData,
): Promise<JobFormState> {
  const values = extractValues(formData)

  const clientError = validateBeforeApi(values)
  if (clientError) {
    return {
      error: toFriendlyErrorMessage(clientError),
      success: null,
      jobId: null,
      values,
      fieldErrors: buildFieldErrors(clientError),
    }
  }

  const labor = Number(values.labor_cost)
  const payload: Record<string, unknown> = {
    job_class: values.job_class,
    job_type: values.job_type,
    summary: values.summary.trim() || null,
    labor_cost: Number.isFinite(labor) && labor >= 0 ? labor : 0,
    details: buildDetailsFromFormData(formData, values.job_type),
    appliance_id:
      values.job_class === 'Internal'
        ? values.appliance_id.trim()
        : values.appliance_id.trim() || null,
    customer_id: values.customer_id.trim() || null,
  }

  const result = await jobsApiFetch('/api/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!result.ok) {
    return {
      error: toFriendlyErrorMessage(result.error),
      success: null,
      jobId: null,
      values,
      fieldErrors: buildFieldErrors(result.error),
    }
  }

  const jobId =
    typeof result.body.jobId === 'string' ? result.body.jobId : null
  if (!jobId) {
    return {
      error: 'Job was created but no ID was returned.',
      success: null,
      jobId: null,
      values,
      fieldErrors: {},
    }
  }

  revalidateJobPaths(jobId)
  return {
    error: null,
    success: 'Job created.',
    jobId,
    values: initialJobFormValues,
    fieldErrors: {},
  }
}
