import { assertCustomerExists } from '@/lib/data/customers'
import { TAX_RATE } from '@/lib/invoices/tax-rate'
import { createClient } from '@/lib/supabase/server'
import type {
  Invoice,
  InvoiceLineItem,
  InvoiceStatus,
  InvoiceType,
  LineItemKind,
} from '@/lib/types/operations'

export type InvoiceListFilters = {
  invoice_type?: InvoiceType
  status?: InvoiceStatus
  limit?: number
}

export type CreateInvoiceInput = {
  invoice_type: InvoiceType
  job_id?: string | null
  appliance_id?: string | null
  customer_id?: string | null
  status?: InvoiceStatus
  tax?: number
  issued_at?: string | null
}

export type UpdateInvoiceInput = {
  customer_id?: string | null
}

export type AddLineItemInput = {
  kind: LineItemKind
  part_id?: string | null
  appliance_id?: string | null
  description?: string | null
  quantity?: number
  unit_price?: number
}

export type InvoiceWithLineItems = Invoice & {
  line_items: InvoiceLineItem[]
}

function mapInvoice(row: Record<string, unknown>): Invoice {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
    invoice_number: String(row.invoice_number),
    invoice_type: row.invoice_type as InvoiceType,
    job_id: row.job_id != null ? String(row.job_id) : null,
    appliance_id: row.appliance_id != null ? String(row.appliance_id) : null,
    customer_id: row.customer_id != null ? String(row.customer_id) : null,
    status: row.status as InvoiceStatus,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    issued_at: row.issued_at != null ? String(row.issued_at) : null,
  }
}

function mapLineItem(row: Record<string, unknown>): InvoiceLineItem {
  return {
    id: String(row.id),
    created_at: String(row.created_at),
    invoice_id: String(row.invoice_id),
    kind: row.kind as LineItemKind,
    part_id: row.part_id != null ? String(row.part_id) : null,
    appliance_id:
      row.appliance_id != null ? String(row.appliance_id) : null,
    description: row.description != null ? String(row.description) : null,
    quantity: Number(row.quantity),
    unit_price: Number(row.unit_price),
    line_total: Number(row.line_total),
  }
}

function throwOnError(error: { message: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`)
  }
}

export function validateInvoiceSource(
  invoiceType: InvoiceType,
  jobId: string | null | undefined,
  applianceId: string | null | undefined,
): void {
  if (invoiceType === 'job' && !jobId) {
    throw new Error('Job invoices must reference a job')
  }
  if (invoiceType === 'appliance_sale' && !applianceId) {
    throw new Error('Appliance sale invoices must reference an appliance')
  }
  if (invoiceType === 'retail' && jobId) {
    throw new Error('Retail invoices must not reference a job')
  }
}

export function computeLineTotal(
  quantity: number,
  unitPrice: number,
): number {
  return quantity * unitPrice
}

/** Re-exported for server-side invoice recomputation. */
export { TAX_RATE } from '@/lib/invoices/tax-rate'

const POSITIVE_LINE_ITEM_KINDS: ReadonlySet<LineItemKind> = new Set([
  'labor',
  'part',
  'appliance',
  'fee',
])

export function computeInvoiceTotals(lineItems: InvoiceLineItem[]): {
  subtotal: number
  tax: number
  total: number
} {
  let grossSubtotal = 0
  let discountsTotal = 0
  let tradeInsTotal = 0

  for (const line of lineItems) {
    if (POSITIVE_LINE_ITEM_KINDS.has(line.kind)) {
      grossSubtotal += line.line_total
    } else if (line.kind === 'discount') {
      discountsTotal += line.line_total
    } else if (line.kind === 'trade_in') {
      tradeInsTotal += line.line_total
    }
  }

  const taxableBase = grossSubtotal + discountsTotal + tradeInsTotal
  const tax = taxableBase * TAX_RATE
  const subtotal = taxableBase
  const total = taxableBase + tax

  return { subtotal, tax, total }
}

export async function listInvoices(
  filters: InvoiceListFilters = {},
): Promise<Invoice[]> {
  const supabase = await createClient()
  let query = supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })

  if (filters.invoice_type) {
    query = query.eq('invoice_type', filters.invoice_type)
  }
  if (filters.status) {
    query = query.eq('status', filters.status)
  }
  if (filters.limit != null) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  throwOnError(error, 'Failed to list invoices')
  return (data ?? []).map((row) => mapInvoice(row as Record<string, unknown>))
}

export async function getInvoiceById(
  id: string,
): Promise<InvoiceWithLineItems | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('*, invoice_line_items(*)')
    .eq('id', id)
    .maybeSingle()

  throwOnError(error, 'Failed to fetch invoice')
  if (!data) return null

  const row = data as Record<string, unknown>
  const nested = row.invoice_line_items
  const lineItems = Array.isArray(nested)
    ? nested.map((item) => mapLineItem(item as Record<string, unknown>))
    : []

  return {
    ...mapInvoice(row),
    line_items: lineItems.sort(
      (a, b) => a.created_at.localeCompare(b.created_at),
    ),
  }
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const jobId = input.job_id ?? null
  const applianceId = input.appliance_id ?? null
  validateInvoiceSource(input.invoice_type, jobId, applianceId)
  await assertCustomerExists(input.customer_id)

  const supabase = await createClient()
  const payload = {
    invoice_type: input.invoice_type,
    job_id: jobId,
    appliance_id: applianceId,
    customer_id: input.customer_id ?? null,
    status: input.status ?? 'Draft',
    tax: input.tax ?? 0,
    issued_at: input.issued_at ?? null,
  }

  const { data, error } = await supabase
    .from('invoices')
    .insert(payload)
    .select('*')
    .single()

  throwOnError(error, 'Failed to create invoice')
  return mapInvoice(data as Record<string, unknown>)
}

export async function addLineItem(
  invoiceId: string,
  input: AddLineItemInput,
): Promise<InvoiceLineItem> {
  const quantity = input.quantity ?? 1
  const unitPrice = input.unit_price ?? 0
  const lineTotal = computeLineTotal(quantity, unitPrice)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoice_line_items')
    .insert({
      invoice_id: invoiceId,
      kind: input.kind,
      part_id: input.part_id ?? null,
      appliance_id: input.appliance_id ?? null,
      description: input.description ?? null,
      quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
    })
    .select('*')
    .single()

  throwOnError(error, 'Failed to add line item')
  return mapLineItem(data as Record<string, unknown>)
}

export async function recomputeInvoiceTotals(
  id: string,
): Promise<InvoiceWithLineItems> {
  const invoice = await getInvoiceById(id)
  if (!invoice) {
    throw new Error('Invoice not found')
  }

  const { subtotal, tax, total } = computeInvoiceTotals(invoice.line_items)

  const supabase = await createClient()
  const { error } = await supabase
    .from('invoices')
    .update({ subtotal, tax, total })
    .eq('id', id)

  throwOnError(error, 'Failed to recompute invoice totals')

  const updated = await getInvoiceById(id)
  if (!updated) {
    throw new Error('Invoice not found after recompute')
  }
  return updated
}

export async function updateInvoice(
  id: string,
  input: UpdateInvoiceInput,
): Promise<Invoice> {
  const current = await getInvoiceById(id)
  if (!current) {
    throw new Error('Invoice not found')
  }

  if (input.customer_id !== undefined) {
    await assertCustomerExists(input.customer_id)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()

  throwOnError(error, 'Failed to update invoice')
  return mapInvoice(data as Record<string, unknown>)
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
  options?: { issued_at?: string | null },
): Promise<Invoice> {
  const supabase = await createClient()
  const payload: { status: InvoiceStatus; issued_at?: string | null } = {
    status,
  }
  if (options && 'issued_at' in options) {
    payload.issued_at = options.issued_at ?? null
  }

  const { data, error } = await supabase
    .from('invoices')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  throwOnError(error, 'Failed to update invoice status')
  return mapInvoice(data as Record<string, unknown>)
}

/** Dev-only accessor smoke test (authenticated server context required). */
export async function runInvoicesAccessorSmokeTest(): Promise<{
  retailInvoiceId: string
  subtotal: number
  total: number
}> {
  const supabase = await createClient()

  const { data: jobRow, error: jobError } = await supabase
    .from('jobs')
    .insert({
      job_class: 'Customer',
      job_type: 'Repair',
      summary: 'C7 invoice smoke job',
    })
    .select('id')
    .single()
  throwOnError(jobError, 'Failed to create smoke job')
  const jobId = String(jobRow!.id)

  const { data: applianceRow, error: applianceError } = await supabase
    .from('appliances')
    .select('id')
    .limit(1)
    .maybeSingle()
  throwOnError(applianceError, 'Failed to fetch appliance for smoke test')
  if (!applianceRow?.id) {
    throw new Error('Smoke test requires at least one appliance row')
  }
  const applianceId = String(applianceRow.id)

  const jobInvoice = await createInvoice({
    invoice_type: 'job',
    job_id: jobId,
  })
  const jobFetched = await getInvoiceById(jobInvoice.id)
  if (!jobFetched || jobFetched.invoice_type !== 'job') {
    throw new Error('Job invoice round-trip failed')
  }

  const saleInvoice = await createInvoice({
    invoice_type: 'appliance_sale',
    appliance_id: applianceId,
  })
  const saleFetched = await getInvoiceById(saleInvoice.id)
  if (!saleFetched || saleFetched.invoice_type !== 'appliance_sale') {
    throw new Error('Appliance sale invoice round-trip failed')
  }

  const retailInvoice = await createInvoice({
    invoice_type: 'retail',
  })
  const retailFetched = await getInvoiceById(retailInvoice.id)
  if (!retailFetched || retailFetched.invoice_type !== 'retail') {
    throw new Error('Retail invoice round-trip failed')
  }

  const listed = await listInvoices({ invoice_type: 'retail', status: 'Draft' })
  if (!listed.some((row) => row.id === retailInvoice.id)) {
    throw new Error('listInvoices filter did not return retail smoke invoice')
  }

  await addLineItem(retailInvoice.id, {
    kind: 'labor',
    description: 'Service labor',
    quantity: 1,
    unit_price: 50,
  })
  await addLineItem(retailInvoice.id, {
    kind: 'part',
    description: 'Hose kit',
    quantity: 2,
    unit_price: 10,
  })
  await addLineItem(retailInvoice.id, {
    kind: 'appliance',
    appliance_id: applianceId,
    quantity: 1,
    unit_price: 100,
  })
  await addLineItem(retailInvoice.id, {
    kind: 'fee',
    description: 'Delivery',
    quantity: 1,
    unit_price: 25,
  })

  const recomputed = await recomputeInvoiceTotals(retailInvoice.id)
  const expectedSubtotal = 50 + 20 + 100 + 25
  if (recomputed.subtotal !== expectedSubtotal) {
    throw new Error(
      `Expected subtotal ${expectedSubtotal}, got ${recomputed.subtotal}`,
    )
  }
  const expectedTotal = expectedSubtotal
  if (recomputed.total !== expectedTotal) {
    throw new Error(`Expected total ${expectedTotal}, got ${recomputed.total}`)
  }
  if (recomputed.tax !== 0) {
    throw new Error(`Expected tax 0, got ${recomputed.tax}`)
  }
  if (recomputed.line_items.length !== 4) {
    throw new Error(`Expected 4 line items, got ${recomputed.line_items.length}`)
  }

  const invoiceIds = [jobInvoice.id, saleInvoice.id, retailInvoice.id]
  for (const invoiceId of invoiceIds) {
    const { error: deleteInvoiceError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
    throwOnError(deleteInvoiceError, 'Failed to clean up smoke invoice')
  }

  const { error: deleteJobError } = await supabase
    .from('jobs')
    .delete()
    .eq('id', jobId)
  throwOnError(deleteJobError, 'Failed to clean up smoke job')

  return {
    retailInvoiceId: retailInvoice.id,
    subtotal: recomputed.subtotal,
    total: recomputed.total,
  }
}
