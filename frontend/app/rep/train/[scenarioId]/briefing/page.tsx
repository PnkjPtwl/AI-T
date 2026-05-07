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
        const targetUrl = `/rep/train/${scenarioId}?sessionId=${data.sessionId}${assignmentId ? `&assignmentId=${assignmentId}` : ''}`
        console.log(`[Briefing] Navigating to simulation: ${targetUrl}`);
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
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#7D8461]"></div>
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

  return (
    <div className="max-w-6xl mx-auto space-y-12 pb-24 text-left">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[#D8CCBC]/50 pb-10">
        <div>
          <Link href="/rep/train" className="text-[#7D8461] hover:underline text-[10px] font-black uppercase tracking-widest mb-4 inline-block">&larr; Return to Library</Link>
          <h1 className="text-4xl font-extrabold text-[#3A2F28] tracking-tight">Intelligence Briefing</h1>
          <p className="text-[#7B6F63] font-medium mt-2 text-base">Review the following tactical data before authorizing the mission.</p>
        </div>
        <div className="text-right">
          <span className={`inline-block px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
            difficulty === 'beginner' ? 'bg-[#7D8461]/10 text-[#7D8461] border-[#7D8461]/20' :
            difficulty === 'intermediate' ? 'bg-[#D6C2A8]/20 text-[#3A2F28] border-[#D8CCBC]' :
            'bg-[#A06A5B]/10 text-[#A06A5B] border-[#A06A5B]/20'
          }`}>
            Difficulty: {difficulty}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-12">
          
          {/* Customer Profile */}
          <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2rem] overflow-hidden shadow-sm">
            <div className="bg-[#EAE2D6]/50 px-10 py-6 border-b border-[#D8CCBC]/50">
              <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em]">Customer Profile</h3>
            </div>
            <div className="p-10">
              <div className="grid grid-cols-2 gap-y-10 gap-x-12">
                <div>
                  <p className="text-[9px] text-[#7B6F63] uppercase tracking-widest font-black mb-1">Target Name</p>
                  <p className="text-lg font-bold text-[#3A2F28] tracking-tight">{customer_info?.name || scenario.persona_name}</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#7B6F63] uppercase tracking-widest font-black mb-1">Functional Role</p>
                  <p className="text-lg font-bold text-[#3A2F28] tracking-tight">{customer_info?.role || 'Executive'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#7B6F63] uppercase tracking-widest font-black mb-1">Organization</p>
                  <p className="text-sm font-bold text-[#3A2F28] tracking-tight">{customer_info?.company || 'Prospect Entity'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#7B6F63] uppercase tracking-widest font-black mb-1">Sector</p>
                  <p className="text-sm font-bold text-[#3A2F28] tracking-tight">{customer_info?.industry || 'Enterprise Technology'}</p>
                </div>
                <div className="col-span-2 pt-6 border-t border-[#D8CCBC]/30">
                  <p className="text-[9px] text-[#7B6F63] uppercase tracking-widest font-black mb-2">Psychological Archetype</p>
                  <p className="text-sm font-bold text-[#7D8461] uppercase tracking-tight">{persona_type}</p>
                  <p className="text-sm text-[#3A2F28]/80 mt-2 leading-relaxed">{personality_traits}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Context */}
          <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2rem] overflow-hidden shadow-sm">
            <div className="bg-[#EAE2D6]/50 px-10 py-6 border-b border-[#D8CCBC]/50">
              <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em]">Tactical Context</h3>
            </div>
            <div className="p-10 space-y-10">
              <div>
                <h4 className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest mb-3">Operational Background</h4>
                <p className="text-sm text-[#3A2F28]/80 leading-relaxed italic">"{scenario.context_text.replace(/\[SCENARIO:.*?\]\s*/g, '').replace(/\[SCENARIO_METADATA:\s*({.*?})\]/s, '').trim()}"</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-[#F6F1E8] rounded-2xl p-6 border border-[#D8CCBC]/30">
                  <h4 className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest mb-2">Customer Outcome</h4>
                  <p className="text-sm font-medium text-[#3A2F28]">{customer_goal}</p>
                </div>
                <div className="bg-[#7D8461]/5 rounded-2xl p-6 border border-[#7D8461]/20">
                  <h4 className="text-[9px] font-black text-[#7D8461] uppercase tracking-widest mb-2">Assigned Objective</h4>
                  <p className="text-sm font-bold text-[#3A2F28]">{sales_rep_goal}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Questions */}
          {suggested_discovery_questions?.length > 0 && (
            <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2rem] overflow-hidden shadow-sm">
              <div className="bg-[#EAE2D6]/50 px-10 py-6 border-b border-[#D8CCBC]/50">
                <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em]">Discovery Roadmap</h3>
              </div>
              <div className="p-10">
                <ul className="space-y-4">
                  {suggested_discovery_questions.map((q: string, i: number) => (
                    <li key={i} className="flex gap-4 text-[#3A2F28] text-sm font-medium items-start p-4 bg-[#F6F1E8]/50 rounded-xl border border-[#D8CCBC]/20">
                      <span className="text-[#7D8461] font-black">?</span>
                      <span className="italic leading-relaxed">"{q}"</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-12">
          
          {/* Objections */}
          <div className="bg-[#EFE7DC] border border-[#A06A5B]/20 rounded-[2rem] overflow-hidden shadow-sm">
            <div className="bg-[#A06A5B]/5 px-8 py-6 border-b border-[#A06A5B]/20">
              <h3 className="text-[10px] font-black text-[#A06A5B] uppercase tracking-[0.2em]">Expected Objections</h3>
            </div>
            <div className="p-8">
              <div className="flex flex-wrap gap-2">
                {likely_objections?.map((obj: string, i: number) => (
                  <span key={i} className="px-3 py-1.5 bg-[#F6F1E8] border border-[#D8CCBC] rounded-lg text-[9px] font-black text-[#7B6F63] uppercase tracking-widest">
                    {obj}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Preparation Tips */}
          {preparation_tips?.length > 0 && (
            <div className="bg-[#EFE7DC] border border-[#7D8461]/20 rounded-[2rem] overflow-hidden shadow-sm">
              <div className="bg-[#7D8461]/5 px-8 py-6 border-b border-[#7D8461]/20">
                <h3 className="text-[10px] font-black text-[#7D8461] uppercase tracking-[0.2em]">Deployment Advice</h3>
              </div>
              <div className="p-8">
                <ul className="space-y-4">
                  {preparation_tips.map((tip: string, i: number) => (
                    <li key={i} className="flex gap-3 text-[#3A2F28] text-xs font-bold items-start uppercase tracking-tight">
                      <span className="text-[#7D8461]">✓</span>
                      <span className="leading-relaxed">{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Coaching Focus */}
          <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2rem] overflow-hidden shadow-sm">
            <div className="bg-[#EAE2D6]/50 px-8 py-6 border-b border-[#D8CCBC]/50">
              <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em]">Evaluation Focus</h3>
            </div>
            <div className="p-8 space-y-6">
              <p className="text-[10px] text-[#7B6F63] font-bold uppercase tracking-widest leading-relaxed">Intelligence will grade strictly on these vectors:</p>
              <div className="flex flex-wrap gap-2">
                {coaching_focus_areas?.map((focus: string, i: number) => (
                  <span key={i} className="px-4 py-2 bg-[#F6F1E8] border border-[#D8CCBC]/50 text-[#3A2F28] rounded-xl text-[9px] font-black uppercase tracking-widest">
                    {focus.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="pt-6">
            <button
              onClick={handleBeginConversation}
              disabled={starting}
              className="w-full py-6 bg-[#7D8461] hover:bg-[#6B7252] disabled:opacity-50 text-[#F6F1E8] text-xs font-black uppercase tracking-[0.2em] rounded-[1.5rem] shadow-lg shadow-[#7D8461]/30 transition-all flex items-center justify-center gap-4"
            >
              {starting ? (
                <div className="w-4 h-4 border-2 border-[#F6F1E8]/30 border-t-[#F6F1E8] rounded-full animate-spin"></div>
              ) : (
                <>Authorize Mission ⚡</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
