'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DataTable } from '@/components/data-table'
import { FilterSelect } from '@/components/filter-select'
import { ListTableSkeleton } from '@/components/list-table-skeleton'
import { PageErrorAlert } from '@/components/page-error-alert'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useFetchErrorToast } from '@/lib/hooks/use-fetch-error-toast'
import { useParts, type PartListFilters } from '@/lib/hooks/use-parts'
import { cn } from '@/lib/utils'
import type { Part, PartStatus } from '@/lib/types/inventory'

const ALL = 'All'

const STATUS_OPTIONS: Array<PartStatus | typeof ALL> = [
  ALL,
  'Active',
  'Discontinued',
]

function isLowStock(part: Part): boolean {
  if (part.reorder_threshold == null) return false
  return part.quantity_on_hand <= part.reorder_threshold
}

function buildHookFilters(state: {
  status: string
  category: string
  brand: string
}): PartListFilters {
  const filters: PartListFilters = {}
  if (state.status !== ALL) {
    filters.status = state.status as PartStatus
  }
  if (state.category !== ALL) filters.category = state.category
  if (state.brand !== ALL) filters.brand = state.brand
  return filters
}

export default function PartsListPage() {
  const [status, setStatus] = useState<string>(ALL)
  const [category, setCategory] = useState<string>(ALL)
  const [brand, setBrand] = useState<string>(ALL)

  const hookFilters = useMemo(
    () => buildHookFilters({ status, category, brand }),
    [status, category, brand],
  )

  const { parts, loading, error } = useParts({ filters: hookFilters })
  const { parts: allParts, error: allPartsError } = useParts({})

  useFetchErrorToast(error, 'Parts list')
  useFetchErrorToast(allPartsError, 'Parts filters')

  const categoryOptions = useMemo(() => {
    const values = new Set(
      allParts.map((row) => row.category).filter((value): value is string => !!value),
    )
    return [ALL, ...Array.from(values).sort()]
  }, [allParts])

  const brandOptions = useMemo(() => {
    const values = new Set(
      allParts.map((row) => row.brand).filter((value): value is string => !!value),
    )
    return [ALL, ...Array.from(values).sort()]
  }, [allParts])

  const lowStockCount = useMemo(
    () => parts.filter(isLowStock).length,
    [parts],
  )

  const clearFilters = () => {
    setStatus(ALL)
    setCategory(ALL)
    setBrand(ALL)
  }

  const hasActiveFilters =
    status !== ALL || category !== ALL || brand !== ALL

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parts"
        description="Parts inventory from the parts table (via /api/parts)."
        actions={
          <Button asChild>
            <Link href="/dashboard/parts/new">Add part</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FilterSelect
          label="Status"
          value={status}
          onValueChange={setStatus}
          options={STATUS_OPTIONS.map((option) => ({
            value: option,
            label: option,
          }))}
        />
        <FilterSelect
          label="Category"
          value={category}
          onValueChange={setCategory}
          options={categoryOptions.map((option) => ({
            value: option,
            label: option,
          }))}
        />
        <FilterSelect
          label="Brand"
          value={brand}
          onValueChange={setBrand}
          options={brandOptions.map((option) => ({
            value: option,
            label: option,
          }))}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {loading
            ? 'Loading parts…'
            : `Showing ${parts.length} part${parts.length === 1 ? '' : 's'}`}
          {!loading && lowStockCount > 0
            ? ` · ${lowStockCount} at or below reorder threshold`
            : ''}
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
          ariaLabel="Parts inventory"
          data={parts}
          getRowKey={(row) => row.id}
          getRowClassName={(row) =>
            isLowStock(row)
              ? 'bg-amber-50/90 dark:bg-amber-950/40'
              : undefined
          }
          emptyMessage="No parts match the current filters."
          columns={[
            {
              id: 'part_number',
              header: 'Part #',
              cell: (row) => (
                <Link
                  href={`/dashboard/parts/${row.id}`}
                  className="font-mono text-sm font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {row.part_number}
                </Link>
              ),
            },
            {
              id: 'name',
              header: 'Name',
              cell: (row) => row.name,
            },
            {
              id: 'category',
              header: 'Category',
              cell: (row) => row.category || '—',
            },
            {
              id: 'quantity_on_hand',
              header: 'Qty on hand',
              cell: (row) => (
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'tabular-nums',
                      isLowStock(row) && 'font-semibold text-amber-900 dark:text-amber-200',
                    )}
                  >
                    {row.quantity_on_hand}
                  </span>
                  {isLowStock(row) ? (
                    <Badge
                      variant="outline"
                      className="border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    >
                      Low stock
                    </Badge>
                  ) : null}
                </div>
              ),
            },
            {
              id: 'reorder_threshold',
              header: 'Reorder at',
              cell: (row) =>
                row.reorder_threshold != null ? (
                  <span className="tabular-nums">{row.reorder_threshold}</span>
                ) : (
                  '—'
                ),
            },
            {
              id: 'status',
              header: 'Status',
              cell: (row) => (
                <StatusBadge kind="part-status" value={row.status} />
              ),
            },
          ]}
        />
      )}
    </div>
  )
}
