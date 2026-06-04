import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ConsumePartForJobDialog } from '@/components/consume-part-for-job-dialog'
import { GenerateJobInvoiceButton } from '@/components/generate-job-invoice-button'
import { JobStateControls } from '@/components/job-state-controls'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getJobDetailById } from '@/lib/data/jobs'
import { JOB_DETAIL_FIELDS_BY_TYPE } from '@/lib/jobs/job-form-details'
import { formatDateTime, formatMoney } from '@/lib/format'
import type { Appliance } from '@/lib/types/inventory'
import type { Job, JobPartLine, JobStateHistory } from '@/lib/types/operations'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(8rem,10rem)_1fr] gap-2 border-b border-border py-2 text-sm last:border-0">
      <dt className="type-label text-muted-foreground">{label}</dt>
      <dd className="text-foreground break-words">{value}</dd>
    </div>
  )
}

function buildSpecRows(job: Job): Array<{ label: string; value: string }> {
  return [
    { label: 'Class', value: job.job_class },
    { label: 'Type', value: job.job_type },
    { label: 'State', value: job.state },
    {
      label: 'Labor cost',
      value: formatMoney(job.labor_cost),
    },
    {
      label: 'Customer ID',
      value: job.customer_id || '—',
    },
    { label: 'Created', value: formatDateTime(job.created_at) },
    { label: 'Updated', value: formatDateTime(job.updated_at) },
    { label: 'ID', value: job.id },
  ]
}

function formatDetailValue(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value, null, 2)
}

function detailLabel(key: string, jobType: Job['job_type']): string {
  const field = JOB_DETAIL_FIELDS_BY_TYPE[jobType].find((f) => f.key === key)
  return field?.label ?? key.replace(/_/g, ' ')
}

function DetailsBlock({ job }: { job: Job }) {
  const details = job.details
  if (!details || Object.keys(details).length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>
  }

  const entries = Object.entries(details).filter(([key]) => key !== 'form')

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">—</p>
  }

  return (
    <dl>
      {entries.map(([key, value]) => (
        <SpecRow
          key={key}
          label={detailLabel(key, job.job_type)}
          value={formatDetailValue(value)}
        />
      ))}
    </dl>
  )
}

function StateHistoryTimeline({ entries }: { entries: JobStateHistory[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No state transitions recorded yet.
      </p>
    )
  }

  return (
    <ol className="border-l border-border pl-6">
      {entries.map((entry) => (
        <li key={entry.id} className="relative pb-6 last:pb-0">
          <span className="absolute -left-[1.6rem] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
              {entry.from_state ? (
                <>
                  <StatusBadge kind="job-state" value={entry.from_state} />
                  <span className="text-muted-foreground">→</span>
                </>
              ) : (
                <span className="text-muted-foreground">Initial →</span>
              )}
              <StatusBadge kind="job-state" value={entry.to_state} />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(entry.created_at)}
              {entry.reason ? ` · ${entry.reason}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}

function JobPartsTable({ lines }: { lines: JobPartLine[] }) {
  if (lines.length === 0) {
    return <p className="text-sm text-muted-foreground">No parts consumed yet.</p>
  }

  const total = lines.reduce(
    (sum, line) => sum + line.quantity * line.unit_price,
    0,
  )

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="px-4 py-2 font-medium">Part</th>
              <th className="px-4 py-2 font-medium text-right">Qty</th>
              <th className="px-4 py-2 font-medium text-right">Unit price</th>
              <th className="px-4 py-2 font-medium text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/parts/${line.part_id}`}
                    className="font-mono text-xs font-medium underline-offset-4 hover:text-primary hover:underline"
                  >
                    {line.part_number}
                  </Link>
                  <p className="text-foreground">{line.part_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(line.created_at)}
                  </p>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {line.quantity}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(line.unit_price)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatMoney(line.quantity * line.unit_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted-foreground text-right">
        Parts subtotal:{' '}
        <span className="font-medium text-foreground tabular-nums">
          {formatMoney(total)}
        </span>
      </p>
    </div>
  )
}

function LinkedApplianceCard({ appliance }: { appliance: Appliance }) {
  return (
    <div className="rounded-md border border-border p-4 space-y-2">
      <Link
        href={`/dashboard/inventory/${appliance.id}`}
        className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
      >
        {appliance.title || appliance.model_number || 'Appliance'}
      </Link>
      <p className="text-sm text-muted-foreground">
        {[appliance.brand, appliance.model_number].filter(Boolean).join(' · ')}
      </p>
      <div className="flex flex-wrap gap-2">
        <StatusBadge kind="lifecycle-state" value={appliance.lifecycle_state} />
        <StatusBadge kind="appliance-status" value={appliance.status} />
      </div>
    </div>
  )
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params
  const result = await getJobDetailById(id)

  if (!result) {
    notFound()
  }

  const { detail, appliance } = result
  const { job, stateHistory, jobParts } = detail
  const title = job.summary?.trim() || `${job.job_type} · ${job.job_class}`

  return (
    <div className="space-y-8">
      <PageHeader
        title={title}
        description={`${job.job_class} work order`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/dashboard/jobs">Back to list</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="job-class" value={job.job_class} />
        <StatusBadge kind="job-type" value={job.job_type} />
        <StatusBadge kind="job-state" value={job.state} />
      </div>

      <JobStateControls jobId={job.id} state={job.state} />

      <GenerateJobInvoiceButton
        jobId={job.id}
        jobClass={job.job_class}
        jobState={job.state}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {job.summary?.trim() || '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Linked appliance</CardTitle>
          </CardHeader>
          <CardContent>
            {appliance ? (
              <LinkedApplianceCard appliance={appliance} />
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Job details</CardTitle>
          <CardDescription>
            Standardized payload for {job.job_type}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DetailsBlock job={job} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Specifications</CardTitle>
        </CardHeader>
        <CardContent>
          <dl>
            {buildSpecRows(job).map((row) => (
              <SpecRow key={row.label} label={row.label} value={row.value} />
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Consumed parts</CardTitle>
            <CardDescription>
              Rows from job_parts (newest last)
            </CardDescription>
          </div>
          <ConsumePartForJobDialog jobId={job.id} />
        </CardHeader>
        <CardContent>
          <JobPartsTable lines={jobParts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>State history</CardTitle>
          <CardDescription>Ordered transitions (newest last)</CardDescription>
        </CardHeader>
        <CardContent>
          <StateHistoryTimeline entries={stateHistory} />
        </CardContent>
      </Card>
    </div>
  )
}
