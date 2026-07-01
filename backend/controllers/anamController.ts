// =============================================================================
// anamController.ts — Anam AI session token provider (with dynamic secrets)
// =============================================================================

import { Request, Response } from 'express'
import { getSecret } from '../lib/secrets'

export const getAnamSessionToken = async (req: Request, res: Response) => {
  try {
    const apiKey   = await getSecret('ANAM_API_KEY')
    const avatarId = await getSecret('ANAM_AVATAR_ID')

    if (!apiKey || !avatarId) {
      return res.status(500).json({ error: 'Anam API key or Avatar ID not configured' })
    }

    const anamRes = await fetch('https://api.anam.ai/v1/auth/session-token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personaConfig: {
          name: 'Sales Coach Avatar',
          avatarId,
          voiceId: '6bfbe25a-979d-40f3-a92b-5394170af54b',
          systemPrompt: 'You are a visual avatar renderer only. Do not speak autonomously.',
          enableAudioPassthrough: true,
        },
      }),
    })

    if (!anamRes.ok) {
      const errText = await anamRes.text()
      console.error('[ANAM] Failed to get session token:', anamRes.status, errText)
      return res.status(anamRes.status).json({
        error: 'Failed to get Anam session token',
        detail: errText,
      })
    }

    const data = await anamRes.json() as any
    return res.json({ sessionToken: data.sessionToken })
  } catch (err: any) {
    console.error('[ANAM] Unexpected error:', err)
    return res.status(500).json({ error: err.message })
  }
}
