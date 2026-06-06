import { NextRequest, NextResponse } from 'next/server'
import {
  createCustomer,
  getCustomerById,
  getCustomerHistory,
  listCustomers,
  type CreateCustomerInput,
} from '@/lib/data/customers'
import { createClient } from '@/lib/supabase/server'
import type { Customer, CustomerAddress, CustomerHistory } from '@/lib/types/crm'

export type CustomersApiSuccess =
  | { success: true; customerId: string }
  | { success: true; customer: Customer }
  | { success: true; customers: Customer[] }
  | { success: true; history: CustomerHistory }

export type CustomersApiError = { success: false; error: string }

async function requireAuth(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return !error && !!user
}

function parseAddress(value: unknown): CustomerAddress | null | undefined {
  if (value === undefined) return undefined
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const raw = value as Record<string, unknown>
  const address: CustomerAddress = {}
  if (raw.street !== undefined) {
    address.street = raw.street == null ? undefined : String(raw.street)
  }
  if (raw.city !== undefined) {
    address.city = raw.city == null ? undefined : String(raw.city)
  }
  if (raw.state !== undefined) {
    address.state = raw.state == null ? undefined : String(raw.state)
  }
  if (raw.zip !== undefined) {
    address.zip = raw.zip == null ? undefined : String(raw.zip)
  }
  return address
}

function parseCreateBody(
  body: unknown,
): { ok: true; input: CreateCustomerInput } | { ok: false; error: string } {
  if (body == null || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body.' }
  }

  const raw = body as Record<string, unknown>
  const full_name =
    typeof raw.full_name === 'string' ? raw.full_name.trim() : ''

  if (!full_name) {
    return { ok: false, error: 'Missing required field: full_name' }
  }

  const input: CreateCustomerInput = { full_name }

  if (raw.email !== undefined) {
    input.email = raw.email == null ? null : String(raw.email).trim() || null
  }
  if (raw.phone !== undefined) {
    input.phone = raw.phone == null ? null : String(raw.phone).trim() || null
  }
  if (raw.notes !== undefined) {
    input.notes = raw.notes == null ? null : String(raw.notes).trim() || null
  }
  if (raw.address !== undefined) {
    input.address = parseAddress(raw.address) ?? null
  }

  return { ok: true, input }
}

export async function GET(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json<CustomersApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (id) {
      if (searchParams.get('history') === 'true') {
        const history = await getCustomerHistory(id)
        if (!history) {
          return NextResponse.json<CustomersApiError>(
            { success: false, error: 'Customer not found' },
            { status: 404 },
          )
        }
        return NextResponse.json<CustomersApiSuccess>({ success: true, history })
      }

      const customer = await getCustomerById(id)
      if (!customer) {
        return NextResponse.json<CustomersApiError>(
          { success: false, error: 'Customer not found' },
          { status: 404 },
        )
      }
      return NextResponse.json<CustomersApiSuccess>({ success: true, customer })
    }

    const limitRaw = searchParams.get('limit')
    const limit = limitRaw != null ? Number(limitRaw) : undefined
    const customers = await listCustomers({
      search: searchParams.get('search') ?? undefined,
      limit: limit != null && Number.isFinite(limit) ? limit : undefined,
    })

    return NextResponse.json<CustomersApiSuccess>({ success: true, customers })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to list customers'
    return NextResponse.json<CustomersApiError>(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json<CustomersApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<CustomersApiError>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const parsed = parseCreateBody(body)
  if (!parsed.ok) {
    return NextResponse.json<CustomersApiError>(
      { success: false, error: parsed.error },
      { status: 400 },
    )
  }

  try {
    const customer = await createCustomer(parsed.input)
    return NextResponse.json<CustomersApiSuccess>(
      { success: true, customerId: customer.id },
      { status: 201 },
    )
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create customer'
    return NextResponse.json<CustomersApiError>(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
