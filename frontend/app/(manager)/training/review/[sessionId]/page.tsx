'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function ManagerSessionReviewPage({ params }: { params: { sessionId: string } }) {
  const router = useRouter()
  const { sessionId } = params

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'transcript' | 'skills' | 'objections'>('overview')

  useEffect(() => {
    if (!sessionId) {
      router.back()
      return
    }

    const fetchSession = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API}/api/sessions/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setSession(data)
        } else {
          router.back()
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [sessionId, router])

  if (loading || !session) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2C5282]"></div>
      </div>
    )
  }

  const feedback = session.feedback_json || {}
  const scenario = session.training_scenarios || {}
  const messages = session.messages_json || []
  const score = feedback.overall_score || 0

  const getOutcome = (s: number) => {
    if (s >= 85) return { label: 'Highly Effective', color: 'text-green-600', bg: 'bg-green-50' }
    if (s >= 70) return { label: 'Effective', color: 'text-blue-600', bg: 'bg-blue-50' }
    if (s >= 50) return { label: 'Needs Improvement', color: 'text-yellow-600', bg: 'bg-yellow-50' }
    return { label: 'Focus Area', color: 'text-red-600', bg: 'bg-red-50' }
  }
  const outcome = getOutcome(score)

  return (
    <div className="space-y-8 pb-12 text-left">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="text-[#64748B] hover:text-[#1A2A3A] text-sm font-medium flex items-center gap-2">
          &larr; Back
        </button>
        <div className="text-[#64748B] text-xs font-medium">
          Session ID: {sessionId?.substring(0, 12)}
        </div>
      </div>

      {/* Header Section */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${scenario.difficulty === 'Hard' ? 'bg-red-50 text-red-600 border-red-200' : scenario.difficulty === 'Easy' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                {scenario.difficulty || 'Medium'}
              </span>
              <span className="text-[#E2E8F0]">|</span>
              <span className="text-[#64748B] text-xs font-medium">{new Date(session.completed_at).toLocaleDateString()}</span>
            </div>
            <h1 className="text-3xl font-bold text-[#1A2A3A]">
              {scenario.persona_name || 'Training Interaction'}
            </h1>
            <p className="text-[#64748B] text-sm leading-relaxed">
              Review of the rep's interaction with <span className="font-semibold">{scenario.persona_name}</span>. 
              {(feedback.summary || feedback.evaluation_summary || '')?.split('.')[0]}.
            </p>
          </div>

          <div className="flex flex-col items-center gap-2 bg-[#F8FAFC] p-6 rounded-xl border border-[#E2E8F0]">
            <div className={`text-5xl font-bold ${outcome.color}`}>
              {score}%
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">Overall Score</div>
            <div className={`mt-2 px-3 py-1 rounded-md border border-[#E2E8F0] ${outcome.bg} ${outcome.color} text-xs font-semibold`}>
              {outcome.label}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-1 gap-1 w-fit">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'transcript', label: 'Transcript' },
          { id: 'skills', label: 'Scorecard' },
          { id: 'objections', label: 'Objections' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-[#2C5282] shadow-sm border border-[#E2E8F0]' 
                : 'text-[#64748B] hover:text-[#1A2A3A]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <section className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-[#1A2A3A] mb-4">Summary</h3>
                <p className="text-[#1A2A3A] text-sm leading-relaxed italic">
                  "{feedback.summary || "No summary available."}"
                </p>
                <div className="mt-6 pt-6 border-t border-[#E2E8F0]">
                   <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Outcome Analysis</h4>
                   <p className="text-sm text-[#1A2A3A] leading-relaxed">
                     {feedback.outcome_analysis || "The interaction provided baseline data."}
                   </p>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-[#1A2A3A]">Highlights</h3>
                <div className="grid grid-cols-1 gap-4">
                  {feedback.highlights?.map((h: any, i: number) => (
                    <div key={i} className={`p-6 rounded-xl border ${
                      h.type === 'strong' 
                        ? 'bg-green-50/50 border-green-200' 
                        : 'bg-yellow-50/50 border-yellow-200'
                    }`}>
                      <div className="flex justify-between items-start mb-4">
                        <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full border ${
                          h.type === 'strong' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }`}>
                          {h.type === 'strong' ? 'Good Moment' : 'Area to Improve'}
                        </span>
                      </div>
                      <p className="text-[#1A2A3A] italic text-lg font-semibold mb-3">“{h.rep_quote}”</p>
                      <p className="text-[#64748B] text-sm mb-4 leading-relaxed">{h.context}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                <div className="mb-6">
                  <h4 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-3">Strengths</h4>
                  <ul className="space-y-2">
                    {feedback.strengths?.map((s: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm text-[#1A2A3A] items-start">
                        <span className="text-green-500">✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="pt-6 border-t border-[#E2E8F0]">
                  <h4 className="text-xs font-semibold text-yellow-600 uppercase tracking-wider mb-3">To Improve</h4>
                  <ul className="space-y-2">
                    {feedback.improvements?.map((s: string, i: number) => (
                      <li key={i} className="flex gap-2 text-sm text-[#1A2A3A] items-start">
                        <span className="text-yellow-500">!</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Vocal Delivery — only rendered when voice data exists (null-safe) */}
              {feedback.voice_delivery && (
                <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                  <h4 className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <span>🎙</span> Vocal Delivery
                  </h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
                      <p className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">Pitch Variation</p>
                      <p className="text-lg font-bold text-[#1A2A3A]">
                        {feedback.voice_delivery.avgPitchStd > 30 ? 'Expressive' : feedback.voice_delivery.avgPitchStd > 15 ? 'Moderate' : 'Monotone'}
                      </p>
                    </div>
                    <div className="bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
                      <p className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">Hesitation</p>
                      <p className="text-lg font-bold text-[#1A2A3A]">
                        {feedback.voice_delivery.avgPauseRatio > 0.4 ? 'High' : feedback.voice_delivery.avgPauseRatio > 0.2 ? 'Moderate' : 'Low'}
                      </p>
                    </div>
                    <div className="bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
                      <p className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">Energy</p>
                      <p className="text-lg font-bold text-[#1A2A3A]">
                        {feedback.voice_delivery.avgEnergyMean > 0.05 ? 'Strong' : feedback.voice_delivery.avgEnergyMean > 0.02 ? 'Steady' : 'Low'}
                      </p>
                    </div>
                    <div className="bg-[#F8FAFC] rounded-lg p-3 border border-[#E2E8F0]">
                      <p className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">Speaking Time</p>
                      <p className="text-lg font-bold text-[#1A2A3A]">
                        {Math.round(feedback.voice_delivery.totalDurationSec)}s
                      </p>
                    </div>
                  </div>
                  {feedback.voice_delivery_feedback && (
                    <p className="text-sm text-[#64748B] italic leading-relaxed border-t border-[#E2E8F0] pt-3">
                      {feedback.voice_delivery_feedback}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'transcript' && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 md:p-10 shadow-sm max-h-[800px] overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((m: any, i: number) => {
                const isUser = m.role === 'user'
                const highlight = feedback.highlights?.find((h: any) => h.rep_quote === m.content)
                
                return (
                  <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1 px-2">
                       <span className="text-xs text-[#64748B] font-semibold">
                         {isUser ? 'Rep' : (scenario.persona_name || 'AI')}
                       </span>
                       {highlight && (
                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                           highlight.type === 'strong' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                         }`}>
                           AI {highlight.type === 'strong' ? 'Good' : 'Flagged'}
                         </span>
                       )}
                    </div>
                    <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed ${
                      isUser 
                        ? `bg-[#2C5282] text-white rounded-tr-none ${highlight?.type === 'weak' ? 'border-2 border-yellow-400' : ''}` 
                        : 'bg-[#F8FAFC] text-[#1A2A3A] border border-[#E2E8F0] rounded-tl-none'
                    }`}>
                      {m.content}
                    </div>
                    {/* Suggestion block removed */}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 shadow-sm max-w-3xl mx-auto">
            <h3 className="text-sm font-semibold text-[#1A2A3A] mb-6">Scorecard Metrics</h3>
            <div className="space-y-6">
              {Object.entries(feedback.scores || {}).map(([key, val]: [string, any]) => (
                <div key={key}>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider mb-2">
                    <span className="text-[#64748B]">{key.replace(/_/g, ' ')}</span>
                    <span className={val >= 80 ? 'text-green-600' : 'text-[#1A2A3A]'}>{val}%</span>
                  </div>
                  <div className="w-full bg-[#F8FAFC] h-2.5 rounded-full overflow-hidden border border-[#E2E8F0]">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        val >= 80 ? 'bg-[#2C5282]' : val >= 60 ? 'bg-blue-400' : 'bg-yellow-400'
                      }`}
                      style={{ width: `${val}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'objections' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {feedback.objections_analysis?.map((o: any, i: number) => (
               <div key={i} className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                     <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                       o.is_effective ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                     }`}>
                       {o.is_effective ? 'Handled Well' : 'Needs Work'}
                     </span>
                  </div>
                  <h4 className="text-lg font-bold text-[#1A2A3A] mb-4">{o.objection}</h4>
                  <div className="space-y-4 pt-4 border-t border-[#E2E8F0]">
                     <div>
                       <p className="text-xs text-[#64748B] font-semibold mb-1">Rep's Response</p>
                       <p className="text-sm text-[#1A2A3A] italic">“{o.rep_response}”</p>
                     </div>
                     <div className="bg-[#F8FAFC] p-4 rounded-lg border border-[#E2E8F0]">
                        <p className="text-xs text-[#2C5282] font-semibold mb-1">Feedback</p>
                        <p className="text-sm text-[#1A2A3A]">{o.feedback}</p>
                     </div>
                  </div>
               </div>
             ))}
             {(!feedback.objections_analysis || feedback.objections_analysis.length === 0) && (
               <div className="md:col-span-2 bg-white border border-[#E2E8F0] rounded-xl p-16 text-center shadow-sm">
                  <p className="text-[#64748B] text-sm">No objections were detected in this session.</p>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  )
}
