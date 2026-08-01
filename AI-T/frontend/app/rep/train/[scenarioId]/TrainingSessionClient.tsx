'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import LiveMetricsBoard, { LiveMetrics, CoachTrigger } from '@/components/training/LiveMetricsBoard'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const MODULATE_API_KEY = process.env.NEXT_PUBLIC_MODULATE_API_KEY || ''
const MODULATE_WS_URL = `wss://platform.modulate.ai/api/velma-2-stt-streaming?api_key=${MODULATE_API_KEY}&audio_format=s16le&sample_rate=16000&num_channels=1`

// Silence detection config
const SILENCE_THRESHOLD = 0.01   // Volume level below which we consider silence
const SILENCE_DURATION_MS = 1500 // How long silence must last before ending a turn

interface ChatMessage {
  role: 'user' | 'assistant' | 'model' | 'system'
  content: string
}

export default function TrainingSessionClient({ scenarioId }: { scenarioId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [scenario, setScenario] = useState<any>(null)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null)
  const [coachTip, setCoachTip] = useState<CoachTrigger | null>(null)
  const [micActive, setMicActive] = useState(false)
  const [userSpeaking, setUserSpeaking] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [deepgramKey, setDeepgramKey] = useState<string | null>(null)
  const [paceWPM, setPaceWPM] = useState(0)
  const [fillerCount, setFillerCount] = useState(0)

  const userTalkTimeMs = useRef(0)
  const aiTalkTimeMs = useRef(0)
  const interruptionCount = useRef(0)
  const lastQuestionTime = useRef<number>(Date.now())
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isAiSpeakingRef = useRef(false)
  const turnStartTimeRef = useRef<number>(0)
  const currentTranscriptRef = useRef<string>('')
  const currentEmotionRef = useRef<string>('Neutral')
  const currentConfidenceRef = useRef<number>(0.9)

  // Mic/audio refs
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const recognitionRef = useRef<any>(null)
  const modulateTranscriptRef = useRef<string>('')
  const isProcessingRef = useRef(false)
  const silenceStartRef = useRef<number>(0)
  const isSpeakingRef = useRef(false)
  const audioChunksRef = useRef<Int16Array[]>([])
  
  const deepgramWsRef = useRef<WebSocket | null>(null)
  const totalWordsRef = useRef<number>(0)
  const totalFillersRef = useRef<number>(0)

  // Fetch session on mount
  useEffect(() => {
    if (!sessionId) return
    const fetchSession = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API}/api/sessions/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setScenario(data.scenario)
          if (data.session?.messages_json) {
            setMessages(data.session.messages_json.map((m: any) => ({
              role: m.role === 'model' ? 'assistant' : m.role,
              content: m.content || (m.parts && m.parts[0]?.text) || ''
            })))
          }
        }
      } catch (e) {
        console.error('Failed to fetch session:', e)
      }
    }
    }
    fetchSession()

    // Fetch Deepgram Key
    fetch(`${API}/api/auth/deepgram-key`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => { if (data.key) setDeepgramKey(data.key) })
      .catch(console.error)

  }, [sessionId])

  const floatTo16BitPCM = (input: Float32Array): Int16Array => {
    const output = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]))
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    return output
  }

  const handleInterrupt = () => {
    if (isAiSpeakingRef.current && audioRef.current) {
      audioRef.current.pause()
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false
      interruptionCount.current += 1
    }
  }

  const playTTS = async (text: string) => {
    setIsAiSpeaking(true)
    isAiSpeakingRef.current = true
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text, voiceId: 'EXAVITQu4vr4xnSDxMaL' })
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        if (audioRef.current) {
          const aiTurnStart = Date.now()
          audioRef.current.src = url
          audioRef.current.play()
          audioRef.current.onended = () => {
            setIsAiSpeaking(false)
            isAiSpeakingRef.current = false
            aiTalkTimeMs.current += (Date.now() - aiTurnStart)
          }
        }
      } else {
        setIsAiSpeaking(false)
        isAiSpeakingRef.current = false
      }
    } catch (e) {
      console.error('TTS Failed', e)
      setIsAiSpeaking(false)
      isAiSpeakingRef.current = false
    }
  }

  const handleUserTurnComplete = async (durationMs: number) => {
    const transcript = currentTranscriptRef.current.trim() || 'Hmm, could you repeat that?'
    const emotion = currentEmotionRef.current

    setMessages(prev => [...prev, { role: 'user', content: transcript }])

    const payload = {
      sessionId,
      transcript: currentTranscriptRef.current.trim(),
      modulateTranscript: modulateTranscriptRef.current.trim(),
      emotion: currentEmotionRef.current || 'Neutral',
      confidenceScore: 0.9,
      userTalkTimeMs: userTalkTimeMs.current,
      aiTalkTimeMs: aiTalkTimeMs.current,
      interruptionCount: interruptionCount.current,
      durationMs,
      durationSinceLastQuestionMs: Date.now() - lastQuestionTime.current,
      pauseQualityMs: 1500
    }

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/sessions/live-turn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        const data = await res.json()
        if (data.metrics) setMetrics(data.metrics)
        
        // If there's a hard trigger tip, show it immediately. Otherwise, ask LLM coach asynchronously.
        if (data.coachTip) {
          setCoachTip(data.coachTip)
        } else if (data.metrics) {
          fetch(`${API}/api/sessions/live-coach`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ metrics: data.metrics, transcript: payload.transcript })
          })
            .then(res => res.json())
            .then(coachData => {
              if (coachData.coachTip) setCoachTip(coachData.coachTip)
            })
            .catch(err => console.error('Live coach failed', err))
        }

        if (data.aiResponse) {
          setMessages(prev => [...prev, { role: 'assistant', content: data.aiResponse }])
          if (data.aiResponse.includes('?')) lastQuestionTime.current = Date.now()
          await playTTS(data.aiResponse)
        }
      }
    } catch (err) {
      console.error('Live turn failed', err)
    }
  }

  // Finalize turn and send to backend
  const processAudioTurn = useCallback(async () => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    const durationMs = Date.now() - turnStartTimeRef.current
    userTalkTimeMs.current += durationMs

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Send EOF to Modulate
        wsRef.current.send("")
        
        // Wait for final Modulate response (should be almost instant since we streamed in real-time)
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 2000)
          const origHandler = wsRef.current!.onmessage
          wsRef.current!.onmessage = (event) => {
            if (origHandler) (origHandler as any).call(wsRef.current, event)
            try {
              const data = JSON.parse(event.data)
              if (data.type === 'done') { clearTimeout(timeout); setTimeout(resolve, 50) }
            } catch {}
          }
        })
        try { wsRef.current.close() } catch {}
        wsRef.current = null
      }

      if (deepgramWsRef.current) {
        try {
          deepgramWsRef.current.send(JSON.stringify({ type: 'CloseStream' }))
          deepgramWsRef.current.close()
        } catch {}
        deepgramWsRef.current = null
      }

      await handleUserTurnComplete(durationMs)
    } finally {
      isProcessingRef.current = false
    }
  }, [])

  // Start mic and audio streaming
  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      })
      streamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: 16000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      // ScriptProcessorNode with 4096 buffer size (~256ms per chunk at 16kHz)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      // --- Setup Deepgram STT Streaming ---
      if (deepgramKey) {
        const dgWs = new WebSocket(`wss://api.deepgram.com/v1/listen?model=nova-2&filler_words=true&encoding=linear16&sample_rate=16000&channels=1`)
        
        dgWs.onopen = () => {
          console.log('Deepgram WS connected (Streaming)')
          dgWs.send(JSON.stringify({ type: 'KeepAlive' }))
        }
        
        dgWs.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'Results' && data.channel && data.channel.alternatives[0]) {
              const alt = data.channel.alternatives[0]
              
              if (data.is_final && alt.transcript) {
                currentTranscriptRef.current += ' ' + alt.transcript
                
                const words = alt.words || []
                let chunkFillers = 0
                words.forEach((w: any) => {
                  const text = (w.punctuated_word || w.word || '').toLowerCase()
                  if (['um', 'uh', 'like', 'mhm'].includes(text.replace(/[^a-z]/g, ''))) {
                    chunkFillers++
                  }
                })
                
                totalWordsRef.current += words.length
                totalFillersRef.current += chunkFillers
                setFillerCount(totalFillersRef.current)
                
                const totalTalkMins = (userTalkTimeMs.current + (Date.now() - turnStartTimeRef.current)) / 60000
                if (totalTalkMins > 0) {
                  setPaceWPM(Math.round(totalWordsRef.current / totalTalkMins))
                }
              }
            }
          } catch (e) {}
        }
        deepgramWsRef.current = dgWs
      } else {
        console.warn('Deepgram API key not available.')
      }

      // Immediately set user as speaking since it's manual push-to-talk now
      isSpeakingRef.current = true
      setUserSpeaking(true)
      turnStartTimeRef.current = Date.now()
      audioChunksRef.current = []
      currentTranscriptRef.current = '' // Reset transcript at start of speech
      modulateTranscriptRef.current = '' // Reset modulate transcript
      if (isAiSpeakingRef.current) handleInterrupt()

      // --- Setup Modulate WS ---
      if (MODULATE_API_KEY) {
        const ws = new WebSocket(MODULATE_WS_URL)
        ws.onopen = () => console.log('Modulate WS connected (Streaming)')
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'utterance' && data.utterance) {
              const txt = data.utterance.text || ''
              if (txt) modulateTranscriptRef.current += ' ' + txt
              
              if (data.utterance.emotion) currentEmotionRef.current = data.utterance.emotion
              if (data.utterance.sentiment) currentEmotionRef.current = data.utterance.sentiment
            }
          } catch (e) {}
        }
        wsRef.current = ws
      }

      processor.onaudioprocess = (e) => {
        if (isAiSpeakingRef.current || isProcessingRef.current || !isSpeakingRef.current) return

        const input = e.inputBuffer.getChannelData(0)
        
        // Store audio chunk and stream to Modulate in real-time
        const pcm = floatTo16BitPCM(input)
        
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcm.buffer)
        }
        
        if (deepgramWsRef.current && deepgramWsRef.current.readyState === WebSocket.OPEN) {
          deepgramWsRef.current.send(pcm.buffer)
        }
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      setMicActive(true)
      setMicError(null)
      console.log('Mic started — manual push-to-talk mode')
    } catch (e: any) {
      console.error('Mic error:', e)
      setMicError(e.message || 'Failed to access microphone')
    }
  }, [processAudioTurn])

  const stopMic = useCallback(() => {

    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (deepgramWsRef.current) {
      try { 
        deepgramWsRef.current.send(JSON.stringify({ type: "CloseStream" })) 
        deepgramWsRef.current.close() 
      } catch {}
      deepgramWsRef.current = null
    }
    
    setMicActive(false)
    setUserSpeaking(false)
    isSpeakingRef.current = false
    
    // Process the turn now that user clicked stop
    processAudioTurn()
  }, [processAudioTurn])

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopMic() }
  }, [stopMic])

  const endSession = async () => {
    stopMic()
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API}/api/sessions/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId })
      })
    } catch (e) { console.error('End session failed:', e) }
    router.push('/rep/dashboard')
  }

  return (
    <div className="flex h-screen bg-white">
      <audio ref={audioRef} className="hidden" />

      {/* LEFT PANEL */}
      <div className="flex-1 flex flex-col border-r border-gray-200 bg-gray-50/50 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">
              {scenario?.persona_name || 'AI Prospect'}
            </h1>
            <p className="text-gray-500 font-medium uppercase tracking-widest text-xs mt-1">
              Live Audio Training
            </p>
          </div>
          
          {/* Deepgram Real-Time Analytics */}
          <div className="flex gap-4 ml-6 mr-auto">
            <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center min-w-[80px]">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Pace (WPM)</p>
              <p className={`text-xl font-black ${paceWPM > 160 ? 'text-red-500' : 'text-blue-600'}`}>{paceWPM}</p>
            </div>
            <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center min-w-[80px]">
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Fillers</p>
              <p className={`text-xl font-black ${fillerCount > 5 ? 'text-amber-500' : 'text-blue-600'}`}>{fillerCount}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setIsPaused(true); stopMic(); }}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg transition-all"
            >
              Pause
            </button>
            <button
              onClick={endSession}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-all"
            >
              End Call
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-[400px]">
          <LiveMetricsBoard
            metrics={metrics}
            coachTip={coachTip}
            isRecording={userSpeaking}
            isAiSpeaking={isAiSpeaking}
          />
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            onClick={() => {
              if (micActive) {
                stopMic()
              } else {
                startMic()
              }
            }}
            disabled={isProcessingRef.current}
            className={`px-12 py-5 rounded-full font-black text-lg transition-all shadow-xl ${
              micError
                ? 'bg-red-600 text-white'
                : userSpeaking
                  ? 'bg-red-500 text-white shadow-red-500/40 scale-105 animate-pulse'
                  : isAiSpeaking
                    ? 'bg-gray-200 text-gray-400'
                    : micActive
                      ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/40'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/40'
            }`}
          >
            {micError
              ? `Mic Error: ${micError}`
              : userSpeaking
                ? '🎙️ Listening...'
                : isAiSpeaking
                  ? '🔊 AI Speaking...'
                  : micActive
                    ? '✅ Waiting for Voice...'
                    : '🎤 Click to Start Mic'}
          </button>
          {!micActive && !micError && (
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest text-center">
              Click to start your microphone. Speak naturally — turns are detected automatically.
            </p>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Transcript */}
      <div className="w-[400px] flex flex-col bg-white border-l border-gray-200">
        <div className="p-6 border-b border-gray-200 bg-gray-50/80">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">Live Transcript</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-5 py-4 max-w-[85%] rounded-2xl text-sm font-medium leading-relaxed ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-gray-100 text-gray-800 rounded-tl-sm'
              }`}>
                {m.content}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mt-2">
                {m.role === 'user' ? 'You' : scenario?.persona_name || 'AI'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pause Modal */}
      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-6">
            <h2 className="text-2xl font-black text-gray-900 text-center">Session Paused</h2>
            <p className="text-gray-500 text-center font-medium">What would you like to do?</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => setIsPaused(false)}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all"
              >
                Resume Session
              </button>
              <button 
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    await fetch(`${API}/api/sessions/retry`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ sessionId })
                    });
                    setMessages([]);
                    setIsPaused(false);
                  } catch (e) { console.error(e) }
                }}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-all"
              >
                Retry Session (Start Over)
              </button>
              <button 
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    await fetch(`${API}/api/sessions/pause`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ sessionId })
                    });
                    router.push('/rep/dashboard');
                  } catch (e) { console.error(e) }
                }}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl transition-all"
              >
                Continue Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
