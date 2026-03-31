'use server'

import { revalidatePath } from 'next/cache'
import { importProductFromForm } from './form_import.mjs'
import type { InventoryFormState } from './types'

export async function createInventoryItem(
  _prevState: InventoryFormState,
  formData: FormData
): Promise<InventoryFormState> {
  try {
    const { productId, uploadedImages } = await importProductFromForm(formData)

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/inventory/new')

    return {
      error: null,
      success: `Inventory item created (ID: ${productId}) with ${uploadedImages} image(s).`,
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to create inventory item.',
      success: null,
    }
  }
}
