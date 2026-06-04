'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DataTable } from '@/components/data-table'
import { FilterSelect } from '@/components/filter-select'
import { ListTableSkeleton } from '@/components/list-table-skeleton'
import { PageErrorAlert } from '@/components/page-error-alert'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFetchErrorToast } from '@/lib/hooks/use-fetch-error-toast'
import { useJobs, type JobListFilters } from '@/lib/hooks/use-jobs'
import { formatDateTime, formatMoney } from '@/lib/format'
import type { Job, JobClass, JobState } from '@/lib/types/operations'

const ALL = 'All'
const ALL_CLASS = 'All' as const

const STATE_OPTIONS: Array<JobState | typeof ALL> = [
  ALL,
  'Open',
  'In Progress',
  'Completed',
  'Closed',
]

type ClassTab = typeof ALL_CLASS | JobClass

function buildHookFilters(state: {
  jobClassTab: ClassTab
  jobState: string
}): JobListFilters {
  const filters: JobListFilters = {}
  if (state.jobClassTab !== ALL_CLASS) {
    filters.job_class = state.jobClassTab
  }
  if (state.jobState !== ALL) {
    filters.state = state.jobState as JobState
  }
  return filters
}

function jobTitle(job: Job): string {
  if (job.summary?.trim()) return job.summary.trim()
  return `${job.job_type} · ${job.job_class}`
}

export default function JobsListPage() {
  const [jobClassTab, setJobClassTab] = useState<ClassTab>(ALL_CLASS)
  const [jobState, setJobState] = useState<string>(ALL)

  const hookFilters = useMemo(
    () => buildHookFilters({ jobClassTab, jobState }),
    [jobClassTab, jobState],
  )

  const { jobs, loading, error } = useJobs({ filters: hookFilters })

  useFetchErrorToast(error, 'Jobs list')

  const clearFilters = () => {
    setJobClassTab(ALL_CLASS)
    setJobState(ALL)
  }

  const hasActiveFilters = jobClassTab !== ALL_CLASS || jobState !== ALL

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Work orders from the jobs table (via /api/jobs)."
        actions={
          <Button asChild>
            <Link href="/dashboard/jobs/new">New job</Link>
          </Button>
        }
      />

      <Tabs
        value={jobClassTab}
        onValueChange={(value) => setJobClassTab(value as ClassTab)}
      >
        <TabsList aria-label="Filter by job class">
          <TabsTrigger value={ALL_CLASS}>All</TabsTrigger>
          <TabsTrigger value="Internal">Internal</TabsTrigger>
          <TabsTrigger value="Customer">Customer</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-3 sm:max-w-xs">
        <FilterSelect
          label="State"
          value={jobState}
          onValueChange={setJobState}
          options={STATE_OPTIONS.map((option) => ({
            value: option,
            label: option,
          }))}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Loading jobs…'
            : `Showing ${jobs.length} job${jobs.length === 1 ? '' : 's'}`}
        </p>
        {hasActiveFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      {error ? <PageErrorAlert message={error} /> : null}

      {loading ? (
        <ListTableSkeleton />
      ) : (
        <DataTable
          ariaLabel="Jobs work orders"
          data={jobs}
          getRowKey={(row) => row.id}
          emptyMessage="No jobs match the current filters."
          columns={[
            {
              id: 'summary',
              header: 'Summary',
              cell: (row) => (
                <Link
                  href={`/dashboard/jobs/${row.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {jobTitle(row)}
                </Link>
              ),
            },
            {
              id: 'job_class',
              header: 'Class',
              cell: (row) => (
                <StatusBadge kind="job-class" value={row.job_class} />
              ),
            },
            {
              id: 'job_type',
              header: 'Type',
              cell: (row) => (
                <StatusBadge kind="job-type" value={row.job_type} />
              ),
            },
            {
              id: 'state',
              header: 'State',
              cell: (row) => <StatusBadge kind="job-state" value={row.state} />,
            },
            {
              id: 'labor_cost',
              header: 'Labor',
              cell: (row) => formatMoney(row.labor_cost),
            },
            {
              id: 'created_at',
              header: 'Created',
              cell: (row) => (
                <span className="text-muted-foreground">
                  {formatDateTime(row.created_at)}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  )
}
