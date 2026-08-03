/**
 * backend/utils/ragClient.ts
 *
 * HTTP client for the Python RAG FastAPI service.
 * If the service is unreachable, all methods return empty results (fail-safe).
 *
 * RAG Service runs at RAG_API_URL (default: http://localhost:8001)
 */

const RAG_API_URL = process.env.RAG_API_URL || 'http://localhost:8001'
const RAG_TIMEOUT_MS = 4000 // 4s max wait — must not block the session response

export interface RagChunk {
  content: string
  folder: string
  filename: string
  score: number
}

/**
 * Searches the knowledge base for chunks relevant to the given query.
 * @param query        The user's message or a derived search query
 * @param accountName  Optional account slug (e.g. "phoenix automotive") for scoped retrieval
 * @param k            Number of chunks to return (default 5 = balanced)
 */
export async function searchKnowledgeBase(
  query: string,
  accountName?: string | null,
  k = 5
): Promise<RagChunk[]> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), RAG_TIMEOUT_MS)

    const res = await fetch(`${RAG_API_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, account_name: accountName || null, k }),
      signal: controller.signal
    })

    clearTimeout(timer)

    if (!res.ok) {
      console.warn(`[RAG] Search returned HTTP ${res.status}`)
      return []
    }

    const data: any = await res.json()
    return (data.results || []) as RagChunk[]

  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn('[RAG] Search timed out — falling back to no context')
    } else {
      console.warn('[RAG] Search error (non-fatal):', err.message)
    }
    return []
  }
}

/**
 * Formats a list of RAG chunks into a context block for injection into the LLM prompt.
 * Returns an empty string if no chunks are provided.
 */
export function formatRagContext(chunks: RagChunk[], accountName?: string | null): string {
  if (!chunks || chunks.length === 0) return ''

  const accountLabel = accountName
    ? accountName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'Knowledge Base'

  const contextLines = chunks
    .map((c, i) => `[Source ${i + 1}: ${c.folder}/${c.filename}]\n${c.content.trim()}`)
    .join('\n\n')

  return `\n\n--- ACCOUNT KNOWLEDGE BASE CONTEXT (${accountLabel}) ---\nThe following is factual information retrieved from the account's knowledge base. Use it to ground your responses realistically. Do not reveal that you are reading from a document — speak naturally as the persona would.\n\n${contextLines}\n--- END CONTEXT ---`
}

/**
 * Returns all unique account names available in the KB.
 */
export async function listKbAccounts(): Promise<Array<{ id: string; name: string }>> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)

    const res = await fetch(`${RAG_API_URL}/accounts`, { signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) return []
    const data: any = await res.json()
    return data.accounts || []
  } catch {
    return []
  }
}
