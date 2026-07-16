'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * useSilenceDetector
 * Fires a callback after the rep has been silent for `thresholdMs` ms
 * since the last time `resetSilence()` was called.
 *
 * Usage:
 *   const { isSilent, resetSilence } = useSilenceDetector({ thresholdMs: 20000, active: !isSpeaking })
 *   Call resetSilence() inside handleSend() after each rep turn.
 */
export function useSilenceDetector({
  thresholdMs = 20000,
  active = true,
}: {
  thresholdMs?: number
  active?: boolean
}) {
  const [isSilent, setIsSilent] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetSilence = useCallback(() => {
    setIsSilent(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (active) {
      timerRef.current = setTimeout(() => {
        setIsSilent(true)
      }, thresholdMs)
    }
  }, [thresholdMs, active])

  // Start or stop the timer whenever `active` changes
  useEffect(() => {
    if (active) {
      timerRef.current = setTimeout(() => {
        setIsSilent(true)
      }, thresholdMs)
    } else {
      if (timerRef.current) clearTimeout(timerRef.current)
      setIsSilent(false)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [active, thresholdMs])

  return { isSilent, resetSilence }
}
