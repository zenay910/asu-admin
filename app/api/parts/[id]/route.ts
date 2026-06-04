import { NextRequest, NextResponse } from 'next/server'
import { getPartById, updatePart } from '@/lib/data/parts'
import {
  friendlyPartDbError,
  parseUpdatePartBody,
} from '@/lib/parts/parse-part-body'
import { createClient } from '@/lib/supabase/server'
import type { Part } from '@/lib/types/inventory'

export type PartByIdApiSuccess = { success: true; part: Part }
export type PartByIdApiError = { success: false; error: string }

async function requireAuth(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return !error && !!user
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json<PartByIdApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id } = await context.params
  const existing = await getPartById(id)
  if (!existing) {
    return NextResponse.json<PartByIdApiError>(
      { success: false, error: 'Part not found' },
      { status: 404 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<PartByIdApiError>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const parsed = parseUpdatePartBody(body)
  if (!parsed.ok) {
    return NextResponse.json<PartByIdApiError>(
      { success: false, error: parsed.error },
      { status: 400 },
    )
  }

  if (Object.keys(parsed.input).length === 0) {
    return NextResponse.json<PartByIdApiError>(
      { success: false, error: 'No fields to update' },
      { status: 400 },
    )
  }

  try {
    const part = await updatePart(id, parsed.input)
    return NextResponse.json<PartByIdApiSuccess>({ success: true, part })
  } catch (err) {
    const message = friendlyPartDbError(
      err instanceof Error ? err.message : 'Failed to update part',
    )
    return NextResponse.json<PartByIdApiError>(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
