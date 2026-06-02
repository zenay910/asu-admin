'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  Appliance,
  ApplianceStatus,
  LifecycleState,
} from '@/lib/types/inventory'

export type ApplianceListFilters = {
  status?: ApplianceStatus
  lifecycle_state?: LifecycleState
  brand?: string
  type?: string
  limit?: number
}

export type ApplianceListRow = Appliance & {
  /** First image by `sort_order`, for list thumbnails. */
  primary_image_url: string | null
}

export type UseAppliancesResult = {
  appliances: ApplianceListRow[]
  loading: boolean
  error: string | null
  refetch: () => void
}

type ApplianceImageRow = {
  photo_url: string
  sort_order: number
}

function pickPrimaryImageUrl(
  images: ApplianceImageRow[] | null | undefined,
): string | null {
  if (!images?.length) return null
  const sorted = [...images].sort(
    (a, b) => a.sort_order - b.sort_order || 0,
  )
  return sorted[0]?.photo_url ?? null
}

function mapApplianceListRow(row: Record<string, unknown>): ApplianceListRow {
  const { appliance_images: rawImages, ...rest } = row
  const appliance = mapAppliance(rest)
  return {
    ...appliance,
    primary_image_url: pickPrimaryImageUrl(
      rawImages as ApplianceImageRow[] | undefined,
    ),
  }
}

function mapAppliance(row: Record<string, unknown>): Appliance {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    title: String(row.title),
    brand: String(row.brand),
    price: Number(row.price),
    model_number: String(row.model_number),
    type: row.type != null ? String(row.type) : null,
    configuration: (row.configuration as Appliance['configuration']) ?? null,
    dimensions: (row.dimensions as Appliance['dimensions']) ?? null,
    capacity: row.capacity != null ? Number(row.capacity) : null,
    fuel: (row.fuel as Appliance['fuel']) ?? null,
    unit_type: (row.unit_type as Appliance['unit_type']) ?? null,
    color: row.color != null ? String(row.color) : null,
    features: (row.features as Appliance['features']) ?? null,
    condition: (row.condition as Appliance['condition']) ?? null,
    lifecycle_state: row.lifecycle_state as LifecycleState,
    status: (row.status as Appliance['status']) ?? null,
    description_long:
      row.description_long != null ? String(row.description_long) : null,
    age: row.age != null ? Number(row.age) : null,
  }
}

export function useAppliances(
  filters: ApplianceListFilters = {},
): UseAppliancesResult {
  const [appliances, setAppliances] = useState<ApplianceListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const filterKey = JSON.stringify(filters)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      let query = supabase
        .from('appliances')
        .select(
          `
          *,
          appliance_images (
            photo_url,
            sort_order
          )
        `,
        )
        .order('created_at', { ascending: false })

      const parsed = JSON.parse(filterKey) as ApplianceListFilters
      if (parsed.status) query = query.eq('status', parsed.status)
      if (parsed.lifecycle_state) {
        query = query.eq('lifecycle_state', parsed.lifecycle_state)
      }
      if (parsed.brand) query = query.eq('brand', parsed.brand)
      if (parsed.type) query = query.eq('type', parsed.type)
      if (parsed.limit != null) query = query.limit(parsed.limit)

      const { data, error: fetchError } = await query
      if (fetchError) {
        setAppliances([])
        setError(fetchError.message)
        return
      }

      setAppliances(
        (data ?? []).map((row) =>
          mapApplianceListRow(row as Record<string, unknown>),
        ),
      )
    } catch (err) {
      setAppliances([])
      setError(err instanceof Error ? err.message : 'Failed to load appliances')
    } finally {
      setLoading(false)
    }
  }, [filterKey])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { appliances, loading, error, refetch }
}
