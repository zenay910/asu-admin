import { createClient } from '@/lib/supabase/server'
import type {
  Appliance,
  ApplianceCondition,
  ApplianceConfiguration,
  ApplianceDetail,
  ApplianceDimensions,
  ApplianceFuel,
  ApplianceImage,
  ApplianceStateHistory,
  ApplianceStatus,
  ApplianceUnitType,
  LifecycleState,
} from '@/lib/types/inventory'

export type ApplianceListFilters = {
  status?: ApplianceStatus
  lifecycle_state?: LifecycleState
  brand?: string
  type?: string
  limit?: number
}

export type CreateApplianceInput = {
  title: string
  price: number
  brand?: string
  model_number?: string
  type?: string | null
  configuration?: ApplianceConfiguration | null
  dimensions?: ApplianceDimensions | null
  capacity?: number | null
  fuel?: ApplianceFuel | null
  unit_type?: ApplianceUnitType | null
  color?: string | null
  features?: string[] | null
  condition?: ApplianceCondition | null
  lifecycle_state?: LifecycleState
  status?: ApplianceStatus | null
  description_long?: string | null
  age?: number | null
}

export type UpdateApplianceInput = Partial<CreateApplianceInput>

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

function throwOnError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

export async function listAppliances(
  filters: ApplianceListFilters = {},
): Promise<Appliance[]> {
  const supabase = await createClient()
  let query = supabase
    .from('appliances')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.lifecycle_state) {
    query = query.eq('lifecycle_state', filters.lifecycle_state)
  }
  if (filters.brand) {
    query = query.eq('brand', filters.brand)
  }
  if (filters.type) {
    query = query.eq('type', filters.type)
  }
  if (filters.limit != null) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  throwOnError(error, 'Failed to list appliances')
  return (data ?? []).map((row) => mapAppliance(row as Record<string, unknown>))
}

export async function getApplianceById(id: string): Promise<Appliance | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appliances')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  throwOnError(error, 'Failed to fetch appliance')
  if (!data) return null
  return mapAppliance(data as Record<string, unknown>)
}

function mapApplianceImage(row: Record<string, unknown>): ApplianceImage {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    appliance_id: String(row.appliance_id),
    photo_url: String(row.photo_url),
    sort_order: Number(row.sort_order ?? 0),
  }
}

function mapApplianceStateHistory(
  row: Record<string, unknown>,
): ApplianceStateHistory {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    appliance_id: String(row.appliance_id),
    from_state: (row.from_state as LifecycleState | null) ?? null,
    to_state: row.to_state as LifecycleState,
    changed_by: row.changed_by != null ? String(row.changed_by) : null,
    reason: row.reason != null ? String(row.reason) : null,
  }
}

export async function getApplianceDetailById(
  id: string,
): Promise<ApplianceDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appliances')
    .select(
      `
      *,
      appliance_images (
        id,
        created_at,
        appliance_id,
        photo_url,
        sort_order
      ),
      appliance_state_history (
        id,
        created_at,
        appliance_id,
        from_state,
        to_state,
        changed_by,
        reason
      )
    `,
    )
    .eq('id', id)
    .maybeSingle()

  throwOnError(error, 'Failed to fetch appliance detail')
  if (!data) return null

  const row = data as Record<string, unknown>
  const rawImages = (row.appliance_images as Record<string, unknown>[]) ?? []
  const rawHistory =
    (row.appliance_state_history as Record<string, unknown>[]) ?? []

  const images = rawImages
    .map((image) => mapApplianceImage(image))
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))

  const stateHistory = rawHistory
    .map((entry) => mapApplianceStateHistory(entry))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  return {
    appliance: mapAppliance(
      Object.fromEntries(
        Object.entries(row).filter(
          ([key]) =>
            key !== 'appliance_images' && key !== 'appliance_state_history',
        ),
      ) as Record<string, unknown>,
    ),
    images,
    stateHistory,
  }
}

export async function createAppliance(
  input: CreateApplianceInput,
): Promise<Appliance> {
  const supabase = await createClient()
  const payload = {
    title: input.title,
    brand: input.brand ?? '',
    price: input.price,
    model_number: input.model_number ?? '',
    type: input.type ?? null,
    configuration: input.configuration ?? null,
    dimensions: input.dimensions ?? null,
    capacity: input.capacity ?? null,
    fuel: input.fuel ?? null,
    unit_type: input.unit_type ?? null,
    color: input.color ?? null,
    features: input.features ?? null,
    condition: input.condition ?? null,
    lifecycle_state: input.lifecycle_state ?? 'Intake',
    status: input.status ?? null,
    description_long: input.description_long ?? null,
    age: input.age ?? null,
  }

  const { data, error } = await supabase
    .from('appliances')
    .insert(payload)
    .select('*')
    .single()

  throwOnError(error, 'Failed to create appliance')
  return mapAppliance(data as Record<string, unknown>)
}

export async function updateAppliance(
  id: string,
  input: UpdateApplianceInput,
): Promise<Appliance> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appliances')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  throwOnError(error, 'Failed to update appliance')
  return mapAppliance(data as Record<string, unknown>)
}

/** Dev-only accessor smoke test (authenticated server context required). */
export async function runApplianceAccessorSmokeTest(): Promise<{
  createdId: string
  listCount: number
  updatedTitle: string
}> {
  const created = await createAppliance({
    title: 'C3 accessor smoke',
    price: 99,
    lifecycle_state: 'Intake',
    status: 'Draft',
  })

  const fetched = await getApplianceById(created.id)
  if (!fetched || fetched.title !== created.title) {
    throw new Error('getApplianceById round-trip failed')
  }

  const listed = await listAppliances({ lifecycle_state: 'Intake' })
  if (!listed.some((row) => row.id === created.id)) {
    throw new Error('listAppliances filter did not return created row')
  }

  const updated = await updateAppliance(created.id, {
    title: 'C3 accessor smoke updated',
  })

  const supabase = await createClient()
  const { error: deleteError } = await supabase
    .from('appliances')
    .delete()
    .eq('id', created.id)
  throwOnError(deleteError, 'Failed to clean up smoke-test row')

  return {
    createdId: created.id,
    listCount: listed.length,
    updatedTitle: updated.title,
  }
}
