import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { formatDate, formatDateTime, formatMoney } from '@/lib/format'

type SampleRow = {
  id: string
  label: string
  amount: number
  createdAt: string
}

const sampleRows: SampleRow[] = [
  {
    id: '1',
    label: 'Sample row A',
    amount: 1299.5,
    createdAt: '2026-05-01T14:30:00.000Z',
  },
  {
    id: '2',
    label: 'Sample row B',
    amount: 89,
    createdAt: '2026-05-15T09:00:00.000Z',
  },
]

export default function F03ScratchPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="F0.3 helpers scratch"
        description="Dev-only preview of shared presentational components."
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Status badges
        </h2>
        <div className="flex flex-wrap gap-2">
          <StatusBadge kind="appliance-status" value="Published" />
          <StatusBadge kind="lifecycle-state" value="Listed" />
          <StatusBadge kind="job-class" value="Customer" />
          <StatusBadge kind="job-state" value="In Progress" />
          <StatusBadge kind="invoice-type" value="appliance_sale" />
          <StatusBadge kind="invoice-status" value="Issued" />
          <StatusBadge kind="appliance-status" value={null} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Formatters
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {formatMoney(1299.5)} · {formatDate('2026-05-01T14:30:00.000Z')} ·{' '}
          {formatDateTime('2026-05-01T14:30:00.000Z')}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Data table
        </h2>
        <DataTable
          caption="F0.3 sample data"
          data={sampleRows}
          getRowKey={(row) => row.id}
          columns={[
            {
              id: 'label',
              header: 'Label',
              cell: (row) => row.label,
            },
            {
              id: 'amount',
              header: 'Amount',
              cell: (row) => formatMoney(row.amount),
            },
            {
              id: 'created',
              header: 'Created',
              cell: (row) => formatDate(row.createdAt),
            },
          ]}
        />
      </section>
    </div>
  )
}
