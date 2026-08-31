// =============================================================================
// lib/apiKeys.ts — Supabase-first API Key Loader with TTL Cache
// =============================================================================
// Priority: Supabase api_keys table → process.env (.env / AWS Secrets)
// Cache:    In-memory, refreshed every CACHE_TTL_MS (default 5 minutes).
//           Keys are NOT fetched from Supabase on every API call.
// =============================================================================

import { getSupabase } from '../db/supabase'

const CACHE_TTL_MS = 5 * 60 * 1000   // 5 minutes

// Only these keys are managed via Supabase; others still come from getSecret()
export const MANAGED_KEYS = [
  'CEREBRAS_API_KEY',
  'ELEVENLABS_API_KEY',
] as const

export type ManagedKey = typeof MANAGED_KEYS[number]

interface CacheEntry {
  value: string
  fetchedAt: number
}

const cache: Map<string, CacheEntry> = new Map()

/** Invalidate a single key in the cache (called after admin updates a key) */
export function invalidateApiKeyCache(keyName: string) {
  cache.delete(keyName)
  console.log(`[ApiKeys] Cache invalidated for ${keyName}`)
}

/** Invalidate the entire cache */
export function invalidateAllApiKeyCache() {
  cache.clear()
  console.log('[ApiKeys] Full cache invalidated')
}

/**
 * Fetch a managed API key.
 * 1. Check in-memory cache (TTL = 5 min)
 * 2. If miss → query Supabase api_keys table
 * 3. If not in Supabase → fall back to process.env
 */
export async function getApiKey(keyName: string): Promise<string> {
  // 1. In-memory cache hit
  const cached = cache.get(keyName)
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) {
    return cached.value
  }

  // 2. Fetch from Supabase
  try {
    const sb = await getSupabase()
    const { data, error } = await sb
      .from('api_keys')
      .select('key_value')
      .eq('key_name', keyName)
      .single()

    if (!error && data?.key_value) {
      const value = data.key_value
      cache.set(keyName, { value, fetchedAt: Date.now() })
      console.log(`[ApiKeys] ✅ Loaded ${keyName} from Supabase`)
      return value
    }
  } catch (err) {
    console.warn(`[ApiKeys] ⚠️ Could not fetch ${keyName} from Supabase:`, err)
  }

  // 3. Fall back to process.env / AWS Secrets (already in process.env after initSecrets)
  const envValue = process.env[keyName] || ''
  if (envValue) {
    // Cache the env value too so we don't check Supabase repeatedly
    cache.set(keyName, { value: envValue, fetchedAt: Date.now() })
    console.log(`[ApiKeys] ℹ️  ${keyName} using .env fallback`)
  } else {
    console.warn(`[ApiKeys] ❌ ${keyName} not found in Supabase or .env`)
  }
  return envValue
}

/**
 * Get the source of a key: 'supabase' | 'env' | 'none'
 * Used by admin UI to show status badge.
 */
export async function getApiKeySource(keyName: string): Promise<'supabase' | 'env' | 'none'> {
  try {
    const sb = await getSupabase()
    const { data, error } = await sb
      .from('api_keys')
      .select('key_name')
      .eq('key_name', keyName)
      .single()

    if (!error && data) return 'supabase'
  } catch (_) {}

  return process.env[keyName] ? 'env' : 'none'
}
