import { NextRequest, NextResponse } from 'next/server'
import {
  linkPartToAppliance,
  unlinkPart,
} from '@/lib/data/part-compatibility'
import { getPartById } from '@/lib/data/parts'
import { getApplianceById } from '@/lib/data/appliances'
import { createClient } from '@/lib/supabase/server'

export type CompatibilityApiSuccess = { success: true }
export type CompatibilityApiError = { success: false; error: string }

async function requireAuth(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  return !error && !!user
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json<CompatibilityApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: partId } = await context.params
  const part = await getPartById(partId)
  if (!part) {
    return NextResponse.json<CompatibilityApiError>(
      { success: false, error: 'Part not found' },
      { status: 404 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json<CompatibilityApiError>(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  if (body == null || typeof body !== 'object') {
    return NextResponse.json<CompatibilityApiError>(
      { success: false, error: 'Invalid request body.' },
      { status: 400 },
    )
  }

  const raw = body as Record<string, unknown>
  const applianceId =
    typeof raw.appliance_id === 'string' ? raw.appliance_id.trim() : ''
  if (!applianceId) {
    return NextResponse.json<CompatibilityApiError>(
      { success: false, error: 'Missing required field: appliance_id' },
      { status: 400 },
    )
  }

  const appliance = await getApplianceById(applianceId)
  if (!appliance) {
    return NextResponse.json<CompatibilityApiError>(
      { success: false, error: 'Appliance not found' },
      { status: 404 },
    )
  }

  const notes =
    raw.notes == null || raw.notes === ''
      ? null
      : String(raw.notes).trim() || null

  try {
    await linkPartToAppliance(partId, applianceId, notes)
    return NextResponse.json<CompatibilityApiSuccess>({ success: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to link part to appliance'
    return NextResponse.json<CompatibilityApiError>(
      { success: false, error: message },
      { status: 400 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json<CompatibilityApiError>(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id: partId } = await context.params
  const applianceId = request.nextUrl.searchParams.get('appliance_id')?.trim()
  if (!applianceId) {
    return NextResponse.json<CompatibilityApiError>(
      { success: false, error: 'Missing query parameter: appliance_id' },
      { status: 400 },
    )
  }

  try {
    await unlinkPart(partId, applianceId)
    return NextResponse.json<CompatibilityApiSuccess>({ success: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to unlink part from appliance'
    return NextResponse.json<CompatibilityApiError>(
      { success: false, error: message },
      { status: 400 },
    )
  }
}
