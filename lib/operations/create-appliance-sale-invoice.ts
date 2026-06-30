'use server'

import { revalidatePath } from 'next/cache'
import { createAppliance, getApplianceById } from '@/lib/data/appliances'
import {
  addLineItem,
  createInvoice,
  recomputeInvoiceTotals,
  type InvoiceWithLineItems,
} from '@/lib/data/invoices'
import { transitionApplianceState } from '@/lib/inventory/transition-appliance-state'
import { createPart, getPartById } from '@/lib/data/parts'
import { createClient } from '@/lib/supabase/server'

import type { PaymentMethod } from '@/lib/types/operations'

export type ApplianceSaleFeeInput = {
  description: string
  amount: number
}

export type ApplianceSaleAccessoryInput = {
  partId: string
  quantity: number
  unitPrice?: number
}

export type ApplianceSaleDiscountInput = {
  description: string
  amount: number
}

export type ApplianceSaleTradeInInput = {
  description: string
  amount: number
}

export type CreateApplianceSaleInvoiceInput = {
  applianceId: string
  fees?: ApplianceSaleFeeInput[]
  nonTaxableFees?: ApplianceSaleFeeInput[]
  accessories?: ApplianceSaleAccessoryInput[]
  discounts?: ApplianceSaleDiscountInput[]
  tradeIns?: ApplianceSaleTradeInInput[]
  customerId?: string | null
  paymentMethod: PaymentMethod
}

export type CreateApplianceSaleInvoiceResult =
  | { success: true; invoiceId: string; invoice: InvoiceWithLineItems }
  | { success: false; error: string }

function saleError(message: string): CreateApplianceSaleInvoiceResult {
  return { success: false, error: message }
}

async function deleteInvoice(invoiceId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('invoices').delete().eq('id', invoiceId)
}

export async function createApplianceSaleInvoice(
  input: CreateApplianceSaleInvoiceInput,
): Promise<CreateApplianceSaleInvoiceResult> {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return saleError('You must be signed in to create an appliance sale invoice.')
  }

  const appliance = await getApplianceById(input.applianceId)
  if (!appliance) {
    return saleError('Appliance not found.')
  }

  if (appliance.lifecycle_state === 'Retired') {
    return saleError('This appliance has already been retired and cannot be sold again.')
  }

  let invoiceId: string | null = null

  try {
    const invoice = await createInvoice({
      invoice_type: 'appliance_sale',
      appliance_id: input.applianceId,
      customer_id: input.customerId ?? null,
      payment_method: input.paymentMethod,
      tax: 0,
    })
    invoiceId = invoice.id

    await addLineItem(invoice.id, {
      kind: 'appliance',
      appliance_id: input.applianceId,
      description: appliance.title,
      quantity: 1,
      unit_price: appliance.price,
    })

    for (const fee of input.fees ?? []) {
      await addLineItem(invoice.id, {
        kind: 'fee',
        description: fee.description,
        quantity: 1,
        unit_price: fee.amount,
        taxable: true,
      })
    }

    for (const fee of input.nonTaxableFees ?? []) {
      await addLineItem(invoice.id, {
        kind: 'fee',
        description: fee.description,
        quantity: 1,
        unit_price: fee.amount,
        taxable: false,
      })
    }

    for (const accessory of input.accessories ?? []) {
      const part = await getPartById(accessory.partId)
      if (!part) {
        throw new Error(`Accessory part not found: ${accessory.partId}`)
      }
      const unitPrice = accessory.unitPrice ?? part.unit_price ?? 0
      await addLineItem(invoice.id, {
        kind: 'part',
        part_id: accessory.partId,
        description: part.name,
        quantity: accessory.quantity,
        unit_price: unitPrice,
      })
    }

    for (const discount of input.discounts ?? []) {
      await addLineItem(invoice.id, {
        kind: 'discount',
        description: discount.description,
        quantity: 1,
        unit_price: -discount.amount,
      })
    }

    for (const tradeIn of input.tradeIns ?? []) {
      await addLineItem(invoice.id, {
        kind: 'trade_in',
        description: tradeIn.description,
        quantity: 1,
        unit_price: -tradeIn.amount,
      })
    }

    const updated = await recomputeInvoiceTotals(invoice.id)

    const transitioned = await transitionApplianceState(
      input.applianceId,
      'Retired',
      { status:'Sold' },
    )
    if (!transitioned.success) {
      await deleteInvoice(invoice.id)
      return saleError(transitioned.error)
    }

    if (
      transitioned.appliance.lifecycle_state !== 'Retired' ||
      transitioned.appliance.status !== 'Sold'
    ) {
      await deleteInvoice(invoice.id)
      await transitionApplianceState(
        input.applianceId,
        appliance.lifecycle_state,
        { status: appliance.status },
      )
      return saleError(
        'Appliance sale completed but lifecycle did not reach Retired/Sold as expected.',
      )
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/inventory/view')
    revalidatePath(`/dashboard/inventory/${input.applianceId}`)
    revalidatePath('/dashboard/invoices')
    revalidatePath(`/dashboard/invoices/${invoice.id}`)

    return {
      success: true,
      invoiceId: invoice.id,
      invoice: updated,
    }
  } catch (error) {
    if (invoiceId) {
      await deleteInvoice(invoiceId)
    }
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to create appliance sale invoice.'
    return saleError(message)
  }
}

/** Dev smoke test: sale invoice + Retired/Sold; already-Retired appliance rejected. */
export async function runCreateApplianceSaleInvoiceSmokeTest(): Promise<{
  invoiceId: string
  total: number
  lifecycleState: string
  status: string | null
}> {
  const suffix = Date.now()
  const appliance = await createAppliance({
    title: 'C9 sale smoke',
    price: 500,
    lifecycle_state: 'Listed',
    status: 'Published',
  })

  const partA = await createPart({
    part_number: `C9-SMOKE-A-${suffix}`,
    name: 'C9 hose',
    quantity_on_hand: 5,
    unit_price: 25,
  })
  const partB = await createPart({
    part_number: `C9-SMOKE-B-${suffix}`,
    name: 'C9 vent',
    quantity_on_hand: 5,
    unit_price: 15,
  })

  const sold = await createApplianceSaleInvoice({
    applianceId: appliance.id,
    paymentMethod: 'cash_venmo_zelle',
    fees: [{ description: 'Installation', amount: 50 }],
    nonTaxableFees: [{ description: 'Delivery', amount: 50 }],
    accessories: [
      { partId: partA.id, quantity: 1 },
      { partId: partB.id, quantity: 2 },
    ],
    discounts: [{ description: 'Washer markdown', amount: 29 }],
    tradeIns: [
      { description: 'Old washer trade-in', amount: 30 },
      { description: 'Old dryer trade-in', amount: 30 },
    ],
  })
  if (!sold.success) {
    throw new Error(`Expected sale to succeed: ${sold.error}`)
  }

  const invoice = sold.invoice
  const kinds = invoice.line_items.map((line) => line.kind).sort()
  if (kinds.join(',') !== 'appliance,discount,fee,fee,part,part,trade_in,trade_in') {
    throw new Error(`Unexpected line kinds: ${kinds.join(',')}`)
  }

  const discountLine = invoice.line_items.find((line) => line.kind === 'discount')
  if (!discountLine || discountLine.line_total !== -29) {
    throw new Error('Expected discount line with line_total -29')
  }

  const tradeInTotal = invoice.line_items
    .filter((line) => line.kind === 'trade_in')
    .reduce((sum, line) => sum + line.line_total, 0)
  if (tradeInTotal !== -60) {
    throw new Error(`Expected trade-in lines totaling -60, got ${tradeInTotal}`)
  }

  const expectedSubtotal = 500 + 50 + 25 + 2 * 15 - 29 - 60
  if (invoice.subtotal !== expectedSubtotal) {
    throw new Error(
      `Expected subtotal ${expectedSubtotal}, got ${invoice.subtotal}`,
    )
  }
  const expectedTax = expectedSubtotal * 0.0765
  if (invoice.tax !== expectedTax) {
    throw new Error(`Expected tax ${expectedTax}, got ${invoice.tax}`)
  }
  const expectedTotal = expectedSubtotal + expectedTax + 50
  if (invoice.total !== expectedTotal) {
    throw new Error(`Expected total ${expectedTotal}, got ${invoice.total}`)
  }
  if (invoice.surcharge !== 0) {
    throw new Error(`Expected surcharge 0, got ${invoice.surcharge}`)
  }

  const soldAppliance = await getApplianceById(appliance.id)
  if (
    !soldAppliance ||
    soldAppliance.lifecycle_state !== 'Retired' ||
    soldAppliance.status !== 'Sold'
  ) {
    throw new Error('Appliance must end Retired with status Sold')
  }

  const retiredAppliance = await createAppliance({
    title: 'C9 retired smoke',
    price: 1,
    lifecycle_state: 'Retired',
    status: 'Sold',
  })
  const retiredReject = await createApplianceSaleInvoice({
    applianceId: retiredAppliance.id,
    paymentMethod: 'cash_venmo_zelle',
  })
  if (retiredReject.success) {
    throw new Error('Expected Retired appliance sale to be rejected')
  }

  const { count: invoiceCount } = await (await createClient())
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('appliance_id', retiredAppliance.id)
  if ((invoiceCount ?? 0) > 0) {
    throw new Error('Rejected sale must not create an invoice')
  }

  const supabase = await createClient()
  const { error: deleteInvoiceError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', sold.invoiceId)
  if (deleteInvoiceError) {
    throw new Error(`Cleanup invoice failed: ${deleteInvoiceError.message}`)
  }

  for (const partId of [partA.id, partB.id]) {
    const { error: deletePartError } = await supabase
      .from('parts')
      .delete()
      .eq('id', partId)
    if (deletePartError) {
      throw new Error(`Cleanup part failed: ${deletePartError.message}`)
    }
  }

  for (const applianceId of [appliance.id, retiredAppliance.id]) {
    const { error: deleteApplianceError } = await supabase
      .from('appliances')
      .delete()
      .eq('id', applianceId)
    if (deleteApplianceError) {
      throw new Error(`Cleanup appliance failed: ${deleteApplianceError.message}`)
    }
  }

  return {
    invoiceId: sold.invoiceId,
    total: invoice.total,
    lifecycleState: soldAppliance.lifecycle_state,
    status: soldAppliance.status,
  }
}
