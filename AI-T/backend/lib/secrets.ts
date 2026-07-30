// =============================================================================
// lib/secrets.ts — Dynamic Secret Loader with TTL Cache
// =============================================================================

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

const CACHE_TTL_MS = 5 * 60 * 1000  // 5 minutes
const SECRET_NAME  = process.env.SECRET_NAME || 'salescoach/demo/backend'

let cachedSecrets: Record<string, string> | null = null
let cacheTimestamp = 0

const isAWS = !!process.env.AWS_REGION

const client = isAWS
  ? new SecretsManagerClient({ region: process.env.AWS_REGION })
  : null

export async function getSecrets(): Promise<Record<string, string>> {
  if (!isAWS) {
    return process.env as Record<string, string>
  }

  const now = Date.now()
  if (cachedSecrets && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedSecrets
  }

  try {
    const cmd = new GetSecretValueCommand({ SecretId: SECRET_NAME })
    const res = await client!.send(cmd)
    cachedSecrets = JSON.parse(res.SecretString || '{}')
    cacheTimestamp = Date.now()
    console.log(`[Secrets] ✅ Refreshed from AWS Secrets Manager at ${new Date().toISOString()}`)
    return cachedSecrets!
  } catch (err) {
    console.error('[Secrets] ❌ Failed to fetch from Secrets Manager:', err)
    if (cachedSecrets) {
      console.warn('[Secrets] ⚠️ Returning stale cached secrets')
      return cachedSecrets
    }
    throw err
  }
}

export async function getSecret(key: string): Promise<string> {
  const secrets = await getSecrets()
  return secrets[key] || ''
}

export async function initSecrets(): Promise<void> {
  await getSecrets()
  console.log('[Secrets] Cache initialized')
}
