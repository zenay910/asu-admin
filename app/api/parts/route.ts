import { NextRequest, NextResponse } from 'next/server'
import { createPart, getPartById, listParts } from '@/lib/data/parts'
import {
  friendlyPartDbError,
  parseCreatePartBody,
} from '@/lib/parts/parse-part-body'
import { createClient } from '@/lib/supabase/server'
import type { Part } from '@/lib/types/inventory'

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

  const parsed = parseCreatePartBody(body)
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
    const message = friendlyPartDbError(
      err instanceof Error ? err.message : 'Failed to create part',
    )
    return NextResponse.json<PartsApiError>(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
