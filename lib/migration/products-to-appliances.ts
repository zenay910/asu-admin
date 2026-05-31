import type { ApplianceStatus, LifecycleState } from '@/lib/types/inventory'

const CANONICAL_STATUS = new Set<ApplianceStatus>([
  'Draft',
  'Published',
  'Sold',
  'Archived',
])

const LIFECYCLE_STATES = new Set<LifecycleState>([
  'Intake',
  'Refurbishment',
  'Listed',
  'Retired',
])

const CONDITIONS = new Set(['New', 'Good', 'Fair', 'Poor'])
const CONFIGURATIONS = new Set([
  'Front Load',
  'Top Load',
  'Stacked Unit',
  'Standard',
  'Slide-In',
  'Glass Cooktop',
  'Coil Cooktop',
])
const UNIT_TYPES = new Set(['Individual', 'Set'])
const FUELS = new Set(['Electric', 'Gas', ''])

/** Live `products` row shape used for backfill (read-only source). */
export type ProductSourceRow = {
  id: string
  created_at: string
  updated_at: string | null
  title: string | null
  brand: string | null
  price: number | string | null
  model_number: string | null
  type: string | null
  configuration: string | null
  dimensions: unknown
  capacity: number | string | null
  fuel: string | null
  unit_type: string | null
  color: string | null
  features: unknown
  condition: string | null
  status: string | null
  description_long: string | null
  age: number | string | null
}

/** Mapped `appliances` insert shape (D1 dry-run / D2 backfill). */
export type MappedApplianceRow = {
  id: string
  created_at: string
  updated_at: string | null
  title: string
  brand: string
  price: number
  model_number: string
  type: string | null
  configuration: string | null
  dimensions: unknown
  capacity: number | null
  fuel: string | null
  unit_type: string | null
  color: string | null
  features: unknown
  condition: string | null
  lifecycle_state: LifecycleState
  status: ApplianceStatus | null
  description_long: string | null
  age: number | null
}

export function canonicalStatus(raw: string | null): ApplianceStatus | null {
  if (raw == null) return null
  if (raw === 'SOLD') return 'Sold'
  if (CANONICAL_STATUS.has(raw as ApplianceStatus)) {
    return raw as ApplianceStatus
  }
  return null
}

/** Deterministic initial lifecycle from canonical storefront status. */
export function deriveLifecycleState(
  status: ApplianceStatus | null,
): LifecycleState {
  switch (status) {
    case 'Published':
      return 'Listed'
    case 'Sold':
    case 'Archived':
      return 'Retired'
    case 'Draft':
      return 'Intake'
    default:
      return 'Intake'
  }
}

export function mapProductToAppliance(row: ProductSourceRow): MappedApplianceRow {
  const status = canonicalStatus(row.status)
  const lifecycle_state = deriveLifecycleState(status)

  return {
    id: row.id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    title: row.title?.trim() || '',
    brand: row.brand?.trim() || '',
    price: Number(row.price ?? 0),
    model_number: row.model_number?.trim() || '',
    type: row.type,
    configuration: row.configuration,
    dimensions: row.dimensions,
    capacity: row.capacity != null ? Number(row.capacity) : null,
    fuel: row.fuel,
    unit_type: row.unit_type,
    color: row.color,
    features: row.features,
    condition: row.condition,
    lifecycle_state,
    status,
    description_long: row.description_long,
    age: row.age != null ? Number(row.age) : null,
  }
}

/** Returns A2 CHECK violation messages (empty = insert-safe). */
export function validateMappedAppliance(row: MappedApplianceRow): string[] {
  const violations: string[] = []

  if (!LIFECYCLE_STATES.has(row.lifecycle_state)) {
    violations.push(`invalid lifecycle_state: ${row.lifecycle_state}`)
  }
  if (row.status != null && !CANONICAL_STATUS.has(row.status)) {
    violations.push(`invalid status: ${row.status}`)
  }
  if (row.condition != null && !CONDITIONS.has(row.condition)) {
    violations.push(`invalid condition: ${row.condition}`)
  }
  if (row.configuration != null && !CONFIGURATIONS.has(row.configuration)) {
    violations.push(`invalid configuration: ${row.configuration}`)
  }
  if (row.unit_type != null && !UNIT_TYPES.has(row.unit_type)) {
    violations.push(`invalid unit_type: ${row.unit_type}`)
  }
  if (row.fuel != null && !FUELS.has(row.fuel)) {
    violations.push(`invalid fuel: ${row.fuel}`)
  }
  if (row.status === 'Published' && row.lifecycle_state !== 'Listed') {
    violations.push('Published requires lifecycle_state Listed')
  }

  return violations
}

export type DryRunSummary = {
  sourceRows: number
  mappedRows: number
  violationRows: number
  lifecycleCounts: Record<LifecycleState, number>
  statusCounts: Record<string, number>
  rows: Array<{
    id: string
    title: string
    statusRaw: string | null
    status: ApplianceStatus | null
    lifecycle_state: LifecycleState
    violations: string[]
  }>
}

export function runProductsToAppliancesDryRun(
  products: ProductSourceRow[],
): DryRunSummary {
  const lifecycleCounts: Record<LifecycleState, number> = {
    Intake: 0,
    Refurbishment: 0,
    Listed: 0,
    Retired: 0,
  }
  const statusCounts: Record<string, number> = {}
  let violationRows = 0

  const rows = products.map((product) => {
    const mapped = mapProductToAppliance(product)
    const violations = validateMappedAppliance(mapped)
    if (violations.length > 0) violationRows += 1

    lifecycleCounts[mapped.lifecycle_state] += 1
    const statusKey = product.status ?? '<null>'
    statusCounts[statusKey] = (statusCounts[statusKey] ?? 0) + 1

    return {
      id: mapped.id,
      title: mapped.title,
      statusRaw: product.status,
      status: mapped.status,
      lifecycle_state: mapped.lifecycle_state,
      violations,
    }
  })

  return {
    sourceRows: products.length,
    mappedRows: rows.length,
    violationRows,
    lifecycleCounts,
    statusCounts,
    rows,
  }
}
