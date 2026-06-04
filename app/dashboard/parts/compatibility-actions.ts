'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

function revalidateCompatibilityPaths(partId: string, applianceId: string) {
  revalidatePath('/dashboard/parts')
  revalidatePath(`/dashboard/parts/${partId}`)
  revalidatePath('/dashboard/inventory/view')
  revalidatePath(`/dashboard/inventory/${applianceId}`)
}

async function compatibilityApiFetch(
  path: string,
  init: RequestInit,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const headerStore = await headers()
  const host = headerStore.get('host')
  if (!host) {
    return { ok: false, error: 'Could not resolve request host.' }
  }
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const cookie = headerStore.get('cookie') ?? ''

  const response = await fetch(`${protocol}://${host}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      cookie,
      ...(init.headers as Record<string, string> | undefined),
    },
  })

  const body = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null

  if (!response.ok) {
    const message =
      typeof body?.error === 'string'
        ? body.error
        : `Request failed (${response.status})`
    return { ok: false, error: message }
  }

  return { ok: true }
}

export async function linkPartCompatibility(
  partId: string,
  applianceId: string,
  notes?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await compatibilityApiFetch(
    `/api/parts/${partId}/compatibility`,
    {
      method: 'POST',
      body: JSON.stringify({
        appliance_id: applianceId,
        notes: notes?.trim() || null,
      }),
    },
  )

  if (!result.ok) return result

  revalidateCompatibilityPaths(partId, applianceId)
  return { ok: true }
}

export async function unlinkPartCompatibility(
  partId: string,
  applianceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await compatibilityApiFetch(
    `/api/parts/${partId}/compatibility?appliance_id=${encodeURIComponent(applianceId)}`,
    { method: 'DELETE' },
  )

  if (!result.ok) return result

  revalidateCompatibilityPaths(partId, applianceId)
  return { ok: true }
}
