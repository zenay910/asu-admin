export type CustomerFormValues = {
  full_name: string
  email: string
  phone: string
  address_street: string
  address_city: string
  address_state: string
  address_zip: string
  notes: string
}

export type CustomerFormFieldErrors = Partial<
  Record<keyof CustomerFormValues, string>
>

export type CustomerFormState = {
  error: string | null
  success: string | null
  customerId: string | null
  values: CustomerFormValues
  fieldErrors: CustomerFormFieldErrors
}

export const initialCustomerFormValues: CustomerFormValues = {
  full_name: '',
  email: '',
  phone: '',
  address_street: '',
  address_city: '',
  address_state: '',
  address_zip: '',
  notes: '',
}

export const initialCustomerFormState: CustomerFormState = {
  error: null,
  success: null,
  customerId: null,
  values: initialCustomerFormValues,
  fieldErrors: {},
}
