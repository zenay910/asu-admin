'use client'

import Link from 'next/link'
import { DataTable } from '@/components/data-table'
import { ListTableSkeleton } from '@/components/list-table-skeleton'
import { PageErrorAlert } from '@/components/page-error-alert'
import { StatusBadge } from '@/components/status-badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDateTime, formatMoney } from '@/lib/format'
import { useCustomers } from '@/lib/hooks/use-customers'
import { useFetchErrorToast } from '@/lib/hooks/use-fetch-error-toast'
import type { Appliance } from '@/lib/types/inventory'
import type { Job } from '@/lib/types/operations'

type CustomerHistoryTabsProps = {
  customerId: string
}

function jobTitle(job: Job): string {
  if (job.summary?.trim()) return job.summary.trim()
  return `${job.job_type} · ${job.job_class}`
}

function applianceColumns(): Parameters<
  typeof DataTable<Appliance>
>[0]['columns'] {
  return [
    {
      id: 'title',
      header: 'Title',
      cell: (row) => (
        <Link
          href={`/dashboard/inventory/${row.id}`}
          className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {row.title || 'Untitled'}
        </Link>
      ),
    },
    {
      id: 'brand',
      header: 'Brand',
      cell: (row) => row.brand || '—',
    },
    {
      id: 'model_number',
      header: 'Model',
      cell: (row) => row.model_number || '—',
    },
    {
      id: 'price',
      header: 'Price',
      cell: (row) => formatMoney(row.price),
    },
  ]
}

export function CustomerHistoryTabs({ customerId }: CustomerHistoryTabsProps) {
  const { history, loading, error } = useCustomers({
    id: customerId,
    history: true,
  })

  useFetchErrorToast(error, 'Customer history')

  if (loading) {
    return <ListTableSkeleton />
  }

  if (error) {
    return <PageErrorAlert message={error} />
  }

  if (!history) {
    return (
      <PageErrorAlert message="Customer history could not be loaded." />
    )
  }

  const owned = history.ownedAppliances
  const sold = history.soldAppliances
  const jobs = history.jobs
  const invoices = history.invoices

  return (
    <Tabs defaultValue="owned" className="space-y-4">
      <TabsList aria-label="Customer history">
        <TabsTrigger value="owned">
          Owned ({owned.length})
        </TabsTrigger>
        <TabsTrigger value="sold">
          Sold ({sold.length})
        </TabsTrigger>
        <TabsTrigger value="jobs">
          Jobs ({jobs.length})
        </TabsTrigger>
        <TabsTrigger value="invoices">
          Invoices ({invoices.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="owned">
        <DataTable
          ariaLabel="Owned appliances"
          data={owned}
          getRowKey={(row) => row.id}
          emptyMessage="No owned appliances linked to this customer."
          columns={applianceColumns()}
        />
      </TabsContent>

      <TabsContent value="sold">
        <DataTable
          ariaLabel="Sold appliances"
          data={sold}
          getRowKey={(row) => row.id}
          emptyMessage="No appliances sold to this customer via appliance sale invoices."
          columns={applianceColumns()}
        />
      </TabsContent>

      <TabsContent value="jobs">
        <DataTable
          ariaLabel="Customer jobs"
          data={jobs}
          getRowKey={(row) => row.id}
          emptyMessage="No jobs linked to this customer."
          columns={[
            {
              id: 'summary',
              header: 'Job',
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
              id: 'state',
              header: 'State',
              cell: (row) => (
                <StatusBadge kind="job-state" value={row.state} />
              ),
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
      </TabsContent>

      <TabsContent value="invoices">
        <DataTable
          ariaLabel="Customer invoices"
          data={invoices}
          getRowKey={(row) => row.id}
          emptyMessage="No invoices linked to this customer."
          columns={[
            {
              id: 'invoice_number',
              header: 'Invoice',
              cell: (row) => (
                <Link
                  href={`/dashboard/invoices/${row.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {row.invoice_number}
                </Link>
              ),
            },
            {
              id: 'invoice_type',
              header: 'Type',
              cell: (row) => (
                <StatusBadge kind="invoice-type" value={row.invoice_type} />
              ),
            },
            {
              id: 'status',
              header: 'Status',
              cell: (row) => (
                <StatusBadge kind="invoice-status" value={row.status} />
              ),
            },
            {
              id: 'total',
              header: 'Total',
              cell: (row) => formatMoney(row.total),
            },
          ]}
        />
      </TabsContent>
    </Tabs>
  )
}
