import { createClient } from '@/lib/supabase/server'
import { createAppliance } from '@/lib/data/appliances'
import { getBayById, listBays } from '@/lib/data/bays'
import type {
  MachineType,
  Refurbishment,
  RefurbishmentPart,
  RefurbishmentStatus,
} from '@/lib/types/refurbishment'

export type CreateRefurbishmentInput = {
  appliance_id: string
  bay_id?: string | null
  status?: RefurbishmentStatus
  source?: string | null
  cost?: number | null
  initial_symptoms?: string | null
  error_codes?: string | null
  work_needed?: string | null
  cleaning_status?: string | null
  test_mode_used?: string | null
  final_results?: string | null
}

export type UpdateRefurbishmentFieldsInput = Partial<
  Omit<CreateRefurbishmentInput, 'appliance_id'>
>

export type RefurbishmentApplianceSummary = {
  refurbishment: Refurbishment
  appliance: {
    id: string
    title: string
    brand: string
    model_number: string
    type: string | null
  }
}

export type RefurbishmentPartLine = RefurbishmentPart & {
  part_number: string
  part_name: string
}

function mapRefurbishment(row: Record<string, unknown>): Refurbishment {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    appliance_id: String(row.appliance_id),
    bay_id: row.bay_id != null ? String(row.bay_id) : null,
    status: row.status as RefurbishmentStatus,
    source: row.source != null ? String(row.source) : null,
    cost: row.cost != null ? Number(row.cost) : null,
    initial_symptoms:
      row.initial_symptoms != null ? String(row.initial_symptoms) : null,
    error_codes: row.error_codes != null ? String(row.error_codes) : null,
    work_needed: row.work_needed != null ? String(row.work_needed) : null,
    cleaning_status:
      row.cleaning_status != null ? String(row.cleaning_status) : null,
    test_mode_used:
      row.test_mode_used != null ? String(row.test_mode_used) : null,
    final_results: row.final_results != null ? String(row.final_results) : null,
  }
}

function throwOnError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

function nestedApplianceRow(
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const nested = row.appliances
  if (nested == null) return null
  if (Array.isArray(nested)) {
    const first = nested[0]
    return first != null ? (first as Record<string, unknown>) : null
  }
  return nested as Record<string, unknown>
}

function mapRefurbishmentApplianceSummary(
  row: Record<string, unknown>,
): RefurbishmentApplianceSummary | null {
  const applianceRow = nestedApplianceRow(row)
  if (!applianceRow) return null

  const refurbishment = mapRefurbishment(
    Object.fromEntries(
      Object.entries(row).filter(([key]) => key !== 'appliances'),
    ) as Record<string, unknown>,
  )

  return {
    refurbishment,
    appliance: {
      id: String(applianceRow.id),
      title: String(applianceRow.title),
      brand: String(applianceRow.brand),
      model_number: String(applianceRow.model_number),
      type: applianceRow.type != null ? String(applianceRow.type) : null,
    },
  }
}

export async function listStagingRefurbishmentsWithAppliances(): Promise<
  RefurbishmentApplianceSummary[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('refurbishments')
    .select(
      `
      *,
      appliances (
        id,
        title,
        brand,
        model_number,
        type
      )
    `,
    )
    .eq('status', 'staging')
    .is('bay_id', null)
    .order('created_at', { ascending: false })

  throwOnError(error, 'Failed to list staging refurbishments')
  return (data ?? [])
    .map((row) =>
      mapRefurbishmentApplianceSummary(row as Record<string, unknown>),
    )
    .filter((row): row is RefurbishmentApplianceSummary => row != null)
}

export async function listStagingRefurbishmentsByMachineType(
  machineType: MachineType,
): Promise<RefurbishmentApplianceSummary[]> {
  const staging = await listStagingRefurbishmentsWithAppliances()
  return staging.filter(
    (row) => row.appliance.type === machineType,
  )
}

export async function listActiveBayAssignmentsWithAppliances(): Promise<
  RefurbishmentApplianceSummary[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('refurbishments')
    .select(
      `
      *,
      appliances (
        id,
        title,
        brand,
        model_number,
        type
      )
    `,
    )
    .not('bay_id', 'is', null)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })

  throwOnError(error, 'Failed to list active bay assignments')
  return (data ?? [])
    .map((row) =>
      mapRefurbishmentApplianceSummary(row as Record<string, unknown>),
    )
    .filter((row): row is RefurbishmentApplianceSummary => row != null)
}

function mapRefurbishmentPart(row: Record<string, unknown>): RefurbishmentPart {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    refurbishment_id: String(row.refurbishment_id),
    part_id: String(row.part_id),
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
  }
}

function nestedPartCatalogRow(
  row: Record<string, unknown>,
): Record<string, unknown> | null {
  const nested = row.parts
  if (nested == null) return null
  if (Array.isArray(nested)) {
    const first = nested[0]
    return first != null ? (first as Record<string, unknown>) : null
  }
  return nested as Record<string, unknown>
}

function mapRefurbishmentPartLine(
  row: Record<string, unknown>,
): RefurbishmentPartLine | null {
  const part = mapRefurbishmentPart(row)
  const partRow = nestedPartCatalogRow(row)
  if (!partRow) return null
  return {
    ...part,
    part_number: String(partRow.part_number),
    part_name: String(partRow.name),
  }
}

export async function listRefurbishmentParts(
  refurbishmentId: string,
): Promise<RefurbishmentPartLine[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('refurbishment_parts')
    .select(
      `
      id,
      created_at,
      refurbishment_id,
      part_id,
      quantity,
      unit_price,
      parts (
        part_number,
        name
      )
    `,
    )
    .eq('refurbishment_id', refurbishmentId)
    .order('created_at', { ascending: true })

  throwOnError(error, 'Failed to list refurbishment parts')
  return (data ?? [])
    .map((row) => mapRefurbishmentPartLine(row as Record<string, unknown>))
    .filter((row): row is RefurbishmentPartLine => row != null)
}

export async function createRefurbishment(
  input: CreateRefurbishmentInput,
): Promise<Refurbishment> {
  const supabase = await createClient()
  const payload = {
    appliance_id: input.appliance_id,
    bay_id: input.bay_id ?? null,
    status: input.status ?? 'staging',
    source: input.source ?? null,
    cost: input.cost ?? null,
    initial_symptoms: input.initial_symptoms ?? null,
    error_codes: input.error_codes ?? null,
    work_needed: input.work_needed ?? null,
    cleaning_status: input.cleaning_status ?? null,
    test_mode_used: input.test_mode_used ?? null,
    final_results: input.final_results ?? null,
  }

  const { data, error } = await supabase
    .from('refurbishments')
    .insert(payload)
    .select('*')
    .single()

  throwOnError(error, 'Failed to create refurbishment')
  return mapRefurbishment(data as Record<string, unknown>)
}

export async function getRefurbishmentById(
  id: string,
): Promise<Refurbishment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('refurbishments')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  throwOnError(error, 'Failed to fetch refurbishment')
  if (!data) return null
  return mapRefurbishment(data as Record<string, unknown>)
}

export async function getRefurbishmentByAppliance(
  applianceId: string,
): Promise<Refurbishment | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('refurbishments')
    .select('*')
    .eq('appliance_id', applianceId)
    .maybeSingle()

  throwOnError(error, 'Failed to fetch refurbishment by appliance')
  if (!data) return null
  return mapRefurbishment(data as Record<string, unknown>)
}

export async function listRefurbishmentsByStatus(
  status: RefurbishmentStatus,
): Promise<Refurbishment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('refurbishments')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })

  throwOnError(error, 'Failed to list refurbishments by status')
  return (data ?? []).map((row) => mapRefurbishment(row as Record<string, unknown>))
}

export async function listActiveBayAssignments(): Promise<Refurbishment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('refurbishments')
    .select('*')
    .not('bay_id', 'is', null)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })

  throwOnError(error, 'Failed to list active bay assignments')
  return (data ?? []).map((row) => mapRefurbishment(row as Record<string, unknown>))
}

export async function updateRefurbishmentFields(
  id: string,
  input: UpdateRefurbishmentFieldsInput,
): Promise<Refurbishment> {
  const current = await getRefurbishmentById(id)
  if (!current) {
    throw new Error('Refurbishment not found')
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('refurbishments')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  throwOnError(error, 'Failed to update refurbishment')
  return mapRefurbishment(data as Record<string, unknown>)
}

/** Dev-only accessor smoke test (authenticated server context required). */
export async function runRefurbishmentsAccessorSmokeTest(): Promise<{
  refurbishmentId: string
  applianceId: string
}> {
  const appliance = await createAppliance({
    title: 'Active bay accessor smoke',
    price: 0,
    type: 'Dryer',
    lifecycle_state: 'Refurbishment',
    status: 'Draft',
  })

  const created = await createRefurbishment({
    appliance_id: appliance.id,
    source: 'Smoke test',
    cost: 50,
  })

  const fetched = await getRefurbishmentById(created.id)
  if (
    !fetched ||
    fetched.appliance_id !== appliance.id ||
    fetched.source !== 'Smoke test'
  ) {
    throw new Error('getRefurbishmentById round-trip failed')
  }

  const byAppliance = await getRefurbishmentByAppliance(appliance.id)
  if (!byAppliance || byAppliance.id !== created.id) {
    throw new Error('getRefurbishmentByAppliance round-trip failed')
  }

  const stagingList = await listRefurbishmentsByStatus('staging')
  if (!stagingList.some((row) => row.id === created.id)) {
    throw new Error('listRefurbishmentsByStatus did not return smoke row')
  }

  const bays = await listBays()
  const dryerBay = bays.find(
    (bay) => bay.machine_type === 'Dryer' && bay.position === 2,
  )
  if (!dryerBay) {
    throw new Error('Smoke test requires Dryer Bay 2')
  }

  const assigned = await updateRefurbishmentFields(created.id, {
    bay_id: dryerBay.id,
    status: 'diagnostic',
    initial_symptoms: 'Smoke symptom',
  })
  if (
    assigned.bay_id !== dryerBay.id ||
    assigned.status !== 'diagnostic' ||
    assigned.initial_symptoms !== 'Smoke symptom'
  ) {
    throw new Error('updateRefurbishmentFields failed')
  }

  const activeAssignments = await listActiveBayAssignments()
  if (!activeAssignments.some((row) => row.id === created.id)) {
    throw new Error('listActiveBayAssignments did not return smoke row')
  }

  const bay = await getBayById(dryerBay.id)
  if (!bay || bay.machine_type !== 'Dryer') {
    throw new Error('getBayById round-trip failed')
  }

  const supabase = await createClient()
  const { error: deleteApplianceError } = await supabase
    .from('appliances')
    .delete()
    .eq('id', appliance.id)
  throwOnError(deleteApplianceError, 'Failed to clean up smoke appliance')

  return {
    refurbishmentId: created.id,
    applianceId: appliance.id,
  }
}
