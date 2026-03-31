export type InventoryFormValues = {
  title: string
  brand: string
  model_number: string
  type: string
  configuration: string
  unit_type: string
  fuel: string
  condition: string
  status: string
  price: string
  color: string
  capacity: string
  age: string
  dimensions: string
  features: string
  description_long: string
}

export type InventoryFormFieldErrors = Partial<Record<keyof InventoryFormValues, string>>

export type InventoryFormState = {
  error: string | null
  success: string | null
  values: InventoryFormValues
  fieldErrors: InventoryFormFieldErrors
}

export const initialInventoryFormValues: InventoryFormValues = {
  title: '',
  brand: '',
  model_number: '',
  type: '',
  configuration: '',
  unit_type: '',
  fuel: '',
  condition: 'Good',
  status: 'Draft',
  price: '',
  color: '',
  capacity: '',
  age: '',
  dimensions: '',
  features: '',
  description_long: '',
}

export const initialInventoryFormState: InventoryFormState = {
  error: null,
  success: null,
  values: initialInventoryFormValues,
  fieldErrors: {},
}
