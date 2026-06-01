import { DataTable } from '@/components/data-table'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { ThemeQaActions } from '@/components/theme-qa-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

const brandSwatches = [
  { name: 'Crimson', className: 'bg-crimson' },
  { name: 'Crimson dark', className: 'bg-crimson-dark' },
  { name: 'Crimson lt', className: 'bg-crimson-lt' },
  { name: 'Crimson pale', className: 'bg-crimson-pale' },
  { name: 'Charcoal', className: 'bg-charcoal' },
  { name: 'Steel', className: 'bg-steel' },
  { name: 'Mid', className: 'bg-mid' },
  { name: 'Smoke', className: 'bg-smoke' },
  { name: 'Rule', className: 'bg-rule' },
] as const

export default function ThemeQaPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="Theme QA (F0.5.5)"
        description="Compare side-by-side with asu-frontend: Outfit + Roboto Mono, crimson / charcoal / smoke palette, shadcn primitives."
        actions={<ThemeQaActions />}
      />

      <section className="space-y-3">
        <p className="section-eyebrow">Brand palette</p>
        <div className="divider-red" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {brandSwatches.map((swatch) => (
            <div key={swatch.name} className="space-y-1">
              <div
                className={`h-12 rounded-sm border border-border ${swatch.className}`}
              />
              <p className="type-caption text-muted-foreground">{swatch.name}</p>
            </div>
          ))}
        </div>
        <p className="type-body text-muted-foreground">
          Semantic shell:{' '}
          <span className="rounded-sm bg-background px-2 py-0.5 text-foreground">
            background
          </span>
          ,{' '}
          <span className="rounded-sm bg-primary px-2 py-0.5 text-primary-foreground">
            primary
          </span>
          ,{' '}
          <span className="rounded-sm bg-accent px-2 py-0.5 text-accent-foreground">
            accent
          </span>
        </p>
      </section>

      <section className="space-y-3">
        <p className="section-eyebrow">Typography</p>
        <div className="divider-red" />
        <p className="type-label">Inventory overview</p>
        <h2 className="type-display">Brand display</h2>
        <p className="type-body">
          Body text uses Outfit at 300 weight — matches asu-frontend `.type-body`.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="type-subheading text-foreground">shadcn buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button">Primary</Button>
          <Button type="button" variant="secondary">
            Secondary
          </Button>
          <Button type="button" variant="outline">
            Outline
          </Button>
          <Button type="button" variant="destructive">
            Destructive
          </Button>
          <Button type="button" variant="ghost">
            Ghost
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="type-subheading text-foreground">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>Default (primary)</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge kind="appliance-status" value="Published" />
          <StatusBadge kind="lifecycle-state" value="Listed" />
          <StatusBadge kind="job-class" value="Customer" />
          <StatusBadge kind="job-state" value="In Progress" />
          <StatusBadge kind="invoice-type" value="appliance_sale" />
          <StatusBadge kind="invoice-status" value="Issued" />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="type-subheading text-foreground">Formatters</h2>
        <p className="text-sm text-muted-foreground">
          {formatMoney(1299.5)} · {formatDate('2026-05-01T14:30:00.000Z')} ·{' '}
          {formatDateTime('2026-05-01T14:30:00.000Z')}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="type-subheading text-foreground">Data table</h2>
        <DataTable
          caption="F0 primitive — inherits border, muted header, card surface"
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
