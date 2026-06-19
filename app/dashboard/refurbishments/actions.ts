'use server'

import { revalidatePath } from 'next/cache'
import { updateRefurbishmentFields } from '@/lib/data/refurbishments'
import type { Refurbishment } from '@/lib/types/refurbishment'

export type PatchRefurbishmentFieldsInput = {
  initial_symptoms?: string | null
  error_codes?: string | null
  work_needed?: string | null
  cleaning_status?: string | null
  test_mode_used?: string | null
  final_results?: string | null
}

export type PatchRefurbishmentFieldsResult =
  | { success: true; refurbishment: Refurbishment }
  | { success: false; error: string }

export async function patchRefurbishmentFields(
  refurbishmentId: string,
  fields: PatchRefurbishmentFieldsInput,
): Promise<PatchRefurbishmentFieldsResult> {
  try {
    const refurbishment = await updateRefurbishmentFields(
      refurbishmentId,
      fields,
    )
    revalidatePath('/dashboard/refurbishments')
    return { success: true, refurbishment }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to update refurbishment fields.'
    return { success: false, error: message }
  }
}
