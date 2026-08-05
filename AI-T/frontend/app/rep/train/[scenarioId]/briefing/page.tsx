'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function BriefingPage({ params }: { params: { scenarioId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { scenarioId } = params
  const assignmentId = searchParams.get('assignmentId')
  const sessionId = searchParams.get('sessionId')
  const urlMode = searchParams.get('mode')

  const [scenario, setScenario] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const fetchBriefing = async () => {
      try {
        const token = localStorage.getItem('token')
        const headers = { 'Authorization': `Bearer ${token}` }

        const scenRes = await fetch(`${API}/api/scenarios/${scenarioId}`, { headers })
        if (scenRes.ok) {
          const data = await scenRes.json()
          setScenario(data)
        }

        if (sessionId) {
          const sessRes = await fetch(`${API}/api/sessions/${sessionId}`, { headers })
          if (sessRes.ok) {
            const sessData = await sessRes.json()
            setSession(sessData)
          }
        }
      } catch (err) {
        console.error('Failed to fetch briefing data', err)
      } finally {
        setLoading(false)
      }
    }

    fetchBriefing()
  }, [scenarioId, sessionId])

  const handleStartOrCreateSession = async () => {
    setStarting(true)
    const trainingMode = urlMode || scenario?.training_mode || 'Coach Mode'
    const modeParam = `&mode=${encodeURIComponent(trainingMode)}`
    try {
      if (sessionId) {
        // Resume existing active session
        router.push(`/rep/train/${scenarioId}?sessionId=${sessionId}${assignmentId ? `&assignmentId=${assignmentId}` : ''}${modeParam}`)
        return
      }

      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/sessions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scenarioId, assignmentId })
      })

      if (res.ok) {
        const data = await res.json()
        const targetUrl = `/rep/train/${scenarioId}?sessionId=${data.sessionId}${assignmentId ? `&assignmentId=${assignmentId}` : ''}${modeParam}`
        router.push(targetUrl)
      } else {
        alert('Failed to start session. Please try again.')
        setStarting(false)
      }
    } catch (err) {
      console.error(err)
      alert('Error connecting to the server.')
      setStarting(false)
    }
  }

  if (loading || !scenario) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#1E1B4B]"></div>
      </div>
    )
  }

  const isResuming = !!sessionId || !!session

  // DB scenario data
  const personaName = scenario.persona_name || scenario.contact_title || 'Prospect Persona'
  const roleTitle = scenario.contact_title || 'Decision Maker'
  const company = scenario.contact_company || 'Target Company'
  const experienceYears = scenario.experience_years || 10
  const industry = scenario.industry || 'B2B Enterprise'
  const buyingStyle = scenario.buying_style || 'Committee-based'
  const communicationStyle = scenario.communication_style || 'Direct, formal'
  const aiConfidence = scenario.ai_confidence || 89
  const difficulty = scenario.difficulty || 'Medium'
  const estimatedDuration = scenario.estimated_duration_mins || 20

  const personalityTraits = typeof scenario.personality_traits === 'string'
    ? scenario.personality_traits.split(',').map((s: string) => s.trim())
    : (Array.isArray(scenario.personality_traits) ? scenario.personality_traits : ['Analytical', 'Data-driven'])

  const priorityGoals = Array.isArray(scenario.priority_goals)
    ? scenario.priority_goals
    : (scenario.conversation_expectations ? [scenario.conversation_expectations] : ['Evaluate product fit', 'Assess implementation timeline'])

  const skillsEvaluated = Array.isArray(scenario.skills_evaluated)
    ? scenario.skills_evaluated
    : (scenario.target_skills ? scenario.target_skills.split(',').map((s: string) => s.trim()) : ['Discovery', 'Value Proposition', 'Objection Handling'])

  const customerBackground = scenario.context_text || scenario.customer_background || 'No context background provided for this scenario.'

  const businessGoals = Array.isArray(scenario.business_goals)
    ? scenario.business_goals
    : [scenario.conversation_expectations || 'Achieve operational efficiency']

  const painPoints = Array.isArray(scenario.pain_points)
    ? scenario.pain_points
    : (scenario.objection_style ? [scenario.objection_style] : ['Current solution scaling bottleneck'])

  const expectedObjections = Array.isArray(scenario.expected_objections)
    ? scenario.expected_objections
    : (scenario.objection_style ? [scenario.objection_style] : ['Budget constraints', 'Integration timeline'])

  const meetingObjective = scenario.conversation_expectations || 'Conduct thorough discovery and secure next meeting commitment.'

  const buyingSignals = Array.isArray(scenario.buying_signals)
    ? scenario.buying_signals
    : ['Active evaluation phase', 'Executive sponsorship']

  const whereYouLeftOff = session?.snapshot_json?.where_you_left_off || [
    { type: 'good', text: 'Initial rapport established.' },
    { type: 'warn', text: 'Uncover deeper technical pain points in the next turn.' }
  ]

  let pausedAgoText = 'Paused recently'
  let progressPct = 0
  let currentStage = 'Discovery'
  let timeSpentMins = 0
  let messageCount = 0
  let lastCoachNote = "You were in mid-discovery. Push deeper on implementation risk before moving to value prop."

  if (session) {
    const rawPausedAt = session.paused_at || session.created_at
    if (rawPausedAt) {
      const pausedAt = rawPausedAt.endsWith('Z') ? rawPausedAt : `${rawPausedAt}Z`
      const diffHrs = Math.floor((new Date().getTime() - new Date(pausedAt).getTime()) / (1000 * 3600))
      pausedAgoText = diffHrs <= 0 ? 'Paused recently' : `Paused ${diffHrs} hours ago`
    }
    progressPct = session.progress_percentage || 0
    currentStage = session.current_stage || 'Discovery'
    messageCount = session.messages_json ? session.messages_json.length : 0
    // Estimate time spent from messages (approx 1 min per 2 messages)
    timeSpentMins = Math.max(1, Math.floor(messageCount / 2))
    
    if (session.feedback_json?.snapshot?.lastCoachNote) {
      lastCoachNote = session.feedback_json.snapshot.lastCoachNote
    }
  }

  return (
    <div className="space-y-6 pb-16 font-sans max-w-[1360px] mx-auto">
      {/* Resuming Banner Header (Figma media__1785583098914.png) */}
      {isResuming && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-[800] rounded-md uppercase">
                RESUMING SESSION
              </span>
              <span className="text-xs text-[#64748B] font-[500]">{pausedAgoText}</span>
            </div>
            <h1 className="text-xl font-[800] text-[#1E293B]">Picking up where you left off</h1>
            <p className="text-xs text-[#64748B]">{scenario.persona_name || 'Technical Discovery'} · {personaName} · {company}</p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-center border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-6">
            <div>
              <p className="text-lg font-[800] text-[#1E1B4B]">{progressPct}%</p>
              <p className="text-[10px] font-[700] text-[#64748B] uppercase">PROGRESS</p>
            </div>
            <div>
              <p className="text-sm font-[800] text-[#1E293B]">{currentStage}</p>
              <p className="text-[10px] font-[700] text-[#64748B] uppercase">STAGE</p>
            </div>
            <div>
              <p className="text-sm font-[800] text-[#1E293B]">{timeSpentMins} min</p>
              <p className="text-[10px] font-[700] text-[#64748B] uppercase">TIME SPENT</p>
            </div>
            <div>
              <p className="text-sm font-[800] text-[#1E293B]">{messageCount}</p>
              <p className="text-[10px] font-[700] text-[#64748B] uppercase">MESSAGES</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-xl border border-purple-100 text-left max-w-[240px]">
              <p className="text-[10px] font-[800] text-purple-700 uppercase">📌 LAST COACH NOTE</p>
              <p className="text-[11px] text-[#334155] mt-0.5 leading-snug">
                "{lastCoachNote}"
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Persona Card Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-[24px] border border-gray-200/80 overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-[#1E1B4B] to-[#312E81] p-6 text-white relative">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 text-white font-[800] text-lg flex items-center justify-center border border-white/30">
                  SC
                </div>
                <div>
                  <h2 className="text-lg font-[800]">{personaName}</h2>
                  <p className="text-xs text-purple-200">{roleTitle}</p>
                  <p className="text-xs text-purple-300 font-[600]">{company}</p>
                </div>
              </div>
              <span className="absolute top-6 right-6 px-2 py-0.5 bg-blue-500/30 border border-blue-300/40 text-blue-200 text-[10px] font-[700] rounded-md">
                AT
              </span>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Experience & Style Details */}
              <div className="space-y-2">
                <div className="flex justify-between text-[#64748B]">
                  <span>Experience</span>
                  <span className="font-[700] text-[#1E293B]">{experienceYears} years</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Industry</span>
                  <span className="font-[700] text-[#1E293B]">{industry}</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Buying Style</span>
                  <span className="font-[700] text-[#1E293B]">{buyingStyle}</span>
                </div>
                <div className="flex justify-between text-[#64748B]">
                  <span>Communication</span>
                  <span className="font-[700] text-[#1E293B]">{communicationStyle}</span>
                </div>
              </div>

              {/* Personality Traits */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <p className="text-[10px] font-[800] text-[#64748B] tracking-wider uppercase">PERSONALITY TRAITS</p>
                <div className="flex flex-wrap gap-1.5">
                  {personalityTraits.map((trait: string, idx: number) => (
                    <span key={idx} className="px-2.5 py-1 bg-purple-50 text-purple-700 font-[700] text-[10px] rounded-md">
                      {trait}
                    </span>
                  ))}
                </div>
              </div>

              {/* Priority Goals */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <p className="text-[10px] font-[800] text-[#64748B] tracking-wider uppercase">PRIORITY GOALS</p>
                <ul className="space-y-1.5">
                  {priorityGoals.map((goal: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2 text-[#334155]">
                      <span className="text-green-600 font-[700]">✓</span>
                      <span>{goal}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Difficulty & Estimated Time */}
              <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-[800] text-[#64748B] uppercase">DIFFICULTY</p>
                  <span className="inline-block mt-1 px-2.5 py-0.5 bg-red-50 text-red-600 font-[700] text-[10px] rounded-md">
                    {difficulty}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-[800] text-[#64748B] uppercase">ESTIMATED TIME</p>
                  <p className="font-[700] text-[#1E293B] mt-1">⏱️ {estimatedDuration} minutes</p>
                </div>
              </div>

              {/* Skills Evaluated */}
              <div className="pt-3 border-t border-gray-100 space-y-2">
                <p className="text-[10px] font-[800] text-[#64748B] tracking-wider uppercase">SKILLS EVALUATED</p>
                <ul className="space-y-1 text-[#334155]">
                  {skillsEvaluated.map((skill: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                      <span>{skill}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* AI Confidence Meter */}
              <div className="pt-3 border-t border-gray-100 space-y-1.5">
                <div className="flex justify-between text-[10px] font-[800] text-[#64748B]">
                  <span>AI CONFIDENCE</span>
                  <span className="text-[#1E1B4B]">{aiConfidence}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-600 rounded-full" style={{ width: `${aiConfidence}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Scenario Briefing Column */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-[24px] border border-gray-200/80 p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-[800] text-[#1E293B]">Training Briefing</h2>
              <p className="text-xs text-[#64748B] font-[500] mt-0.5">
                Review all details carefully before beginning your session with {personaName}.
              </p>
            </div>

            {/* Customer Background */}
            <div className="bg-gray-50/60 p-5 rounded-2xl border border-gray-100 space-y-2">
              <h3 className="text-xs font-[800] text-[#64748B] tracking-wider uppercase flex items-center gap-2">
                <span>👤</span> Customer Background
              </h3>
              <p className="text-xs text-[#334155] leading-relaxed">{customerBackground}</p>
            </div>

            {/* Business Goals & Pain Points Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Business Goals */}
              <div className="bg-gray-50/60 p-5 rounded-2xl border border-gray-100 space-y-3">
                <h3 className="text-xs font-[800] text-[#64748B] tracking-wider uppercase flex items-center gap-2">
                  <span>🎯</span> Business Goals
                </h3>
                <ul className="space-y-2 text-xs text-[#334155]">
                  {businessGoals.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-600 font-[700]">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pain Points */}
              <div className="bg-gray-50/60 p-5 rounded-2xl border border-gray-100 space-y-3">
                <h3 className="text-xs font-[800] text-[#64748B] tracking-wider uppercase flex items-center gap-2">
                  <span>⚠️</span> Pain Points
                </h3>
                <ul className="space-y-2 text-xs text-[#334155]">
                  {painPoints.map((item: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-500 font-[700]">●</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Expected Objections */}
            <div className="space-y-3">
              <h3 className="text-xs font-[800] text-[#64748B] tracking-wider uppercase flex items-center gap-2">
                <span>🛡️</span> Expected Objections
              </h3>
              <div className="space-y-2">
                {expectedObjections.map((obj: string, idx: number) => (
                  <div key={idx} className="bg-amber-50/60 border border-amber-200/80 p-3.5 rounded-xl text-xs font-[600] text-amber-900 flex items-center gap-2.5">
                    <span>⚠️</span>
                    <span>{obj}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Meeting Objective & Buying Signals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="bg-gray-50/60 p-5 rounded-2xl border border-gray-100 space-y-2">
                <h3 className="text-xs font-[800] text-[#64748B] tracking-wider uppercase flex items-center gap-2">
                  <span>📌</span> Meeting Objective
                </h3>
                <p className="text-xs text-[#334155] leading-relaxed">{meetingObjective}</p>
              </div>

              <div className="bg-gray-50/60 p-5 rounded-2xl border border-gray-100 space-y-3">
                <h3 className="text-xs font-[800] text-[#64748B] tracking-wider uppercase flex items-center gap-2">
                  <span>📈</span> Buying Signals
                </h3>
                <ul className="space-y-2 text-xs text-[#334155]">
                  {buyingSignals.map((sig: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-600 font-[700]">✓</span>
                      <span>{sig}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* WHERE YOU LEFT OFF (If Resuming) */}
            {isResuming && (
              <div className="bg-blue-50/50 border border-blue-200/80 p-5 rounded-2xl space-y-3">
                <h3 className="text-xs font-[800] text-blue-900 tracking-wider uppercase flex items-center gap-2">
                  <span>📍</span> WHERE YOU LEFT OFF
                </h3>
                <ul className="space-y-2 text-xs">
                  {whereYouLeftOff.map((item: any, idx: number) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      {item.type === 'good' ? (
                        <span className="text-green-600 font-[700]">✓</span>
                      ) : (
                        <span className="text-amber-600 font-[700]">⚠️</span>
                      )}
                      <span className="text-[#334155]">{item.text || item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Sticky Control Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-md flex items-center justify-between">
        <div>
          <p className="text-sm font-[800] text-[#1E293B]">Ready to begin?</p>
          <p className="text-xs text-[#64748B]">Your AI coach will guide you in real time.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/rep/dashboard')}
            className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-[700] text-[#334155] hover:bg-gray-50 transition-colors"
          >
            Save for Later
          </button>
          <button
            onClick={handleStartOrCreateSession}
            disabled={starting}
            className="px-7 py-2.5 rounded-xl bg-[#1E1B4B] hover:bg-[#2E2A72] text-white text-xs font-[700] shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {starting ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>{isResuming ? '▷ Resume Training Session' : '▷ Start Training Session'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
