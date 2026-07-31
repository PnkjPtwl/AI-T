'use client'

import React, { useState, useEffect } from 'react'

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
  // Keep a history of the latest valid coach tip to display persistently
  const [persistentTip, setPersistentTip] = useState<CoachTrigger | null>(null)

  useEffect(() => {
    if (coachTip && coachTip.shouldPopup) {
      setPersistentTip(coachTip)
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

  // Define Tone categories
  const isRisk = ['Angry', 'Frustrated', 'Contemptuous', 'Stressed'].includes(m.emotion)
  const isWarn = ['Anxious', 'Tired', 'Bored'].includes(m.emotion)
  const isCalm = ['Confident', 'Happy', 'Excited', 'Neutral'].includes(m.emotion)

  // Derive status labels
  let paceStatus = 'Normal'
  let paceColor = 'text-green-600'
  if (m.wpm > 160) { paceStatus = 'Too Fast'; paceColor = 'text-amber-500' }
  else if (m.wpm > 0 && m.wpm < 110) { paceStatus = 'Too Slow'; paceColor = 'text-amber-500' }

  let fillerStatus = 'Great'
  let fillerColor = 'text-green-600'
  if (m.fillerRatio > 8) { fillerStatus = 'Needs Work'; fillerColor = 'text-red-500' }
  else if (m.fillerRatio > 4) { fillerStatus = 'Okay'; fillerColor = 'text-amber-500' }

  return (
    <div className="relative w-full h-[480px] flex gap-4">
      
      {/* LEFT COLUMN: Tone Meter & Core Metrics */}
      <div className="flex-1 flex flex-col gap-4">
        
        {/* Live Tone & Mood Meter */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm">Live Tone & Mood Meter</h3>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" style={{ opacity: isRecording ? 1 : 0 }} />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                {isRecording ? 'Listening to you...' : isAiSpeaking ? 'AI Processing...' : 'Waiting...'}
              </span>
            </div>
          </div>

          <div className="relative h-2 w-full bg-gray-100 rounded-full flex overflow-hidden mt-2">
            <div className="flex-1 bg-red-500/80"></div>
            <div className="flex-1 bg-amber-400/80"></div>
            <div className="flex-1 bg-blue-400/80"></div>
            <div className="flex-1 bg-green-500/80"></div>
            
            {/* Indicator Marker */}
            <div className="absolute top-0 bottom-0 w-1.5 bg-gray-900 rounded-full shadow-sm transition-all duration-700 ease-out z-10" 
                 style={{ 
                   left: isRisk ? '12.5%' : isWarn ? '37.5%' : isCalm ? '87.5%' : '62.5%',
                   transform: 'translateX(-50%)'
                 }} 
            />
          </div>
          <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 tracking-widest px-1">
            <span>Risk</span>
            <span>Warn</span>
            <span>Focused</span>
            <span>Calm</span>
          </div>

          <div className="grid grid-cols-4 gap-3 mt-2">
            <div className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-colors ${isRisk ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
              <span className={`text-lg font-black ${isRisk ? 'text-red-700' : 'text-gray-400'}`}>Risk</span>
            </div>
            <div className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-colors ${isWarn ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
              <span className={`text-lg font-black ${isWarn ? 'text-amber-700' : 'text-gray-400'}`}>Warn</span>
            </div>
            <div className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-colors ${!isRisk && !isWarn && !isCalm ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
              <span className={`text-lg font-black ${!isRisk && !isWarn && !isCalm ? 'text-blue-700' : 'text-gray-400'}`}>Focused</span>
            </div>
            <div className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-colors ${isCalm ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'}`}>
              <span className={`text-lg font-black ${isCalm ? 'text-green-700' : 'text-gray-400'}`}>Calm</span>
            </div>
          </div>
        </div>

        {/* Core Metrics Grid */}
        <div className="flex-1 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 text-sm mb-4">Metrics</h3>
          <div className="grid grid-cols-3 gap-4 h-[calc(100%-2rem)]">
            
            {/* WPM Score */}
            <div className="bg-gray-50/80 rounded-xl p-4 flex flex-col justify-between border border-gray-100">
              <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Pace (WPM)</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                  paceStatus === 'Normal' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>{paceStatus}</span>
              </div>
              <div>
                <span className={`text-3xl font-black ${m.wpm > 0 ? paceColor : 'text-gray-300'}`}>
                  {m.wpm > 0 ? m.wpm : '--'}
                </span>
                <p className="text-[10px] text-gray-400 font-medium mt-1 leading-snug">Average words per minute during your turn.</p>
              </div>
            </div>

            {/* Filler Score */}
            <div className="bg-gray-50/80 rounded-xl p-4 flex flex-col justify-between border border-gray-100">
               <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Filler Ratio</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                  fillerStatus === 'Great' ? 'bg-green-100 text-green-700' : fillerStatus === 'Okay' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                }`}>{fillerStatus}</span>
              </div>
              <div>
                <span className={`text-3xl font-black ${m.fillerRatio > 0 ? fillerColor : 'text-gray-300'}`}>
                  {m.fillerRatio > 0 ? `${m.fillerRatio.toFixed(1)}%` : '--%'}
                </span>
                <p className="text-[10px] text-gray-400 font-medium mt-1 leading-snug">Percentage of speech that is um, uh, etc.</p>
              </div>
            </div>

            {/* Talk Ratio Score */}
            <div className="bg-gray-50/80 rounded-xl p-4 flex flex-col justify-between border border-gray-100">
               <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Talk Ratio</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider bg-blue-100 text-blue-700">Live</span>
              </div>
              <div>
                <span className={`text-3xl font-black ${m.talkListenRatio > 70 ? 'text-amber-500' : 'text-gray-900'}`}>
                  {m.talkListenRatio > 0 ? `${m.talkListenRatio}%` : '50%'}
                </span>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-2 mb-1">
                  <div className={`h-full ${m.talkListenRatio > 70 ? 'bg-amber-500' : 'bg-gray-800'}`} style={{ width: `${m.talkListenRatio}%` }}></div>
                </div>
                <p className="text-[10px] text-gray-400 font-medium leading-snug">Target &lt; 60%</p>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* RIGHT COLUMN: AI Coach LIVE */}
      <div className="w-80 bg-orange-50/40 border border-orange-100 rounded-2xl flex flex-col shadow-sm">
        <div className="p-4 border-b border-orange-100 flex items-center justify-between bg-white/50 rounded-t-2xl">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-purple-600 flex items-center justify-center shadow-sm">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            AI Coach
          </h3>
          <span className="bg-blue-100 text-blue-700 text-[9px] px-2 py-0.5 rounded-full uppercase tracking-widest font-black border border-blue-200/50">
            Live
          </span>
        </div>
        
        <div className="flex-1 p-4 overflow-y-auto">
          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Real-Time Insights</h4>
          
          {persistentTip ? (
            <div className={`p-4 rounded-xl border bg-white shadow-sm
              ${persistentTip.severity === 'danger' ? 'border-red-200' : persistentTip.severity === 'warning' ? 'border-amber-200' : 'border-orange-200'}
            `}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5
                  ${persistentTip.severity === 'danger' ? 'text-red-500' : persistentTip.severity === 'warning' ? 'text-amber-500' : 'text-orange-500'}
                `}>
                  {persistentTip.severity === 'info' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1 block">
                    {persistentTip.severity === 'danger' ? 'Critical Alert' : persistentTip.severity === 'warning' ? 'Coach Warning' : 'Coach Insight'}
                  </span>
                  <p className="text-sm font-medium text-gray-800 leading-relaxed">
                    {persistentTip.tip}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center h-32 bg-white/50">
              <span className="text-gray-400 text-sm font-medium">Listening for insights...</span>
            </div>
          )}

          <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-6 mb-3">Vibe Details</h4>
          <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">Primary Emotion</span>
              <span className="text-xs font-bold text-gray-900">{m.emotion}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">Speech Clarity</span>
              <span className="text-xs font-bold text-gray-900">{Math.round(m.confidenceScore * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
