/** Matches `appliances_lifecycle_state_check` on public.appliances */
export type LifecycleState = 'Intake' | 'Refurbishment' | 'Listed' | 'Retired'

/** Matches `appliances_status_check` on public.appliances */
export type ApplianceStatus = 'Draft' | 'Published' | 'Sold' | 'Archived'

/** Matches `appliances_condition_check` on public.appliances */
export type ApplianceCondition = 'New' | 'Good' | 'Fair' | 'Poor'

/** Matches `appliances_configuration_check` on public.appliances */
export type ApplianceConfiguration =
  | 'Front Load'
  | 'Top Load'
  | 'Stacked Unit'
  | 'Standard'
  | 'Slide-In'
  | 'Glass Cooktop'
  | 'Coil Cooktop'

/** Matches `appliances_unit_type_check` on public.appliances */
export type ApplianceUnitType = 'Individual' | 'Set'

/** Matches `appliances_fuel_check` on public.appliances (includes empty string) */
export type ApplianceFuel = 'Electric' | 'Gas' | ''

/** Matches `parts_status_check` on public.parts */
export type PartStatus = 'Active' | 'Discontinued'

export type ApplianceDimensions = {
  width_in?: number
  depth_in?: number
  height_in?: number
  unit_of_measure?: string
}

/** Row shape for public.appliances */
export type Appliance = {
  id: string
  created_at: string
  updated_at: string | null
  title: string
  brand: string
  price: number
  model_number: string
  type: string | null
  configuration: ApplianceConfiguration | null
  dimensions: ApplianceDimensions | null
  capacity: number | null
  fuel: ApplianceFuel | null
  unit_type: ApplianceUnitType | null
  color: string | null
  features: string[] | null
  condition: ApplianceCondition | null
  lifecycle_state: LifecycleState
  status: ApplianceStatus | null
  description_long: string | null
  age: number | null
}

/** Row shape for public.appliance_images */
export type ApplianceImage = {
  id: string
  created_at: string
  appliance_id: string
  photo_url: string
  sort_order: number
}

/** Row shape for public.parts */
export type Part = {
  id: string
  created_at: string
  updated_at: string | null
  part_number: string
  name: string
  description: string | null
  brand: string | null
  category: string | null
  quantity_on_hand: number
  reorder_threshold: number | null
  location: string | null
  unit_cost: number | null
  unit_price: number | null
  status: PartStatus
}

/** Row shape for public.part_compatibility */
export type PartCompatibility = {
  id: string
  created_at: string
  part_id: string
  appliance_id: string
  notes: string | null
}
