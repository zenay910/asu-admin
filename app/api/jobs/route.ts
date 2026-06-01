import { NextRequest, NextResponse } from 'next/server'
import {
  createJob,
  getJobById,
  listJobs,
  type CreateJobInput,
} from '@/lib/data/jobs'
import { createClient } from '@/lib/supabase/server'
import type { Job, JobClass, JobState, JobType } from '@/lib/types/operations'

export type JobsApiSuccess =
  | { success: true; jobId: string }
  | { success: true; job: Job }
  | { success: true; jobs: Job[] }

export type JobsApiError = { success: false; error: string }

const JOB_CLASSES: readonly JobClass[] = ['Internal', 'Customer']
const JOB_STATES: readonly JobState[] = [
  'Open',
  'In Progress',
  'Completed',
  'Closed',
]
const JOB_TYPES: readonly JobType[] = [
  'Intake',
  'Diagnostic',
  'Repair',
  'Cleaning',
  'Delivery',
  'Installation',
  'Maintenance',
  'Warranty',
]

async function requireAuth(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return !error && !!user
}

function isJobClass(value: string): value is JobClass {
  return (JOB_CLASSES as readonly string[]).includes(value)
}

function isJobState(value: string): value is JobState {
  return (JOB_STATES as readonly string[]).includes(value)
}

function isJobType(value: string): value is JobType {
  return (JOB_TYPES as readonly string[]).includes(value)
}

function parseCreateBody(
  body: unknown,
): { ok: true; input: CreateJobInput } | { ok: false; error: string } {
  if (body == null || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body.' }
  }

  const raw = body as Record<string, unknown>
  const job_class =
    typeof raw.job_class === 'string' ? raw.job_class.trim() : ''
  const job_type = typeof raw.job_type === 'string' ? raw.job_type.trim() : ''

  if (!job_class) {
    return { ok: false, error: 'Missing required field: job_class' }
  }
  if (!isJobClass(job_class)) {
    return { ok: false, error: 'Invalid job_class; use Internal or Customer' }
  }
  if (!job_type) {
    return { ok: false, error: 'Missing required field: job_type' }
  }
  if (!isJobType(job_type)) {
    return { ok: false, error: 'Invalid job_type' }
  }

  const input: CreateJobInput = { job_class, job_type }

  if (raw.appliance_id !== undefined) {
    input.appliance_id =
      raw.appliance_id == null ? null : String(raw.appliance_id)
  }
  if (raw.customer_id !== undefined) {
    input.customer_id =
      raw.customer_id == null ? null : String(raw.customer_id)
  }
  if (raw.state !== undefined) {
    const state = String(raw.state)
    if (!isJobState(state)) {
      return { ok: false, error: 'Invalid state' }
    }
    input.state = state
  }
  if (raw.summary !== undefined) {
    input.summary = raw.summary == null ? null : String(raw.summary)
  }
  if (raw.details !== undefined) {
    input.details =
      raw.details == null || typeof raw.details !== 'object'
        ? null
        : (raw.details as Record<string, unknown>)
  }
  if (raw.labor_cost !== undefined) {
    const labor = Number(raw.labor_cost)
    if (!Number.isFinite(labor) || labor < 0) {
      return { ok: false, error: 'labor_cost must be a non-negative number' }
    }
    input.labor_cost = labor
  }

  return { ok: true, input }
}

export async function GET(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json<JobsApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (id) {
      const job = await getJobById(id)
      if (!job) {
        return NextResponse.json<JobsApiError>(
          { success: false, error: 'Job not found' },
          { status: 404 },
        )
      }
      return NextResponse.json<JobsApiSuccess>({ success: true, job })
    }

    const limitRaw = searchParams.get('limit')
    const limit = limitRaw != null ? Number(limitRaw) : undefined

    const jobClassParam = searchParams.get('job_class')
    const job_class =
      jobClassParam && isJobClass(jobClassParam) ? jobClassParam : undefined

    const stateParam = searchParams.get('state')
    const state = stateParam && isJobState(stateParam) ? stateParam : undefined

    const jobTypeParam = searchParams.get('job_type')
    const job_type =
      jobTypeParam && isJobType(jobTypeParam) ? jobTypeParam : undefined

    const jobs = await listJobs({
      job_class,
      state,
      job_type,
      limit: limit != null && Number.isFinite(limit) ? limit : undefined,
    })

    return NextResponse.json<JobsApiSuccess>({ success: true, jobs })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list jobs'
    return NextResponse.json<JobsApiError>(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json<JobsApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<JobsApiError>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const parsed = parseCreateBody(body)
  if (!parsed.ok) {
    return NextResponse.json<JobsApiError>(
      { success: false, error: parsed.error },
      { status: 400 },
    )
  }

  try {
    const job = await createJob(parsed.input)
    return NextResponse.json<JobsApiSuccess>(
      { success: true, jobId: job.id },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create job'
    return NextResponse.json<JobsApiError>(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
