'use server'

import { revalidatePath } from 'next/cache'
import { importProductFromForm } from './form_import.mjs'
import {
  initialInventoryFormValues,
  type InventoryFormFieldErrors,
  type InventoryFormState,
} from './types'

const trackedFields = [
  'title',
  'brand',
  'model_number',
  'type',
  'configuration',
  'unit_type',
  'fuel',
  'condition',
  'status',
  'price',
  'color',
  'capacity',
  'age',
  'dimensions',
  'features',
  'description_long',
] as const

function extractValues(formData: FormData) {
  const values = { ...initialInventoryFormValues }

  for (const field of trackedFields) {
    const raw = formData.get(field)
    values[field] = typeof raw === 'string' ? raw : ''
  }

  return values
}

function buildFieldErrors(message: string): InventoryFormFieldErrors {
  const fieldErrors: InventoryFormFieldErrors = {}

  const missingMatch = message.match(/Missing required field: ([a-z_]+)/i)
  if (missingMatch) {
    const field = missingMatch[1] as keyof InventoryFormFieldErrors
    fieldErrors[field] = 'This field is required.'
    return fieldErrors
  }

  const invalidRequiredMatch = message.match(/Missing or invalid required field: ([a-z_]+)/i)
  if (invalidRequiredMatch) {
    const field = invalidRequiredMatch[1] as keyof InventoryFormFieldErrors
    fieldErrors[field] = 'Enter a valid value for this required field.'
    return fieldErrors
  }

  const invalidEnumMatch = message.match(/Invalid ([a-z_]+)\s+"/i)
  if (invalidEnumMatch) {
    const field = invalidEnumMatch[1] as keyof InventoryFormFieldErrors
    fieldErrors[field] = message
  }

  return fieldErrors
}

function toFriendlyErrorMessage(message: string) {
  const missingMatch = message.match(/Missing required field: ([a-z_]+)/i)
  if (missingMatch) {
    const field = missingMatch[1]
    if (field === 'title') return 'Please enter a title before saving.'
    if (field === 'price') return 'Please enter a price before saving.'
    return 'Please fill in the required fields and try again.'
  }

  const invalidRequiredMatch = message.match(/Missing or invalid required field: ([a-z_]+)/i)
  if (invalidRequiredMatch) {
    const field = invalidRequiredMatch[1]
    if (field === 'price') return 'Please enter a valid price (0 or greater).'
    return 'One of the required fields has an invalid value. Please review and try again.'
  }

  const invalidEnumMatch = message.match(/Invalid ([a-z_]+)\s+"([^"]+)"/i)
  if (invalidEnumMatch) {
    const field = invalidEnumMatch[1].replace(/_/g, ' ')
    return `Please choose a valid ${field}.`
  }

  if (/Product insert failed:/i.test(message)) {
    return 'We could not save this inventory item. Please review your details and try again.'
  }

  return message
}

export async function createInventoryItem(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  const values = extractValues(formData)

  try {
    const { productId, uploadedImages } = await importProductFromForm(formData)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/inventory/new')

    return {
      error: null,
      success: `Inventory item created (ID: ${productId}) with ${uploadedImages} image(s).`,
      values: initialInventoryFormValues,
      fieldErrors: {},
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create inventory item.'

    return {
      error: toFriendlyErrorMessage(message),
      success: null,
      values,
      fieldErrors: buildFieldErrors(message),
    }
  }
}
