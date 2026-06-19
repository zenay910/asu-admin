/** Matches `refurbishments_status_check` on public.refurbishments */
export type RefurbishmentStatus =
  | 'staging'
  | 'diagnostic'
  | 'repair'
  | 'testing'
  | 'completed'

/** Matches `bays_machine_type_check` on public.bays */
export type MachineType = 'Dryer' | 'Washer'

/** Row shape for public.bays */
export type Bay = {
  id: string
  created_at: string
  name: string
  machine_type: MachineType
  position: number
}

/** Row shape for public.refurbishments */
export type Refurbishment = {
  id: string
  created_at: string
  updated_at: string | null
  appliance_id: string
  bay_id: string | null
  status: RefurbishmentStatus
  source: string | null
  cost: number | null
  initial_symptoms: string | null
  error_codes: string | null
  work_needed: string | null
  cleaning_status: string | null
  test_mode_used: string | null
  final_results: string | null
}

/** Row shape for public.refurbishment_parts */
export type RefurbishmentPart = {
  id: string
  created_at: string
  refurbishment_id: string
  part_id: string
  quantity: number
  unit_price: number
}
