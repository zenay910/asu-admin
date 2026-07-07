import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/** Server-only Supabase client with service role (bypasses RLS). Never import from client components. */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for service client.',
    )
  }

  return createSupabaseClient(url, serviceRoleKey)
}
