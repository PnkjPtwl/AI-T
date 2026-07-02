/**
 * voiceAiClient.ts — Fail-soft HTTP client for the voice-ai sidecar.
 *
 * DESIGN RULES:
 *  1. VOICE_AI_ENABLED=false (or unset) → returns null immediately, zero network calls.
 *  2. If the sidecar is down, slow, or errors → returns null, never throws.
 *  3. This must NEVER block or fail the main session flow.
 *
 * REVERSIBILITY:
 *  Set VOICE_AI_ENABLED=false in .env (or docker-compose env) and restart.
 *  No rebuild needed. Feature vanishes completely.
 */

import axios from 'axios'
import FormData from 'form-data'

// For local dev: http://localhost:8000. In Docker: http://voice-ai:8000
const VOICE_AI_URL = process.env.VOICE_AI_URL || 'http://localhost:8000'
const VOICE_AI_ENABLED = process.env.VOICE_AI_ENABLED === 'true'
const TIMEOUT_MS = Number(process.env.VOICE_AI_TIMEOUT_MS || 4000)

export interface ProsodyMetrics {
  pitchMean: number
  pitchStd: number
  pitchRange: number
  energyMean: number
  energyStd: number
  durationSec: number
  pauseRatio: number
}

export interface VoiceMetrics {
  status: 'ok' | 'skipped_too_short' | 'error'
  prosody: ProsodyMetrics | null
  emotion: {
    label: string
    confidence: number
    distribution: Record<string, number>
  } | null
}

export async function analyzeVoice(
  audioBuffer: Buffer,
  filename: string
): Promise<VoiceMetrics | null> {
  if (!VOICE_AI_ENABLED) return null

  try {
    const form = new FormData()
    form.append('audio', audioBuffer, { filename, contentType: 'audio/webm' })

    const { data } = await axios.post<VoiceMetrics>(
      `${VOICE_AI_URL}/analyze-voice`,
      form,
      {
        headers: form.getHeaders(),
        timeout: TIMEOUT_MS,
      }
    )
    return data
  } catch (err: any) {
    // Fail soft, always. This must never throw up into the session flow.
    console.error(
      '[voiceAiClient] analyzeVoice failed, continuing without voice metrics:',
      err.message || err
    )
    return null
  }
}
