export type SetFormValues = {
  title: string
  description_long: string
  features: string
  condition: string
  status: string
  price: string
  color: string
  brand: string
}

export type SetFormFieldErrors = Partial<
  Record<keyof SetFormValues | 'members', string>
>

export type SetFormState = {
  error: string | null
  success: string | null
  createdApplianceId: string | null
  values: SetFormValues
  memberIds: string[]
  fieldErrors: SetFormFieldErrors
}

export const initialSetFormValues: SetFormValues = {
  title: '',
  description_long: '',
  features: '',
  condition: 'Good',
  status: 'Draft',
  price: '',
  color: '',
  brand: '',
}

export const initialSetFormState: SetFormState = {
  error: null,
  success: null,
  createdApplianceId: null,
  values: initialSetFormValues,
  memberIds: [],
  fieldErrors: {},
}
