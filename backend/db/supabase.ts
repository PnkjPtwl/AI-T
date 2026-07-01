// =============================================================================
// db/supabase.ts — Lazy-initialized Supabase clients
// =============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getSecret } from '../lib/secrets'

let _supabase: SupabaseClient | null = null
let _supabaseAuth: SupabaseClient | null = null

export async function getSupabase(): Promise<SupabaseClient> {
  if (!_supabase) {
    const url = await getSecret('SUPABASE_URL')
    const key = await getSecret('SUPABASE_SERVICE_ROLE_KEY')

    if (!url || !key) {
      throw new Error(
        '❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.\n' +
        '   Check AWS Secrets Manager or your local .env file.'
      )
    }

    _supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  }
  return _supabase
}

export async function getSupabaseAuth(): Promise<SupabaseClient> {
  if (!_supabaseAuth) {
    const url = await getSecret('SUPABASE_URL')
    const key = await getSecret('SUPABASE_ANON_KEY')
    _supabaseAuth = createClient(url, key)
  }
  return _supabaseAuth
}

let _syncSupabase: SupabaseClient | null = null

export function setSyncSupabase(client: SupabaseClient) {
  _syncSupabase = client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_syncSupabase) {
      throw new Error(
        'supabase used before initSecrets(). Use getSupabase() instead, or await initSecrets() first.'
      )
    }
    return (_syncSupabase as any)[prop]
  }
})
