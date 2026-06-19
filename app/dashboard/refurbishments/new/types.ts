export type RefurbishmentIntakeFormValues = {
  source: string
  cost: string
  model_number: string
  title: string
  brand: string
  type: string
  configuration: string
  fuel: string
  capacity: string
  age: string
  dimensions: string
  features: string
  description_long: string
  color: string
}

export type RefurbishmentIntakeFieldErrors = Partial<
  Record<keyof RefurbishmentIntakeFormValues, string>
>

export type RefurbishmentIntakeFormState = {
  error: string | null
  success: string | null
  createdApplianceId: string | null
  createdRefurbishmentId: string | null
  values: RefurbishmentIntakeFormValues
  fieldErrors: RefurbishmentIntakeFieldErrors
}

export const initialRefurbishmentIntakeFormValues: RefurbishmentIntakeFormValues =
  {
    source: '',
    cost: '',
    model_number: '',
    title: '',
    brand: '',
    type: '',
    configuration: '',
    fuel: '',
    capacity: '',
    age: '',
    dimensions: '',
    features: '',
    description_long: '',
    color: '',
  }

export const initialRefurbishmentIntakeFormState: RefurbishmentIntakeFormState =
  {
    error: null,
    success: null,
    createdApplianceId: null,
    createdRefurbishmentId: null,
    values: initialRefurbishmentIntakeFormValues,
    fieldErrors: {},
  }
