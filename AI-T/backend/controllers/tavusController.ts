import { Request, Response } from 'express'
import { getSecret } from '../lib/secrets'

export const createConversation = async (req: Request, res: Response) => {
  try {
    const apiKey    = await getSecret('TAVUS_API_KEY')
    const replicaId = await getSecret('TAVUS_REPLICA_ID')
    const personaId = await getSecret('TAVUS_PERSONA_ID')

    if (!apiKey || !replicaId || !personaId) {
      return res.status(500).json({ error: 'Missing Tavus environment variables' })
    }

    const activeRes = await fetch('https://tavusapi.com/v2/conversations?status=active', {
      headers: { 'x-api-key': apiKey }
    })
    
    if (activeRes.ok) {
      const activeData: any = await activeRes.json()
      if (activeData.data && activeData.data.length > 0) {
        console.log(`[TAVUS] Found ${activeData.data.length} active conversations. Ending them...`)
        for (const conv of activeData.data) {
          await fetch(`https://tavusapi.com/v2/conversations/${conv.conversation_id}/end`, {
            method: 'POST',
            headers: { 'x-api-key': apiKey }
          })
        }
      }
    }

    const payload = {
      face_id: replicaId,
      pal_id: personaId,
      conversation_name: 'AI Sales Training Session',
      conversational_context: 'You are a presentation layer only. The backend controls all responses. You MUST wait until you receive conversation.echo before speaking.',
      custom_greeting: '',
      properties: {
        max_call_duration: 900,
        participant_absent_timeout: 600
      }
    }

    const tavusRes = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!tavusRes.ok) {
      const errorText = await tavusRes.text()
      console.error('[TAVUS] Error creating conversation:', errorText)
      return res.status(tavusRes.status).json({ error: `Failed to create Tavus conversation: ${errorText}` })
    }

    const data = await tavusRes.json()
    res.json(data)

  } catch (error) {
    console.error('[TAVUS] Internal error creating conversation:', error)
    res.status(500).json({ error: 'Internal error creating Tavus conversation' })
  }
}
