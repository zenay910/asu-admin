import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.json({ error: 'No authorization code returned' }, { status: 400 })
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = (await tokenResponse.json()) as {
    refresh_token?: string
    error?: string
    error_description?: string
  }

  if (tokens.error) {
    return NextResponse.json({ error: tokens.error_description }, { status: 500 })
  }

  if (!tokens.refresh_token) {
    return NextResponse.json(
      {
        error:
          'Google did not return a refresh token. Revoke app access in your Google Account, then reconnect with consent.',
      },
      { status: 500 },
    )
  }

  let supabase
  try {
    supabase = createServiceClient()
  } catch (error) {
    console.error('Service client error:', error)
    return NextResponse.json(
      { error: 'Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is missing.' },
      { status: 500 },
    )
  }

  const { error } = await supabase.from('store_settings').upsert(
    {
      setting_key: 'google_merchant_refresh_token',
      setting_value: tokens.refresh_token,
    },
    { onConflict: 'setting_key' },
  )

  if (error) {
    console.error('Supabase save error:', error)
    return NextResponse.json(
      {
        error: 'Failed to save token to database',
        detail: error.message,
      },
      { status: 500 },
    )
  }

  return NextResponse.redirect(new URL('/', request.url))
}