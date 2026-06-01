import { NextRequest, NextResponse } from 'next/server'
import {
  getInvoiceById,
  listInvoices,
  type InvoiceWithLineItems,
} from '@/lib/data/invoices'
import { createApplianceSaleInvoice } from '@/lib/operations/create-appliance-sale-invoice'
import { createRetailInvoice } from '@/lib/operations/create-retail-invoice'
import { generateInvoiceForJob } from '@/lib/operations/generate-invoice-for-job'
import { createClient } from '@/lib/supabase/server'
import type { Invoice, InvoiceStatus, InvoiceType } from '@/lib/types/operations'

export type InvoicesApiSuccess =
  | { success: true; invoiceId: string }
  | { success: true; invoice: InvoiceWithLineItems }
  | { success: true; invoices: Invoice[] }

export type InvoicesApiError = { success: false; error: string }

const INVOICE_TYPES: readonly InvoiceType[] = ['job', 'appliance_sale', 'retail']
const INVOICE_STATUSES: readonly InvoiceStatus[] = [
  'Draft',
  'Issued',
  'Paid',
  'Void',
]

async function requireAuth(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return !error && !!user
}

function isInvoiceType(value: string): value is InvoiceType {
  return (INVOICE_TYPES as readonly string[]).includes(value)
}

function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value)
}

function parseTax(raw: Record<string, unknown>): number | undefined {
  if (raw.tax === undefined) return undefined
  const tax = Number(raw.tax)
  if (!Number.isFinite(tax) || tax < 0) {
    return NaN
  }
  return tax
}

function parseFees(
  raw: unknown,
): { ok: true; fees: { description: string; amount: number }[] } | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: true, fees: [] }
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'fees must be an array' }
  }
  const fees: { description: string; amount: number }[] = []
  for (const item of raw) {
    if (item == null || typeof item !== 'object') {
      return { ok: false, error: 'Each fee must be an object' }
    }
    const row = item as Record<string, unknown>
    const description =
      typeof row.description === 'string' ? row.description.trim() : ''
    const amount = Number(row.amount)
    if (!description) {
      return { ok: false, error: 'Each fee requires a description' }
    }
    if (!Number.isFinite(amount)) {
      return { ok: false, error: 'Each fee requires a numeric amount' }
    }
    fees.push({ description, amount })
  }
  return { ok: true, fees }
}

function parseRetailParts(
  raw: unknown,
): {
  ok: true
  parts: { partId: string; quantity: number; unitPrice?: number }[]
} | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: 'parts must be a non-empty array' }
  }
  const parts: { partId: string; quantity: number; unitPrice?: number }[] = []
  for (const item of raw) {
    if (item == null || typeof item !== 'object') {
      return { ok: false, error: 'Each part line must be an object' }
    }
    const row = item as Record<string, unknown>
    const partId =
      typeof row.part_id === 'string'
        ? row.part_id
        : typeof row.partId === 'string'
          ? row.partId
          : ''
    const quantity = Number(row.quantity)
    if (!partId) {
      return { ok: false, error: 'Each part line requires part_id' }
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { ok: false, error: 'Each part line requires a positive integer quantity' }
    }
    const line: { partId: string; quantity: number; unitPrice?: number } = {
      partId,
      quantity,
    }
    if (row.unit_price !== undefined || row.unitPrice !== undefined) {
      const unitPrice = Number(row.unit_price ?? row.unitPrice)
      if (!Number.isFinite(unitPrice)) {
        return { ok: false, error: 'unit_price must be a number when provided' }
      }
      line.unitPrice = unitPrice
    }
    parts.push(line)
  }
  return { ok: true, parts }
}

function parseAccessories(
  raw: unknown,
): {
  ok: true
  accessories: { partId: string; quantity: number; unitPrice?: number }[]
} | { ok: false; error: string } {
  if (raw === undefined) {
    return { ok: true, accessories: [] }
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'accessories must be an array' }
  }
  const accessories: { partId: string; quantity: number; unitPrice?: number }[] = []
  for (const item of raw) {
    if (item == null || typeof item !== 'object') {
      return { ok: false, error: 'Each accessory must be an object' }
    }
    const row = item as Record<string, unknown>
    const partId =
      typeof row.part_id === 'string'
        ? row.part_id
        : typeof row.partId === 'string'
          ? row.partId
          : ''
    const quantity = Number(row.quantity)
    if (!partId) {
      return { ok: false, error: 'Each accessory requires part_id' }
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return {
        ok: false,
        error: 'Each accessory requires a positive integer quantity',
      }
    }
    const line: { partId: string; quantity: number; unitPrice?: number } = {
      partId,
      quantity,
    }
    if (row.unit_price !== undefined || row.unitPrice !== undefined) {
      const unitPrice = Number(row.unit_price ?? row.unitPrice)
      if (!Number.isFinite(unitPrice)) {
        return { ok: false, error: 'unit_price must be a number when provided' }
      }
      line.unitPrice = unitPrice
    }
    accessories.push(line)
  }
  return { ok: true, accessories }
}

async function dispatchCreate(
  body: Record<string, unknown>,
): Promise<{ ok: true; invoiceId: string } | { ok: false; error: string }> {
  const invoice_type =
    typeof body.invoice_type === 'string' ? body.invoice_type.trim() : ''

  if (!invoice_type) {
    return { ok: false, error: 'Missing required field: invoice_type' }
  }
  if (!isInvoiceType(invoice_type)) {
    return {
      ok: false,
      error: 'Invalid invoice_type; use job, appliance_sale, or retail',
    }
  }

  const tax = parseTax(body)
  if (tax !== undefined && Number.isNaN(tax)) {
    return { ok: false, error: 'tax must be a non-negative number' }
  }

  if (invoice_type === 'job') {
    const job_id =
      typeof body.job_id === 'string' ? body.job_id.trim() : ''
    if (!job_id) {
      return { ok: false, error: 'Missing required field: job_id for job invoices' }
    }

    const result = await generateInvoiceForJob(job_id, { tax })
    if (!result.success) {
      return { ok: false, error: result.error }
    }
    return { ok: true, invoiceId: result.invoiceId }
  }

  if (invoice_type === 'appliance_sale') {
    const appliance_id =
      typeof body.appliance_id === 'string' ? body.appliance_id.trim() : ''
    if (!appliance_id) {
      return {
        ok: false,
        error: 'Missing required field: appliance_id for appliance_sale invoices',
      }
    }

    const feesParsed = parseFees(body.fees)
    if (!feesParsed.ok) {
      return { ok: false, error: feesParsed.error }
    }
    const accessoriesParsed = parseAccessories(body.accessories)
    if (!accessoriesParsed.ok) {
      return { ok: false, error: accessoriesParsed.error }
    }

    const customer_id =
      body.customer_id === undefined
        ? undefined
        : body.customer_id == null
          ? null
          : String(body.customer_id)

    const result = await createApplianceSaleInvoice({
      applianceId: appliance_id,
      fees: feesParsed.fees,
      accessories: accessoriesParsed.accessories,
      tax,
      customerId: customer_id,
    })
    if (!result.success) {
      return { ok: false, error: result.error }
    }
    return { ok: true, invoiceId: result.invoiceId }
  }

  const partsParsed = parseRetailParts(body.parts)
  if (!partsParsed.ok) {
    return { ok: false, error: partsParsed.error }
  }
  const feesParsed = parseFees(body.fees)
  if (!feesParsed.ok) {
    return { ok: false, error: feesParsed.error }
  }

  const result = await createRetailInvoice({
    parts: partsParsed.parts,
    fees: feesParsed.fees,
    tax,
  })
  if (!result.success) {
    return { ok: false, error: result.error }
  }
  return { ok: true, invoiceId: result.invoiceId }
}

export async function GET(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json<InvoicesApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (id) {
      const invoice = await getInvoiceById(id)
      if (!invoice) {
        return NextResponse.json<InvoicesApiError>(
          { success: false, error: 'Invoice not found' },
          { status: 404 },
        )
      }
      return NextResponse.json<InvoicesApiSuccess>({ success: true, invoice })
    }

    const limitRaw = searchParams.get('limit')
    const limit = limitRaw != null ? Number(limitRaw) : undefined

    const typeParam = searchParams.get('invoice_type')
    const invoice_type =
      typeParam && isInvoiceType(typeParam) ? typeParam : undefined

    const statusParam = searchParams.get('status')
    const status =
      statusParam && isInvoiceStatus(statusParam) ? statusParam : undefined

    const invoices = await listInvoices({
      invoice_type,
      status,
      limit: limit != null && Number.isFinite(limit) ? limit : undefined,
    })

    return NextResponse.json<InvoicesApiSuccess>({ success: true, invoices })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to list invoices'
    return NextResponse.json<InvoicesApiError>(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json<InvoicesApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<InvoicesApiError>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  if (body == null || typeof body !== 'object') {
    return NextResponse.json<InvoicesApiError>(
      { success: false, error: 'Invalid request body.' },
      { status: 400 },
    )
  }

  const dispatched = await dispatchCreate(body as Record<string, unknown>)
  if (!dispatched.ok) {
    return NextResponse.json<InvoicesApiError>(
      { success: false, error: dispatched.error },
      { status: 400 },
    )
  }

  return NextResponse.json<InvoicesApiSuccess>(
    { success: true, invoiceId: dispatched.invoiceId },
    { status: 201 },
  )
}
