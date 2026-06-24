import { createAppliance } from '@/lib/data/appliances'
import { createClient } from '@/lib/supabase/server'
import type {
  Appliance,
  ApplianceSetMember,
  ApplianceSetMemberDetail,
} from '@/lib/types/inventory'

function throwOnError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
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

function mapSetMember(row: Record<string, unknown>): ApplianceSetMember {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    set_appliance_id: String(row.set_appliance_id),
    member_appliance_id: String(row.member_appliance_id),
    sort_order: Number(row.sort_order ?? 0),
  }
}

function pickPrimaryImageUrl(
  images: Array<{ photo_url: string; sort_order: number }> | null | undefined,
): string | null {
  if (!images?.length) return null
  const sorted = [...images].sort(
    (a, b) => a.sort_order - b.sort_order || 0,
  )
  return sorted[0]?.photo_url ?? null
}

function nestedAppliance(
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const nested = row.appliances
  if (nested == null) return null
  if (Array.isArray(nested)) {
    return (nested[0] as Record<string, unknown>) ?? null
  }
  return nested as Record<string, unknown>
}

export async function linkMembers(
  setApplianceId: string,
  memberApplianceIds: string[],
): Promise<ApplianceSetMember[]> {
  if (memberApplianceIds.length < 2) {
    throw new Error('Sets require at least 2 member appliances.')
  }

  const uniqueIds = [...new Set(memberApplianceIds)]
  if (uniqueIds.length !== memberApplianceIds.length) {
    throw new Error('Duplicate member appliances are not allowed in a set.')
  }

  const supabase = await createClient()

  if (memberApplianceIds.includes(setApplianceId)) {
    throw new Error('A set cannot include itself as a member.')
  }

  const { data: memberRows, error: memberError } = await supabase
    .from('appliances')
    .select('id, unit_type')
    .in('id', memberApplianceIds)

  throwOnError(memberError, 'Failed to validate set members')

  if ((memberRows ?? []).length !== memberApplianceIds.length) {
    throw new Error('One or more selected machines were not found.')
  }

  if (
    memberRows?.some(
      (row) => (row.unit_type as Appliance['unit_type']) === 'Set',
    )
  ) {
    throw new Error('Sets can only include individual appliances.')
  }

  const payload = memberApplianceIds.map((memberApplianceId, index) => ({
    set_appliance_id: setApplianceId,
    member_appliance_id: memberApplianceId,
    sort_order: index,
  }))

  const { data, error } = await supabase
    .from('appliance_set_members')
    .insert(payload)
    .select('*')

  throwOnError(error, 'Failed to link set members')
  return (data ?? []).map((row) => mapSetMember(row as Record<string, unknown>))
}

export async function getSetMembers(
  setApplianceId: string,
): Promise<ApplianceSetMemberDetail[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('appliance_set_members')
    .select(
      `
      id,
      created_at,
      set_appliance_id,
      member_appliance_id,
      sort_order,
      appliances:member_appliance_id (
        *,
        appliance_images (
          photo_url,
          sort_order
        )
      )
    `,
    )
    .eq('set_appliance_id', setApplianceId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  throwOnError(error, 'Failed to fetch set members')

  return (data ?? [])
    .map((row) => {
      const member = mapSetMember(row as Record<string, unknown>)
      const applianceRow = nestedAppliance(row as Record<string, unknown>)
      if (!applianceRow) return null

      const { appliance_images: rawImages, ...rest } = applianceRow
      const appliance = mapAppliance(rest)
      return {
        member,
        appliance,
        primary_image_url: pickPrimaryImageUrl(
          rawImages as Array<{ photo_url: string; sort_order: number }> | undefined,
        ),
      }
    })
    .filter((entry): entry is ApplianceSetMemberDetail => entry != null)
}

export async function unlinkMember(
  setApplianceId: string,
  memberApplianceId: string,
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('appliance_set_members')
    .delete()
    .eq('set_appliance_id', setApplianceId)
    .eq('member_appliance_id', memberApplianceId)

  throwOnError(error, 'Failed to unlink set member')
}

export async function unlinkAllMembers(setApplianceId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('appliance_set_members')
    .delete()
    .eq('set_appliance_id', setApplianceId)

  throwOnError(error, 'Failed to unlink all set members')
}

/** Dev-only accessor smoke test (authenticated server context required). */
export async function runApplianceSetMembersAccessorSmokeTest(): Promise<{
  setApplianceId: string
  memberCount: number
}> {
  const washer = await createAppliance({
    title: 'Set member washer smoke',
    price: 299,
    unit_type: 'Individual',
    lifecycle_state: 'Intake',
    status: 'Draft',
  })
  const dryer = await createAppliance({
    title: 'Set member dryer smoke',
    price: 299,
    unit_type: 'Individual',
    lifecycle_state: 'Intake',
    status: 'Draft',
  })
  const setAppliance = await createAppliance({
    title: 'Set members accessor smoke',
    price: 549,
    unit_type: 'Set',
    lifecycle_state: 'Intake',
    status: 'Draft',
  })

  await linkMembers(setAppliance.id, [washer.id, dryer.id])
  const members = await getSetMembers(setAppliance.id)
  if (members.length !== 2) {
    throw new Error('getSetMembers did not return expected member count')
  }

  await unlinkAllMembers(setAppliance.id)
  const afterUnlink = await getSetMembers(setAppliance.id)
  if (afterUnlink.length !== 0) {
    throw new Error('unlinkAllMembers did not remove rows')
  }

  const supabase = await createClient()
  await supabase.from('appliances').delete().eq('id', setAppliance.id)
  await supabase.from('appliances').delete().eq('id', washer.id)
  await supabase.from('appliances').delete().eq('id', dryer.id)

  return {
    setApplianceId: setAppliance.id,
    memberCount: members.length,
  }
}
