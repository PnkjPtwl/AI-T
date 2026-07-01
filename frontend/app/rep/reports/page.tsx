'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function IntelligenceReportsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'recent' | 'highest' | 'needs_improvement' | 'discovery' | 'negotiation'>('recent')

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API}/api/sessions/my-sessions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          // Ensure we only show sessions with valid feedback
          setSessions(data.filter((s: any) => s.feedback_json && s.feedback_json.overall_score))
        }
      } catch (err) {
        console.error('Failed to fetch reports', err)
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  const getFilteredAndSortedSessions = () => {
    let result = [...sessions]

    // 1. Apply Text Search (Scenario Name or Type)
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s => 
        s.scenario_name?.toLowerCase().includes(q) || 
        s.feedback_json?.summary?.toLowerCase().includes(q)
      )
    }

    // 2. Apply Category Filters
    if (filter === 'discovery') {
      result = result.filter(s => s.scenario_name?.toLowerCase().includes('discovery'))
    } else if (filter === 'negotiation') {
      result = result.filter(s => s.scenario_name?.toLowerCase().includes('negotiation') || s.scenario_name?.toLowerCase().includes('skeptical'))
    }

    // 3. Apply Sorting
    if (filter === 'highest') {
      result.sort((a, b) => b.feedback_json.overall_score - a.feedback_json.overall_score)
    } else if (filter === 'needs_improvement') {
      result.sort((a, b) => a.feedback_json.overall_score - b.feedback_json.overall_score)
    } else {
      // Default: Recent
      result.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
    }

    return result
  }

  const filtered = getFilteredAndSortedSessions()

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#2C5282]"></div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24 text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold text-[#1A2A3A] tracking-tight">Reports</h1>
          <p className="text-[#64748B] font-medium text-base">View your past training sessions and performance scores.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl px-6 py-4 flex items-center gap-4 w-full md:w-80 shadow-sm">
             <span className="text-[#64748B]">🔍</span>
             <input 
               type="text" 
               placeholder="Search reports..." 
               className="bg-transparent text-xs font-bold text-[#1A2A3A] uppercase tracking-widest outline-none w-full placeholder:text-[#64748B]"
               value={search}
               onChange={(e) => setSearch(e.target.value)}
             />
          </div>
          <div className="flex flex-wrap bg-[#F8FAFC] p-1.5 rounded-2xl border border-[#E2E8F0] gap-1">
             {[
               { id: 'recent', label: 'Recent' },
               { id: 'highest', label: 'Top Score' },
               { id: 'needs_improvement', label: 'Priority' },
               { id: 'discovery', label: 'Discovery' },
               { id: 'negotiation', label: 'Negotiation' }
             ].map(t => (
               <button 
                 key={t.id}
                 onClick={() => setFilter(t.id as any)}
                 className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filter === t.id ? 'bg-white text-[#2C5282] shadow-sm' : 'text-[#64748B] hover:text-[#1A2A3A]'}`}
               >
                 {t.label}
               </button>
             ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {filtered.length === 0 ? (
          <div className="py-32 text-center bg-white border border-dashed border-[#E2E8F0] rounded-[2.5rem]">
             <p className="text-[#64748B] font-black uppercase tracking-[0.2em] text-[10px]">No historical data matches your current parameters.</p>
             {sessions.length > 0 && (
               <button 
                onClick={() => { setSearch(''); setFilter('recent'); }}
                className="mt-6 text-[#2C5282] text-[10px] font-black uppercase tracking-widest hover:underline"
               >
                 Clear all filters
               </button>
             )}
          </div>
        ) : (
          filtered.map((session) => {
            const f = session.feedback_json
            const scores = f.scores || {}
            return (
              <div 
                key={session.id} 
                onClick={() => router.push(`/rep/train/${session.scenario_id}/review?sessionId=${session.id}`)}
                className="bg-white border border-[#E2E8F0] rounded-[2.5rem] p-10 hover:shadow-xl transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row gap-12 items-center">
                  {/* Left: Info */}
                  <div className="flex-1 space-y-6 w-full">
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black text-[#2C5282] uppercase tracking-[0.2em] px-3 py-1 bg-white rounded-full border border-[#E2E8F0]">ID: {session.id.substring(0,8)}</span>
                      <span className="text-[#64748B] text-[10px] font-bold uppercase tracking-widest">{new Date(session.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-[#1A2A3A] group-hover:text-[#2C5282] transition-colors leading-tight tracking-tight">{session.scenario_name}</h3>
                      <p className="text-sm text-[#64748B] mt-3 line-clamp-2 leading-relaxed font-medium">
                        {f.summary?.length > 180 ? f.summary.substring(0, 180) + '...' : f.summary}
                      </p>
                    </div>
                  </div>

                  {/* Middle: Metrics */}
                  <div className="lg:w-[450px] grid grid-cols-2 gap-x-10 gap-y-8 w-full border-l border-r border-[#E2E8F0]/30 px-10">
                    {[
                      { label: 'Objection Handling', val: scores.objection_handling || 0 },
                      { label: 'Strategic Communication', val: scores.communication || scores.executive_communication || 0 },
                      { label: 'Closing Logic', val: scores.closing || 0 },
                      { label: 'Discovery Depth', val: scores.discovery || scores.questioning_ability || 0 }
                    ].map((s, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-2 text-[#64748B]">
                          <span>{s.label}</span>
                          <span className="text-[#1A2A3A]">{s.val}%</span>
                        </div>
                        <div className="w-full bg-[#F8FAFC] h-2 rounded-full overflow-hidden border border-[#E2E8F0]/20 shadow-inner">
                          <div 
                            className={`h-full transition-all duration-1000 ${s.val >= 80 ? 'bg-[#2C5282]' : s.val >= 50 ? 'bg-[#D6C2A8]' : 'bg-red-500'}`} 
                            style={{ width: `${s.val}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right: Score */}
                  <div className="lg:w-56 text-center space-y-3 w-full bg-white/50 p-8 rounded-3xl border border-[#E2E8F0]/30">
                    <div className={`text-6xl font-black tracking-tighter ${f.overall_score >= 80 ? 'text-[#2C5282]' : 'text-[#1A2A3A]'}`}>
                      {f.overall_score}%
                    </div>
                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#64748B]">Overall Score</div>
                    <div className="pt-6">
                       <button className="w-full py-4 bg-[#2C5282] text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-[#1A365D] transition-all shadow-md group-hover:scale-105">
                         View Report
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
