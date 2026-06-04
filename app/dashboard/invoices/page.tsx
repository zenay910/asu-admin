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
import { useFetchErrorToast } from '@/lib/hooks/use-fetch-error-toast'
import { useInvoices, type InvoiceListFilters } from '@/lib/hooks/use-invoices'
import { formatMoney } from '@/lib/format'
import type { InvoiceStatus, InvoiceType } from '@/lib/types/operations'

const ALL = 'All'

const TYPE_OPTIONS: Array<InvoiceType | typeof ALL> = [
  ALL,
  'job',
  'appliance_sale',
  'retail',
]

const TYPE_LABELS: Record<InvoiceType, string> = {
  job: 'Job',
  appliance_sale: 'Appliance sale',
  retail: 'Retail',
}

const STATUS_OPTIONS: Array<InvoiceStatus | typeof ALL> = [
  ALL,
  'Draft',
  'Issued',
  'Paid',
  'Void',
]

function buildHookFilters(state: {
  invoiceType: string
  status: string
}): InvoiceListFilters {
  const filters: InvoiceListFilters = {}
  if (state.invoiceType !== ALL) {
    filters.invoice_type = state.invoiceType as InvoiceType
  }
  if (state.status !== ALL) {
    filters.status = state.status as InvoiceStatus
  }
  return filters
}

export default function InvoicesListPage() {
  const [invoiceType, setInvoiceType] = useState<string>(ALL)
  const [status, setStatus] = useState<string>(ALL)

  const hookFilters = useMemo(
    () => buildHookFilters({ invoiceType, status }),
    [invoiceType, status],
  )

  const { invoices, loading, error } = useInvoices({ filters: hookFilters })

  useFetchErrorToast(error, 'Invoices list')

  const clearFilters = () => {
    setInvoiceType(ALL)
    setStatus(ALL)
  }

  const hasActiveFilters = invoiceType !== ALL || status !== ALL

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Job, appliance-sale, and retail invoices (via /api/invoices)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/dashboard/invoices/new/retail">Retail sale</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/invoices/new/appliance-sale">
                Appliance sale
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FilterSelect
          label="Type"
          value={invoiceType}
          onValueChange={setInvoiceType}
          options={TYPE_OPTIONS.map((option) => ({
            value: option,
            label:
              option === ALL
                ? option
                : TYPE_LABELS[option as InvoiceType],
          }))}
        />
        <FilterSelect
          label="Status"
          value={status}
          onValueChange={setStatus}
          options={STATUS_OPTIONS.map((option) => ({
            value: option,
            label: option,
          }))}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Loading invoices…'
            : `Showing ${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`}
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
          ariaLabel="Invoices"
          data={invoices}
          getRowKey={(row) => row.id}
          emptyMessage="No invoices match the current filters."
          columns={[
            {
              id: 'invoice_number',
              header: 'Invoice #',
              cell: (row) => (
                <Link
                  href={`/dashboard/invoices/${row.id}`}
                  className="font-mono text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
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
              cell: (row) => (
                <span className="tabular-nums font-medium">
                  {formatMoney(row.total)}
                </span>
              ),
            },
          ]}
        />
      )}
    </div>
  )
}
