import { createAppliance } from '@/lib/data/appliances'
import { createPart } from '@/lib/data/parts'
import { createClient } from '@/lib/supabase/server'
import type { Appliance, Part, PartCompatibility } from '@/lib/types/inventory'

function mapCompatibility(row: Record<string, unknown>): PartCompatibility {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    part_id: String(row.part_id),
    appliance_id: String(row.appliance_id),
    notes: row.notes != null ? String(row.notes) : null,
  }
}

function mapPart(row: Record<string, unknown>): Part {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    part_number: String(row.part_number),
    name: String(row.name),
    description: row.description != null ? String(row.description) : null,
    brand: row.brand != null ? String(row.brand) : null,
    category: row.category != null ? String(row.category) : null,
    quantity_on_hand: Number(row.quantity_on_hand),
    reorder_threshold:
      row.reorder_threshold != null ? Number(row.reorder_threshold) : null,
    location: row.location != null ? String(row.location) : null,
    unit_cost: row.unit_cost != null ? Number(row.unit_cost) : null,
    unit_price: row.unit_price != null ? Number(row.unit_price) : null,
    status: row.status as Part['status'],
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
    lifecycle_state: row.lifecycle_state as Appliance['lifecycle_state'],
    status: (row.status as Appliance['status']) ?? null,
    description_long:
      row.description_long != null ? String(row.description_long) : null,
    age: row.age != null ? Number(row.age) : null,
  }
}

function throwOnError(error: { message: string; code?: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

function nestedRow(
  row: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const nested = row[key]
  if (nested == null) return null
  if (Array.isArray(nested)) {
    const first = nested[0]
    return first != null ? (first as Record<string, unknown>) : null
  }
  return nested as Record<string, unknown>
}

export async function linkPartToAppliance(
  partId: string,
  applianceId: string,
  notes?: string | null,
): Promise<PartCompatibility> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('part_compatibility')
    .insert({
      part_id: partId,
      appliance_id: applianceId,
      notes: notes ?? null,
    })
    .select('*')
    .single()

  if (error?.code === '23505') {
    throw new Error('This part is already linked to this appliance.')
  }
  throwOnError(error, 'Failed to link part to appliance')
  return mapCompatibility(data as Record<string, unknown>)
}

export async function unlinkPart(
  partId: string,
  applianceId: string,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('part_compatibility')
    .delete()
    .eq('part_id', partId)
    .eq('appliance_id', applianceId)

  throwOnError(error, 'Failed to unlink part from appliance')
}

export async function listCompatibleParts(applianceId: string): Promise<Part[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('part_compatibility')
    .select('parts(*)')
    .eq('appliance_id', applianceId)

  throwOnError(error, 'Failed to list compatible parts')
  return (data ?? [])
    .map((row) => {
      const parts = nestedRow(row as Record<string, unknown>, 'parts')
      return parts ? mapPart(parts) : null
    })
    .filter((part): part is Part => part != null)
}

export async function listCompatibleAppliances(
  partId: string,
): Promise<Appliance[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('part_compatibility')
    .select('appliances(*)')
    .eq('part_id', partId)

  throwOnError(error, 'Failed to list compatible appliances')
  return (data ?? [])
    .map((row) => {
      const appliances = nestedRow(row as Record<string, unknown>, 'appliances')
      return appliances ? mapAppliance(appliances) : null
    })
    .filter((appliance): appliance is Appliance => appliance != null)
}

export async function runPartCompatibilityAccessorSmokeTest(): Promise<void> {
  const suffix = Date.now()
  const appliance = await createAppliance({
    title: 'C6 compat smoke',
    price: 1,
    lifecycle_state: 'Intake',
    status: 'Draft',
  })
  const part = await createPart({
    part_number: `C6-SMOKE-${suffix}`,
    name: 'C6 compat smoke part',
  })

  await linkPartToAppliance(part.id, appliance.id, 'smoke link')

  const byAppliance = await listCompatibleParts(appliance.id)
  if (!byAppliance.some((row) => row.id === part.id)) {
    throw new Error('listCompatibleParts did not return linked part')
  }

  const byPart = await listCompatibleAppliances(part.id)
  if (!byPart.some((row) => row.id === appliance.id)) {
    throw new Error('listCompatibleAppliances did not return linked appliance')
  }

  try {
    await linkPartToAppliance(part.id, appliance.id)
    throw new Error('Expected duplicate link to be rejected')
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes('already linked')
    ) {
      throw error
    }
  }

  await unlinkPart(part.id, appliance.id)

  const afterUnlink = await listCompatibleParts(appliance.id)
  if (afterUnlink.some((row) => row.id === part.id)) {
    throw new Error('unlinkPart did not remove compatibility')
  }

  const supabase = await createClient()
  await supabase.from('appliances').delete().eq('id', appliance.id)
  await supabase.from('parts').delete().eq('id', part.id)
}
