'use client'

// =============================================================================
// page.tsx — Training Session Page (Anam AI Avatar Edition)
//
// WHAT CHANGED vs old version:
//   1. Replaced the static 🤖 emoji with a real-time Anam AI video avatar.
//   2. On mount: fetches an Anam session token, initialises the Anam JS SDK,
//      streams the avatar to a <video> element, and opens an AudioPassthroughStream.
//   3. Updated speakText() to:
//       a. Call /api/tts/base64 (returns PCM 16kHz mono as base64) instead of /api/tts.
//       b. Pipe that base64 chunk straight to Anam via audioStream.sendAudioChunk().
//       c. Signal audioStream.endOfSpeech() when the turn is complete so lip-sync stops cleanly.
//   4. Mic / mute interruption calls anamClient.interruptPersona() to clear the video buffer.
//   5. Anam client is disposed on component unmount.
//
// WHAT IS UNCHANGED:
//   - All Groq / backend API calls (sendMessage, sendVoiceMessage, endSession)
//   - Session history, persona brief, conversation panel
//   - Timer, turn counter, assignment lifecycle
//   - All Supabase / evaluation logic (lives in the backend)
// =============================================================================

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function PracticeChatPage({ params }: { params: { scenarioId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const assignmentId = searchParams.get('assignmentId')

  const [scenario, setScenario] = useState<any>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [ending, setEnding] = useState(false)

  const MAX_TURNS = 20
  const [timeLeft, setTimeLeft] = useState(600)

  // Voice States
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])

  const [isThinking, setIsThinking] = useState(false)
  const [isBriefOpen, setIsBriefOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const [anamFailed, setAnamFailed] = useState(false)

  // Ref to auto-scroll conversation
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  
  // Audio playback ref for TTS fallback
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // ─── Anam AI refs ─────────────────────────────────────────────────────────
  // anamClientRef    → the AnamClient instance (browser SDK)
  // audioStreamRef   → the AudioPassthroughStream for sending PCM chunks
  // anamReadyRef     → guards against sending audio before the stream opens
  const anamClientRef  = useRef<any>(null)
  const audioStreamRef = useRef<any>(null)
  const anamReadyRef   = useRef<boolean>(false)
  const currentSpeechRef = useRef<{text: string, voiceId: string, timeoutId: any} | null>(null)

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping, isProcessing])

  // ─── Fetch scenario ──────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchScenario = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API}/api/scenarios/${params.scenarioId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setScenario(data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      fetchScenario()
    } else {
      router.push('/rep/train')
    }
  }, [params.scenarioId, sessionId, router])

  // ─── Anam AI initialisation ──────────────────────────────────────────────────
  // Runs once after the session is confirmed. Fetches a session token from our
  // backend proxy, then wires the SDK to stream into the <video id="avatar-video">.
  useEffect(() => {
    if (!sessionId) return

    let cancelled = false

    const initAnam = async () => {
      try {
        const token = localStorage.getItem('token')

        // 1. Get a short-lived Anam session token from our backend
        const tokenRes = await fetch(`${API}/api/anam/session-token`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        })
        if (!tokenRes.ok) throw new Error('Failed to get Anam session token')
        const { sessionToken } = await tokenRes.json()
        if (cancelled) return

        // 2. Dynamically import the Anam SDK (avoids SSR issues in Next.js)
        const { createClient, AnamEvent } = await import('@anam-ai/js-sdk')
        if (cancelled) return

        // 3. Create the Anam client with the session token
        //    disableInputAudio: we handle our own mic pipeline via Groq Whisper
        const client = createClient(sessionToken, { disableInputAudio: true })
        anamClientRef.current = client

        client.addListener(AnamEvent.CONNECTION_CLOSED, (reason: any, details: any) => {
          console.warn('[ANAM] Connection Closed:', reason, details)
          setAnamFailed(true)
          anamReadyRef.current = false
        })
        client.addListener(AnamEvent.SERVER_WARNING, (message: any) => {
          console.warn('[ANAM] Server Warning:', message)
        })

        // 4. Bind the avatar video stream to our <video> element
        await client.streamToVideoElement('avatar-video')
        if (cancelled) return

        // 5. Open an agent audio input stream — PCM s16le, 16 kHz, mono
        const stream = client.createAgentAudioInputStream({
          encoding:   'pcm_s16le',
          sampleRate: 16000,
          channels:   1,
        })
        audioStreamRef.current = stream
        anamReadyRef.current   = true

        console.log('[ANAM] Avatar ready — audio passthrough stream open')
      } catch (err) {
        console.error('[ANAM] Initialisation failed:', err)
        setAnamFailed(true)
        anamReadyRef.current = false
        // Non-fatal: the session continues with the emoji fallback hidden behind the video
      }
    }

    initAnam()

    // Cleanup: dispose the Anam client when the component unmounts (session ends)
    return () => {
      cancelled = true
      anamReadyRef.current = false
      if (anamClientRef.current) {
        try { anamClientRef.current.stopStreaming?.() } catch (_) {}
        try { anamClientRef.current.stop?.() } catch (_) {}
        try { anamClientRef.current.leave?.() } catch (_) {}
        anamClientRef.current = null
      }
      audioStreamRef.current = null
    }
  }, [sessionId])



  // ─── Timer countdown (respects pause) ───────────────────────────────────────
  useEffect(() => {
    if (ending || timeLeft <= 0 || isPaused) return
    const interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
    return () => clearInterval(interval)
  }, [ending, timeLeft, isPaused])

  useEffect(() => {
    if (timeLeft === 0 && !ending) handleEndSession()
  }, [timeLeft, ending])

  // ─── Turn limit ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const turns = Math.floor(messages.length / 2)
    if (!ending && turns >= MAX_TURNS) handleEndSession()
  }, [messages, ending])

  // ─── Speak text (ElevenLabs TTS → Anam Audio Passthrough) ──────────────────
  //
  // Fetches PCM audio from /api/tts/base64, then:
  //   • Sends the base64 chunk to Anam so the avatar lip-syncs
  //   • Signals endOfSpeech() once the full turn is delivered
  //
  // If Anam is not yet ready (init still in flight) we fall back gracefully
  // to the original audio/mpeg blob approach so the session is never blocked.
  const speakText = useCallback(async (text: string) => {
    setIsThinking(false)
    setIsSpeaking(true)
    try {
      const token   = localStorage.getItem('token')
      const voiceId = scenario?.voice_id || 'EXAVITQu4vr4xnSDxMaL' // Bella (Female, Free Tier)

      const playFallback = async (fallbackText: string = text, fallbackVoiceId: string = voiceId) => {
        const res = await fetch(`${API}/api/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ text: fallbackText, voice_id: fallbackVoiceId }),
        })
        if (!res.ok) throw new Error('TTS failed')
        const blob = await res.blob()
        const url  = URL.createObjectURL(blob)
        if (audioRef.current) {
          audioRef.current.src     = url
          audioRef.current.onended = () => {
            setIsSpeaking(false)
            currentSpeechRef.current = null
          }
          await audioRef.current.play()
        }
      }

      if (anamReadyRef.current && audioStreamRef.current) {
        // ── Anam path: PCM base64 → avatar lip-sync ──────────────────────────
        const res = await fetch(`${API}/api/tts/base64`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ text, voice_id: voiceId }),
        })
        if (!res.ok) throw new Error('TTS base64 failed')
        const data = await res.json()

        try {
          // Push the entire audio turn as one chunk to the avatar stream
          await audioStreamRef.current.sendAudioChunk(data.audioBase64)
          // Signal that this speaking turn is complete so lip-sync doesn't hang
          audioStreamRef.current.endSequence()
          
          // Calculate duration of PCM audio chunk manually so the UI stays in "Speaking Mode"
          // Length in bytes ~ (base64.length * 0.75). It's 16-bit (2 bytes) PCM at 16000Hz.
          const byteLength = Math.floor(data.audioBase64.length * 0.75)
          const durationMs = (byteLength / 2) / 16000 * 1000

          const timeoutId = setTimeout(() => {
            setIsSpeaking(false)
            currentSpeechRef.current = null
          }, durationMs)

          currentSpeechRef.current = { text, voiceId, timeoutId }

        } catch (anamErr) {
          console.warn('[ANAM] Mid-turn failure, falling back to ElevenLabs audio tag', anamErr)
          setAnamFailed(true)
          anamReadyRef.current = false
          await playFallback(text, voiceId)
        }
      } else {
        // ── Fallback path: audio/mpeg blob via <audio> tag ───────────────────
        await playFallback(text, voiceId)
      }
    } catch (err) {
      console.error('Failed to play TTS', err)
      setIsSpeaking(false)
    }
  }, [scenario])

  // ─── Anam Video Error Handler ────────────────────────────────────────────────
  const handleVideoError = async () => {
    if (anamFailed) return;
    console.error("[ANAM] Video element stalled or crashed. Activating fallback.");
    setAnamFailed(true);
    anamReadyRef.current = false;

    if (currentSpeechRef.current) {
      const { text, voiceId, timeoutId } = currentSpeechRef.current;
      clearTimeout(timeoutId);
      currentSpeechRef.current = null;
      console.warn("[ANAM] Rescuing cut-off audio:", text);
      
      const token = localStorage.getItem('token')
      try {
        const res = await fetch(`${API}/api/tts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ text, voice_id: voiceId }),
        })
        if (res.ok) {
          const blob = await res.blob()
          const url  = URL.createObjectURL(blob)
          if (audioRef.current) {
            audioRef.current.src     = url
            audioRef.current.onended = () => setIsSpeaking(false)
            await audioRef.current.play()
          }
        }
      } catch (err) {
        console.error("Rescue audio playback failed", err);
        setIsSpeaking(false);
      }
    }
  }

  // ─── Browser Native STT ────────────────────────────────────────────────────────────
  const recognitionRef = useRef<any>(null)

  const handleMicClick = async () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setIsRecording(false)
      return
    }

    if (isSpeaking) {
      if (anamClientRef.current) {
        try { anamClientRef.current.interruptPersona() } catch (_) {}
      }
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setIsSpeaking(false)
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.")
        return
      }

      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition
      recognition.lang = 'en-US'
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        setIsRecording(true)
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        if (transcript) {
           handleSend(null, transcript)
        }
      }

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error)
        setIsRecording(false)
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognition.start()
    } catch (err) {
      console.error('Speech recognition setup error:', err)
      setIsRecording(false)
    }
  }

  // ─── Text message → Groq LLM → TTS ──────────────────────────────────────────
  const handleSend = async (e?: React.FormEvent | null, directText?: string) => {
    if (e) e.preventDefault()
    const textToSend = directText || inputText.trim()
    if (!textToSend || isTyping) return

    if (!directText) setInputText('')
    setMessages(prev => [...prev, { role: 'user', content: textToSend }])
    setIsTyping(true)
    setIsThinking(true)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/sessions/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId, message: textToSend })
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
        // Groq replied — stop thinking, start speaking
        speakText(data.reply)
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: '(Error: Failed to get AI response)' }])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsTyping(false)
    }
  }

  // ─── End session ─────────────────────────────────────────────────────────────
  const handleEndSession = async () => {
    setEnding(true)
    if (audioRef.current) audioRef.current.pause()
    // Stop the Anam avatar stream cleanly on session end
    if (anamClientRef.current) {
      try { anamClientRef.current.stopStreaming?.() } catch (_) {}
    }

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/sessions/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ sessionId })
      })

      if (res.ok) {
        console.log(`[Lifecycle] Session ${sessionId} ended successfully.`)

        if (assignmentId && assignmentId !== 'undefined' && assignmentId !== 'null') {
          try {
            console.log(`[Lifecycle] Calling complete-assignment for: ${assignmentId}`)
            const completeRes = await fetch(`${API}/api/users/complete-assignment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ assignmentId })
            })
            if (completeRes.ok) {
              console.log(`[Lifecycle] Assignment ${assignmentId} marked as COMPLETED.`)
            } else {
              const errData = await completeRes.json()
              console.error('[Lifecycle] Failed to complete assignment:', errData)
            }
          } catch (err) {
            console.error('[Lifecycle] Error during assignment completion:', err)
          }
        }

        router.push(`/rep/train/${params.scenarioId}/review?sessionId=${sessionId}`)
      } else {
        alert('Failed to end session')
        setEnding(false)
      }
    } catch (err) {
      console.error(err)
      alert('Error ending session')
      setEnding(false)
    }
  }

  // ─── Loading state ────────────────────────────────────────────────────────────
  if (loading || !scenario) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#2C5282]" />
      </div>
    )
  }

  const personaName = scenario.customer_info?.name || scenario.persona_name || 'Target Persona'
  const personaType = scenario.persona_type || 'Target Account'

  return (
    // fixed inset-0: breaks out of the growing min-h-screen layout so the session is truly full-screen
    <div className="fixed inset-0 z-50 flex flex-col font-jakarta bg-white overflow-hidden">
      {/* Invisible audio element for TTS playback */}
      <audio ref={audioRef} className="hidden" />

      {/* Top Bar — just live indicator + timers. End Call moved to mic bar below. */}
      <header className="bg-white border-b border-[#E2E8F0] px-6 py-3.5 flex justify-between items-center shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-semibold text-[#1A2A3A]">
            {isPaused ? <span className="text-yellow-600">⏸ Paused</span> : 'Live Simulation'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-3.5 py-1.5 rounded-lg border flex items-center gap-2 text-[11px] font-bold ${timeLeft < 60 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            ⏱ {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:{(timeLeft % 60).toString().padStart(2, '0')}
          </div>
          <div className={`px-3.5 py-1.5 rounded-lg border flex items-center gap-2 text-[11px] font-bold ${Math.floor(messages.length / 2) >= MAX_TURNS - 2 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
            💬 Turn {Math.floor(messages.length / 2)}/{MAX_TURNS}
          </div>
        </div>
      </header>

      {/* Full-screen Loading Overlay */}
      {ending && (
        <div className="fixed inset-0 z-[999] bg-white/95 flex flex-col items-center justify-center animate-in fade-in duration-500">
          <div className="w-20 h-20 border-4 border-[#2C5282] border-t-transparent rounded-full animate-spin mb-8 shadow-[0_0_30px_rgba(125,132,97,0.2)]" />
          <h2 className="text-4xl font-black text-[#1A2A3A] mb-4 tracking-tight uppercase">Session Completed</h2>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[#2C5282] rounded-full animate-pulse" />
            <p className="text-[#64748B] text-xs uppercase tracking-[0.3em] font-black">Generating Intelligence Report</p>
            <div className="w-2 h-2 bg-[#2C5282] rounded-full animate-pulse delay-75" />
          </div>
        </div>
      )}

      <div className="flex-1 flex min-h-0 overflow-hidden relative">

        {/* LEFT PANEL: Persona Brief (Drawer) */}
        <div className={`absolute top-0 bottom-0 left-0 z-20 w-[350px] bg-white border-r border-[#E2E8F0] shadow-2xl flex flex-col transform transition-transform duration-300 ${isBriefOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 border-b border-[#E2E8F0] shrink-0 flex justify-between items-start">
            <div>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] mb-4">Persona Brief</h2>
              <h3 className="text-2xl font-extrabold text-[#1A2A3A] mb-1">{personaName}</h3>
              <p className="text-xs text-[#64748B] font-medium uppercase tracking-wider">{personaType}</p>

              <div className="flex flex-wrap gap-2 mt-6">
                {scenario.personality_traits && typeof scenario.personality_traits === 'string' ? (
                  <span className="px-3 py-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full text-[9px] font-black uppercase tracking-widest text-[#2C5282]">
                    {scenario.personality_traits.substring(0, 50)}...
                  </span>
                ) : null}
                {scenario.difficulty && (
                  <span className="px-3 py-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full text-[9px] font-black uppercase tracking-widest text-[#64748B]">
                    {scenario.difficulty}
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={() => setIsBriefOpen(false)} 
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#1A2A3A] transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
            {(() => {
              if (!scenario?.context_text) return null

              let text = scenario.context_text
              let metadata: any = null
              let scenarioTitle = scenario.scenario_name || null

              const metadataMatch = text.match(/\[SCENARIO_METADATA:\s*({[\s\S]*?})\]/)
              if (metadataMatch) {
                try {
                  metadata = JSON.parse(metadataMatch[1])
                  text = text.replace(metadataMatch[0], '')
                } catch (e) {
                  console.error('Failed to parse metadata', e)
                }
              }

              const scenarioMatch = text.match(/\[SCENARIO:\s*(.*?)\]/)
              if (scenarioMatch) {
                scenarioTitle = scenarioMatch[1]
                text = text.replace(scenarioMatch[0], '')
              }

              text = text.trim()

              const renderList = (content: string) => {
                if (!content) return null
                const items = content.split('\n').filter(i => i.trim())
                if (items.length <= 1 && !content.includes('-') && !content.includes('•')) {
                  return <p className="text-sm text-[#64748B] leading-relaxed">{content}</p>
                }
                return (
                  <ul className="list-disc pl-4 text-sm text-[#64748B] space-y-1.5 marker:text-[#64748B]">
                    {items.map((item, i) => {
                      const cleaned = item.replace(/^[-*•]\s*/, '').trim()
                      return cleaned ? <li key={i} className="leading-relaxed pl-1">{cleaned}</li> : null
                    })}
                  </ul>
                )
              }

              return (
                <div className="space-y-8">
                  {scenarioTitle && (
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] mb-2">Scenario</h4>
                      <p className="text-sm font-bold text-[#1A2A3A] leading-relaxed">{scenarioTitle}</p>
                    </div>
                  )}
                  {text && (
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] mb-2">Goal & Context</h4>
                      <p className="text-sm text-[#64748B] leading-relaxed whitespace-pre-wrap">{text}</p>
                    </div>
                  )}
                  {metadata && (
                    <>
                      {metadata.personality_traits && (
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] mb-2">Personality</h4>
                          <p className="text-sm text-[#64748B] leading-relaxed">{metadata.personality_traits}</p>
                        </div>
                      )}
                      {metadata.objection_style && (
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] mb-2">Objection Style</h4>
                          {renderList(metadata.objection_style)}
                        </div>
                      )}
                      {metadata.evaluation_focus && (
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] mb-2">Evaluation Focus</h4>
                          {renderList(metadata.evaluation_focus)}
                        </div>
                      )}
                      {metadata.conversation_expectations && (
                        <div>
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] mb-2">Expectations</h4>
                          <p className="text-sm text-[#64748B] leading-relaxed">{metadata.conversation_expectations}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        </div>

        {/* CENTER PANEL: Anam AI Video Avatar */}
        <div className="flex-1 flex flex-col bg-[#0A0A0A] relative text-white">
          {!isBriefOpen && (
             <button 
                onClick={() => setIsBriefOpen(true)} 
                className="absolute top-6 left-6 z-10 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-xl"
             >
               <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7"/></svg>
               Persona Brief
             </button>
          )}

          <div className="flex-1 flex flex-col items-center justify-center p-8">
            {/* Anam AI video element — the SDK streams the avatar face here */}
            <div className={`w-full max-w-md aspect-video rounded-2xl overflow-hidden relative shadow-2xl transition-all duration-500 ${
              isSpeaking
                ? 'ring-4 ring-[#3B82F6] shadow-[0_0_40px_rgba(59,130,246,0.4)]'
                : isThinking
                ? 'ring-2 ring-[#4B5563] ring-opacity-50'
                : 'ring-1 ring-white/10'
            }`}>
              {anamFailed ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#111]">
                  <div className="text-8xl animate-pulse">🤖</div>
                </div>
              ) : (
                <video
                  id="avatar-video"
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover bg-[#111]"
                  onStalled={handleVideoError}
                  onError={handleVideoError}
                  onSuspend={() => {
                    // Sometimes onSuspend fires normally, but if we're speaking, it shouldn't.
                    if (currentSpeechRef.current) handleVideoError();
                  }}
                />
              )}
              {/* Subtle overlay gradient at the bottom for name/status */}
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
            </div>
            
            <h2 className="mt-8 text-3xl font-extrabold text-white tracking-tight">
              {personaName}
            </h2>
            <p className="text-sm font-medium text-gray-400 uppercase tracking-[0.2em] mt-2">
              {personaType}
            </p>

            {/* Waveform / Status */}
            <div className="mt-8 h-12 flex items-center justify-center">
              {isSpeaking ? (
                <div className="flex justify-center items-center gap-1.5 h-8">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`w-2 bg-[#3B82F6] rounded-full animate-voice-wave`} style={{ animationDelay: `${i * 0.15}s` }}></div>
                  ))}
                </div>
              ) : isThinking || isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-[#3B82F6] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2.5 h-2.5 bg-[#3B82F6] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2.5 h-2.5 bg-[#3B82F6] rounded-full animate-bounce"></div>
                </div>
              ) : (
                <div className="flex justify-center items-center gap-1.5 h-4 opacity-30">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-2 bg-gray-500 rounded-full h-2"></div>
                  ))}
                </div>
              )}
            </div>
            {isSpeaking && (
              <button
                onClick={() => {
                  // Interrupt the Anam avatar lip-sync immediately
                  if (anamClientRef.current) {
                    try { anamClientRef.current.interruptPersona() } catch (_) {}
                  }
                  if (audioRef.current) audioRef.current.pause()
                  setIsSpeaking(false)
                }}
                className="mt-6 text-[9px] font-black uppercase tracking-widest bg-transparent border border-white/20 hover:bg-white/10 px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-all"
              >
                Interrupt Avatar
              </button>
            )}
          </div>

          {/* Unified Input Bar */}
          <div className="p-5 bg-[#0A0A0A] shrink-0 border-t border-white/10">
            {/* End Call confirm toast */}
            {showEndConfirm && (
              <div className="mb-4 mx-auto max-w-lg bg-[#1C1C1E] border border-white/10 rounded-2xl p-4 flex items-center gap-4 animate-in slide-in-from-bottom-4 duration-200">
                <div className="flex-1">
                  <p className="text-white text-sm font-semibold">End this session?</p>
                  <p className="text-gray-400 text-xs mt-0.5">Your performance will be analysed and a report will be generated.</p>
                </div>
                <button
                  onClick={() => { setShowEndConfirm(false); handleEndSession() }}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
                >
                  End Call
                </button>
                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="text-gray-400 hover:text-white text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="max-w-4xl mx-auto flex items-center gap-3">
              {/* Pause button */}
              <button
                type="button"
                onClick={() => setIsPaused(p => !p)}
                disabled={ending}
                title={isPaused ? 'Resume session' : 'Pause session'}
                className={`w-[48px] h-[48px] shrink-0 rounded-full flex items-center justify-center transition-all border ${
                  isPaused
                    ? 'bg-yellow-500 border-yellow-400 text-white shadow-[0_0_16px_rgba(234,179,8,0.4)]'
                    : 'bg-[#18181B] border-[#27272A] text-gray-400 hover:text-white hover:border-[#3F3F46]'
                }`}
              >
                {isPaused ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"/></svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
                )}
              </button>
              <form onSubmit={handleSend} className="flex-1 relative group">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  disabled={isTyping || ending || isRecording || isProcessing || isPaused}
                  placeholder={isPaused ? 'Session paused — press ▶ to resume' : isRecording ? 'Listening to your voice...' : 'Type a response...'}
                  className="w-full bg-[#18181B] border border-[#27272A] hover:border-[#3F3F46] rounded-[24px] pl-6 pr-12 py-4 text-white placeholder-[#71717A] focus:outline-none focus:border-[#3B82F6] focus:bg-[#18181B] focus:ring-2 focus:ring-[#3B82F6]/20 transition-all font-medium disabled:opacity-50 text-[15px]"
                />
              </form>
              <button
                type="button"
                onClick={handleMicClick}
                disabled={isProcessing || isSpeaking || ending || isPaused}
                className={`w-[48px] h-[48px] shrink-0 rounded-full flex items-center justify-center transition-all ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] animate-pulse'
                    : 'bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] text-gray-300 shadow-sm'
                }`}
              >
                {isRecording ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 002 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                )}
              </button>
              <button
                type="button"
                onClick={(e: any) => handleSend(e)}
                disabled={!inputText.trim() || isTyping || ending || isRecording || isPaused}
                className="w-[48px] h-[48px] shrink-0 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 disabled:hover:bg-[#3B82F6] text-white rounded-full flex items-center justify-center transition-all shadow-[0_4px_14px_rgba(59,130,246,0.4)]"
              >
                <svg className="w-5 h-5 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>

              {/* End Call button */}
              <button
                type="button"
                onClick={() => setShowEndConfirm(true)}
                disabled={ending}
                title="End Call"
                className="w-[48px] h-[48px] shrink-0 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-full flex items-center justify-center transition-all shadow-[0_4px_14px_rgba(220,38,38,0.4)]"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Conversation — collapsible */}
        <div className={`border-l border-[#E2E8F0] bg-white flex flex-col transition-all duration-300 overflow-hidden ${isHistoryOpen ? 'w-[30%] min-w-[320px]' : 'w-0 min-w-0'}`}>
          <div className="p-5 border-b border-[#E2E8F0] shrink-0 flex justify-between items-center">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B]">Conversation History</h2>
            <button
              onClick={() => setIsHistoryOpen(false)}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#1A2A3A] transition-colors text-sm"
              title="Minimize"
            >
              ✕
            </button>
          </div>
          {/* Messages scroll area — bounded height, scrolls internally */}
          <div className="flex-1 h-0 overflow-y-auto p-5 space-y-5 custom-scrollbar">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] rounded-2xl px-5 py-4 text-sm font-medium shadow-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-[#2C5282] text-white rounded-tr-sm'
                    : 'bg-[#F8FAFC] text-[#1A2A3A] border border-[#E2E8F0] rounded-tl-sm'
                }`}>
                  <p className="whitespace-pre-wrap text-inherit">{m.content}</p>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#64748B] mt-2">
                  {m.role === 'user' ? 'You' : personaName}
                </span>
              </div>
            ))}
            {(isTyping || isProcessing) && (
              <div className="flex flex-col items-start">
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] text-[#1A2A3A] rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2 shadow-sm">
                  <div className="w-1.5 h-1.5 bg-[#2C5282] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-[#2C5282] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-[#2C5282] rounded-full animate-bounce" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-[#64748B] mt-2">
                  {personaName}
                </span>
              </div>
            )}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Collapsed conversation restore button */}
        {!isHistoryOpen && (
          <button
            onClick={() => setIsHistoryOpen(true)}
            className="absolute bottom-24 right-4 z-20 bg-white border border-[#E2E8F0] shadow-lg rounded-full px-4 py-2.5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#64748B] hover:text-[#1A2A3A] hover:shadow-xl transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            Chat ({messages.length})
          </button>
        )}

      </div>

      <style jsx>{`
        @keyframes voice-wave {
          0%, 100% { height: 20%; }
          50% { height: 100%; }
        }
        .animate-voice-wave {
          animation: voice-wave 0.6s ease-in-out infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #3A2F28;
          border-radius: 10px;
        }
      `}</style>
    </div>
  )
}
