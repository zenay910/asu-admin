'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { DataTable } from '@/components/data-table'
import { FilterSelect } from '@/components/filter-select'
import { HoverImagePreview } from '@/components/hover-image-preview'
import { ListTableSkeleton } from '@/components/list-table-skeleton'
import { PageErrorAlert } from '@/components/page-error-alert'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  useAppliances,
  type ApplianceListFilters,
} from '@/lib/hooks/use-appliances'
import { useFetchErrorToast } from '@/lib/hooks/use-fetch-error-toast'
import { LIFECYCLE_STATES } from '@/lib/inventory/lifecycle'
import { formatMoney } from '@/lib/format'
import type { Appliance, ApplianceStatus } from '@/lib/types/inventory'

const ALL = 'All'

const STATUS_OPTIONS: Array<ApplianceStatus | typeof ALL> = [
  ALL,
  'Draft',
  'Published',
  'Sold',
  'Archived',
]

const LIFECYCLE_OPTIONS = [ALL, ...LIFECYCLE_STATES] as const

function buildHookFilters(state: {
  status: string
  lifecycle_state: string
  type: string
  brand: string
}): ApplianceListFilters {
  const filters: ApplianceListFilters = {}
  if (state.status !== ALL) {
    filters.status = state.status as ApplianceStatus
  }
  if (state.lifecycle_state !== ALL) {
    filters.lifecycle_state = state.lifecycle_state as Appliance['lifecycle_state']
  }
  if (state.brand !== ALL) filters.brand = state.brand
  if (state.type !== ALL) filters.type = state.type
  return filters
}

function ApplianceThumbnail({
  title,
  imageUrl,
}: {
  title: string
  imageUrl: string | null
}) {
  if (!imageUrl) {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm border border-border bg-muted text-[10px] text-muted-foreground"
        aria-hidden
      >
        No img
      </div>
    )
  }

  return <HoverImagePreview src={imageUrl} alt={title} />
}

export default function InventoryListPage() {
  const [status, setStatus] = useState<string>(ALL)
  const [lifecycleState, setLifecycleState] = useState<string>(ALL)
  const [type, setType] = useState<string>(ALL)
  const [brand, setBrand] = useState<string>(ALL)

  const hookFilters = useMemo(
    () =>
      buildHookFilters({
        status,
        lifecycle_state: lifecycleState,
        type,
        brand,
      }),
    [status, lifecycleState, type, brand],
  )

  const { appliances, loading, error } = useAppliances(hookFilters)
  const { appliances: allAppliances, error: allAppliancesError } =
    useAppliances({})

  useFetchErrorToast(error, 'Inventory list')
  useFetchErrorToast(allAppliancesError, 'Inventory filters')

  const brandOptions = useMemo(() => {
    const brands = new Set(
      allAppliances.map((row) => row.brand).filter((value) => value.trim()),
    )
    return [ALL, ...Array.from(brands).sort()]
  }, [allAppliances])

  const typeOptions = useMemo(() => {
    const types = new Set(
      allAppliances.map((row) => row.type).filter((value): value is string => !!value),
    )
    return [ALL, ...Array.from(types).sort()]
  }, [allAppliances])

  const clearFilters = () => {
    setStatus(ALL)
    setLifecycleState(ALL)
    setType(ALL)
    setBrand(ALL)
  }

  const hasActiveFilters =
    status !== ALL ||
    lifecycleState !== ALL ||
    type !== ALL ||
    brand !== ALL

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Appliances from the catalog (source of truth: appliances table)."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/inventory/new/set">New set</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/inventory/new">Add appliance</Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Lifecycle"
          value={lifecycleState}
          onValueChange={setLifecycleState}
          options={LIFECYCLE_OPTIONS.map((option) => ({
            value: option,
            label: option,
          }))}
        />
        <FilterSelect
          label="Type"
          value={type}
          onValueChange={setType}
          options={typeOptions.map((option) => ({
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
            ? 'Loading appliances…'
            : `Showing ${appliances.length} appliance${appliances.length === 1 ? '' : 's'}`}
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
          ariaLabel="Appliances inventory"
          data={appliances}
          getRowKey={(row) => row.id}
          emptyMessage="No appliances match the current filters."
          columns={[
            {
              id: 'image',
              header: '',
              headerClassName: 'w-14',
              cellClassName: 'w-14 overflow-visible',
              cell: (row) => (
                <ApplianceThumbnail
                  title={row.title || row.model_number || 'Appliance'}
                  imageUrl={row.primary_image_url}
                />
              ),
            },
            {
              id: 'title',
              header: 'Title',
              cell: (row) => (
                <Link
                  href={`/dashboard/inventory/${row.id}`}
                  className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  {row.title || row.model_number || 'Untitled'}
                </Link>
              ),
            },
            {
              id: 'brand',
              header: 'Brand',
              cell: (row) => row.brand || '—',
            },
            {
              id: 'type',
              header: 'Type',
              cell: (row) => row.type || '—',
            },
            {
              id: 'price',
              header: 'Price',
              cell: (row) => formatMoney(row.price),
            },
            {
              id: 'status',
              header: 'Status',
              cell: (row) => (
                <StatusBadge kind="appliance-status" value={row.status} />
              ),
            },
            {
              id: 'lifecycle',
              header: 'Lifecycle',
              cell: (row) => (
                <StatusBadge kind="lifecycle-state" value={row.lifecycle_state} />
              ),
            },
            {
              id: 'actions',
              header: '',
              cell: (row) => (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/inventory/edit/${row.id}`}>Edit</Link>
                </Button>
              ),
            },
          ]}
        />
      )}
    </div>
  )
}
