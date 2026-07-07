import { getApplianceById } from '@/lib/data/appliances'
import { createServiceClient } from '@/lib/supabase/service'
import type { Appliance, ApplianceStatus } from '@/lib/types/inventory'

const REFRESH_TOKEN_KEY = 'google_merchant_refresh_token'
const LAST_ERROR_KEY = 'google_merchant_last_error'
const LAST_SYNCED_AT_KEY = 'google_merchant_last_synced_at'

export type GoogleMerchantAvailability = 'IN_STOCK' | 'OUT_OF_STOCK'

export type GoogleMerchantSyncResult =
  | { synced: true; availability: GoogleMerchantAvailability }
  | { synced: false; reason: string }

const LOCAL_INCLUDED_DESTINATIONS = [
  'LOCAL_INVENTORY_ADS',
  'FREE_LOCAL_LISTINGS',
] as const

const ONLINE_EXCLUDED_DESTINATIONS = [
  'SHOPPING_ADS',
  'DISPLAY_ADS',
  'FREE_LISTINGS',
  'YOUTUBE_SHOPPING',
  'YOUTUBE_SHOPPING_CHECKOUT',
  'YOUTUBE_AFFILIATE',
] as const

type MerchantProductInput = {
  offerId: string
  contentLanguage: string
  feedLabel: string
  legacyLocal: true
  productAttributes: {
    title: string
    description: string
    link: string
    imageLink: string
    price: {
      amountMicros: string
      currencyCode: string
    }
    availability: GoogleMerchantAvailability
    condition: 'NEW' | 'USED'
    brand: string
    includedDestinations: readonly string[]
    excludedDestinations: readonly string[]
    pickupMethod: 'RESERVE'
    pickupSla: 'SAME_DAY'
  }
}

type LocalInventoryInput = {
  storeCode: string
  localInventoryAttributes: {
    price: {
      amountMicros: string
      currencyCode: string
    }
    availability: GoogleMerchantAvailability
  }
}

type MerchantConfig = {
  merchantId: string
  dataSourceId: string
  feedLabel: string
  contentLanguage: string
  currencyCode: string
  storefrontBaseUrl: string
  storeCode: string
  clientId: string
  clientSecret: string
}

const MERCHANT_ENV_KEYS = [
  'GOOGLE_MERCHANT_ID',
  'GOOGLE_MERCHANT_DATASOURCE_ID',
  'GOOGLE_MERCHANT_FEED_LABEL',
  'GOOGLE_MERCHANT_CONTENT_LANGUAGE',
  'GOOGLE_MERCHANT_CURRENCY',
  'STOREFRONT_BASE_URL',
  'GOOGLE_MERCHANT_STORE_CODE',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const

type MerchantEnvKey = (typeof MERCHANT_ENV_KEYS)[number]

function readRequiredMerchantEnv(): Record<MerchantEnvKey, string | undefined> {
  return {
    GOOGLE_MERCHANT_ID: process.env.GOOGLE_MERCHANT_ID,
    GOOGLE_MERCHANT_DATASOURCE_ID: process.env.GOOGLE_MERCHANT_DATASOURCE_ID,
    GOOGLE_MERCHANT_FEED_LABEL: process.env.GOOGLE_MERCHANT_FEED_LABEL,
    GOOGLE_MERCHANT_CONTENT_LANGUAGE: process.env.GOOGLE_MERCHANT_CONTENT_LANGUAGE,
    GOOGLE_MERCHANT_CURRENCY: process.env.GOOGLE_MERCHANT_CURRENCY,
    STOREFRONT_BASE_URL: process.env.STOREFRONT_BASE_URL,
    GOOGLE_MERCHANT_STORE_CODE: process.env.GOOGLE_MERCHANT_STORE_CODE,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  }
}

function getMissingMerchantEnvKeys(
  required: Record<MerchantEnvKey, string | undefined>,
): MerchantEnvKey[] {
  return MERCHANT_ENV_KEYS.filter((key) => !required[key])
}

/** Secret-safe env presence check for diagnostics (never returns values). */
export function getMerchantEnvStatus(): {
  env: Record<MerchantEnvKey, boolean>
  missing: MerchantEnvKey[]
  ready: boolean
} {
  const required = readRequiredMerchantEnv()
  const missing = getMissingMerchantEnvKeys(required)
  const env = Object.fromEntries(
    MERCHANT_ENV_KEYS.map((key) => [key, Boolean(required[key])]),
  ) as Record<MerchantEnvKey, boolean>

  return { env, missing, ready: missing.length === 0 }
}

function getMerchantConfig(): MerchantConfig | null {
  const required = readRequiredMerchantEnv()
  const missing = getMissingMerchantEnvKeys(required)

  if (missing.length > 0) {
    console.error('[google-merchant] Missing env vars:', missing.join(', '))
    return null
  }

  return {
    merchantId: required.GOOGLE_MERCHANT_ID!,
    dataSourceId: required.GOOGLE_MERCHANT_DATASOURCE_ID!,
    feedLabel: required.GOOGLE_MERCHANT_FEED_LABEL!,
    contentLanguage: required.GOOGLE_MERCHANT_CONTENT_LANGUAGE!,
    currencyCode: required.GOOGLE_MERCHANT_CURRENCY!,
    storefrontBaseUrl: required.STOREFRONT_BASE_URL!.replace(/\/$/, ''),
    storeCode: required.GOOGLE_MERCHANT_STORE_CODE!,
    clientId: required.GOOGLE_CLIENT_ID!,
    clientSecret: required.GOOGLE_CLIENT_SECRET!,
  }
}

async function getRefreshToken(): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('store_settings')
    .select('setting_value')
    .eq('setting_key', REFRESH_TOKEN_KEY)
    .maybeSingle()

  if (error) {
    console.error('[google-merchant] Failed to read refresh token:', error.message)
    return null
  }

  const token = data?.setting_value
  return typeof token === 'string' && token.length > 0 ? token : null
}

/** Secret-safe check for OAuth refresh token presence in store_settings. */
export async function hasGoogleMerchantRefreshToken(): Promise<boolean> {
  try {
    return (await getRefreshToken()) !== null
  } catch {
    return false
  }
}

async function getAccessToken(
  refreshToken: string,
  config: MerchantConfig,
): Promise<string | null> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const tokens = (await response.json()) as {
    access_token?: string
    error?: string
    error_description?: string
  }

  if (!response.ok || tokens.error || !tokens.access_token) {
    console.error(
      '[google-merchant] Token refresh failed:',
      tokens.error_description ?? tokens.error ?? response.statusText,
    )
    return null
  }

  return tokens.access_token
}

function mapCondition(condition: Appliance['condition']): 'NEW' | 'USED' {
  return condition === 'New' ? 'NEW' : 'USED'
}

function mapPrice(
  appliance: Appliance,
  config: MerchantConfig,
): { amountMicros: string; currencyCode: string } {
  return {
    amountMicros: String(Math.round(Number(appliance.price) * 1_000_000)),
    currencyCode: config.currencyCode,
  }
}

/** Product resource id for legacyLocal offers: local~contentLanguage~feedLabel~offerId */
export function buildLegacyLocalProductId(
  config: Pick<MerchantConfig, 'contentLanguage' | 'feedLabel'>,
  offerId: string,
): string {
  return `local~${config.contentLanguage}~${config.feedLabel}~${offerId}`
}

export function mapApplianceToProductInput(
  appliance: Appliance,
  imageLink: string,
  availability: GoogleMerchantAvailability,
  config: MerchantConfig,
): MerchantProductInput {
  const description =
    appliance.description_long?.trim() ||
    `${appliance.brand} ${appliance.title}`.trim()

  return {
    offerId: appliance.id,
    contentLanguage: config.contentLanguage,
    feedLabel: config.feedLabel,
    legacyLocal: true,
    productAttributes: {
      title: appliance.title,
      description,
      link: `${config.storefrontBaseUrl}/product/${appliance.id}`,
      imageLink,
      price: mapPrice(appliance, config),
      availability,
      condition: mapCondition(appliance.condition),
      brand: appliance.brand || 'Unknown',
      includedDestinations: LOCAL_INCLUDED_DESTINATIONS,
      excludedDestinations: ONLINE_EXCLUDED_DESTINATIONS,
      pickupMethod: 'RESERVE',
      pickupSla: 'SAME_DAY',
    },
  }
}

export function mapApplianceToLocalInventoryInput(
  appliance: Appliance,
  availability: GoogleMerchantAvailability,
  config: MerchantConfig,
): LocalInventoryInput {
  return {
    storeCode: config.storeCode,
    localInventoryAttributes: {
      price: mapPrice(appliance, config),
      availability,
    },
  }
}

async function getPrimaryImageLink(applianceId: string): Promise<string | null> {
  const supabase = createServiceClient()

  const { data: applianceImage, error: applianceImageError } = await supabase
    .from('appliance_images')
    .select('photo_url')
    .eq('appliance_id', applianceId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (applianceImageError) {
    console.error(
      '[google-merchant] Failed to read appliance_images:',
      applianceImageError.message,
    )
  } else if (applianceImage?.photo_url) {
    return String(applianceImage.photo_url)
  }

  const { data: productImage, error: productImageError } = await supabase
    .from('product_images')
    .select('photo_url')
    .eq('product_id', applianceId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (productImageError) {
    console.error(
      '[google-merchant] Failed to read product_images:',
      productImageError.message,
    )
    return null
  }

  return productImage?.photo_url ? String(productImage.photo_url) : null
}

async function insertProductInput(
  accessToken: string,
  body: MerchantProductInput,
  config: MerchantConfig,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const dataSource = `accounts/${config.merchantId}/dataSources/${config.dataSourceId}`
  const url = new URL(
    `https://merchantapi.googleapis.com/products/v1/accounts/${config.merchantId}/productInputs:insert`,
  )
  url.searchParams.set('dataSource', dataSource)

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let message = response.statusText
    try {
      const errorBody = (await response.json()) as { error?: { message?: string } }
      message = errorBody.error?.message ?? message
    } catch {
      // keep statusText
    }
    return { ok: false, message }
  }

  return { ok: true }
}

async function insertLocalInventory(
  accessToken: string,
  productId: string,
  body: LocalInventoryInput,
  config: MerchantConfig,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parent = `accounts/${config.merchantId}/products/${productId}`
  const url = `https://merchantapi.googleapis.com/inventories/v1/${parent}/localInventories:insert`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    let message = response.statusText
    try {
      const errorBody = (await response.json()) as { error?: { message?: string } }
      message = errorBody.error?.message ?? message
    } catch {
      // keep statusText
    }
    return { ok: false, message }
  }

  return { ok: true }
}

async function recordSyncOutcome(
  success: boolean,
  detail: string,
): Promise<void> {
  try {
    const supabase = createServiceClient()
    const now = new Date().toISOString()
    const rows = success
      ? [
          { setting_key: LAST_SYNCED_AT_KEY, setting_value: now },
          { setting_key: LAST_ERROR_KEY, setting_value: '' },
        ]
      : [{ setting_key: LAST_ERROR_KEY, setting_value: detail }]

    const { error } = await supabase.from('store_settings').upsert(rows, {
      onConflict: 'setting_key',
    })

    if (error) {
      console.error('[google-merchant] Failed to record sync outcome:', error.message)
    }
  } catch (error) {
    console.error('[google-merchant] Failed to record sync outcome:', error)
  }
}

function resolveSyncAvailability(
  prevStatus: ApplianceStatus | null,
  nextStatus: ApplianceStatus | null,
): GoogleMerchantAvailability | null {
  if (nextStatus === 'Published' && prevStatus !== 'Published') {
    return 'IN_STOCK'
  }
  if (prevStatus === 'Published' && nextStatus === 'Sold') {
    return 'OUT_OF_STOCK'
  }
  return null
}

async function syncApplianceToGoogle(
  applianceId: string,
  availability: GoogleMerchantAvailability,
): Promise<GoogleMerchantSyncResult> {
  const config = getMerchantConfig()
  if (!config) {
    const { missing } = getMerchantEnvStatus()
    const reason =
      missing.length > 0
        ? `Google Merchant sync skipped: missing env vars: ${missing.join(', ')}`
        : 'Google Merchant sync skipped: missing server configuration.'
    console.error('[google-merchant]', reason)
    await recordSyncOutcome(false, reason)
    return { synced: false, reason }
  }

  const refreshToken = await getRefreshToken()
  if (!refreshToken) {
    const reason = 'Google Merchant sync skipped: no refresh token in store_settings.'
    console.error('[google-merchant]', reason)
    return { synced: false, reason }
  }

  const accessToken = await getAccessToken(refreshToken, config)
  if (!accessToken) {
    const reason = 'Google Merchant sync skipped: could not obtain access token.'
    await recordSyncOutcome(false, reason)
    return { synced: false, reason }
  }

  const appliance = await getApplianceById(applianceId)
  if (!appliance) {
    const reason = `Google Merchant sync skipped: appliance ${applianceId} not found.`
    console.error('[google-merchant]', reason)
    return { synced: false, reason }
  }

  const imageLink = await getPrimaryImageLink(applianceId)
  if (!imageLink) {
    const reason = `Google Merchant sync skipped: no image for appliance ${applianceId}.`
    console.error('[google-merchant]', reason)
    await recordSyncOutcome(false, reason)
    return { synced: false, reason }
  }

  const productInput = mapApplianceToProductInput(
    appliance,
    imageLink,
    availability,
    config,
  )

  const productResult = await insertProductInput(accessToken, productInput, config)
  if (!productResult.ok) {
    const reason = `Google Merchant API error: ${productResult.message}`
    console.error('[google-merchant]', reason)
    await recordSyncOutcome(false, reason)
    return { synced: false, reason }
  }

  const productId = buildLegacyLocalProductId(config, appliance.id)
  const localInventoryInput = mapApplianceToLocalInventoryInput(
    appliance,
    availability,
    config,
  )

  const localResult = await insertLocalInventory(
    accessToken,
    productId,
    localInventoryInput,
    config,
  )
  if (!localResult.ok) {
    const reason = `Google Merchant local inventory error: ${localResult.message}`
    console.error('[google-merchant]', reason)
    await recordSyncOutcome(false, reason)
    return { synced: false, reason }
  }

  await recordSyncOutcome(true, availability)
  return { synced: true, availability }
}

/** Sync to Google Merchant on status transition. Never throws. */
export async function syncGoogleMerchantOnStatusChange(
  applianceId: string,
  prevStatus: ApplianceStatus | null,
  nextStatus: ApplianceStatus | null,
): Promise<GoogleMerchantSyncResult> {
  try {
    const availability = resolveSyncAvailability(prevStatus, nextStatus)
    if (!availability) {
      return { synced: false, reason: 'No Google Merchant sync required for this transition.' }
    }

    return await syncApplianceToGoogle(applianceId, availability)
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : 'Unexpected Google Merchant sync failure.'
    console.error('[google-merchant] Unexpected error:', error)
    await recordSyncOutcome(false, reason)
    return { synced: false, reason }
  }
}
