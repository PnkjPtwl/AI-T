'use client'

import { useState, useCallback } from 'react'

type PaceLabel = 'too_fast' | 'good' | 'too_slow' | 'unknown'

interface PaceResult {
  wpm: number
  label: PaceLabel
  labelText: string
  color: string
}

function classifyWpm(wpm: number): Omit<PaceResult, 'wpm'> {
  if (wpm === 0) return { label: 'unknown', labelText: '—', color: 'text-gray-400' }
  if (wpm > 160) return { label: 'too_fast', labelText: 'Too Fast', color: 'text-red-400' }
  if (wpm < 100) return { label: 'too_slow', labelText: 'Too Slow', color: 'text-amber-400' }
  return { label: 'good', labelText: 'Good Pace', color: 'text-emerald-400' }
}

/**
 * useSpeakingPace
 * Tracks WPM from voice turns only (typed turns have no duration data).
 * Call `recordVoiceTurn(wordCount, durationSec)` inside handleSend when durationSec is available.
 */
export function useSpeakingPace() {
  const [pace, setPace] = useState<PaceResult>({ wpm: 0, label: 'unknown', labelText: '—', color: 'text-gray-400' })

  const recordVoiceTurn = useCallback((wordCount: number, durationSec: number) => {
    if (!durationSec || durationSec <= 0 || wordCount <= 0) return
    const wpm = Math.round((wordCount / durationSec) * 60)
    const classification = classifyWpm(wpm)
    setPace({ wpm, ...classification })
  }, [])

  return { pace, recordVoiceTurn }
}
