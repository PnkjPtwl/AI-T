import express, { Response } from 'express'
import { authenticate } from '../middleware/auth'
import { managerOnly } from '../middleware/roleGuard'

const router = express.Router()

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:8001'

// GET /api/hubspot/accounts
router.get('/accounts', authenticate, managerOnly, async (req: any, res: Response) => {
  try {
    const ragRes = await fetch(`${RAG_API_URL}/hubspot/accounts`)
    if (!ragRes.ok) {
      return res.status(ragRes.status).json({ error: 'Failed to fetch hubspot accounts from RAG' })
    }
    const data = await ragRes.json()
    return res.json(data)
  } catch (err: any) {
    console.error('[HubSpot] getAccounts error:', err)
    return res.status(500).json({ error: 'Failed to fetch hubspot accounts' })
  }
})

// POST /api/hubspot/fetch
router.post('/fetch', authenticate, managerOnly, async (req: any, res: Response) => {
  try {
    const ragRes = await fetch(`${RAG_API_URL}/hubspot/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })
    if (!ragRes.ok) {
      return res.status(ragRes.status).json({ error: 'Failed to fetch hubspot data from RAG' })
    }
    const data = await ragRes.json()
    return res.json(data)
  } catch (err: any) {
    console.error('[HubSpot] fetchData error:', err)
    return res.status(500).json({ error: 'Failed to fetch hubspot crm data' })
  }
})

// POST /api/hubspot/ingest
router.post('/ingest', authenticate, managerOnly, async (req: any, res: Response) => {
  try {
    const ragRes = await fetch(`${RAG_API_URL}/hubspot/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    })
    if (!ragRes.ok) {
      return res.status(ragRes.status).json({ error: 'Failed to ingest hubspot data in RAG' })
    }
    const data = (await ragRes.json()) as any
    
    // Create Knowledge Base record in Supabase upon successful ingest
    if (data.success) {
      const { supabase } = await import('../db/supabase')
      const orgId = req.user.org_id
      const userId = req.user.id
      const accountSlug = req.body.account_slug
      const accountName = req.body.account_name
      
      // Check if it already exists
      const { data: existing } = await supabase
        .from('knowledge_bases')
        .select('id, document_count, chunk_count')
        .eq('slug', accountSlug)
        .eq('org_id', orgId)
        .single()
        
      if (existing) {
        // Update existing counts
        await supabase
          .from('knowledge_bases')
          .update({
            document_count: (existing.document_count || 0) + data.doc_count,
            chunk_count: (existing.chunk_count || 0) + data.chunk_count,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
      } else {
        // Create new
        await supabase
          .from('knowledge_bases')
          .insert({
            name: accountName,
            slug: accountSlug,
            description: 'HubSpot CRM Data',
            org_id: orgId,
            created_by: userId,
            status: 'active',
            document_count: data.doc_count,
            chunk_count: data.chunk_count
          })
      }
    }
    
    return res.json(data)
  } catch (err: any) {
    console.error('[HubSpot] ingestData error:', err)
    return res.status(500).json({ error: 'Failed to ingest hubspot data' })
  }
})

export default router
