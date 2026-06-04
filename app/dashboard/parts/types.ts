import type { PartStatus } from '@/lib/types/inventory'

export type PartFormValues = {
  part_number: string
  name: string
  description: string
  brand: string
  category: string
  location: string
  quantity_on_hand: string
  reorder_threshold: string
  unit_cost: string
  unit_price: string
  status: PartStatus
}

export type PartFormFieldErrors = Partial<Record<keyof PartFormValues, string>>

export type PartFormState = {
  error: string | null
  success: string | null
  partId: string | null
  values: PartFormValues
  fieldErrors: PartFormFieldErrors
}

export const initialPartFormValues: PartFormValues = {
  part_number: '',
  name: '',
  description: '',
  brand: '',
  category: '',
  location: '',
  quantity_on_hand: '0',
  reorder_threshold: '',
  unit_cost: '',
  unit_price: '',
  status: 'Active',
}

export const initialPartFormState: PartFormState = {
  error: null,
  success: null,
  partId: null,
  values: initialPartFormValues,
  fieldErrors: {},
}
