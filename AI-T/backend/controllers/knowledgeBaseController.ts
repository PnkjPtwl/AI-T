/**
 * backend/controllers/knowledgeBaseController.ts
 *
 * Handles all CRUD operations for custom Knowledge Base accounts.
 * File uploads are forwarded to the Python RAG service for processing,
 * and temp files are deleted locally after forwarding.
 */

import { supabase } from '../db/supabase'
import fs from 'fs'
import path from 'path'
import { Response } from 'express'

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:8001'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Converts a human-readable name to a URL/metadata-safe slug */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Forward uploaded files to RAG service and clean up temp files */
async function forwardFilesToRag(
  filePaths: string[],
  accountSlug: string,
  accountName: string,
  documentCategory?: string
): Promise<{ success: boolean; doc_count: number; chunk_count: number; error?: string }> {
  // Use native FormData + Blob (Node 18+ Web APIs) — compatible with native fetch.
  // The old npm `form-data` stream approach caused "error parsing the body" in FastAPI.
  const form = new globalThis.FormData()
  form.append('account_slug', accountSlug)
  form.append('account_name', accountName)
  form.append('document_category', documentCategory || 'uploaded')

  for (const filePath of filePaths) {
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath)
      const blob = new globalThis.Blob([buffer])
      form.append('files', blob, path.basename(filePath))
    }
  }

  try {
    // Do NOT set Content-Type manually — native fetch adds multipart/form-data + boundary automatically
    const res = await fetch(`${RAG_API_URL}/kb/upload`, {
      method: 'POST',
      body: form
    })

    if (!res.ok) {
      const text = await res.text()
      return { success: false, doc_count: 0, chunk_count: 0, error: `RAG service error: ${text}` }
    }

    const data: any = await res.json()
    return {
      success: data.success ?? true,
      doc_count: data.doc_count ?? 0,
      chunk_count: data.chunk_count ?? 0,
      error: data.error
    }
  } catch (err: any) {
    return { success: false, doc_count: 0, chunk_count: 0, error: err.message }
  } finally {
    // Always clean up temp files after forwarding
    for (const filePath of filePaths) {
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      } catch {}
    }
  }
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/** GET /api/knowledge-base — list all KBs for the org */
export const listKnowledgeBases = async (req: any, res: Response) => {
  try {
    const orgId = req.user.org_id
    const { data, error } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return res.json({ knowledge_bases: data || [] })
  } catch (err: any) {
    console.error('[KB] listKnowledgeBases error:', err)
    return res.status(500).json({ error: 'Failed to fetch knowledge bases' })
  }
}

/** GET /api/knowledge-base/:slug — get single KB details */
export const getKnowledgeBaseDetails = async (req: any, res: Response) => {
  try {
    const { slug } = req.params
    const orgId = req.user.org_id

    const { data, error } = await supabase
      .from('knowledge_bases')
      .select('*')
      .eq('slug', slug)
      .eq('org_id', orgId)
      .single()

    if (error || !data) return res.status(404).json({ error: 'Knowledge base not found' })
    return res.json(data)
  } catch (err: any) {
    console.error('[KB] getKnowledgeBaseDetails error:', err)
    return res.status(500).json({ error: 'Failed to fetch knowledge base' })
  }
}

/** POST /api/knowledge-base — create a new KB and process uploaded files */
export const createKnowledgeBase = async (req: any, res: Response) => {
  const orgId = req.user.org_id
  const userId = req.user.id
  const { name, description } = req.body

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Knowledge base name is required' })
  }

  const files: Express.Multer.File[] = (req as any).files || []
  if (!files.length) {
    return res.status(400).json({ error: 'At least one document must be uploaded' })
  }

  const slug = toSlug(name)

  // Check slug uniqueness within org
  const { data: existing } = await supabase
    .from('knowledge_bases')
    .select('id')
    .eq('slug', slug)
    .eq('org_id', orgId)
    .single()

  if (existing) {
    // Clean up temp files
    for (const f of files) try { fs.unlinkSync(f.path) } catch {}
    return res.status(409).json({ error: `A knowledge base with the name "${name}" already exists.` })
  }

  // 1. Create the KB record in 'processing' state
  const { data: kb, error: insertError } = await supabase
    .from('knowledge_bases')
    .insert({
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      org_id: orgId,
      created_by: userId,
      status: 'processing',
      document_count: 0,
      chunk_count: 0
    })
    .select()
    .single()

  if (insertError || !kb) {
    for (const f of files) try { fs.unlinkSync(f.path) } catch {}
    console.error('[KB] createKnowledgeBase insert error:', insertError)
    return res.status(500).json({ error: 'Failed to create knowledge base record' })
  }

  // 2. Forward files to RAG service for processing
  const filePaths = files.map((f: any) => f.path)
  const ragResult = await forwardFilesToRag(filePaths, slug, name.trim(), req.body?.document_category)

  // 3. Update KB record with result
  const newStatus = ragResult.success ? 'active' : 'error'
  await supabase
    .from('knowledge_bases')
    .update({
      status: newStatus,
      document_count: ragResult.doc_count,
      chunk_count: ragResult.chunk_count,
      updated_at: new Date().toISOString()
    })
    .eq('id', kb.id)

  if (!ragResult.success) {
    console.error('[KB] RAG processing failed:', ragResult.error)
    return res.status(500).json({
      error: 'Knowledge base created but document processing failed: ' + ragResult.error,
      kb_id: kb.id,
      slug
    })
  }

  const { data: finalKb } = await supabase
    .from('knowledge_bases')
    .select('*')
    .eq('id', kb.id)
    .single()

  return res.status(201).json({
    success: true,
    message: `Knowledge base "${name}" created successfully.`,
    knowledge_base: finalKb,
    doc_count: ragResult.doc_count,
    chunk_count: ragResult.chunk_count
  })
}

/** POST /api/knowledge-base/:slug/upload — append docs to an existing KB */
export const uploadDocuments = async (req: any, res: Response) => {
  const { slug } = req.params
  const orgId = req.user.org_id
  const files: Express.Multer.File[] = (req as any).files || []

  if (!files.length) {
    return res.status(400).json({ error: 'No files uploaded' })
  }

  // Verify the KB exists and belongs to this org
  const { data: kb, error: fetchError } = await supabase
    .from('knowledge_bases')
    .select('*')
    .eq('slug', slug)
    .eq('org_id', orgId)
    .single()

  if (fetchError || !kb) {
    for (const f of files) try { fs.unlinkSync(f.path) } catch {}
    return res.status(404).json({ error: 'Knowledge base not found' })
  }

  // Set status to processing
  await supabase
    .from('knowledge_bases')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', kb.id)

  // Forward files to RAG
  const filePaths = files.map((f: any) => f.path)
  const ragResult = await forwardFilesToRag(filePaths, slug, kb.name, req.body?.document_category)

  // Update counts (append to existing)
  const newDocCount = (kb.document_count || 0) + ragResult.doc_count
  const newChunkCount = (kb.chunk_count || 0) + ragResult.chunk_count
  const newStatus = ragResult.success ? 'active' : 'error'

  await supabase
    .from('knowledge_bases')
    .update({
      status: newStatus,
      document_count: newDocCount,
      chunk_count: newChunkCount,
      updated_at: new Date().toISOString()
    })
    .eq('id', kb.id)

  if (!ragResult.success) {
    return res.status(500).json({ error: 'Document processing failed: ' + ragResult.error })
  }

  return res.json({
    success: true,
    message: `${ragResult.doc_count} document(s) added to "${kb.name}"`,
    new_doc_count: newDocCount,
    new_chunk_count: newChunkCount
  })
}

/** DELETE /api/knowledge-base/:slug — delete KB and all its embeddings */
export const deleteKnowledgeBase = async (req: any, res: Response) => {
  const { slug } = req.params
  const orgId = req.user.org_id

  // Verify KB exists for this org
  const { data: kb } = await supabase
    .from('knowledge_bases')
    .select('id, name')
    .eq('slug', slug)
    .eq('org_id', orgId)
    .single()

  if (!kb) return res.status(404).json({ error: 'Knowledge base not found' })

  try {
    // 1. Delete embeddings from RAG service
    const ragRes = await fetch(`${RAG_API_URL}/kb/${encodeURIComponent(slug)}`, {
      method: 'DELETE'
    })
    if (!ragRes.ok) {
      const txt = await ragRes.text()
      console.warn('[KB] RAG delete returned non-OK:', txt)
    }
  } catch (err: any) {
    console.warn('[KB] RAG embedding delete failed (continuing):', err.message)
  }

  // 2. Delete the KB record from Supabase
  const { error: deleteError } = await supabase
    .from('knowledge_bases')
    .delete()
    .eq('id', kb.id)

  if (deleteError) {
    console.error('[KB] deleteKnowledgeBase error:', deleteError)
    return res.status(500).json({ error: 'Failed to delete knowledge base record' })
  }

  return res.json({ success: true, message: `Knowledge base "${kb.name}" deleted.` })
}
