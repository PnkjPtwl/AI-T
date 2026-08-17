'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ChatMessage {
  role: 'user' | 'assistant' | 'model' | 'system'
  content: string
  timestamp?: string
  inlineCoachNote?: string
  emotionLabel?: { emotion: string; colorClass: string; changeText: string }
}

interface LiveMetricsState {
  wpm: number
  fillerRatio: number
  talkListenRatio: number
  userTalkTimeMs: number
  aiTalkTimeMs: number
  questionCount: number
}

interface CoachingInsight {
  id: string
  severity: 'warning' | 'danger' | 'info' | 'success'
  title: string
  text: string
  timestamp: string
}

export default function TrainingSessionClient({ scenarioId }: { scenarioId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const paramSessionId = searchParams.get('sessionId')
  const assignmentId = searchParams.get('assignmentId')

  const [activeSessionId, setActiveSessionId] = useState<string | null>(paramSessionId)
  const [scenario, setScenario] = useState<any>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [textInput, setTextInput] = useState('')
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [micActive, setMicActive] = useState(false)
  const [avatarType, setAvatarType] = useState<string>('female')
  const [autoSendOnSilence, setAutoSendOnSilence] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)

  // Real-time analytics state
  const [moodScore, setMoodScore] = useState(65)
  const [toneClarity, setToneClarity] = useState(88)
  const [sentimentShift, setSentimentShift] = useState(0)
  const [currentStage, setCurrentStage] = useState('Opening')
  const [progressPct, setProgressPct] = useState(15)
  const [inlineCoachNote, setInlineCoachNote] = useState<string | null>(
    null // Set dynamically after mode is resolved; cleared for Exam Mode
  )

  // Tone distribution percentages (starts empty until real sentiment data arrives)
  const [toneDistribution, setToneDistribution] = useState({
    alert: 0,
    hesitant: 0,
    warm: 0,
    wise: 0
  })
  const prevToneDistributionRef = useRef({ alert: 0, hesitant: 0, warm: 0, wise: 0 })

  // Live metrics state
  const [metrics, setMetrics] = useState<LiveMetricsState>({
    wpm: 0,
    fillerRatio: 0,
    talkListenRatio: 0,
    userTalkTimeMs: 0,
    aiTalkTimeMs: 0,
    questionCount: 0
  })

  // Real-time insights array for AI Coach sidebar
  const [coachingInsights, setCoachingInsights] = useState<CoachingInsight[]>([])

  // Suggested follow-ups state
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([])
  const [suggestedFollowUpsSources, setSuggestedFollowUpsSources] = useState<string[]>([])

  // Learning Mode extra fields
  const [battleCard, setBattleCard] = useState<string | null>(null)
  const [meddpiccTip, setMeddpiccTip] = useState<string | null>(null)
  const [meddpiccStatus, setMeddpiccStatus] = useState<Record<string, boolean>>({
    "Metrics": false,
    "Economic Buyer": false,
    "Decision Criteria": false,
    "Decision Process": false,
    "Paper Process": false,
    "Identify Pain": false,
    "Champion": false,
    "Competition": false
  })

  // KB fact-check state (real-time contradiction detection)
  const [factCheck, setFactCheck] = useState<{ has_contradiction: boolean; rep_claim: string; kb_fact: string; correction_hint: string } | null>(null)
  const [hasKb, setHasKb] = useState(false)
  const [factCheckDismissed, setFactCheckDismissed] = useState(false)

  // Whether the first message has been sent (gates metric display)
  const [isSessionStarted, setIsSessionStarted] = useState(false)

  const rawMode = searchParams.get('mode') || scenario?.training_mode || 'Coach Mode'
  const isExamMode = rawMode.toLowerCase().includes('exam')
  const isLearningMode = rawMode.toLowerCase().includes('learning')
  const trainingMode = isExamMode ? 'Exam Mode' : isLearningMode ? 'Learning Mode' : 'Coach Mode'

  // Clear all live coaching state when in Exam Mode
  useEffect(() => {
    if (isExamMode) {
      setInlineCoachNote(null)
      setCoachingInsights([])
      setSuggestedFollowUps([])
    } else if (!isExamMode && inlineCoachNote === null) {
      setInlineCoachNote('💡 Tip: Open with an engaging question to uncover the prospect\'s key challenges.')
    }
  }, [isExamMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const micActiveRef = useRef(false)
  const speechStartTimeRef = useRef<number | null>(null)
  const speechSilenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const isUnmountedRef = useRef(false)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, inlineCoachNote, coachingInsights])

  // Clean up audio & speech resources on unmount
  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
      micActiveRef.current = false
      if (recognitionRef.current) {
        try { recognitionRef.current.stop() } catch (e) {}
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop())
      }
      if (audioContextRef.current) {
        try { audioContextRef.current.close() } catch (e) {}
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
      if (speechSilenceTimerRef.current) {
        clearTimeout(speechSilenceTimerRef.current)
      }
    }
  }, [])

  // Auto-initialize session if activeSessionId is missing
  useEffect(() => {
    const ensureSession = async () => {
      const token = localStorage.getItem('token')
      let sessId = activeSessionId || paramSessionId

      if (!sessId) {
        try {
          const startRes = await fetch(`${API}/api/sessions/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ scenarioId, assignmentId: assignmentId || null })
          })
          if (startRes.ok) {
            const startData = await startRes.json()
            sessId = startData.sessionId
            if (startData.avatarType) {
              setAvatarType(startData.avatarType)
            }
            if (sessId) {
              setActiveSessionId(sessId)
              const newUrl = window.location.pathname + `?sessionId=${sessId}${assignmentId ? `&assignmentId=${assignmentId}` : ''}`
              window.history.replaceState(null, '', newUrl)
            }
          }
        } catch (e) {
          console.error('Failed to auto-start session:', e)
        }
      }

      if (!sessId) return

      try {
        const res = await fetch(`${API}/api/sessions/${sessId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          const sess = data.session || data
          setScenario(data.scenario || sess.training_scenarios)

          const assignObj = Array.isArray(sess.training_assignments)
            ? sess.training_assignments[0]
            : (sess.training_assignments || sess.assignment)

          const resolvedAvatar = assignObj?.avatar_type || searchParams.get('avatarType') || searchParams.get('avatar_type')
          if (resolvedAvatar) {
            setAvatarType(resolvedAvatar)
          }

          if (sess.current_stage) setCurrentStage(sess.current_stage)
          if (sess.progress_percentage) setProgressPct(sess.progress_percentage)

          if (sess.messages_json && sess.messages_json.length > 0) {
            const parsedMsgs: ChatMessage[] = sess.messages_json.map((m: any) => ({
              role: (m.role === 'model' || m.role === 'persona' || m.role === 'bot') ? 'assistant' : m.role,
              content: m.content || (m.parts && m.parts[0]?.text) || ''
            }))
            setMessages(parsedMsgs)

            // Re-calculate metrics from loaded conversation
            const userMsgs = parsedMsgs.filter(m => m.role === 'user')
            const assistantMsgs = parsedMsgs.filter(m => m.role === 'assistant')

            const totalUserWords = userMsgs.reduce((acc, m) => acc + m.content.split(/\s+/).length, 0)
            const totalAiWords = assistantMsgs.reduce((acc, m) => acc + m.content.split(/\s+/).length, 0)
            const userEstMs = totalUserWords * 400
            const aiEstMs = totalAiWords * 400
            const totalMs = userEstMs + aiEstMs
            const calcRatio = totalMs > 0 ? Math.round((userEstMs / totalMs) * 100) : 45
            const questionCount = userMsgs.filter(m => m.content.includes('?')).length

            setMetrics({
              wpm: 135,
              fillerRatio: 1.5,
              talkListenRatio: calcRatio,
              userTalkTimeMs: userEstMs,
              aiTalkTimeMs: aiEstMs,
              questionCount
            })

            // Restore suggested followups & coaching insights from the last turn
            if (userMsgs.length > 0 && assistantMsgs.length > 0) {
              const lastUser = userMsgs[userMsgs.length - 1].content
              const lastAi = assistantMsgs[assistantMsgs.length - 1].content
              try {
                const sentRes = await fetch(`${API}/api/sessions/live-sentiment`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    repMessage: lastUser,
                    customerReply: lastAi,
                    sessionId: sessId
                  })
                })
                if (sentRes.ok) {
                  const sentData = await sentRes.json()
                  if (sentData.suggested_followups && sentData.suggested_followups.length > 0) {
                    setSuggestedFollowUps(sentData.suggested_followups)
                    setSuggestedFollowUpsSources(sentData.suggested_followups_sources || [])
                  }
                  if (sentData.has_kb !== undefined) setHasKb(sentData.has_kb)
                  if (sentData.fact_check) {
                    setFactCheck(sentData.fact_check)
                    setFactCheckDismissed(false)
                  }
                  if (sentData.coaching_hint) {
                    setInlineCoachNote(`🎯 ${sentData.coaching_hint}`)
                    setCoachingInsights(prev => [
                      {
                        id: `restored-${Date.now()}`,
                        severity: 'info',
                        title: 'Customer Sentiment',
                        text: sentData.coaching_hint,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      },
                      ...prev
                    ])
                  }
                  if (sentData.customer_sentiment !== undefined) {
                    setMoodScore(sentData.customer_sentiment)
                  }
                  if (sentData.tone_distribution) {
                    setToneDistribution(sentData.tone_distribution)
                  }
                }
              } catch (e) {
                console.warn('Restoring sentiment failed (non-fatal):', e)
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch session:', err)
      }
    }
    ensureSession()
  }, [scenarioId, paramSessionId])

  const [sttStatus, setSttStatus] = useState<string | null>(null)

  // Initialize Web Audio volume meter for real-time visual feedback
  const initAudioVisualizer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const audioCtx = new AudioCtx()
      audioContextRef.current = audioCtx
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]
        }
        const avg = sum / dataArray.length
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)))
        if (micActiveRef.current) {
          animFrameRef.current = requestAnimationFrame(updateLevel)
        }
      }
      updateLevel()
    } catch (e) {
      console.warn('Audio visualizer init error:', e)
    }
  }

  const isStartingMicRef = useRef(false)
  const isSendingRef = useRef(false)

  const startListening = async (isAutoRestart = false) => {
    if (typeof window === 'undefined') return

    // 1. Request Browser Mic Permission (skip if auto-restart — we already have the stream)
    if (!isAutoRestart) {
      let stream: MediaStream | null = null
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          // Stop existing stream before requesting new one
          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(t => t.stop())
            mediaStreamRef.current = null
          }
          
          stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          
          // If user navigated away while waiting for permission, abort
          if (isUnmountedRef.current) {
            stream.getTracks().forEach(t => t.stop())
            return
          }

          mediaStreamRef.current = stream
          initAudioVisualizer(stream)
        }
      } catch (err: any) {
        console.warn('Microphone permission denied:', err)
        alert('Microphone access is blocked. Please allow microphone permissions in your browser address bar.')
        setMicActive(false)
        micActiveRef.current = false
        return
      }
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech-to-Text is not supported in this browser. Please use Chrome, Edge, or Brave.')
      setMicActive(false)
      micActiveRef.current = false
      return
    }

    // Stop any existing recognition cleanly before creating a new one
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch (e) {}
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setMicActive(true)
      micActiveRef.current = true
      setSttStatus('🎙️ Listening... Speak clearly into your mic.')
    }

    recognition.onspeechstart = () => {
      speechStartTimeRef.current = Date.now()
    }

    recognition.onresult = (event: any) => {
      if (!speechStartTimeRef.current) {
        speechStartTimeRef.current = Date.now()
      }
      let interim = ''
      let final = ''

      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript + ' '
        } else {
          interim += transcript
        }
      }

      const combined = (final + interim).trim()
      if (combined) {
        setTextInput(combined)
        setSttStatus(`🎙️ Hearing: "${combined.slice(-35)}"`)

        // Silence auto-send detection if enabled
        if (autoSendOnSilence) {
          if (speechSilenceTimerRef.current) clearTimeout(speechSilenceTimerRef.current)
          speechSilenceTimerRef.current = setTimeout(() => {
            if (combined.trim().length > 3) {
              handleSendMessage(combined)
            }
          }, 1800)
        }
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error !== 'aborted') {
        console.warn('Speech recognition error event:', event.error)
      }
      if (event.error === 'not-allowed') {
        alert('Microphone permission was denied. Please allow microphone access in your browser settings.')
        setMicActive(false)
        micActiveRef.current = false
      } else if (event.error === 'no-speech') {
        setSttStatus('🎙️ Listening... Speak into your mic.')
      }
    }

    recognition.onend = () => {
      // Do NOT auto-restart if we're in the middle of sending a message
      // (handleSendMessage's finally block will handle the restart)
      if (isSendingRef.current) return

      // Auto-restart speech recognition if mic should still be active
      if (micActiveRef.current) {
        try {
          recognition.start()
        } catch (e) {
          // Engine crashed — reset UI cleanly so user can click again
          setSttStatus(null)
          setMicActive(false)
          micActiveRef.current = false
        }
      } else {
        setSttStatus(null)
        setMicActive(false)
      }
    }

    try {
      recognition.start()
      recognitionRef.current = recognition
    } catch (err: any) {
      console.error('Failed to start speech recognition:', err)
      setMicActive(false)
      micActiveRef.current = false
    }
  }

  const stopListening = () => {
    micActiveRef.current = false
    isSendingRef.current = false
    isStartingMicRef.current = false
    if (recognitionRef.current) {
      try { recognitionRef.current.abort() } catch (e) {}
      recognitionRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close() } catch (e) {}
      audioContextRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    setAudioLevel(0)
    setMicActive(false)
    setSttStatus(null)
  }

  const toggleMic = async () => {
    if (micActive) {
      stopListening()
    } else {
      if (isStartingMicRef.current) return
      isStartingMicRef.current = true
      try {
        await startListening()
      } finally {
        isStartingMicRef.current = false
      }
    }
  }

  const playTTS = async (text: string) => {
    setIsAiSpeaking(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text, avatarType: avatarType || 'female' })
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        if (audioRef.current) {
          audioRef.current.src = url
          audioRef.current.play()
          audioRef.current.onended = () => setIsAiSpeaking(false)
          return
        }
      }
    } catch (err) {
      console.warn('Backend TTS failed, using Web Speech Synthesis fallback', err)
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.onend = () => setIsAiSpeaking(false)
      utterance.onerror = () => setIsAiSpeaking(false)
      window.speechSynthesis.speak(utterance)
    } else {
      setIsAiSpeaking(false)
    }
  }

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || textInput
    if (!messageText.trim()) return

    if (speechSilenceTimerRef.current) {
      clearTimeout(speechSilenceTimerRef.current)
    }

    const wasMicActive = micActiveRef.current

    // Calculate actual speech duration
    const speechEndTime = Date.now()
    const userWords = messageText.trim().split(/\s+/).length
    let rawDurationMs = 0
    let calculatedWpm = metrics.wpm || 135

    if (wasMicActive && speechStartTimeRef.current) {
      const elapsedMs = Math.max(800, speechEndTime - speechStartTimeRef.current)
      // Clamped realistic speaking duration (avoid silence skewing)
      const maxSensibleMs = Math.max(1200, userWords * 750)
      const effectiveMs = Math.min(elapsedMs, maxSensibleMs)
      calculatedWpm = Math.round((userWords / (effectiveMs / 60000))) || 135
      // Clamp to realistic physical speaking pace bounds (90 - 210 WPM)
      calculatedWpm = Math.min(210, Math.max(90, calculatedWpm))
      rawDurationMs = effectiveMs
    } else {
      // For typed messages (no mic), maintain previous pace or healthy baseline (135 WPM)
      calculatedWpm = metrics.wpm > 0 ? metrics.wpm : 135
      rawDurationMs = Math.round((userWords / 135) * 60000)
    }
    speechStartTimeRef.current = null

    // Tell the onend handler NOT to auto-restart — we'll do it ourselves in the finally block
    if (wasMicActive && recognitionRef.current) {
      isSendingRef.current = true
      try {
        recognitionRef.current.abort()
      } catch (e) {}
      recognitionRef.current = null
    }

    const userMsg: ChatMessage = { role: 'user', content: messageText.trim() }
    setMessages(prev => [...prev, userMsg])
    setTextInput('')

    // Update cumulative metrics
    const fillerRegex = /\b(um|uh|like|you know|so|basically)\b/gi
    const fillerMatches = messageText.match(fillerRegex) || []
    const calculatedFillerRatio = Math.round((fillerMatches.length / userWords) * 1000) / 10

    const updatedUserTalkMs = metrics.userTalkTimeMs + rawDurationMs
    const currentAiTalkMs = metrics.aiTalkTimeMs || 4000
    const totalTalkMs = updatedUserTalkMs + currentAiTalkMs
    const calcTalkListenRatio = Math.round((updatedUserTalkMs / totalTalkMs) * 100)

    setMetrics(prev => ({
      ...prev,
      wpm: calculatedWpm,
      fillerRatio: calculatedFillerRatio,
      userTalkTimeMs: updatedUserTalkMs,
      talkListenRatio: calcTalkListenRatio,
      questionCount: prev.questionCount + (messageText.includes('?') ? 1 : 0)
    }))

    try {
      const token = localStorage.getItem('token')
      let currentSessionId = activeSessionId || paramSessionId

      // Auto-start session if not initialized yet
      if (!currentSessionId) {
        try {
          const startRes = await fetch(`${API}/api/sessions/start`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ scenarioId, assignmentId: assignmentId || null })
          })
          if (startRes.ok) {
            const startData = await startRes.json()
            currentSessionId = startData.sessionId
            if (startData.avatarType) {
              setAvatarType(startData.avatarType)
            }
            if (currentSessionId) {
              setActiveSessionId(currentSessionId)
              const newUrl = window.location.pathname + `?sessionId=${currentSessionId}${assignmentId ? `&assignmentId=${assignmentId}` : ''}`
              window.history.replaceState(null, '', newUrl)
            }
          }
        } catch (e) {
          console.error('Auto start session failed:', e)
        }
      }

      if (!currentSessionId) return
      
      // 1. Process Live Turn (Conversation & AI Response)
      const res = await fetch(`${API}/api/sessions/live-turn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          transcript: messageText,
          durationMs: rawDurationMs,
          userTalkTimeMs: updatedUserTalkMs,
          aiTalkTimeMs: currentAiTalkMs,
          interruptionCount: 0,
          emotion: calculatedWpm > 160 ? 'Anxious' : 'Confident',
          confidenceScore: 0.88
        })
      })

      if (res.ok) {
        const data = await res.json()
        const aiRespText = data.aiResponse || ''
        if (aiRespText) {
          const aiMsg: ChatMessage = { role: 'assistant', content: aiRespText }
          setMessages(prev => [...prev, aiMsg])
          
          // Mark session as started — gates metric panels switching from placeholder to live data
          setIsSessionStarted(true)

          // Estimate AI talk duration for talk/listen ratio
          const aiWords = aiRespText.split(/\s+/).length
          const estAiDurationMs = Math.max(2000, (aiWords / 150) * 60000)
          setMetrics(prev => ({
            ...prev,
            aiTalkTimeMs: prev.aiTalkTimeMs + estAiDurationMs,
            talkListenRatio: Math.round((prev.userTalkTimeMs / (prev.userTalkTimeMs + prev.aiTalkTimeMs + estAiDurationMs)) * 100)
          }))

          await playTTS(aiRespText)
        }

        if (data.inline_coach_note && !isExamMode) setInlineCoachNote(data.inline_coach_note)
        if (data.current_stage) setCurrentStage(data.current_stage)
        if (data.progress_percentage) setProgressPct(data.progress_percentage)

        // Process Coach Tip trigger from live-turn (only in non-Exam modes)
        if (!isExamMode && data.coachTip && data.coachTip.shouldPopup) {
          const newInsight: CoachingInsight = {
            id: `insight-${Date.now()}`,
            severity: data.coachTip.severity || 'warning',
            title: data.coachTip.severity === 'danger' ? 'High Friction' : 'Pace & Tone',
            text: data.coachTip.tip,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
          setCoachingInsights(prev => [newInsight, ...prev.slice(0, 4)])
        }

        // 2. Process Live Sentiment & Sentiment Analytics (skip in Exam Mode)
        if (!isExamMode) {
        try {
          const sentRes = await fetch(`${API}/api/sessions/live-sentiment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              repMessage: messageText,
              customerReply: aiRespText,
              sessionId: currentSessionId,
              trainingMode   // pass mode so backend forks prompt correctly
            })
          })

          if (sentRes.ok) {
            const sentData = await sentRes.json()
            const newMood = sentData.customer_sentiment !== undefined ? sentData.customer_sentiment : moodScore
            const shift = newMood - moodScore
            setMoodScore(newMood)
            setSentimentShift(shift)

            if (sentData.coaching_hint) {
              setInlineCoachNote(`🎯 ${sentData.coaching_hint}`)
              const newInsight: CoachingInsight = {
                id: `sent-insight-${Date.now()}`,
                severity: sentData.rep_tone_type === 'warn' ? 'warning' : 'info',
                title: sentData.rep_tone_type === 'warn' ? 'Tone Adjustment' : 'Customer Sentiment',
                text: sentData.coaching_hint,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }
              setCoachingInsights(prev => [newInsight, ...prev.slice(0, 4)])
            }

            // Update Tone Distribution dynamically
            let newToneDist = prevToneDistributionRef.current;
            if (sentData.tone_distribution) {
              newToneDist = sentData.tone_distribution;
              setToneDistribution(sentData.tone_distribution)
            } else {
              if (newMood >= 70) {
                newToneDist = { alert: 10, hesitant: 10, warm: 50, wise: 30 }
              } else if (newMood <= 45) {
                newToneDist = { alert: 40, hesitant: 40, warm: 10, wise: 10 }
              } else {
                newToneDist = { alert: 15, hesitant: 35, warm: 30, wise: 20 }
              }
              setToneDistribution(newToneDist)
            }

            let maxAbsChange = 0;
            let largestShiftEmotion: 'alert' | 'hesitant' | 'warm' | 'wise' | null = null;
            let actualDiff = 0;
            const emotions = ['alert', 'hesitant', 'warm', 'wise'] as const;

            const prevTotal = prevToneDistributionRef.current.alert + prevToneDistributionRef.current.hesitant + prevToneDistributionRef.current.warm + prevToneDistributionRef.current.wise;

            if (prevTotal > 0) {
              for (const em of emotions) {
                const diff = newToneDist[em] - prevToneDistributionRef.current[em];
                if (Math.abs(diff) >= 20 && Math.abs(diff) > maxAbsChange) {
                  maxAbsChange = Math.abs(diff);
                  largestShiftEmotion = em;
                  actualDiff = diff;
                }
              }
            }

            if (largestShiftEmotion) {
              const colorMap = {
                alert: 'text-red-700 bg-red-100 border-red-300',
                hesitant: 'text-orange-700 bg-orange-100 border-orange-300',
                warm: 'text-yellow-700 bg-yellow-100 border-yellow-300',
                wise: 'text-green-700 bg-green-100 border-green-300'
              };
              const nameMap = {
                alert: 'Alert',
                hesitant: 'Hesitant',
                warm: 'Warm',
                wise: 'Wise'
              };

              setMessages(prevMsgs => {
                const newMsgs = [...prevMsgs];
                for (let i = newMsgs.length - 1; i >= 0; i--) {
                  if (newMsgs[i].role === 'user') {
                    newMsgs[i] = {
                      ...newMsgs[i],
                      emotionLabel: {
                        emotion: nameMap[largestShiftEmotion!],
                        colorClass: colorMap[largestShiftEmotion!],
                        changeText: actualDiff > 0 ? `+${actualDiff}%` : `${actualDiff}%`
                      }
                    };
                    break;
                  }
                }
                return newMsgs;
              });
            }

            prevToneDistributionRef.current = newToneDist;

            if (sentData.suggested_followups && sentData.suggested_followups.length > 0) {
              setSuggestedFollowUps(sentData.suggested_followups)
              setSuggestedFollowUpsSources(sentData.suggested_followups_sources || [])
            }
            // KB and fact-check state
            if (sentData.has_kb !== undefined) setHasKb(sentData.has_kb)
            if (sentData.fact_check) {
              setFactCheck(sentData.fact_check)
              setFactCheckDismissed(false)
            }
            // Learning Mode extras
            if (isLearningMode) {
              setBattleCard(sentData.battle_card || null)
              setMeddpiccTip(sentData.meddpicc_tip || null)
              if (sentData.meddpicc_status) {
                setMeddpiccStatus(prev => {
                  const updated = { ...prev };
                  for (const key in sentData.meddpicc_status) {
                    if (sentData.meddpicc_status[key]) {
                      updated[key] = true;
                    }
                  }
                  return updated;
                });
              }
            }
          }
        } catch (sentErr) {
          console.warn('[LiveSentiment] call failed (non-fatal):', sentErr)
        }
        } // end !isExamMode
      }
    } catch (err) {
      console.error('Failed to send live message', err)
    } finally {
      isSendingRef.current = false
      // Restart mic listening if it was active before sending
      if (wasMicActive && micActiveRef.current) {
        await startListening(true)
      }
    }
  }

  const handleEndAndReview = async () => {
    stopListening()
    setIsEnding(true)
    
    let finalMessages = [...messages]
    if (textInput.trim()) {
      finalMessages.push({ role: 'user', content: textInput.trim() })
    }
    
    const currentSessionId = activeSessionId || paramSessionId
    try {
      const token = localStorage.getItem('token')
      if (currentSessionId) {
        await fetch(`${API}/api/sessions/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessionId: currentSessionId, currentMessages: finalMessages })
        })
      }
    } catch (err) {
      console.error('End session failed:', err)
    } finally {
      router.push(`/rep/train/${scenarioId}/review?sessionId=${currentSessionId}`)
    }
  }

  const handlePauseAndExit = async () => {
    stopListening()
    const currentSessionId = activeSessionId || paramSessionId
    try {
      const token = localStorage.getItem('token')
      if (currentSessionId) {
        await fetch(`${API}/api/sessions/pause`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ sessionId: currentSessionId })
        })
      }
    } catch (err) {
      console.error('Pause session failed:', err)
    } finally {
      router.push('/rep/dashboard')
    }
  }

  const personaName = scenario?.persona_name || scenario?.contact_title || 'Sarah Chen'
  const roleTitle = scenario?.contact_title || 'VP of Engineering'
  const company = scenario?.contact_company || 'Acme Technologies'

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] font-sans text-xs overflow-hidden">
      <audio ref={audioRef} className="hidden" />

      {/* Top Command Center Bar */}
      <div className="bg-[#1E1B4B] text-white px-6 py-3 flex items-center justify-between shadow-md z-20 shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-[800] text-[10px]">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            LIVE
          </span>
          <div>
            <h1 className="font-[800] text-sm leading-none">{scenario?.persona_name || 'Technical Discovery'}</h1>
            <p className="text-[10px] text-purple-200 mt-0.5">Mode: {trainingMode}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
            <span className={`w-2 h-2 rounded-full ${isAiSpeaking ? 'bg-green-400 animate-pulse' : 'bg-blue-400'}`}></span>
            <span className="text-[11px] font-[600]">
              {isAiSpeaking ? `${personaName} is speaking...` : `Listening to You`}
            </span>
          </div>

          {/* Customer Sentiment Badge */}
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/10">
            <span className="text-[10px] font-[600] text-purple-200">Sentiment Score</span>
            <span className={`text-[11px] font-[800] ${moodScore >= 70 ? 'text-green-300' : moodScore >= 50 ? 'text-amber-300' : 'text-red-300'}`}>
              {moodScore}/100 ({sentimentShift >= 0 ? `+${sentimentShift}` : sentimentShift})
            </span>
          </div>

          <button
            onClick={handleEndAndReview}
            disabled={isEnding}
            className="px-4 py-1.5 rounded-xl border border-red-400/40 text-red-300 hover:bg-red-500/20 font-[700] text-xs transition-colors flex items-center gap-1.5"
          >
            {isEnding ? 'Ending...' : '🔴 End Session'}
          </button>
        </div>
      </div>

      {/* Main 3-Column Command Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT COLUMN: Persona Brief & Live Voice Metrics */}
        <div className="w-72 bg-white border-r border-gray-200 p-5 overflow-y-auto space-y-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1E1B4B] text-white font-[800] flex items-center justify-center text-sm shadow-sm">
              SC
            </div>
            <div>
              <h2 className="font-[800] text-[#1E293B] text-sm">{personaName}</h2>
              <p className="text-[11px] text-[#64748B]">{roleTitle}</p>
              <span className="inline-block mt-0.5 px-2 py-0.5 bg-blue-50 text-blue-700 text-[9px] font-[700] rounded">
                {isAiSpeaking ? 'Speaking' : 'Listening'}
              </span>
            </div>
          </div>

          <div className="space-y-2 text-[11px]">
            <p className="font-[800] text-[#64748B] uppercase tracking-wider text-[10px]">Persona Brief</p>
            <div className="space-y-1.5 text-[#334155]">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Role</span>
                <span className="font-[600]">{roleTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Company</span>
                <span className="font-[600]">{company}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Comm. Style</span>
                <span className="font-[600]">Direct, Data-driven</span>
              </div>
            </div>
          </div>

          {/* REAL-TIME VOICE ANALYTICS CARD */}
          <div className="space-y-2.5 pt-3 border-t border-gray-100">
            <p className="font-[800] text-[#64748B] uppercase tracking-wider text-[10px] flex items-center justify-between">
              <span>🎙️ Voice Delivery Metrics</span>
              <span className="text-[9px] text-purple-600 font-[700]">LIVE</span>
            </p>
            {!isSessionStarted ? (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-4 text-center">
                <p className="text-[11px] text-[#94A3B8] font-[600]">🎙️ Start speaking to see live metrics</p>
              </div>
            ) : (
            <>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-purple-50/60 border border-purple-100 p-2 rounded-xl text-center">
                <p className="text-[9px] font-[700] text-purple-600 uppercase">Pace (WPM)</p>
                <p className="text-sm font-[800] text-[#1E293B]">{metrics.wpm}</p>
                <span className="text-[8px] text-gray-500">Target: 120-150</span>
              </div>
              <div className="bg-amber-50/60 border border-amber-100 p-2 rounded-xl text-center">
                <p className="text-[9px] font-[700] text-amber-600 uppercase">Fillers</p>
                <p className="text-sm font-[800] text-[#1E293B]">{metrics.fillerRatio}%</p>
                <span className="text-[8px] text-gray-500">&lt;5% ideal</span>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-xl space-y-1.5">
              <div className="flex justify-between text-[10px] font-[700] text-[#334155]">
                <span>Talk / Listen Ratio</span>
                <span>{metrics.talkListenRatio}% Rep</span>
              </div>
              <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-indigo-600" style={{ width: `${metrics.talkListenRatio}%` }}></div>
                <div className="h-full bg-blue-400 flex-1"></div>
              </div>
            </div>
            </>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-gray-100">
            <p className="font-[800] text-[#64748B] uppercase tracking-wider text-[10px]">Sales Stages</p>
            <div className="space-y-1">
              {['Opening', 'Needs Discovery', 'Value Pitch', 'Objection Handling', 'Closing'].map((stage, idx) => {
                const stagesList = ['Opening', 'Needs Discovery', 'Value Pitch', 'Objection Handling', 'Closing'];
                const isActive = currentStage === stage;
                const isPast = stagesList.indexOf(currentStage) > idx;
                return (
                  <div key={stage} className={`text-[10px] font-[700] flex items-center gap-2 ${isActive ? 'text-purple-700' : isPast ? 'text-green-600' : 'text-gray-400'}`}>
                    <span>{isPast ? '✓' : isActive ? '▶' : '○'}</span>
                    <span>{stage}</span>
                  </div>
                )
              })}
            </div>
            {!isExamMode && inlineCoachNote && (
              <div className="mt-2 p-2 bg-purple-50 text-purple-900 text-[10px] font-[600] rounded-lg border border-purple-100 shadow-sm leading-snug">
                🚀 <span className="font-[800]">Next Step:</span> {inlineCoachNote}
              </div>
            )}
            <div className="flex justify-between text-[10px] font-[800] text-[#64748B] mt-3 pt-2 border-t border-gray-100">
              <span>Overall Progress</span>
              <span>{progressPct}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-purple-600 transition-all duration-500 rounded-full" style={{ width: `${progressPct}%` }}></div>
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Chat Stream & Voice Controls */}
        <div className="flex-1 flex flex-col bg-[#F8FAFC] overflow-hidden">
          {/* Tone & Sentiment Meter Header */}
          <div className="bg-white border-b border-gray-200 p-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">
              <span className="flex items-center gap-2">
                <span>Live Tone & Sentiment Analytics</span>
                <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-[9px]">Active Analysis</span>
              </span>
              {micActive && (
                <span className="text-red-500 font-[800] animate-pulse flex items-center gap-1">
                  🔴 Recording Mic Audio
                </span>
              )}
            </div>

            {isSessionStarted ? (
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-red-600 border border-red-700 p-2 rounded-lg text-center shadow-sm">
                <p className="text-[10px] font-[600] text-red-100">Alert</p>
                <p className="text-sm font-[800] text-white">{toneDistribution.alert}%</p>
              </div>
              <div className="bg-orange-500 border border-orange-600 p-2 rounded-lg text-center shadow-sm">
                <p className="text-[10px] font-[600] text-orange-50">Hesitant</p>
                <p className="text-sm font-[800] text-white">{toneDistribution.hesitant}%</p>
              </div>
              <div className="bg-yellow-400 border border-yellow-500 p-2 rounded-lg text-center shadow-sm">
                <p className="text-[10px] font-[600] text-yellow-900">Warm</p>
                <p className="text-sm font-[800] text-black">{toneDistribution.warm}%</p>
              </div>
              <div className="bg-green-600 border border-green-700 p-2 rounded-lg text-center shadow-sm">
                <p className="text-[10px] font-[600] text-green-100">Wise</p>
                <p className="text-sm font-[800] text-white">{toneDistribution.wise}%</p>
              </div>
            </div>
            ) : (
            <div className="flex items-center justify-center h-10 text-[11px] text-[#94A3B8] font-[600]">
              <span className="mr-2">💬</span> Tone analysis will appear after your first message
            </div>
            )}
          </div>

          {/* Transcript Chat Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m, idx) => {
              const isUser = m.role === 'user'
              return (
                <div key={idx} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[75%] p-4 rounded-2xl text-xs leading-relaxed shadow-sm ${
                      isUser
                        ? 'bg-[#1E1B4B] text-white rounded-tr-none'
                        : 'bg-white border border-gray-200 text-[#1E293B] rounded-tl-none'
                    }`}
                  >
                    <p className={isUser ? "text-white" : ""}>{m.content}</p>
                  </div>
                  <div className="flex flex-col">
                    <span className={`text-[10px] font-[600] text-[#64748B] mt-1 px-1 flex items-center gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {isUser ? 'You (Sales Rep)' : personaName}
                    </span>
                    {isUser && m.emotionLabel && (
                      <div className={`mt-1 self-end inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[9px] font-bold border ${m.emotionLabel.colorClass}`}>
                        <span>{m.emotionLabel.emotion} Shift: {m.emotionLabel.changeText}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {!isExamMode && inlineCoachNote && (
              <div className="my-3 bg-amber-50 border border-amber-200 text-amber-900 p-3.5 rounded-xl text-xs font-[600] flex items-center gap-2 shadow-sm animate-fadeIn">
                <span>{inlineCoachNote}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Live Mic Audio Level Visualizer & STT Status */}
          {(micActive || sttStatus) && (
            <div className="px-6 py-2 bg-purple-50/80 border-t border-purple-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-[600] text-purple-900">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                <span>{sttStatus || 'Microphone Active — Speak continuously...'}</span>
              </div>

              {/* Audio Wave Volume Level Bar */}
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-purple-700 font-[700]">MIC LEVEL</span>
                <div className="w-24 h-2 bg-purple-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all duration-75"
                    style={{ width: `${Math.max(10, audioLevel)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Bottom Chat Input & Controls */}
          <div className="bg-white border-t border-gray-200 p-4 flex items-center justify-between gap-4 shrink-0">
            <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2">
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                placeholder={micActive ? 'Listening to your voice... (or type here)' : 'Type your response...'}
                className="w-full bg-transparent text-xs font-[500] text-[#1E293B] focus:outline-none"
              />
              <button
                onClick={() => handleSendMessage()}
                className="px-3 py-1 bg-[#1E1B4B] text-white font-[700] text-xs rounded-lg hover:bg-[#2E2A72] transition-colors"
              >
                Send
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Voice Capture Microphone Toggle Button */}
              <button
                onClick={toggleMic}
                className={`px-3 py-2 rounded-xl border font-[700] text-xs transition-colors flex items-center gap-1.5 ${
                  micActive
                    ? 'bg-red-500 text-white border-red-600 shadow-md animate-pulse'
                    : 'bg-white text-[#334155] border-gray-300 hover:bg-gray-50'
                }`}
              >
                {micActive ? '🔴 Mic Active' : '🎙️ Enable Mic'}
              </button>

              {/* Silence Auto-Send Toggle */}
              <label className="flex items-center gap-1.5 text-[10px] font-[600] text-gray-600 bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSendOnSilence}
                  onChange={e => setAutoSendOnSilence(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                Auto-Send
              </label>

              <button
                onClick={() => setIsPaused(true)}
                className="px-3 py-2 rounded-xl border border-gray-300 bg-white text-[#334155] font-[700] text-xs hover:bg-gray-50 transition-colors"
              >
                ⏸️ Pause
              </button>
              <button
                onClick={handleEndAndReview}
                disabled={isEnding}
                className="px-5 py-2 rounded-xl bg-[#1E1B4B] hover:bg-[#2E2A72] text-white text-xs font-[700] shadow-md transition-colors"
              >
                {isEnding ? 'Ending...' : 'End & Review'}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: AI Coach Live Insights Sidebar */}
        {!isExamMode && (
          <div className="w-80 bg-white border-l border-gray-200 p-5 overflow-y-auto space-y-6 shrink-0">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="font-[800] text-sm text-[#1E293B] flex items-center gap-2">
                🤖 AI Coach
              </h2>
              <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-[800] rounded">
                {isLearningMode ? 'AI ASSISTED' : 'LIVE'}
              </span>
            </div>

            {/* REAL-TIME AI COACHING INSIGHTS */}
            <div className="space-y-3">
              <p className="font-[800] text-[#64748B] uppercase tracking-wider text-[10px]">REAL-TIME COACHING INSIGHTS</p>
              <div className="space-y-2 text-xs">
                {coachingInsights.length === 0 ? (
                  <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-5 text-center">
                    <p className="text-2xl mb-2">🤖</p>
                    <p className="text-[11px] font-[700] text-[#1E293B]">Waiting for conversation...</p>
                    <p className="text-[10px] text-[#94A3B8] mt-1">AI coaching tips will appear here as you speak.</p>
                  </div>
                ) : coachingInsights.map(insight => (
                  <div
                    key={insight.id}
                    className={`p-3 rounded-xl space-y-1 border shadow-sm ${
                      insight.severity === 'danger'
                        ? 'bg-red-50/80 border-red-200 text-red-900'
                        : insight.severity === 'warning'
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : 'bg-blue-50/80 border-blue-200 text-blue-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-[800] text-[10px] uppercase">
                        {insight.severity === 'danger' ? '🚨 Warning' : insight.severity === 'warning' ? '⚠️ Tip' : '💡 Insight'} — {insight.title}
                      </p>
                      <span className="text-[9px] opacity-70">{insight.timestamp}</span>
                    </div>
                    <p className="leading-snug text-[11px] font-[500]">{insight.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── FACT CHECK ALERT (all non-Exam modes, KB personas only) ── */}
            {factCheck && factCheck.has_contradiction && !factCheckDismissed && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl relative animate-in fade-in slide-in-from-top-2 duration-300">
                <button
                  onClick={() => setFactCheckDismissed(true)}
                  className="absolute top-2 right-2 text-amber-400 hover:text-amber-600 text-xs font-bold"
                  title="Dismiss"
                >
                  ✕
                </button>
                <div className="flex items-start gap-2">
                  <span className="text-amber-600 text-sm shrink-0 mt-0.5">⚠️</span>
                  <div>
                    <p className="font-[800] text-amber-800 text-[10px] uppercase tracking-wider">Fact Check Alert</p>
                    <p className="text-[11px] font-[600] text-amber-900 leading-snug mt-1">{factCheck.correction_hint}</p>
                    {factCheck.kb_fact && (
                      <p className="text-[10px] text-amber-700 mt-1 italic">KB: {factCheck.kb_fact}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── COACH MODE: Coaching Observations (non-clickable hints) ── */}
            {!isLearningMode && suggestedFollowUps.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div>
                  <p className="font-[800] text-[#64748B] uppercase tracking-wider text-[10px]">COACHING OBSERVATIONS</p>
                  <p className="text-[9px] text-[#94A3B8] mt-0.5">Directional hints — you drive the conversation</p>
                </div>
                <div className="space-y-2">
                  {suggestedFollowUps.map((obs, idx) => (
                    <div
                      key={idx}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-[500] text-slate-700 flex items-start gap-2"
                    >
                      <span className="text-slate-400 text-sm shrink-0 mt-0.5">💭</span>
                      <span className="leading-snug">{obs}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── LEARNING MODE: Clickable Suggestions + Battle Card + MEDDICC ── */}
            {isLearningMode && (
              <>
                {/* Clickable Follow-Ups */}
                {suggestedFollowUps.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <p className="font-[800] text-[#64748B] uppercase tracking-wider text-[10px]">SUGGESTED RESPONSES</p>
                      <span className="text-[9px] text-purple-600 font-[600]">Click to Send</span>
                    </div>
                    <div className="space-y-2">
                      {suggestedFollowUps.map((question, idx) => {
                        const isKbGrounded = suggestedFollowUpsSources[idx] === 'kb'
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(question)}
                            title="Click to send this response"
                            className={`w-full p-2.5 text-left rounded-xl text-xs font-[600] transition-all shadow-sm flex items-start gap-2 group ${
                              isKbGrounded
                                ? 'bg-emerald-50/60 hover:bg-emerald-100/80 border border-emerald-300/80 text-emerald-950 hover:text-emerald-900'
                                : 'bg-purple-50/50 hover:bg-purple-100/80 border border-purple-200/80 text-purple-950 hover:text-purple-900'
                            }`}
                          >
                            <span className={`text-sm group-hover:scale-110 transition-transform shrink-0 ${
                              isKbGrounded ? 'text-emerald-600' : 'text-purple-600'
                            }`}>{isKbGrounded ? '📚' : '💡'}</span>
                            <div className="flex-1">
                              {isKbGrounded && (
                                <span className="inline-block text-[9px] font-[700] text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full px-1.5 py-0.5 mb-1 uppercase tracking-wider">KB-Grounded</span>
                              )}
                              <span className="leading-snug block">{question}</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Battle Card */}
                {battleCard && (
                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <p className="font-[800] text-[#64748B] uppercase tracking-wider text-[10px]">⚔️ BATTLE CARD</p>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-[11px] font-[600] text-amber-900 leading-snug">{battleCard}</p>
                    </div>
                  </div>
                )}

                {/* MEDDPICC Checklist & Tip */}
                {(meddpiccTip || Object.values(meddpiccStatus).some(Boolean)) && (
                  <div className="pt-3 border-t border-gray-100 space-y-2">
                    <p className="font-[800] text-[#64748B] uppercase tracking-wider text-[10px]">🎯 MEDDPICC COACHING</p>
                    <div className="space-y-1 mt-2">
                      {['Metrics', 'Economic Buyer', 'Decision Criteria', 'Decision Process', 'Paper Process', 'Identify Pain', 'Champion', 'Competition'].map(stage => {
                        const isCompleted = meddpiccStatus[stage];
                        return (
                          <div key={stage} className={`text-[10px] font-[700] flex items-center gap-2 ${isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                            <span>{isCompleted ? '✓' : '○'}</span>
                            <span>{stage} {isCompleted && <span className="text-[9px] uppercase">(Completed)</span>}</span>
                          </div>
                        )
                      })}
                    </div>
                    {meddpiccTip && (
                      <div className="p-3 mt-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                        <p className="text-[11px] font-[600] text-indigo-900 leading-snug">{meddpiccTip}</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Pause Modal */}
      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-5 text-center">
            <h3 className="text-lg font-[800] text-[#1E293B]">Session Paused</h3>
            <p className="text-xs text-[#64748B]">Select an action to continue.</p>

            <div className="space-y-2">
              <button
                onClick={() => setIsPaused(false)}
                className="w-full py-2.5 bg-[#1E1B4B] hover:bg-[#2E2A72] text-white font-[700] rounded-xl text-xs transition-colors"
              >
                Resume Session
              </button>
              {!isExamMode && (
                <>
                  <button
                    onClick={() => {
                      setIsPaused(false)
                      setMessages([])
                    }}
                    className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-[#334155] font-[700] rounded-xl text-xs transition-colors"
                  >
                    Retry Session (Start Over)
                  </button>
                  <button
                    onClick={handlePauseAndExit}
                    className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-[#334155] font-[700] rounded-xl text-xs transition-colors"
                  >
                    Continue Later
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
