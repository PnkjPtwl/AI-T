// =============================================================================
// ttsController.ts — ElevenLabs TTS proxy (with dynamic secrets)
// =============================================================================

import { getSecret } from '../lib/secrets'
import OpenAI from 'openai'

export const synthesizeSpeech = async (req: any, res: any) => {
  const { text, voice_id, avatarType } = req.body

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' })
  }

  const apiKey = await getSecret('ELEVENLABS_API_KEY')
  if (!apiKey) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' })
  }

  let selectedVoiceId = voice_id || 'EXAVITQu4vr4xnSDxMaL'
  if (avatarType === 'male') {
    selectedVoiceId = await getSecret('ELEVENLABS_VOICE_ID_MALE') || 'pNInz6obpgDQGcFmaJgB';
  } else if (avatarType === 'female') {
    selectedVoiceId = await getSecret('ELEVENLABS_VOICE_ID_FEMALE') || 'EXAVITQu4vr4xnSDxMaL';
  }

  console.log(`[TTS] Request for avatarType='${avatarType}', using voice_id='${selectedVoiceId}'`);

  try {
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!elevenRes.ok) {
      const errText = await elevenRes.text()
      console.warn('[TTS] ElevenLabs error, falling back to OpenAI:', elevenRes.status, errText)
      throw new Error('ElevenLabs fallback')
    }

    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Transfer-Encoding', 'chunked')
    res.setHeader('Cache-Control', 'no-cache')

    if (elevenRes.body) {
      const reader = elevenRes.body.getReader()
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
        res.end()
      }
      await pump()
    } else {
      res.end()
    }
  } catch (err: any) {
    if (err.message === 'ElevenLabs fallback' || !apiKey) {
      try {
        const openaiApiKey = await getSecret('OPENAI_API_KEY')
        if (!openaiApiKey) {
          return res.status(500).json({ error: 'Neither ElevenLabs nor OpenAI API keys configured' })
        }
        
        const openai = new OpenAI({ apiKey: openaiApiKey })
        const openAiVoice = avatarType === 'male' ? 'onyx' : 'alloy';
        const mp3 = await openai.audio.speech.create({
          model: 'tts-1',
          voice: openAiVoice,
          input: text.trim(),
        })
        
        const buffer = Buffer.from(await mp3.arrayBuffer())
        res.setHeader('Content-Type', 'audio/mpeg')
        res.setHeader('Content-Length', buffer.length)
        return res.end(buffer)
      } catch (fallbackErr: any) {
        console.error('[TTS] OpenAI fallback failed:', fallbackErr)
        if (!res.headersSent) {
          return res.status(500).json({ error: fallbackErr.message })
        }
      }
    }

    console.error('[TTS] Unexpected error:', err)
    if (!res.headersSent) {
      res.status(500).json({ error: err.message })
    }
  }
}

export const synthesizeSpeechBase64 = async (req: any, res: any) => {
  const { text, voice_id, avatarType } = req.body

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return res.status(400).json({ error: 'text is required' })
  }

  const apiKey = await getSecret('ELEVENLABS_API_KEY')
  if (!apiKey) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' })
  }

  let selectedVoiceId = voice_id || 'EXAVITQu4vr4xnSDxMaL'
  if (avatarType === 'male') {
    selectedVoiceId = await getSecret('ELEVENLABS_VOICE_ID_MALE') || 'pNInz6obpgDQGcFmaJgB';
  } else if (avatarType === 'female') {
    selectedVoiceId = await getSecret('ELEVENLABS_VOICE_ID_FEMALE') || 'EXAVITQu4vr4xnSDxMaL';
  }

  try {
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=pcm_16000`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/pcm',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      }
    )

    if (!elevenRes.ok) {
      const errText = await elevenRes.text()
      console.error('[TTS/Base64] ElevenLabs error:', elevenRes.status, errText)
      return res.status(502).json({
        error: 'ElevenLabs request failed',
        detail: errText,
      })
    }

    const pcmBuffer = Buffer.from(await elevenRes.arrayBuffer())
    const audioBase64 = pcmBuffer.toString('base64')

    return res.json({
      audioBase64,
      encoding: 'pcm_s16le',
      sampleRate: 16000,
      channels: 1,
    })
  } catch (err: any) {
    console.error('[TTS/Base64] Unexpected error:', err)
    return res.status(500).json({ error: err.message })
  }
}
