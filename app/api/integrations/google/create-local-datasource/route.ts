import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const REFRESH_TOKEN_KEY = 'google_merchant_refresh_token'

function parseDataSourceId(response: {
  name?: string
  dataSourceId?: string
}): string | null {
  if (response.dataSourceId) {
    return String(response.dataSourceId)
  }
  if (response.name) {
    const match = response.name.match(/dataSources\/([^/]+)$/)
    return match?.[1] ?? null
  }
  return null
}

/** One-time route: create a legacyLocal primary API data source for in-store inventory. */
export async function GET() {
  const merchantId = process.env.GOOGLE_MERCHANT_ID
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const feedLabel = process.env.GOOGLE_MERCHANT_FEED_LABEL ?? 'US'
  const contentLanguage = process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE ?? 'en'

  if (!merchantId || !clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          'Missing GOOGLE_MERCHANT_ID, GOOGLE_CLIENT_ID, or GOOGLE_CLIENT_SECRET.',
      },
      { status: 500 },
    )
  }

  let supabase
  try {
    supabase = createServiceClient()
  } catch (error) {
    console.error('[create-local-datasource] Service client error:', error)
    return NextResponse.json(
      { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing.' },
      { status: 500 },
    )
  }

  const { data: tokenRow, error: tokenError } = await supabase
    .from('store_settings')
    .select('setting_value')
    .eq('setting_key', REFRESH_TOKEN_KEY)
    .maybeSingle()

  if (tokenError) {
    console.error('[create-local-datasource] Failed to read refresh token:', tokenError.message)
    return NextResponse.json(
      { error: 'Failed to read refresh token from store_settings.', detail: tokenError.message },
      { status: 500 },
    )
  }

  const refreshToken = tokenRow?.setting_value
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    return NextResponse.json(
      {
        error:
          'No google_merchant_refresh_token in store_settings. Complete OAuth at /api/integrations/google first.',
      },
      { status: 400 },
    )
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = (await tokenResponse.json()) as {
    access_token?: string
    error?: string
    error_description?: string
  }

  if (!tokenResponse.ok || tokens.error || !tokens.access_token) {
    console.error('[create-local-datasource] Token refresh failed:', tokens)
    return NextResponse.json(
      {
        error: 'Failed to obtain access token from Google.',
        detail: tokens.error_description ?? tokens.error ?? tokenResponse.statusText,
      },
      { status: 500 },
    )
  }

  // v1 removed `channel`; legacyLocal on the data source marks it local-only.
  const createBody = {
    displayName: 'ASU Local In-Store Inventory',
    primaryProductDataSource: {
      feedLabel,
      contentLanguage,
      countries: ['US'],
      legacyLocal: true,
    },
  }

  const createResponse = await fetch(
    `https://merchantapi.googleapis.com/datasources/v1/accounts/${merchantId}/dataSources`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    },
  )

  const createResult = (await createResponse.json().catch(() => null)) as {
    name?: string
    dataSourceId?: string
    error?: { message?: string }
  } | null

  if (!createResponse.ok) {
    const message =
      createResult?.error?.message ?? createResponse.statusText
    console.error('[create-local-datasource] dataSources.create failed:', createResult)
    return NextResponse.json(
      {
        error: 'dataSources.create request failed.',
        detail: message,
        request: createBody,
        response: createResult,
      },
      { status: createResponse.status },
    )
  }

  const dataSourceId = parseDataSourceId(createResult ?? {})

  return NextResponse.json({
    success: true,
    message:
      'Local primary API data source created. Update GOOGLE_MERCHANT_DATASOURCE_ID in .env.local, then restart the dev server.',
    name: createResult?.name ?? null,
    dataSourceId,
    envUpdate: dataSourceId
      ? `GOOGLE_MERCHANT_DATASOURCE_ID=${dataSourceId}`
      : null,
    dataSource: createResult,
    note:
      'Merchant API v1 does not accept a channel field on data sources; legacyLocal: true was used instead.',
  })
}
