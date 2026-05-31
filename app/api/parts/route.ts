import { NextRequest, NextResponse } from 'next/server'
import {
  createPart,
  getPartById,
  listParts,
  type CreatePartInput,
} from '@/lib/data/parts'
import { createClient } from '@/lib/supabase/server'
import type { Part, PartStatus } from '@/lib/types/inventory'

export type PartsApiSuccess =
  | { success: true; partId: string }
  | { success: true; part: Part }
  | { success: true; parts: Part[] }

export type PartsApiError = { success: false; error: string }

async function requireAuth(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return !error && !!user
}

function parseCreateBody(
  body: unknown,
): { ok: true; input: CreatePartInput } | { ok: false; error: string } {
  if (body == null || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body.' }
  }

  const raw = body as Record<string, unknown>
  const part_number =
    typeof raw.part_number === 'string' ? raw.part_number.trim() : ''
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''

  if (!part_number) {
    return { ok: false, error: 'Missing required field: part_number' }
  }
  if (!name) {
    return { ok: false, error: 'Missing required field: name' }
  }

  const input: CreatePartInput = { part_number, name }

  if (raw.description !== undefined) {
    input.description =
      raw.description == null ? null : String(raw.description)
  }
  if (raw.brand !== undefined) {
    input.brand = raw.brand == null ? null : String(raw.brand)
  }
  if (raw.category !== undefined) {
    input.category = raw.category == null ? null : String(raw.category)
  }
  if (raw.location !== undefined) {
    input.location = raw.location == null ? null : String(raw.location)
  }
  if (raw.quantity_on_hand !== undefined) {
    const qty = Number(raw.quantity_on_hand)
    if (!Number.isFinite(qty) || qty < 0) {
      return { ok: false, error: 'quantity_on_hand must be a non-negative number' }
    }
    input.quantity_on_hand = qty
  }
  if (raw.reorder_threshold !== undefined) {
    const threshold =
      raw.reorder_threshold == null ? null : Number(raw.reorder_threshold)
    if (threshold != null && !Number.isFinite(threshold)) {
      return { ok: false, error: 'reorder_threshold must be a number' }
    }
    input.reorder_threshold = threshold
  }
  if (raw.unit_cost !== undefined) {
    const cost = raw.unit_cost == null ? null : Number(raw.unit_cost)
    if (cost != null && !Number.isFinite(cost)) {
      return { ok: false, error: 'unit_cost must be a number' }
    }
    input.unit_cost = cost
  }
  if (raw.unit_price !== undefined) {
    const price = raw.unit_price == null ? null : Number(raw.unit_price)
    if (price != null && !Number.isFinite(price)) {
      return { ok: false, error: 'unit_price must be a number' }
    }
    input.unit_price = price
  }
  if (raw.status !== undefined) {
    const status = String(raw.status)
    if (status !== 'Active' && status !== 'Discontinued') {
      return { ok: false, error: 'Invalid status; use Active or Discontinued' }
    }
    input.status = status as PartStatus
  }

  return { ok: true, input }
}

export async function GET(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json<PartsApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    const { searchParams } = request.nextUrl
    const id = searchParams.get('id')

    if (id) {
      const part = await getPartById(id)
      if (!part) {
        return NextResponse.json<PartsApiError>(
          { success: false, error: 'Part not found' },
          { status: 404 },
        )
      }
      return NextResponse.json<PartsApiSuccess>({ success: true, part })
    }

    const limitRaw = searchParams.get('limit')
    const limit = limitRaw != null ? Number(limitRaw) : undefined
    const statusParam = searchParams.get('status')
    const status =
      statusParam === 'Active' || statusParam === 'Discontinued'
        ? statusParam
        : undefined
    const parts = await listParts({
      status,
      category: searchParams.get('category') ?? undefined,
      brand: searchParams.get('brand') ?? undefined,
      limit: limit != null && Number.isFinite(limit) ? limit : undefined,
    })

    return NextResponse.json<PartsApiSuccess>({ success: true, parts })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list parts'
    return NextResponse.json<PartsApiError>(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json<PartsApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<PartsApiError>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const parsed = parseCreateBody(body)
  if (!parsed.ok) {
    return NextResponse.json<PartsApiError>(
      { success: false, error: parsed.error },
      { status: 400 },
    )
  }

  try {
    const part = await createPart(parsed.input)
    return NextResponse.json<PartsApiSuccess>(
      { success: true, partId: part.id },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create part'
    return NextResponse.json<PartsApiError>(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
