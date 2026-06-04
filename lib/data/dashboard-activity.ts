import { createClient } from '@/lib/supabase/server'
import { listInvoices } from '@/lib/data/invoices'
import { listJobs } from '@/lib/data/jobs'
import type { LifecycleState } from '@/lib/types/inventory'
import type { Invoice, Job, JobState } from '@/lib/types/operations'

const FETCH_LIMIT = 8
const DEFAULT_ACTIVITY_LIMIT = 20

export type DashboardActivityKind =
  | 'job_created'
  | 'invoice_created'
  | 'job_state_change'
  | 'appliance_state_change'

export type DashboardActivityItem = {
  id: string
  kind: DashboardActivityKind
  created_at: string
  href: string
  title: string
  detail: string
}

function throwOnError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

function jobLabel(job: Job): string {
  if (job.summary?.trim()) return job.summary.trim()
  return `${job.job_type} · ${job.job_class}`
}

function stateChangeDetail(
  from: string | null,
  to: string,
): string {
  return from ? `${from} → ${to}` : `→ ${to}`
}

function jobItems(jobs: Job[]): DashboardActivityItem[] {
  return jobs.map((job) => ({
    id: `job-${job.id}`,
    kind: 'job_created',
    created_at: job.created_at,
    href: `/dashboard/jobs/${job.id}`,
    title: jobLabel(job),
    detail: `New ${job.job_class} job · ${job.state}`,
  }))
}

function invoiceItems(invoices: Invoice[]): DashboardActivityItem[] {
  return invoices.map((invoice) => ({
    id: `invoice-${invoice.id}`,
    kind: 'invoice_created',
    created_at: invoice.created_at,
    href: `/dashboard/invoices/${invoice.id}`,
    title: invoice.invoice_number,
    detail: `${invoice.invoice_type.replace('_', ' ')} · ${invoice.status}`,
  }))
}

export async function getRecentDashboardActivity(
  limit = DEFAULT_ACTIVITY_LIMIT,
): Promise<DashboardActivityItem[]> {
  const supabase = await createClient()

  const [jobs, invoices, jobHistoryResult, applianceHistoryResult] =
    await Promise.all([
      listJobs({ limit: FETCH_LIMIT }),
      listInvoices({ limit: FETCH_LIMIT }),
      supabase
        .from('job_state_history')
        .select(
          `
          id,
          created_at,
          job_id,
          from_state,
          to_state,
          reason,
          jobs (
            summary,
            job_type,
            job_class
          )
        `,
        )
        .order('created_at', { ascending: false })
        .limit(FETCH_LIMIT),
      supabase
        .from('appliance_state_history')
        .select(
          `
          id,
          created_at,
          appliance_id,
          from_state,
          to_state,
          reason,
          appliances (
            title,
            model_number
          )
        `,
        )
        .order('created_at', { ascending: false })
        .limit(FETCH_LIMIT),
    ])

  throwOnError(jobHistoryResult.error, 'Failed to load job state history')
  throwOnError(
    applianceHistoryResult.error,
    'Failed to load appliance state history',
  )

  const jobHistoryItems: DashboardActivityItem[] = (
    jobHistoryResult.data ?? []
  ).map((row) => {
    const record = row as Record<string, unknown>
    const nested = record.jobs as Record<string, unknown> | null
    const summary =
      nested && typeof nested.summary === 'string' ? nested.summary : ''
    const jobType =
      nested && typeof nested.job_type === 'string' ? nested.job_type : 'Job'
    const jobClass =
      nested && typeof nested.job_class === 'string' ? nested.job_class : ''
    const label = summary.trim() || `${jobType}${jobClass ? ` · ${jobClass}` : ''}`

    const fromState = record.from_state as JobState | null
    const toState = record.to_state as JobState
    const reason =
      typeof record.reason === 'string' && record.reason.trim()
        ? ` · ${record.reason.trim()}`
        : ''

    return {
      id: `job-history-${String(record.id)}`,
      kind: 'job_state_change',
      created_at: String(record.created_at),
      href: `/dashboard/jobs/${String(record.job_id)}`,
      title: label,
      detail: `${stateChangeDetail(fromState, toState)}${reason}`,
    }
  })

  const applianceHistoryItems: DashboardActivityItem[] = (
    applianceHistoryResult.data ?? []
  ).map((row) => {
    const record = row as Record<string, unknown>
    const nested = record.appliances as Record<string, unknown> | null
    const title =
      nested && typeof nested.title === 'string' && nested.title.trim()
        ? nested.title.trim()
        : nested && typeof nested.model_number === 'string'
          ? nested.model_number
          : 'Appliance'

    const fromState = record.from_state as LifecycleState | null
    const toState = record.to_state as LifecycleState
    const reason =
      typeof record.reason === 'string' && record.reason.trim()
        ? ` · ${record.reason.trim()}`
        : ''

    return {
      id: `appliance-history-${String(record.id)}`,
      kind: 'appliance_state_change',
      created_at: String(record.created_at),
      href: `/dashboard/inventory/${String(record.appliance_id)}`,
      title,
      detail: `${stateChangeDetail(fromState, toState)}${reason}`,
    }
  })

  const merged = [
    ...jobItems(jobs),
    ...invoiceItems(invoices),
    ...jobHistoryItems,
    ...applianceHistoryItems,
  ]

  merged.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )

  return merged.slice(0, limit)
}
