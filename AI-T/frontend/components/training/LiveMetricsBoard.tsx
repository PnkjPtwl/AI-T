'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export interface LiveMetrics {
  wpm: number
  fillerRatio: number // percentage 0-100
  talkListenRatio: number // User percentage 0-100
  interruptionCount: number
  questionCount: number
  emotion: string
  confidenceScore: number
}

export interface CoachTrigger {
  shouldPopup: boolean
  tip: string
  severity: 'warning' | 'danger' | 'info'
}

interface LiveMetricsBoardProps {
  metrics: LiveMetrics | null
  coachTip: CoachTrigger | null
  isRecording: boolean
  isAiSpeaking: boolean
}

export default function LiveMetricsBoard({ metrics, coachTip, isRecording, isAiSpeaking }: LiveMetricsBoardProps) {
  const [activeTip, setActiveTip] = useState<CoachTrigger | null>(null)
  const tipTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (coachTip && coachTip.shouldPopup) {
      setActiveTip(coachTip)
      if (tipTimeoutRef.current) clearTimeout(tipTimeoutRef.current)
      // Auto-dismiss the popup after 8 seconds
      tipTimeoutRef.current = setTimeout(() => {
        setActiveTip(null)
      }, 8000)
    }
  }, [coachTip])

  // Fallback defaults if metrics is null
  const m = metrics || {
    wpm: 0,
    fillerRatio: 0,
    talkListenRatio: 50,
    interruptionCount: 0,
    questionCount: 0,
    emotion: 'Neutral',
    confidenceScore: 0
  }

  // Helpers
  const isAnxious = ['Anxious', 'Stressed', 'Tired'].includes(m.emotion)
  const isConfident = ['Confident', 'Happy', 'Excited'].includes(m.emotion)
  const emotionColor = isConfident ? 'bg-green-100 text-green-700' : isAnxious ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'

  return (
    <div className="relative w-full h-full flex flex-col gap-4 p-6 bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      
      {/* Live Recording Indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white shadow flex items-center justify-center">
            {isRecording ? (
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            ) : (
              <div className="w-3 h-3 bg-gray-300 rounded-full" />
            )}
          </div>
          <span className="text-sm font-semibold text-gray-700 uppercase tracking-widest">
            {isRecording ? 'Listening...' : isAiSpeaking ? 'AI is speaking' : 'Waiting for voice...'}
          </span>
        </div>
      </div>

      {/* CORE METRICS GRID */}
      <div className="grid grid-cols-2 gap-4">
        {/* 1. The Vibe */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Acoustic Sentiment</span>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${emotionColor}`}>
              {m.emotion}
            </span>
            {isAnxious && (
              <span className="text-red-500 text-xs animate-pulse font-medium">Take a breath</span>
            )}
          </div>
        </div>

        {/* 2. Mechanics - WPM */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pace (WPM)</span>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-black ${(m.wpm > 160 || (m.wpm < 110 && m.wpm > 0)) ? 'text-amber-500' : 'text-gray-800'}`}>
              {m.wpm}
            </span>
            <span className="text-gray-400 text-sm mb-1">wpm</span>
          </div>
        </div>

        {/* 3. Mechanics - Fillers */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Filler Ratio</span>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-black ${m.fillerRatio > 8 ? 'text-red-500' : 'text-gray-800'}`}>
              {m.fillerRatio.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* 4. Flow - Talk Ratio */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Your Talk Ratio</span>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mt-1 relative">
             <div 
               className={`h-full ${m.talkListenRatio > 70 ? 'bg-amber-500' : 'bg-blue-500'} transition-all duration-500`}
               style={{ width: `${m.talkListenRatio}%` }}
             />
          </div>
          <span className="text-xs text-gray-500 mt-2 font-medium">{m.talkListenRatio}% (Target: &lt; 60%)</span>
        </div>
      </div>

      {/* COACHING POPUP (ABSOLUTE OVERLAY) */}
      <AnimatePresence>
        {activeTip && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`absolute bottom-6 left-6 right-6 p-4 rounded-xl shadow-xl border-l-4 flex items-start gap-4 backdrop-blur-md bg-white/95
              ${activeTip.severity === 'danger' ? 'border-red-500' : activeTip.severity === 'warning' ? 'border-amber-500' : 'border-blue-500'}
            `}
          >
            <div className={`p-2 rounded-full 
              ${activeTip.severity === 'danger' ? 'bg-red-100 text-red-600' : activeTip.severity === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}
            `}>
              {/* Icon */}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="flex-1">
              <h4 className="text-[10px] uppercase font-bold tracking-widest text-gray-400 mb-1">Live Coach Tip</h4>
              <p className="text-sm font-semibold text-gray-800 leading-snug">{activeTip.tip}</p>
            </div>
            <button onClick={() => setActiveTip(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
