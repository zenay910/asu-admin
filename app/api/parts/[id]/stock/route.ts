import { NextRequest, NextResponse } from 'next/server'
import { getPartById, recordStockMovement } from '@/lib/data/parts'
import { friendlyStockAdjustmentError } from '@/lib/parts/stock-errors'
import { createClient } from '@/lib/supabase/server'

export type AdjustStockApiSuccess = {
  success: true
  quantityOnHand: number
  movementId: string
}

export type AdjustStockApiError = { success: false; error: string }

async function requireAuth(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return !error && !!user
}

function parseAdjustBody(
  body: unknown,
): { ok: true; delta: number; reason: string | null } | { ok: false; error: string } {
  if (body == null || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body.' }
  }

  const raw = body as Record<string, unknown>
  const delta = Number(raw.delta)
  if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
    return { ok: false, error: 'delta must be a whole number' }
  }
  if (delta === 0) {
    return { ok: false, error: 'delta must not be zero' }
  }

  const reason =
    raw.reason == null || raw.reason === ''
      ? null
      : String(raw.reason).trim() || null

  return { ok: true, delta, reason }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json<AdjustStockApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id } = await context.params
  const part = await getPartById(id)
  if (!part) {
    return NextResponse.json<AdjustStockApiError>(
      { success: false, error: 'Part not found' },
      { status: 404 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<AdjustStockApiError>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  const parsed = parseAdjustBody(body)
  if (!parsed.ok) {
    return NextResponse.json<AdjustStockApiError>(
      { success: false, error: parsed.error },
      { status: 400 },
    )
  }

  try {
    const result = await recordStockMovement(id, parsed.delta, {
      reason: parsed.reason,
    })
    return NextResponse.json<AdjustStockApiSuccess>({
      success: true,
      quantityOnHand: result.quantityOnHand,
      movementId: result.movementId,
    })
  } catch (err) {
    const message = friendlyStockAdjustmentError(
      err instanceof Error ? err.message : 'Failed to adjust stock',
    )
    return NextResponse.json<AdjustStockApiError>(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
