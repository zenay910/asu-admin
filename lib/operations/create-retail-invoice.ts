'use server'

import { revalidatePath } from 'next/cache'
import {
  addLineItem,
  createInvoice,
  recomputeInvoiceTotals,
  type InvoiceWithLineItems,
} from '@/lib/data/invoices'
import {
  adjustStock,
  createPart,
  getPartById,
  recordStockMovement,
} from '@/lib/data/parts'
import { createClient } from '@/lib/supabase/server'

export type RetailPartLineInput = {
  partId: string
  quantity: number
  unitPrice?: number
}

export type RetailFeeInput = {
  description: string
  amount: number
}

export type CreateRetailInvoiceInput = {
  parts: RetailPartLineInput[]
  fees?: RetailFeeInput[]
  tax?: number
}

export type CreateRetailInvoiceResult =
  | { success: true; invoiceId: string; invoice: InvoiceWithLineItems }
  | { success: false; error: string }

type CompletedStockDrawdown = {
  partId: string
  quantity: number
  movementId: string
}

function retailError(message: string): CreateRetailInvoiceResult {
  return { success: false, error: message }
}

async function deleteInvoice(invoiceId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('invoices').delete().eq('id', invoiceId)
}

async function rollbackStockDrawdowns(
  completed: CompletedStockDrawdown[],
): Promise<void> {
  const supabase = await createClient()
  for (const row of [...completed].reverse()) {
    await adjustStock(row.partId, row.quantity)
    await supabase.from('part_stock_movements').delete().eq('id', row.movementId)
  }
}

export async function createRetailInvoice(
  input: CreateRetailInvoiceInput,
): Promise<CreateRetailInvoiceResult> {
  if (!input.parts.length) {
    return retailError('At least one part line is required for a retail sale.')
  }

  for (const line of input.parts) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      return retailError('Each part line must have a positive whole-number quantity.')
    }
  }

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return retailError('You must be signed in to create a retail invoice.')
  }

  for (const line of input.parts) {
    const part = await getPartById(line.partId)
    if (!part) {
      return retailError(`Part not found: ${line.partId}`)
    }
    if (part.quantity_on_hand < line.quantity) {
      return retailError(
        `Not enough stock for ${part.name} (on hand: ${part.quantity_on_hand}, requested: ${line.quantity}).`,
      )
    }
  }

  let invoiceId: string | null = null
  const completedDrawdowns: CompletedStockDrawdown[] = []

  try {
    const invoice = await createInvoice({
      invoice_type: 'retail',
      tax: input.tax ?? 0,
    })
    invoiceId = invoice.id

    for (const line of input.parts) {
      const part = await getPartById(line.partId)
      if (!part) {
        throw new Error(`Part not found: ${line.partId}`)
      }

      const unitPrice = line.unitPrice ?? part.unit_price ?? 0
      await addLineItem(invoice.id, {
        kind: 'part',
        part_id: line.partId,
        description: part.name,
        quantity: line.quantity,
        unit_price: unitPrice,
      })

      const movement = await recordStockMovement(line.partId, -line.quantity, {
        reason: 'Retail sale',
        changedBy: user.id,
      })
      completedDrawdowns.push({
        partId: line.partId,
        quantity: line.quantity,
        movementId: movement.movementId,
      })
    }

    for (const fee of input.fees ?? []) {
      await addLineItem(invoice.id, {
        kind: 'fee',
        description: fee.description,
        quantity: 1,
        unit_price: fee.amount,
      })
    }

    const updated = await recomputeInvoiceTotals(invoice.id)
    revalidatePath('/dashboard')

    return {
      success: true,
      invoiceId: invoice.id,
      invoice: updated,
    }
  } catch (error) {
    if (completedDrawdowns.length) {
      await rollbackStockDrawdowns(completedDrawdowns)
    }
    if (invoiceId) {
      await deleteInvoice(invoiceId)
    }
    const message =
      error instanceof Error ? error.message : 'Failed to create retail invoice.'
    return retailError(message)
  }
}

/** Dev smoke test: retail part sale draws stock + audit; oversell is a no-op. */
export async function runCreateRetailInvoiceSmokeTest(): Promise<{
  invoiceId: string
  quantityOnHand: number
  movementJobPartId: string | null
}> {
  const suffix = Date.now()
  const part = await createPart({
    part_number: `C10-SMOKE-${suffix}`,
    name: 'C10 retail smoke part',
    quantity_on_hand: 10,
    unit_price: 12,
  })

  const sold = await createRetailInvoice({
    parts: [{ partId: part.id, quantity: 3 }],
    fees: [{ description: 'Counter fee', amount: 5 }],
  })
  if (!sold.success) {
    throw new Error(`Expected retail sale to succeed: ${sold.error}`)
  }

  const invoice = sold.invoice
  if (invoice.invoice_type !== 'retail' || invoice.job_id !== null) {
    throw new Error('Invoice must be retail with no job_id')
  }
  if (invoice.line_items.length !== 2) {
    throw new Error(`Expected 2 line items, got ${invoice.line_items.length}`)
  }

  const expectedSubtotal = 3 * 12 + 5
  if (invoice.subtotal !== expectedSubtotal) {
    throw new Error(
      `Expected subtotal ${expectedSubtotal}, got ${invoice.subtotal}`,
    )
  }

  const afterSale = await getPartById(part.id)
  if (afterSale?.quantity_on_hand !== 7) {
    throw new Error(
      `Expected quantity_on_hand 7, got ${afterSale?.quantity_on_hand}`,
    )
  }

  const supabase = await createClient()
  const { data: movement, error: movementError } = await supabase
    .from('part_stock_movements')
    .select('delta, quantity_after, job_part_id')
    .eq('part_id', part.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (movementError || !movement) {
    throw new Error(`Failed to read movement: ${movementError?.message}`)
  }
  if (
    movement.delta !== -3 ||
    movement.quantity_after !== 7 ||
    movement.job_part_id != null
  ) {
    throw new Error('Movement row does not match retail drawdown')
  }

  const stockBeforeReject = afterSale!.quantity_on_hand
  const movementCountBefore = (
    await supabase
      .from('part_stock_movements')
      .select('id', { count: 'exact', head: true })
      .eq('part_id', part.id)
  ).count
  const invoiceCountBefore = (
    await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('invoice_type', 'retail')
  ).count

  const oversell = await createRetailInvoice({
    parts: [{ partId: part.id, quantity: 100 }],
  })
  if (oversell.success) {
    throw new Error('Expected oversell to be rejected')
  }

  const stockAfterReject = (await getPartById(part.id))?.quantity_on_hand
  if (stockAfterReject !== stockBeforeReject) {
    throw new Error('Oversell must not change quantity_on_hand')
  }

  const { count: movementCountAfter } = await supabase
    .from('part_stock_movements')
    .select('id', { count: 'exact', head: true })
    .eq('part_id', part.id)
  if (movementCountAfter !== movementCountBefore) {
    throw new Error('Oversell must not insert an additional movement row')
  }

  const { count: invoiceCountAfter } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('invoice_type', 'retail')
  if (invoiceCountAfter !== invoiceCountBefore) {
    throw new Error('Oversell must not create an additional invoice')
  }

  const { error: deleteInvoiceError } = await supabase
    .from('invoices')
    .delete()
    .eq('id', sold.invoiceId)
  if (deleteInvoiceError) {
    throw new Error(`Cleanup invoice failed: ${deleteInvoiceError.message}`)
  }

  const { error: deletePartError } = await supabase
    .from('parts')
    .delete()
    .eq('id', part.id)
  if (deletePartError) {
    throw new Error(`Cleanup part failed: ${deletePartError.message}`)
  }

  return {
    invoiceId: sold.invoiceId,
    quantityOnHand: stockAfterReject!,
    movementJobPartId: movement.job_part_id,
  }
}
