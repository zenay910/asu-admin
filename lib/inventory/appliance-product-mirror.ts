import { canonicalStatus } from '@/lib/migration/products-to-appliances'
import type {
  Appliance,
  ApplianceCondition,
  ApplianceConfiguration,
  ApplianceFuel,
  ApplianceStatus,
  ApplianceUnitType,
  LifecycleState,
} from '@/lib/types/inventory'
import type { CreateApplianceInput } from '@/lib/data/appliances'

/** Product row fields mirrored from an appliance (legacy storefront table). */
export type ProductMirrorPayload = {
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
  age: number | null
  features: unknown
  condition: string | null
  status: string
  description_long: string | null
  updated_at: string
}

/** Payload shape from `buildProductPayload` in form_import.mjs */
export type InventoryFormProductPayload = {
  title: string
  brand: string | null
  price: number
  model_number: string | null
  type: string | null
  configuration: string | null
  dimensions: unknown
  capacity: number | null
  fuel: string | null
  unit_type: string | null
  color: string | null
  age: number | null
  features: unknown
  condition: string | null
  status: string | null
  description_long: string | null
  updated_at: string
}

/**
 * Storefront `products.status`: Published only when appliance is Listed + Published.
 */
export function mirrorProductStatus(
  lifecycleState: LifecycleState,
  applianceStatus: ApplianceStatus | null,
): string {
  if (lifecycleState === 'Listed' && applianceStatus === 'Published') {
    return 'Published'
  }
  if (applianceStatus === 'Sold') return 'Sold'
  if (applianceStatus === 'Archived') return 'Archived'
  return 'Draft'
}

/** Appliance `status` from form value, enforcing Published ⇔ Listed. */
export function resolveApplianceStatus(
  lifecycleState: LifecycleState,
  formStatus: string | null,
): ApplianceStatus | null {
  const canonical = canonicalStatus(formStatus)
  if (canonical === 'Published' && lifecycleState !== 'Listed') {
    return 'Draft'
  }
  return canonical ?? 'Draft'
}

export function inventoryPayloadToApplianceInput(
  payload: InventoryFormProductPayload,
  options: {
    lifecycle_state: LifecycleState
    status: ApplianceStatus | null
  },
): CreateApplianceInput {
  return {
    title: payload.title,
    brand: payload.brand ?? '',
    price: payload.price,
    model_number: payload.model_number ?? '',
    type: payload.type,
    configuration: (payload.configuration as ApplianceConfiguration) ?? null,
    dimensions: payload.dimensions as CreateApplianceInput['dimensions'],
    capacity: payload.capacity,
    fuel: (payload.fuel as ApplianceFuel) ?? null,
    unit_type: (payload.unit_type as ApplianceUnitType) ?? 'Individual',
    color: payload.color,
    features: payload.features as CreateApplianceInput['features'],
    condition: (payload.condition as ApplianceCondition) ?? 'Good',
    lifecycle_state: options.lifecycle_state,
    status: options.status,
    description_long: payload.description_long,
    age: payload.age,
  }
}

export function applianceToProductMirrorPayload(
  appliance: Appliance,
): ProductMirrorPayload {
  return {
    title: appliance.title,
    brand: appliance.brand,
    price: appliance.price,
    model_number: appliance.model_number,
    type: appliance.type,
    configuration: appliance.configuration,
    dimensions: appliance.dimensions,
    capacity: appliance.capacity,
    fuel: appliance.fuel,
    unit_type: appliance.unit_type,
    color: appliance.color,
    age: appliance.age,
    features: appliance.features,
    condition: appliance.condition,
    status: mirrorProductStatus(appliance.lifecycle_state, appliance.status),
    description_long: appliance.description_long,
    updated_at: new Date().toISOString(),
  }
}
