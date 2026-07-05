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
  
  const [scenario, setScenario] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const fetchBriefing = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API}/api/scenarios/${scenarioId}`, {
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
    
    fetchBriefing()
  }, [scenarioId])

  const handleBeginConversation = async () => {
    setStarting(true)
    try {
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
        const targetUrl = `/rep/train/${scenarioId}?sessionId=${data.sessionId}${assignmentId ? `&assignmentId=${assignmentId}` : ''}&avatar=${data.avatarType || 'female'}`
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
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2C5282]"></div>
      </div>
    )
  }

  const {
    customer_info,
    personality_traits,
    customer_goal,
    sales_rep_goal,
    likely_objections,
    coaching_focus_areas,
    preparation_tips,
    suggested_discovery_questions,
    difficulty,
    persona_type
  } = scenario

  const renderBullets = (text: string) => {
    if (!text) return null;
    
    // Normalize abbreviations so they don't break sentence splitting
    const safeText = text.replace(/Pvt\.\s*Ltd\./gi, 'Pvt Ltd')
                         .replace(/Pvt\./gi, 'Pvt')
                         .replace(/Ltd\./gi, 'Ltd')
                         .replace(/Inc\./gi, 'Inc')
                         .replace(/Mr\./gi, 'Mr')
                         .replace(/Ms\./gi, 'Ms')
                         .replace(/Dr\./gi, 'Dr');

    if (safeText.includes('•') || safeText.includes('- ')) {
      return (
        <ul className="list-disc pl-4 space-y-1.5 marker:text-[#2C5282]">
          {safeText.split('\n').map((line, i) => {
            const clean = line.replace(/^[-•]\s*/, '').trim()
            return clean ? <li key={i} className="text-sm text-[#1A2A3A]">{clean}</li> : null
          })}
        </ul>
      )
    }
    
    if (safeText.includes('\n')) {
      return (
        <ul className="list-disc pl-4 space-y-1.5 marker:text-[#2C5282]">
          {safeText.split('\n').map((line, i) => {
            const clean = line.trim()
            return clean ? <li key={i} className="text-sm text-[#1A2A3A]">{clean}</li> : null
          })}
        </ul>
      )
    }

    const sentences = safeText.match(/[^.!?]+[.!?]+/g) || [safeText]
    return (
      <ul className="list-disc pl-4 space-y-1.5 marker:text-[#2C5282]">
        {sentences.map((s, i) => {
          const clean = s.trim()
          return clean ? <li key={i} className="text-sm text-[#1A2A3A]">{clean}</li> : null
        })}
      </ul>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#E2E8F0] pb-6">
        <div>
          <Link href="/rep/train" className="text-[#2C5282] hover:underline text-sm font-medium mb-4 inline-block">&larr; Back to Library</Link>
          <h1 className="text-3xl font-bold text-[#1A2A3A]">Training Briefing</h1>
          <p className="text-[#64748B] text-sm mt-1">Review the following details before starting your session.</p>
        </div>
        <div className="text-right">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
            difficulty === 'Hard' ? 'bg-red-50 text-red-600 border-red-200' :
            difficulty === 'Medium' ? 'bg-blue-50 text-blue-700 border-blue-200' :
            'bg-green-50 text-green-700 border-green-200'
          }`}>
            Difficulty: {difficulty || 'Medium'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Customer Profile */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
            <div className="bg-[#F8FAFC] px-6 py-4 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-semibold text-[#1A2A3A]">Contact Persona</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                <div className="col-span-2">
                  <p className="text-xs text-[#64748B] font-semibold uppercase tracking-wider mb-1">Role & Company</p>
                  <p className="text-base font-bold text-[#1A2A3A]">
                    {scenario.contact_title || customer_info?.role || 'Executive'} - {scenario.contact_company || customer_info?.company || 'Prospect Co.'}
                  </p>
                </div>
                <div className="col-span-2 pt-4 border-t border-[#E2E8F0]">
                  <p className="text-xs text-[#64748B] font-semibold uppercase tracking-wider mb-2">Motivations & Priorities</p>
                  {renderBullets(personality_traits)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
            <div className="bg-[#F8FAFC] px-6 py-4 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-semibold text-[#1A2A3A]">Meeting Context</h3>
            </div>
            <div className="p-6 space-y-6">
              {/* Current Situation */}
              {(() => {
                const rawContext = scenario.context_text || ''
                const cleanContext = rawContext
                  .replace(/\[SCENARIO:.*?\]\s*/g, '')
                  .replace(/\[SCENARIO_METADATA:[\s\S]*?\]/, '')
                  .replace(/\[MANDATORY EVALUATION RUBRIC[\s\S]*$/, '')
                  .trim()
                if (!cleanContext) return null
                return (
                  <div>
                    <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                      Current Situation
                    </h4>
                    {renderBullets(cleanContext)}
                  </div>
                )
              })()}

              {/* What the Prospect Expects */}
              {scenario.objection_style && (
                <div>
                  <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-400 inline-block"></span>
                    Expect These Challenges
                  </h4>
                  {renderBullets(scenario.objection_style)}
                </div>
              )}

              {/* Your Dos */}
              {(() => {
                const rawContext = scenario.context_text || ''
                const rubricMatch = rawContext.match(/\[MANDATORY EVALUATION RUBRIC[\s\S]*?\]/)
                if (!rubricMatch) return null
                const rubric = rubricMatch[0]
                  .replace(/\[MANDATORY EVALUATION RUBRIC[\s\S]*?\]\s*/, '')
                  .replace(/\[SCENARIO_METADATA[\s\S]*/, '')
                  .trim()
                const questions = rubric.split('\n').filter((l: string) => l.trim().startsWith('-'))
                if (!questions.length) return null
                return (
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <span>✓</span> Your Must-Ask Questions
                    </h4>
                    <ul className="list-none space-y-1.5">
                      {questions.map((q: string, i: number) => {
                        const clean = q.replace(/^-\s*/, '').trim()
                        return clean ? <li key={i} className="text-sm text-green-800 flex items-start gap-2"><span className="mt-0.5 text-green-500">›</span>{clean}</li> : null
                      })}
                    </ul>
                  </div>
                )
              })()}

              {/* Rep Objective */}
              <div className="bg-[#F8FAFC] rounded-lg p-5 border border-[#E2E8F0]">
                <h4 className="text-xs font-semibold text-[#2C5282] uppercase tracking-wider mb-2">Your Objective</h4>
                <p className="text-sm font-bold text-[#1A2A3A]">{scenario.conversation_expectations || sales_rep_goal || 'Build rapport, understand the prospect\'s challenges, and identify a clear next step.'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          
          {/* Coaching Focus */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
            <div className="bg-[#F8FAFC] px-6 py-4 border-b border-[#E2E8F0]">
              <h3 className="text-sm font-semibold text-[#1A2A3A]">Scorecard Metrics</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-[#64748B] font-semibold leading-relaxed">You will be evaluated on these specific criteria:</p>
              <div className="flex flex-col gap-2">
                {(scenario.evaluation_focus ? scenario.evaluation_focus.split(',') : (coaching_focus_areas || [])).map((focus: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                     <svg className="w-4 h-4 text-[#2C5282]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                     <span className="text-sm font-medium text-[#1A2A3A]">
                       {focus.trim()}
                     </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Expected Objections */}
          {scenario.objection_style && (
            <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
              <div className="bg-[#F8FAFC] px-6 py-4 border-b border-[#E2E8F0]">
                <h3 className="text-sm font-semibold text-[#1A2A3A]">Communication Style</h3>
              </div>
              <div className="p-6">
                {renderBullets(scenario.objection_style)}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="pt-2">
            <button
              onClick={handleBeginConversation}
              disabled={starting}
              className="w-full py-4 bg-[#2C5282] hover:bg-[#2A4A75] disabled:opacity-50 text-white text-sm font-bold uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center justify-center gap-3"
            >
              {starting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>Start Training</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
