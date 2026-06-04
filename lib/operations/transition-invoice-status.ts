'use server'

import { revalidatePath } from 'next/cache'
import { getInvoiceById, updateInvoiceStatus } from '@/lib/data/invoices'
import {
  canTransitionInvoice,
  getAllowedInvoiceTransitions,
} from '@/lib/operations/invoice-lifecycle'
import { createClient } from '@/lib/supabase/server'
import type { Invoice, InvoiceStatus } from '@/lib/types/operations'

export type TransitionInvoiceStatusResult =
  | { success: true; invoice: Invoice }
  | { success: false; error: string }

function transitionError(message: string): TransitionInvoiceStatusResult {
  return { success: false, error: message }
}

function friendlyTransitionError(
  from: InvoiceStatus,
  to: InvoiceStatus,
): string {
  const allowed = getAllowedInvoiceTransitions(from)
  if (allowed.length === 0) {
    return `This invoice is ${from} and cannot be moved to another status.`
  }
  return `Cannot move from ${from} to ${to}. Allowed next statuses: ${allowed.join(', ')}.`
}

export async function transitionInvoiceStatus(
  invoiceId: string,
  toStatus: InvoiceStatus,
): Promise<TransitionInvoiceStatusResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return transitionError('You must be signed in to change invoice status.')
  }

  const current = await getInvoiceById(invoiceId)
  if (!current) {
    return transitionError('Invoice not found.')
  }

  const fromStatus = current.status
  if (fromStatus === toStatus) {
    return transitionError(`This invoice is already ${toStatus}.`)
  }

  if (!canTransitionInvoice(fromStatus, toStatus)) {
    return transitionError(friendlyTransitionError(fromStatus, toStatus))
  }

  const issued_at =
    toStatus === 'Issued' ? new Date().toISOString() : undefined

  try {
    const invoice = await updateInvoiceStatus(invoiceId, toStatus, {
      ...(issued_at !== undefined ? { issued_at } : {}),
    })

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/invoices')
    revalidatePath(`/dashboard/invoices/${invoiceId}`)

    return { success: true, invoice }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update invoice status.'
    return transitionError(message)
  }
}
