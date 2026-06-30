'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import type { PaymentMethod } from '@/lib/types/operations'

export type InvoiceActionResult =
  | { ok: true; invoiceId: string }
  | { ok: false; error: string }

export type ApplianceSaleFeePayload = {
  description: string
  amount: number
}

export type ApplianceSaleAccessoryPayload = {
  part_id: string
  quantity: number
  unit_price?: number
}

export type ApplianceSaleDiscountPayload = {
  description: string
  amount: number
}

export type ApplianceSaleTradeInPayload = {
  description: string
  amount: number
}

export type CreateApplianceSaleInvoicePayload = {
  appliance_id: string
  customer_id?: string | null
  payment_method: PaymentMethod
  fees: ApplianceSaleFeePayload[]
  non_taxable_fees?: ApplianceSaleFeePayload[]
  accessories: ApplianceSaleAccessoryPayload[]
  discounts?: ApplianceSaleDiscountPayload[]
  trade_ins?: ApplianceSaleTradeInPayload[]
}

async function invoicesApiPost(
  body: Record<string, unknown>,
): Promise<InvoiceActionResult> {
  const headerStore = await headers()
  const host = headerStore.get('host')
  if (!host) {
    return { ok: false, error: 'Could not resolve request host.' }
  }
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const cookie = headerStore.get('cookie') ?? ''

  const response = await fetch(`${protocol}://${host}/api/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie,
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null

  if (!response.ok) {
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : `Request failed (${response.status})`
    return { ok: false, error: message }
  }

  if (payload?.success !== true) {
    return { ok: false, error: 'Unexpected response from invoices API.' }
  }

  const invoiceId =
    typeof payload.invoiceId === 'string' ? payload.invoiceId : ''
  if (!invoiceId) {
    return { ok: false, error: 'Invoice was created but no ID was returned.' }
  }

  return { ok: true, invoiceId }
}

function revalidateAfterApplianceSale(
  applianceId: string,
  invoiceId: string,
) {
  revalidatePath('/dashboard/invoices')
  revalidatePath(`/dashboard/invoices/${invoiceId}`)
  revalidatePath('/dashboard/inventory/view')
  revalidatePath(`/dashboard/inventory/${applianceId}`)
}

export async function createApplianceSaleInvoiceViaApi(
  input: CreateApplianceSaleInvoicePayload,
): Promise<InvoiceActionResult> {
  const appliance_id = input.appliance_id.trim()
  if (!appliance_id) {
    return { ok: false, error: 'Select an appliance to sell.' }
  }

  if (!input.payment_method) {
    return { ok: false, error: 'Select a payment method.' }
  }

  const result = await invoicesApiPost({
    invoice_type: 'appliance_sale',
    appliance_id,
    customer_id: input.customer_id?.trim() || null,
    payment_method: input.payment_method,
    fees: input.fees,
    non_taxable_fees: input.non_taxable_fees ?? [],
    accessories: input.accessories,
    discounts: input.discounts ?? [],
    trade_ins: input.trade_ins ?? [],
  })

  if (!result.ok) {
    return result
  }

  revalidateAfterApplianceSale(appliance_id, result.invoiceId)
  return result
}

export type RetailPartPayload = {
  part_id: string
  quantity: number
  unit_price?: number
}

export type RetailFeePayload = {
  description: string
  amount: number
}

export type CreateRetailInvoicePayload = {
  parts: RetailPartPayload[]
  fees: RetailFeePayload[]
  tax?: number
}

function revalidateAfterRetailSale(
  invoiceId: string,
  partIds: string[],
) {
  revalidatePath('/dashboard/invoices')
  revalidatePath(`/dashboard/invoices/${invoiceId}`)
  revalidatePath('/dashboard/parts')
  for (const partId of partIds) {
    revalidatePath(`/dashboard/parts/${partId}`)
  }
}

export async function createRetailInvoiceViaApi(
  input: CreateRetailInvoicePayload,
): Promise<InvoiceActionResult> {
  if (!input.parts.length) {
    return { ok: false, error: 'Add at least one part line for a retail sale.' }
  }

  const tax = input.tax ?? 0
  if (!Number.isFinite(tax) || tax < 0) {
    return { ok: false, error: 'Tax must be a non-negative number.' }
  }

  const result = await invoicesApiPost({
    invoice_type: 'retail',
    tax,
    parts: input.parts,
    fees: input.fees,
  })

  if (!result.ok) {
    return result
  }

  revalidateAfterRetailSale(
    result.invoiceId,
    input.parts.map((line) => line.part_id),
  )
  return result
}
