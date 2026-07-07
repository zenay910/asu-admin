import { NextResponse } from 'next/server'
import {
  getMerchantEnvStatus,
  hasGoogleMerchantRefreshToken,
} from '@/lib/google-merchant'

/** Temporary dev diagnostic: env presence + refresh token (no secret values). */
export async function GET() {
  const { env, missing, ready: envReady } = getMerchantEnvStatus()

  let hasRefreshToken = false
  let serviceClientError: string | null = null

  try {
    hasRefreshToken = await hasGoogleMerchantRefreshToken()
  } catch (error) {
    serviceClientError =
      error instanceof Error ? error.message : 'Failed to read store_settings.'
  }

  return NextResponse.json({
    ready: envReady && hasRefreshToken && !serviceClientError,
    env,
    missing,
    hasRefreshToken,
    serviceClientError,
  })
}
