'use server'

import { revalidatePath } from 'next/cache'
import { linkMembers, unlinkAllMembers } from '@/lib/data/appliance-set-members'
import { createApplianceDualWrite } from '@/lib/inventory/appliance-dual-write'
import { createClient } from '@/lib/supabase/server'
import {
  initialSetFormValues,
  type SetFormFieldErrors,
  type SetFormState,
} from './types'

const trackedFields = [
  'title',
  'description_long',
  'features',
  'condition',
  'status',
  'price',
  'color',
  'brand',
] as const

const SET_PATHS = [
  '/dashboard/inventory',
  '/dashboard/inventory/view',
  '/dashboard/inventory/new/set',
] as const

function extractMemberIds(formData: FormData): string[] {
  return formData
    .getAll('memberIds')
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
}

function extractValues(formData: FormData) {
  const values = { ...initialSetFormValues }

  for (const field of trackedFields) {
    const raw = formData.get(field)
    values[field] = typeof raw === 'string' ? raw : ''
  }

  return values
}

function buildFieldErrors(message: string): SetFormFieldErrors {
  const fieldErrors: SetFormFieldErrors = {}

  if (/Sets require at least 2 member appliances/i.test(message)) {
    fieldErrors.members = message
    return fieldErrors
  }

  if (/Duplicate member appliances/i.test(message)) {
    fieldErrors.members = message
    return fieldErrors
  }

  const missingMatch = message.match(/Missing required field: ([a-z_]+)/i)
  if (missingMatch) {
    const field = missingMatch[1] as keyof SetFormFieldErrors
    fieldErrors[field] = 'This field is required.'
    return fieldErrors
  }

  const invalidRequiredMatch = message.match(
    /Missing or invalid required field: ([a-z_]+)/i,
  )
  if (invalidRequiredMatch) {
    const field = invalidRequiredMatch[1] as keyof SetFormFieldErrors
    fieldErrors[field] = 'Enter a valid value for this required field.'
    return fieldErrors
  }

  return fieldErrors
}

function toFriendlyErrorMessage(message: string) {
  if (/Sets require at least 2 member appliances/i.test(message)) {
    return 'Select at least two existing machines for this set.'
  }

  if (/Duplicate member appliances/i.test(message)) {
    return 'Each machine can only be selected once.'
  }

  const missingMatch = message.match(/Missing required field: ([a-z_]+)/i)
  if (missingMatch) {
    const field = missingMatch[1]
    if (field === 'title') return 'Please enter a title before saving.'
    if (field === 'price') return 'Please enter a price before saving.'
    return 'Please fill in the required fields and try again.'
  }

  const invalidRequiredMatch = message.match(
    /Missing or invalid required field: ([a-z_]+)/i,
  )
  if (invalidRequiredMatch) {
    const field = invalidRequiredMatch[1]
    if (field === 'price') return 'Please enter a valid price (0 or greater).'
    return 'One of the required fields has an invalid value. Please review and try again.'
  }

  if (
    /Product (insert|update|mirror) failed:/i.test(message) ||
    /Appliance/i.test(message)
  ) {
    return 'We could not save this set. Please review your details and try again.'
  }

  return message
}

async function rollbackSetCreate(applianceId: string): Promise<void> {
  const supabase = await createClient()
  await unlinkAllMembers(applianceId)
  await supabase.from('product_images').delete().eq('product_id', applianceId)
  await supabase.from('appliance_images').delete().eq('appliance_id', applianceId)
  await supabase.from('products').delete().eq('id', applianceId)
  await supabase.from('appliances').delete().eq('id', applianceId)
}

function revalidateSetPaths(applianceId?: string) {
  for (const path of SET_PATHS) {
    revalidatePath(path)
  }
  revalidatePath('/dashboard/inventory/new')
  if (applianceId) {
    revalidatePath(`/dashboard/inventory/${applianceId}`)
    revalidatePath(`/dashboard/inventory/edit/${applianceId}`)
  }
}

export async function createSetInventoryItem(
  _prevState: SetFormState,
  formData: FormData,
): Promise<SetFormState> {
  const values = extractValues(formData)
  const memberIds = extractMemberIds(formData)

  if (memberIds.length < 2) {
    return {
      error: 'Select at least two existing machines for this set.',
      success: null,
      createdApplianceId: null,
      values,
      memberIds,
      fieldErrors: {
        members: 'Select at least two machines.',
      },
    }
  }

  formData.set('unit_type', 'Set')
  if (!formData.get('brand') && values.brand) {
    formData.set('brand', values.brand)
  }

  let applianceId: string | null = null

  try {
    const { applianceId: createdId, uploadedImages } =
      await createApplianceDualWrite(formData)
    applianceId = createdId

    await linkMembers(createdId, memberIds)
    revalidateSetPaths(createdId)

    return {
      error: null,
      success: `Set created with ${uploadedImages} image(s) and ${memberIds.length} linked machine(s).`,
      createdApplianceId: createdId,
      values: initialSetFormValues,
      memberIds: [],
      fieldErrors: {},
    }
  } catch (error) {
    if (applianceId) {
      await rollbackSetCreate(applianceId)
    }

    const message =
      error instanceof Error ? error.message : 'Failed to create inventory set.'

    return {
      error: toFriendlyErrorMessage(message),
      success: null,
      createdApplianceId: null,
      values,
      memberIds,
      fieldErrors: buildFieldErrors(message),
    }
  }
}
