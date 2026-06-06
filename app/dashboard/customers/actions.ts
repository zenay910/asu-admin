'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { updateCustomer } from '@/lib/data/customers'
import type { CustomerAddress } from '@/lib/types/crm'
import {
  initialCustomerFormValues,
  type CustomerFormFieldErrors,
  type CustomerFormState,
  type CustomerFormValues,
} from './types'

const trackedFields = [
  'full_name',
  'email',
  'phone',
  'address_street',
  'address_city',
  'address_state',
  'address_zip',
  'notes',
] as const

function extractValues(formData: FormData): CustomerFormValues {
  const values = { ...initialCustomerFormValues }
  for (const field of trackedFields) {
    const raw = formData.get(field)
    values[field] = typeof raw === 'string' ? raw : ''
  }
  return values
}

function formValuesToAddress(
  values: CustomerFormValues,
): CustomerAddress | null {
  const street = values.address_street.trim()
  const city = values.address_city.trim()
  const state = values.address_state.trim()
  const zip = values.address_zip.trim()
  if (!street && !city && !state && !zip) return null
  return {
    ...(street ? { street } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(zip ? { zip } : {}),
  }
}

function formValuesToPayload(values: CustomerFormValues) {
  return {
    full_name: values.full_name.trim(),
    email: values.email.trim() || null,
    phone: values.phone.trim() || null,
    address: formValuesToAddress(values),
    notes: values.notes.trim() || null,
  }
}

function buildFieldErrors(message: string): CustomerFormFieldErrors {
  const fieldErrors: CustomerFormFieldErrors = {}
  const missingMatch = message.match(/Missing required field: ([a-z_]+)/i)
  if (missingMatch) {
    const field = missingMatch[1] as keyof CustomerFormFieldErrors
    if (field === 'full_name') {
      fieldErrors.full_name = 'This field is required.'
    }
  }
  if (message.toLowerCase().includes('full_name')) {
    fieldErrors.full_name = 'This field is required.'
  }
  return fieldErrors
}

function toFriendlyErrorMessage(message: string) {
  const missingMatch = message.match(/Missing required field: ([a-z_]+)/i)
  if (missingMatch?.[1] === 'full_name') {
    return 'Please enter a name before saving.'
  }
  return message
}

function validateValues(
  values: CustomerFormValues,
): CustomerFormFieldErrors | null {
  if (!values.full_name.trim()) {
    return { full_name: 'This field is required.' }
  }
  return null
}

async function customersApiFetch(
  path: string,
  init: RequestInit,
): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string; status: number }
> {
  const headerStore = await headers()
  const host = headerStore.get('host')
  if (!host) {
    return { ok: false, error: 'Could not resolve request host.', status: 500 }
  }
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const cookie = headerStore.get('cookie') ?? ''

  const response = await fetch(`${protocol}://${host}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      cookie,
      ...(init.headers as Record<string, string> | undefined),
    },
  })

  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (!response.ok) {
    const rawError =
      typeof body?.error === 'string'
        ? body.error
        : `Request failed (${response.status})`
    return { ok: false, error: rawError, status: response.status }
  }
  return { ok: true, body: body ?? {} }
}

function revalidateCustomerPaths(customerId?: string) {
  revalidatePath('/dashboard/customers')
  if (customerId) {
    revalidatePath(`/dashboard/customers/${customerId}`)
    revalidatePath(`/dashboard/customers/edit/${customerId}`)
  }
}

export async function createCustomerItem(
  _prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const values = extractValues(formData)
  const fieldErrors = validateValues(values)
  if (fieldErrors) {
    return {
      error: 'Please enter a name before saving.',
      success: null,
      customerId: null,
      values,
      fieldErrors,
    }
  }

  const result = await customersApiFetch('/api/customers', {
    method: 'POST',
    body: JSON.stringify(formValuesToPayload(values)),
  })

  if (!result.ok) {
    return {
      error: toFriendlyErrorMessage(result.error),
      success: null,
      customerId: null,
      values,
      fieldErrors: buildFieldErrors(result.error),
    }
  }

  const customerId =
    typeof result.body.customerId === 'string' ? result.body.customerId : null
  if (!customerId) {
    return {
      error: 'Customer was created but no ID was returned.',
      success: null,
      customerId: null,
      values,
      fieldErrors: {},
    }
  }

  revalidateCustomerPaths(customerId)
  return {
    error: null,
    success: 'Customer created.',
    customerId,
    values: initialCustomerFormValues,
    fieldErrors: {},
  }
}

export async function updateCustomerItem(
  _prevState: CustomerFormState,
  formData: FormData,
  customerId: string,
): Promise<CustomerFormState> {
  const values = extractValues(formData)
  const fieldErrors = validateValues(values)
  if (fieldErrors) {
    return {
      error: 'Please enter a name before saving.',
      success: null,
      customerId: null,
      values,
      fieldErrors,
    }
  }

  try {
    await updateCustomer(customerId, formValuesToPayload(values))
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to update customer'
    return {
      error: message,
      success: null,
      customerId: null,
      values,
      fieldErrors: buildFieldErrors(message),
    }
  }

  revalidateCustomerPaths(customerId)
  return {
    error: null,
    success: 'Customer updated.',
    customerId,
    values,
    fieldErrors: {},
  }
}
