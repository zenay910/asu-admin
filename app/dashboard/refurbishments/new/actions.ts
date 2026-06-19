'use server'

import { revalidatePath } from 'next/cache'
import { createRefurbishment } from '@/lib/data/refurbishments'
import { createApplianceDualWrite } from '@/lib/inventory/appliance-dual-write'
import { createClient } from '@/lib/supabase/server'
import {
  initialRefurbishmentIntakeFormValues,
  type RefurbishmentIntakeFieldErrors,
  type RefurbishmentIntakeFormState,
} from './types'

const trackedFields = [
  'source',
  'cost',
  'model_number',
  'title',
  'brand',
  'type',
  'configuration',
  'fuel',
  'capacity',
  'age',
  'dimensions',
  'features',
  'description_long',
  'color',
] as const

function extractValues(formData: FormData) {
  const values = { ...initialRefurbishmentIntakeFormValues }

  for (const field of trackedFields) {
    const raw = formData.get(field)
    values[field] = typeof raw === 'string' ? raw : ''
  }

  return values
}

function parseCost(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed.replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function buildFieldErrors(message: string): RefurbishmentIntakeFieldErrors {
  const fieldErrors: RefurbishmentIntakeFieldErrors = {}

  const missingMatch = message.match(/Missing required field: ([a-z_]+)/i)
  if (missingMatch) {
    const field = missingMatch[1] as keyof RefurbishmentIntakeFieldErrors
    fieldErrors[field] = 'This field is required.'
    return fieldErrors
  }

  const invalidRequiredMatch = message.match(
    /Missing or invalid required field: ([a-z_]+)/i,
  )
  if (invalidRequiredMatch) {
    const field = invalidRequiredMatch[1] as keyof RefurbishmentIntakeFieldErrors
    fieldErrors[field] = 'Enter a valid value for this required field.'
    return fieldErrors
  }

  const invalidEnumMatch = message.match(/Invalid ([a-z_]+)\s+"/i)
  if (invalidEnumMatch) {
    const field = invalidEnumMatch[1] as keyof RefurbishmentIntakeFieldErrors
    fieldErrors[field] = message
  }

  return fieldErrors
}

function toFriendlyErrorMessage(message: string) {
  const missingMatch = message.match(/Missing required field: ([a-z_]+)/i)
  if (missingMatch) {
    const field = missingMatch[1]
    if (field === 'title') {
      return 'Please enter a title or extract specs before saving.'
    }
    return 'Please fill in the required fields and try again.'
  }

  const invalidRequiredMatch = message.match(
    /Missing or invalid required field: ([a-z_]+)/i,
  )
  if (invalidRequiredMatch) {
    return 'One of the required fields has an invalid value. Please review and try again.'
  }

  const invalidEnumMatch = message.match(/Invalid ([a-z_]+)\s+"([^"]+)"/i)
  if (invalidEnumMatch) {
    const field = invalidEnumMatch[1].replace(/_/g, ' ')
    return `Please choose a valid ${field}.`
  }

  if (
    /Product (insert|update|mirror) failed:/i.test(message) ||
    /Appliance/i.test(message) ||
    /refurbishment/i.test(message)
  ) {
    return 'We could not save this refurbishment intake. Please review your details and try again.'
  }

  return message
}

function ensureTitle(formData: FormData): void {
  const title = formData.get('title')
  if (typeof title === 'string' && title.trim()) return

  const brand = String(formData.get('brand') ?? '').trim()
  const modelNumber = String(formData.get('model_number') ?? '').trim()
  const fallback = [brand, modelNumber].filter(Boolean).join(' ').trim()
  formData.set('title', fallback || 'Refurbishment unit')
}

export async function createRefurbishmentIntake(
  _prevState: RefurbishmentIntakeFormState,
  formData: FormData,
): Promise<RefurbishmentIntakeFormState> {
  const values = extractValues(formData)

  formData.set('price', '0')
  formData.set('status', 'Draft')
  formData.set('condition', 'Good')
  formData.set('unit_type', 'Individual')
  ensureTitle(formData)

  let applianceId: string | null = null

  try {
    const { applianceId: createdApplianceId } = await createApplianceDualWrite(
      formData,
      { lifecycle_state: 'Refurbishment' },
    )
    applianceId = createdApplianceId

    const refurbishment = await createRefurbishment({
      appliance_id: createdApplianceId,
      status: 'staging',
      source: values.source.trim() || null,
      cost: parseCost(values.cost),
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/refurbishments')

    return {
      error: null,
      success: 'Refurbishment intake saved. Unit is in staging.',
      createdApplianceId,
      createdRefurbishmentId: refurbishment.id,
      values: initialRefurbishmentIntakeFormValues,
      fieldErrors: {},
    }
  } catch (error) {
    if (applianceId) {
      const supabase = await createClient()
      await supabase.from('appliances').delete().eq('id', applianceId)
    }

    const message =
      error instanceof Error
        ? error.message
        : 'Failed to create refurbishment intake.'

    return {
      error: toFriendlyErrorMessage(message),
      success: null,
      createdApplianceId: null,
      createdRefurbishmentId: null,
      values,
      fieldErrors: buildFieldErrors(message),
    }
  }
}
