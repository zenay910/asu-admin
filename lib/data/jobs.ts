import { createClient } from '@/lib/supabase/server'
import { isValidJobTypeForClass } from '@/lib/operations/job-lifecycle'
import { getApplianceById } from '@/lib/data/appliances'
import type { Appliance } from '@/lib/types/inventory'
import type {
  Job,
  JobClass,
  JobDetail,
  JobPart,
  JobPartLine,
  JobState,
  JobStateHistory,
  JobType,
} from '@/lib/types/operations'

export type JobListFilters = {
  job_class?: JobClass
  state?: JobState
  job_type?: JobType
  limit?: number
}

export type CreateJobInput = {
  job_class: JobClass
  job_type: JobType
  appliance_id?: string | null
  customer_id?: string | null
  state?: JobState
  summary?: string | null
  details?: Record<string, unknown> | null
  labor_cost?: number
}

export type UpdateJobInput = Partial<CreateJobInput>

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    appliance_id: row.appliance_id != null ? String(row.appliance_id) : null,
    customer_id: row.customer_id != null ? String(row.customer_id) : null,
    job_class: row.job_class as JobClass,
    job_type: row.job_type as JobType,
    state: row.state as JobState,
    summary: row.summary != null ? String(row.summary) : null,
    details: (row.details as Job['details']) ?? null,
    labor_cost: Number(row.labor_cost),
  }
}

function throwOnError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

export function validateJobFields(
  jobClass: JobClass,
  jobType: JobType,
  applianceId: string | null | undefined,
): void {
  if (!isValidJobTypeForClass(jobClass, jobType)) {
    throw new Error(
      `Invalid job type "${jobType}" for class "${jobClass}"`,
    )
  }
  if (jobClass === 'Internal' && !applianceId) {
    throw new Error('Internal jobs must reference an appliance')
  }
}

export async function listJobs(filters: JobListFilters = {}): Promise<Job[]> {
  const supabase = await createClient()
  let query = supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.job_class) {
    query = query.eq('job_class', filters.job_class)
  }
  if (filters.state) {
    query = query.eq('state', filters.state)
  }
  if (filters.job_type) {
    query = query.eq('job_type', filters.job_type)
  }
  if (filters.limit != null) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  throwOnError(error, 'Failed to list jobs')
  return (data ?? []).map((row) => mapJob(row as Record<string, unknown>))
}

function mapJobStateHistory(row: Record<string, unknown>): JobStateHistory {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    job_id: String(row.job_id),
    from_state: (row.from_state as JobState | null) ?? null,
    to_state: row.to_state as JobState,
    changed_by: row.changed_by != null ? String(row.changed_by) : null,
    reason: row.reason != null ? String(row.reason) : null,
  }
}

function mapJobPart(row: Record<string, unknown>): JobPart {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    job_id: String(row.job_id),
    part_id: String(row.part_id),
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
  }
}

function nestedPartRow(
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const nested = row.parts
  if (nested == null) return null
  if (Array.isArray(nested)) {
    const first = nested[0]
    return first != null ? (first as Record<string, unknown>) : null
  }
  return nested as Record<string, unknown>
}

function mapJobPartLine(row: Record<string, unknown>): JobPartLine | null {
  const part = mapJobPart(row)
  const partRow = nestedPartRow(row)
  if (!partRow) return null
  return {
    ...part,
    part_number: String(partRow.part_number),
    part_name: String(partRow.name),
  }
}

export async function getJobDetailById(id: string): Promise<{
  detail: JobDetail
  appliance: Appliance | null
} | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select(
      `
      *,
      job_state_history (
        id,
        created_at,
        job_id,
        from_state,
        to_state,
        changed_by,
        reason
      ),
      job_parts (
        id,
        created_at,
        job_id,
        part_id,
        quantity,
        unit_price,
        parts (
          part_number,
          name
        )
      )
    `,
    )
    .eq('id', id)
    .maybeSingle()

  throwOnError(error, 'Failed to fetch job detail')
  if (!data) return null

  const row = data as Record<string, unknown>
  const rawHistory =
    (row.job_state_history as Record<string, unknown>[]) ?? []
  const rawJobParts = (row.job_parts as Record<string, unknown>[]) ?? []

  const stateHistory = rawHistory
    .map((entry) => mapJobStateHistory(entry))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const jobParts = rawJobParts
    .map((entry) => mapJobPartLine(entry))
    .filter((line): line is JobPartLine => line != null)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  const job = mapJob(
    Object.fromEntries(
      Object.entries(row).filter(
        ([key]) => key !== 'job_state_history' && key !== 'job_parts',
      ),
    ) as Record<string, unknown>,
  )

  const appliance = job.appliance_id
    ? await getApplianceById(job.appliance_id)
    : null

  return {
    detail: { job, stateHistory, jobParts },
    appliance,
  }
}

export async function getJobById(id: string): Promise<Job | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  throwOnError(error, 'Failed to fetch job')
  if (!data) return null
  return mapJob(data as Record<string, unknown>)
}

export async function createJob(input: CreateJobInput): Promise<Job> {
  validateJobFields(input.job_class, input.job_type, input.appliance_id)

  const supabase = await createClient()
  const payload = {
    job_class: input.job_class,
    job_type: input.job_type,
    appliance_id: input.appliance_id ?? null,
    customer_id: input.customer_id ?? null,
    state: input.state ?? 'Open',
    summary: input.summary ?? null,
    details: input.details ?? null,
    labor_cost: input.labor_cost ?? 0,
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert(payload)
    .select('*')
    .single()

  throwOnError(error, 'Failed to create job')
  return mapJob(data as Record<string, unknown>)
}

export async function updateJob(id: string, input: UpdateJobInput): Promise<Job> {
  const current = await getJobById(id)
  if (!current) {
    throw new Error('Job not found')
  }

  const jobClass = input.job_class ?? current.job_class
  const jobType = input.job_type ?? current.job_type
  const applianceId =
    input.appliance_id !== undefined ? input.appliance_id : current.appliance_id

  validateJobFields(jobClass, jobType, applianceId)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('jobs')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  throwOnError(error, 'Failed to update job')
  return mapJob(data as Record<string, unknown>)
}

/** Dev-only accessor smoke test (authenticated server context required). */
export async function runJobsAccessorSmokeTest(): Promise<{
  internalJobId: string
  customerJobId: string
}> {
  const supabase = await createClient()
  const { data: applianceRow, error: applianceError } = await supabase
    .from('appliances')
    .select('id')
    .limit(1)
    .maybeSingle()
  throwOnError(applianceError, 'Failed to fetch appliance for smoke test')
  if (!applianceRow?.id) {
    throw new Error('Smoke test requires at least one appliance row')
  }
  const applianceId = String(applianceRow.id)

  try {
    await createJob({
      job_class: 'Internal',
      job_type: 'Delivery',
      appliance_id: applianceId,
    })
    throw new Error('Expected invalid class/type pair to throw')
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes('Invalid job type')
    ) {
      throw error
    }
  }

  try {
    await createJob({
      job_class: 'Internal',
      job_type: 'Intake',
      appliance_id: null,
    })
    throw new Error('Expected Internal job without appliance to throw')
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes('must reference an appliance')
    ) {
      throw error
    }
  }

  const internalJob = await createJob({
    job_class: 'Internal',
    job_type: 'Intake',
    appliance_id: applianceId,
    summary: 'C3 internal smoke',
  })

  const internalFetched = await getJobById(internalJob.id)
  if (
    !internalFetched ||
    internalFetched.job_class !== 'Internal' ||
    internalFetched.appliance_id !== applianceId
  ) {
    throw new Error('Internal job getJobById round-trip failed')
  }

  const customerJob = await createJob({
    job_class: 'Customer',
    job_type: 'Repair',
    appliance_id: null,
    summary: 'C3 customer smoke',
  })

  const customerFetched = await getJobById(customerJob.id)
  if (
    !customerFetched ||
    customerFetched.job_class !== 'Customer' ||
    customerFetched.appliance_id !== null
  ) {
    throw new Error('Customer job getJobById round-trip failed')
  }

  const internalListed = await listJobs({
    job_class: 'Internal',
    job_type: 'Intake',
    state: 'Open',
  })
  if (!internalListed.some((row) => row.id === internalJob.id)) {
    throw new Error('listJobs filters did not return internal smoke job')
  }

  const updated = await updateJob(customerJob.id, {
    summary: 'C3 customer smoke updated',
  })
  if (updated.summary !== 'C3 customer smoke updated') {
    throw new Error('updateJob failed')
  }

  const { error: deleteInternalError } = await supabase
    .from('jobs')
    .delete()
    .eq('id', internalJob.id)
  throwOnError(deleteInternalError, 'Failed to clean up internal smoke job')

  const { error: deleteCustomerError } = await supabase
    .from('jobs')
    .delete()
    .eq('id', customerJob.id)
  throwOnError(deleteCustomerError, 'Failed to clean up customer smoke job')

  return {
    internalJobId: internalJob.id,
    customerJobId: customerJob.id,
  }
}
