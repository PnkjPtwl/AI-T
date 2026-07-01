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
  const [filter, setFilter] = useState<'assigned' | 'completed'>('assigned')

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
          setScenarios(data)
        }
        if (assignRes.ok) {
          const data = await assignRes.json()
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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2C5282]"></div>
      </div>
    )
  }

  const now = new Date().getTime();
   
  const activeAssignments = assignments.filter(a => {
    if (a.status === 'Completed') return false;
    if (a.deadline) {
      const dl = new Date(a.deadline);
      dl.setHours(23, 59, 59, 999);
      if (now > dl.getTime()) {
        return false; // Auto-destruct
      }
    }
    return true;
  })

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-[#1A2A3A] tracking-tight">Assignments</h1>
        <p className="text-[#64748B] font-medium text-base">Complete your required trainings and practice scenarios.</p>
      </div>

      {/* Tabs */}
      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-[#E2E8F0]/50 rounded-[1rem] w-fit border border-[#E2E8F0]">
         {[
           { id: 'assigned', label: 'Assigned' },
           { id: 'completed', label: 'Completed' }
         ].map(t => (
           <button 
             key={t.id}
             onClick={() => setFilter(t.id as any)}
             className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-widest rounded-xl transition-all ${filter === t.id ? 'bg-white text-[#2C5282] shadow-sm border border-[#E2E8F0]' : 'text-[#64748B] hover:text-[#1A2A3A]'}`}
           >
             {t.label}
           </button>
         ))}
      </div>

      {/* Content */}
      {filter === 'completed' && assignments.filter(a => a.status === 'Completed').length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center">
           <div className="w-16 h-16 bg-[#EBF8FF] text-[#2C5282] rounded-full flex items-center justify-center mb-6 shadow-sm border border-[#2C5282]/10">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
           </div>
           <h3 className="text-2xl font-extrabold text-[#1A2A3A] mb-2 tracking-tight">No Completed Trainings</h3>
           <p className="text-[#64748B] text-base font-medium">You haven't completed any training assignments yet. Head over to the Assigned tab to get started.</p>
        </div>
      ) : filter === 'assigned' && activeAssignments.length === 0 ? (
        <div className="py-32 flex flex-col items-center justify-center">
           <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-sm border border-green-200">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
           </div>
           <h3 className="text-3xl font-extrabold text-[#1A2A3A] mb-2 tracking-tight">All Caught Up!</h3>
           <p className="text-[#64748B] text-base font-medium max-w-md mx-auto text-center">You have completed all your pending assignments. Great job staying on top of your training.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(filter === 'assigned' 
              ? activeAssignments.map(a => ({ ...a.scenario, assignmentId: a.id, difficulty: a.priority, status: a.status, deadline: a.deadline }))
              : assignments.filter(a => a.status === 'Completed').map(a => ({ ...a.scenario, assignmentId: a.id, difficulty: a.priority, status: a.status, score: a.score, sessionId: a.session_id }))
          ).map((scenario: any) => {
            let warningText = '';
          let isUrgent = false;
          
          if (filter === 'assigned' && scenario.deadline) {
             const dl = new Date(scenario.deadline);
             dl.setHours(23, 59, 59, 999);
             const diffHours = (dl.getTime() - now) / (1000 * 60 * 60);
             if (diffHours >= 0 && diffHours <= 24) {
                isUrgent = true;
                warningText = `Due in ${Math.round(diffHours)} hrs 🔥`;
             } else if (diffHours > 24) {
                warningText = `Due in ${Math.round(diffHours / 24)} days`;
             }
          }

          return (
          <div key={scenario.id} className={`bg-white border ${isUrgent ? 'border-red-500 shadow-[0_4px_12px_rgba(239,68,68,0.15)] ring-1 ring-red-500' : 'border-[#E2E8F0] hover:border-[#2C5282]/40'} rounded-[2rem] overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col group`}>
             <div className="p-8 flex-1 space-y-6">
                <div className="flex justify-between items-start">
                   <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${
                     scenario.difficulty?.toLowerCase() === 'high' ? 'bg-red-50 text-red-600 border-red-200' : 
                     scenario.difficulty?.toLowerCase() === 'easy' ? 'bg-green-50 text-green-700 border-green-200' :
                     'bg-blue-50 text-blue-700 border-blue-200'
                   }`}>
                      {scenario.difficulty || 'Medium'}
                   </span>
                   {scenario.assignmentId && (
                     <div className="flex items-center gap-3">
                        {isUrgent && <span className="text-[10px] text-red-600 font-bold tracking-widest uppercase animate-pulse bg-red-50 border border-red-200 px-3 py-1 rounded-full">{warningText}</span>}
                        {!isUrgent && warningText && <span className="text-[10px] text-amber-600 font-bold tracking-widest uppercase">{warningText}</span>}
                        <span className={`text-[10px] font-black px-3 py-1 rounded-full shadow-sm uppercase tracking-widest border ${scenario.status === 'Completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]'}`}>
                           {scenario.status === 'Completed' ? `Score: ${scenario.score}%` : 'Pending'}
                        </span>
                     </div>
                   )}
                </div>
                <div>
                   <h3 className="text-xl font-extrabold text-[#1A2A3A] group-hover:text-[#2C5282] transition-colors leading-tight tracking-tight">{scenario.persona_name}</h3>
                   <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-widest mt-2">{scenario.persona_type}</p>
                </div>
                <p className="text-sm text-[#1A2A3A] leading-relaxed line-clamp-3">
                   {scenario.context_text?.replace(/\[SCENARIO:.*?\]\s*/g, '').replace(/\[SCENARIO_METADATA:\s*({[\s\S]*?})\]/, '').trim()}
                </p>
             </div>
             <div className="p-8 bg-[#F8FAFC] border-t border-[#E2E8F0] flex justify-between items-center mt-auto group-hover:bg-[#EBF8FF]/50 transition-colors">
                <button 
                  onClick={() => scenario.status === 'Completed' 
                    ? router.push(`/rep/train/${scenario.id}/review?sessionId=${scenario.sessionId}`)
                    : handleStartPractice(scenario.id, scenario.assignmentId)}
                  className={`w-full py-3.5 text-xs font-black tracking-widest uppercase rounded-2xl transition-all duration-300 shadow-sm flex justify-center items-center gap-2 ${scenario.status === 'Completed' ? 'bg-white border border-[#E2E8F0] text-[#1A2A3A] hover:border-[#2C5282] hover:text-[#2C5282]' : (isUrgent ? 'bg-red-600 hover:bg-red-700 text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)]' : 'bg-[#2C5282] text-white hover:bg-[#1A365D] hover:shadow-[0_4px_12px_rgba(44,82,130,0.3)]')}`}
                >
                  {scenario.status === 'Completed' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      View Report
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      Start
                    </>
                  )}
                </button>
             </div>
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}
