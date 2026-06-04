import type { InvoiceStatus } from '@/lib/types/operations'

/** Allowed invoice status transitions (F4.6) */
export const ALLOWED_INVOICE_TRANSITIONS: Record<
  InvoiceStatus,
  readonly InvoiceStatus[]
> = {
  Draft: ['Issued', 'Void'],
  Issued: ['Paid', 'Void'],
  Paid: [],
  Void: [],
}

export function getAllowedInvoiceTransitions(
  from: InvoiceStatus,
): readonly InvoiceStatus[] {
  return ALLOWED_INVOICE_TRANSITIONS[from]
}

export function canTransitionInvoice(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  return getAllowedInvoiceTransitions(from).includes(to)
}
