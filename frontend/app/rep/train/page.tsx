'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function TrainingCenter() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [scenarios, setScenarios] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'assigned' | 'completed'>('all')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
        const [scenRes, assignRes] = await Promise.all([
          fetch(`${API}/api/scenarios`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API}/api/users/my-assignments`, { headers: { 'Authorization': `Bearer ${token}` } })
        ])

        if (scenRes.ok) {
          const data = await scenRes.json()
          console.log('[TrainingCenter] Fetched scenarios:', data)
          setScenarios(data)
        }
        if (assignRes.ok) {
          const data = await assignRes.json()
          console.log('[TrainingCenter] Fetched assignments:', data)
          setAssignments(data)
        }
      } catch (err) {
        console.error('[TrainingCenter] Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleStartPractice = (scenarioId: string, assignmentId?: string) => {
    const url = `/rep/train/${scenarioId}/briefing${assignmentId ? `?assignmentId=${assignmentId}` : ''}`
    router.push(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#7D8461]"></div>
      </div>
    )
  }

  const activeAssignments = assignments.filter(a => a.status !== 'Completed')

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-extrabold text-[#3A2F28] tracking-tight">Mission Control</h1>
        <p className="text-[#7B6F63] font-medium mt-2 text-base">Authorize tactical simulations and training modules.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-[#EAE2D6] rounded-[1.25rem] w-fit border border-[#D8CCBC]">
         {[
           { id: 'all', label: 'Global Library' },
           { id: 'assigned', label: 'Active Missions' },
           { id: 'completed', label: 'Session History' }
         ].map(t => (
           <button 
             key={t.id}
             onClick={() => setFilter(t.id as any)}
             className={`px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${filter === t.id ? 'bg-[#EFE7DC] text-[#7D8461] shadow-sm border border-[#D8CCBC]' : 'text-[#7B6F63] hover:text-[#3A2F28]'}`}
           >
             {t.label}
           </button>
         ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {filter === 'completed' && assignments.filter(a => a.status === 'Completed').length === 0 && (
          <div className="col-span-full py-32 text-center bg-[#EAE2D6]/40 border border-dashed border-[#D8CCBC] rounded-[2.5rem]">
             <p className="text-[#7B6F63] font-black uppercase tracking-[0.2em] text-[10px]">No completed sessions found.</p>
          </div>
        )}

        {(filter === 'all' 
          ? scenarios 
          : filter === 'assigned' 
            ? activeAssignments.map(a => ({ ...a.scenario, assignmentId: a.id, difficulty: a.priority, status: a.status }))
            : assignments.filter(a => a.status === 'Completed').map(a => ({ ...a.scenario, assignmentId: a.id, difficulty: a.priority, status: a.status, score: a.score, sessionId: a.session_id }))
        ).map((scenario: any) => (
          <div key={scenario.id} className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2rem] overflow-hidden hover:shadow-xl transition-all flex flex-col group">
             <div className="p-10 flex-1 space-y-6">
                <div className="flex justify-between items-start">
                   <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${
                     scenario.difficulty?.toLowerCase() === 'high' ? 'bg-[#A06A5B]/10 text-[#A06A5B] border-[#A06A5B]/20' : 
                     'bg-[#7D8461]/10 text-[#7D8461] border-[#7D8461]/20'
                   }`}>
                      {scenario.difficulty || 'Standard'}
                   </span>
                   {scenario.assignmentId && (
                     <span className={`text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-tighter shadow-sm ${scenario.status === 'Completed' ? 'bg-[#7D8461] text-white' : 'bg-[#D6C2A8] text-[#3A2F28]'}`}>
                        {scenario.status === 'Completed' ? `Score: ${scenario.score}%` : 'Assigned'}
                     </span>
                   )}
                </div>
                <div>
                   <h3 className="text-2xl font-bold text-[#3A2F28] group-hover:text-[#7D8461] transition-colors leading-tight">{scenario.persona_name}</h3>
                   <p className="text-[9px] text-[#7B6F63] font-black uppercase tracking-[0.2em] mt-1">{scenario.persona_type}</p>
                </div>
                <p className="text-sm text-[#3A2F28]/80 leading-relaxed line-clamp-3">
                   {scenario.context_text?.replace(/\[SCENARIO:.*?\]\s*/g, '').replace(/\[SCENARIO_METADATA:\s*({.*?})\]/s, '').trim()}
                </p>
             </div>
             <div className="p-10 bg-[#EAE2D6]/40 border-t border-[#D8CCBC]/50 flex justify-between items-center">
                <div className="text-left">
                   <p className="text-[8px] font-black text-[#7B6F63] uppercase tracking-widest">Training Focus</p>
                   <p className="text-[10px] font-black text-[#3A2F28] uppercase tracking-tight mt-0.5">Tactical Discovery</p>
                </div>
                <button 
                  onClick={() => scenario.status === 'Completed' 
                    ? router.push(`/rep/train/${scenario.id}/review?sessionId=${scenario.sessionId}`)
                    : handleStartPractice(scenario.id, scenario.assignmentId)}
                  className={`px-8 py-3.5 text-[#F6F1E8] text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-md ${scenario.status === 'Completed' ? 'bg-[#3A2F28] hover:bg-[#2A221D]' : 'bg-[#7D8461] hover:bg-[#6B7252]'}`}
                >
                  {scenario.status === 'Completed' ? 'Review Report →' : 'Briefing →'}
                </button>
             </div>
          </div>
        ))}
      </div>
    </div>
  )
}
