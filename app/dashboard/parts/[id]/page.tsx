import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdjustPartStockDialog } from '@/components/adjust-part-stock-dialog'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PartCompatibilityManager } from '@/components/part-compatibility-manager'
import { listCompatibleAppliances } from '@/lib/data/part-compatibility'
import { getPartDetailById } from '@/lib/data/parts'
import { formatDateTime, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Part } from '@/lib/types/inventory'
import type { PartStockMovement } from '@/lib/types/operations'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ id: string }>
}

function isLowStock(part: Part): boolean {
  if (part.reorder_threshold == null) return false
  return part.quantity_on_hand <= part.reorder_threshold
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(8rem,10rem)_1fr] gap-2 border-b border-border py-2 text-sm last:border-0">
      <dt className="type-label text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  )
}

function buildSpecRows(part: Part): Array<{ label: string; value: string }> {
  return [
    { label: 'Part number', value: part.part_number },
    { label: 'Name', value: part.name },
    { label: 'Brand', value: part.brand || '—' },
    { label: 'Category', value: part.category || '—' },
    { label: 'Location', value: part.location || '—' },
    {
      label: 'Quantity on hand',
      value: String(part.quantity_on_hand),
    },
    {
      label: 'Reorder threshold',
      value:
        part.reorder_threshold != null ? String(part.reorder_threshold) : '—',
    },
    {
      label: 'Unit cost',
      value: part.unit_cost != null ? formatMoney(part.unit_cost) : '—',
    },
    {
      label: 'Unit price',
      value: part.unit_price != null ? formatMoney(part.unit_price) : '—',
    },
    { label: 'Created', value: formatDateTime(part.created_at) },
    { label: 'Updated', value: formatDateTime(part.updated_at) },
    { label: 'ID', value: part.id },
  ]
}

function formatDelta(delta: number): string {
  if (delta > 0) return `+${delta}`
  return String(delta)
}

function MovementSummary({ movement }: { movement: PartStockMovement }) {
  const signClass =
    movement.delta > 0
      ? 'text-emerald-700 dark:text-emerald-300'
      : movement.delta < 0
        ? 'text-amber-900 dark:text-amber-200'
        : 'text-foreground'

  return (
    <li className="relative border-b border-border py-4 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={cn('text-sm font-semibold tabular-nums', signClass)}>
          {formatDelta(movement.delta)}
          <span className="ml-2 font-normal text-muted-foreground">
            → {movement.quantity_after} on hand
          </span>
        </p>
        <time className="text-xs text-muted-foreground">
          {formatDateTime(movement.created_at)}
        </time>
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {movement.reason ? <p>{movement.reason}</p> : null}
        {movement.job_part_id ? (
          <p>Job part: {movement.job_part_id}</p>
        ) : (
          <p>Non-job adjustment</p>
        )}
      </div>
    </li>
  )
}

export default async function PartDetailPage({ params }: PageProps) {
  const { id } = await params
  const detail = await getPartDetailById(id)

  if (!detail) {
    notFound()
  }

  const { part, stockMovements } = detail
  const compatibleAppliances = await listCompatibleAppliances(part.id)
  const lowStock = isLowStock(part)

  return (
    <div className="space-y-8">
      <PageHeader
        title={part.name}
        description={part.part_number}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/parts">Back to list</Link>
            </Button>
            <Button asChild>
              <Link href={`/dashboard/parts/edit/${part.id}`}>Edit</Link>
            </Button>
            <AdjustPartStockDialog
              partId={part.id}
              quantityOnHand={part.quantity_on_hand}
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="part-status" value={part.status} />
        {lowStock ? (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          >
            Low stock
          </Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              {buildSpecRows(part).map((row) => (
                <SpecRow key={row.label} label={row.label} value={row.value} />
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {part.description?.trim() || '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compatible appliances</CardTitle>
          <CardDescription>
            {compatibleAppliances.length
              ? `${compatibleAppliances.length} linked appliance${compatibleAppliances.length === 1 ? '' : 's'}`
              : 'No compatibility links yet'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PartCompatibilityManager
            partId={part.id}
            linkedAppliances={compatibleAppliances}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock movement history</CardTitle>
          <CardDescription>
            Audit log from part_stock_movements (newest first)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stockMovements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No stock movements recorded yet.
            </p>
          ) : (
            <ul>
              {stockMovements.map((movement) => (
                <MovementSummary key={movement.id} movement={movement} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
