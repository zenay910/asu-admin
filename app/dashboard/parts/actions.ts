'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { friendlyPartDbError } from '@/lib/parts/parse-part-body'
import { friendlyStockAdjustmentError } from '@/lib/parts/stock-errors'
import type { PartStatus } from '@/lib/types/inventory'
import {
  initialPartFormValues,
  type PartFormFieldErrors,
  type PartFormState,
  type PartFormValues,
} from './types'

const trackedFields = [
  'part_number',
  'name',
  'description',
  'brand',
  'category',
  'location',
  'quantity_on_hand',
  'reorder_threshold',
  'unit_cost',
  'unit_price',
  'status',
] as const

function extractValues(formData: FormData): PartFormValues {
  const values = { ...initialPartFormValues }
  for (const field of trackedFields) {
    const raw = formData.get(field)
    if (field === 'status') {
      const status = typeof raw === 'string' ? raw : 'Active'
      values.status =
        status === 'Discontinued' ? 'Discontinued' : ('Active' as PartStatus)
      continue
    }
    values[field] = typeof raw === 'string' ? raw : ''
  }
  return values
}

function buildFieldErrors(message: string): PartFormFieldErrors {
  const fieldErrors: PartFormFieldErrors = {}
  if (message.includes('part number already exists')) {
    fieldErrors.part_number = message
    return fieldErrors
  }
  const missingMatch = message.match(/Missing required field: ([a-z_]+)/i)
  if (missingMatch) {
    const field = missingMatch[1] as keyof PartFormFieldErrors
    fieldErrors[field] = 'This field is required.'
  }
  return fieldErrors
}

function toFriendlyErrorMessage(message: string) {
  if (message.includes('part number already exists')) {
    return message
  }
  const missingMatch = message.match(/Missing required field: ([a-z_]+)/i)
  if (missingMatch) {
    if (missingMatch[1] === 'part_number') {
      return 'Please enter a part number before saving.'
    }
    if (missingMatch[1] === 'name') {
      return 'Please enter a name before saving.'
    }
    return 'Please fill in the required fields and try again.'
  }
  return message
}

function formValuesToCreateJson(values: PartFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    part_number: values.part_number.trim(),
    name: values.name.trim(),
    status: values.status,
  }
  if (values.description.trim()) payload.description = values.description.trim()
  if (values.brand.trim()) payload.brand = values.brand.trim()
  if (values.category.trim()) payload.category = values.category.trim()
  if (values.location.trim()) payload.location = values.location.trim()
  if (values.quantity_on_hand.trim()) {
    payload.quantity_on_hand = Number(values.quantity_on_hand)
  }
  if (values.reorder_threshold.trim()) {
    payload.reorder_threshold = Number(values.reorder_threshold)
  } else {
    payload.reorder_threshold = null
  }
  if (values.unit_cost.trim()) payload.unit_cost = Number(values.unit_cost)
  if (values.unit_price.trim()) payload.unit_price = Number(values.unit_price)
  return payload
}

function formValuesToUpdateJson(values: PartFormValues): Record<string, unknown> {
  const payload = formValuesToCreateJson(values)
  delete payload.quantity_on_hand
  return payload
}

async function partsApiFetch(
  path: string,
  init: RequestInit,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: string; status: number }> {
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

  const body = (await response.json().catch(() => null)) as Record<string, unknown> | null
  if (!response.ok) {
    const rawError =
      typeof body?.error === 'string' ? body.error : `Request failed (${response.status})`
    const message = path.includes('/stock')
      ? friendlyStockAdjustmentError(rawError)
      : friendlyPartDbError(rawError)
    return { ok: false, error: message, status: response.status }
  }
  return { ok: true, body: body ?? {} }
}

function revalidatePartPaths(partId?: string) {
  revalidatePath('/dashboard/parts')
  if (partId) {
    revalidatePath(`/dashboard/parts/${partId}`)
    revalidatePath(`/dashboard/parts/edit/${partId}`)
  }
}

export async function createPartItem(
  _prevState: PartFormState,
  formData: FormData,
): Promise<PartFormState> {
  const values = extractValues(formData)

  const result = await partsApiFetch('/api/parts', {
    method: 'POST',
    body: JSON.stringify(formValuesToCreateJson(values)),
  })

  if (!result.ok) {
    return {
      error: toFriendlyErrorMessage(result.error),
      success: null,
      partId: null,
      values,
      fieldErrors: buildFieldErrors(result.error),
    }
  }

  const partId =
    typeof result.body.partId === 'string' ? result.body.partId : null
  if (!partId) {
    return {
      error: 'Part was created but no ID was returned.',
      success: null,
      partId: null,
      values,
      fieldErrors: {},
    }
  }

  revalidatePartPaths(partId)
  return {
    error: null,
    success: 'Part created.',
    partId,
    values: initialPartFormValues,
    fieldErrors: {},
  }
}

export async function updatePartItem(
  _prevState: PartFormState,
  formData: FormData,
  partId: string,
): Promise<PartFormState> {
  const values = extractValues(formData)

  const result = await partsApiFetch(`/api/parts/${partId}`, {
    method: 'PATCH',
    body: JSON.stringify(formValuesToUpdateJson(values)),
  })

  if (!result.ok) {
    return {
      error: toFriendlyErrorMessage(result.error),
      success: null,
      partId: null,
      values,
      fieldErrors: buildFieldErrors(result.error),
    }
  }

  revalidatePartPaths(partId)
  return {
    error: null,
    success: 'Part updated.',
    partId,
    values: initialPartFormValues,
    fieldErrors: {},
  }
}

export async function adjustPartStock(
  partId: string,
  delta: number,
  reason: string,
): Promise<
  | { ok: true; quantityOnHand: number; movementId: string }
  | { ok: false; error: string }
> {
  const result = await partsApiFetch(`/api/parts/${partId}/stock`, {
    method: 'POST',
    body: JSON.stringify({
      delta,
      reason: reason.trim() || null,
    }),
  })

  if (!result.ok) {
    return { ok: false, error: result.error }
  }

  const quantityOnHand = Number(result.body.quantityOnHand)
  const movementId =
    typeof result.body.movementId === 'string' ? result.body.movementId : ''

  revalidatePartPaths(partId)

  return {
    ok: true,
    quantityOnHand,
    movementId,
  }
}

