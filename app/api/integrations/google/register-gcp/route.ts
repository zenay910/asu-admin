import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const REFRESH_TOKEN_KEY = 'google_merchant_refresh_token'

/** Replace with your Google account email before running this one-time route. */
const DEVELOPER_EMAIL = 'yanezhjs@gmail.com'

export async function GET() {
  const merchantId = process.env.GOOGLE_MERCHANT_ID
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!merchantId || !clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          'Missing GOOGLE_MERCHANT_ID, GOOGLE_CLIENT_ID, or GOOGLE_CLIENT_SECRET.',
      },
      { status: 500 },
    )
  }

  // if (DEVELOPER_EMAIL === 'YOUR_EMAIL_HERE') {
  //   return NextResponse.json(
  //     {
  //       error:
  //         'Set DEVELOPER_EMAIL in app/api/integrations/google/register-gcp/route.ts before running.',
  //     },
  //     { status: 400 },
  //   )
  // }

  let supabase
  try {
    supabase = createServiceClient()
  } catch (error) {
    console.error('[register-gcp] Service client error:', error)
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
    console.error('[register-gcp] Failed to read refresh token:', tokenError.message)
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
    console.error('[register-gcp] Token refresh failed:', tokens)
    return NextResponse.json(
      {
        error: 'Failed to obtain access token from Google.',
        detail: tokens.error_description ?? tokens.error ?? tokenResponse.statusText,
      },
      { status: 500 },
    )
  }

  const registerResponse = await fetch(
    `https://merchantapi.googleapis.com/accounts/v1/accounts/${merchantId}/developerRegistration:registerGcp`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ developerEmail: DEVELOPER_EMAIL }),
    },
  )

  const registerBody = await registerResponse.json().catch(() => null)

  if (!registerResponse.ok) {
    const message =
      (registerBody as { error?: { message?: string } } | null)?.error?.message ??
      registerResponse.statusText
    console.error('[register-gcp] registerGcp failed:', registerBody)
    return NextResponse.json(
      { error: 'registerGcp request failed.', detail: message, response: registerBody },
      { status: registerResponse.status },
    )
  }

  return NextResponse.json({
    success: true,
    message: 'GCP project registered with Merchant Center.',
    developerEmail: DEVELOPER_EMAIL,
    registration: registerBody,
  })
}
