import type { JobClass, JobType } from '@/lib/types/operations'

export type JobFormValues = {
  job_class: JobClass
  job_type: JobType
  appliance_id: string
  customer_id: string
  summary: string
  labor_cost: string
}

export type JobFormFieldErrors = Partial<Record<keyof JobFormValues, string>>

export type JobFormState = {
  error: string | null
  success: string | null
  jobId: string | null
  values: JobFormValues
  fieldErrors: JobFormFieldErrors
}

export const initialJobFormValues: JobFormValues = {
  job_class: 'Internal',
  job_type: 'Intake',
  appliance_id: '',
  customer_id: '',
  summary: '',
  labor_cost: '0',
}

export const initialJobFormState: JobFormState = {
  error: null,
  success: null,
  jobId: null,
  values: initialJobFormValues,
  fieldErrors: {},
}
