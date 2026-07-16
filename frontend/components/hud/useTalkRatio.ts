'use client'

import { useMemo } from 'react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface TalkRatioResult {
  repPct: number       // 0-100
  customerPct: number  // 0-100
  repWords: number
  customerWords: number
  isWarning: boolean   // rep talking > 70%
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * useTalkRatio
 * Computes rep vs. customer word-count ratio from the full messages array.
 * Purely derived from existing state — no network calls.
 */
export function useTalkRatio(messages: ChatMessage[]): TalkRatioResult {
  return useMemo(() => {
    let repWords = 0
    let customerWords = 0

    for (const m of messages) {
      const wc = countWords(m.content)
      if (m.role === 'user') repWords += wc
      else customerWords += wc
    }

    const total = repWords + customerWords
    const repPct = total > 0 ? Math.round((repWords / total) * 100) : 0
    const customerPct = 100 - repPct

    return {
      repPct,
      customerPct,
      repWords,
      customerWords,
      isWarning: repPct > 70,
    }
  }, [messages])
}
