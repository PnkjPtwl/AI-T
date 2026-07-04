'use client'

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

function RepDetailContent() {
  const { repId } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialScenario = searchParams.get('scenario') || 'all'
  
  const [rep, setRep] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [missions, setMissions] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')
  const [selectedScenarioFilter, setSelectedScenarioFilter] = useState<string>(initialScenario)
  
  const [selectedSession, setSelectedSession] = useState<any>(null)
  const reportRef = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  const TABS = ['Overview', 'Intelligence', 'Sessions', 'Missions', 'History']

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
        const headers = { 'Authorization': `Bearer ${token}` }
        
        const [sessionsRes, missionsRes, notesRes] = await Promise.all([
          fetch(`${API}/api/users/reps/${repId}/sessions`, { headers }),
          fetch(`${API}/api/users/team-assignments`, { headers }),
          fetch(`${API}/api/users/reps/${repId}/notes`, { headers })
        ])

        if (sessionsRes.ok) {
          const data = await sessionsRes.json()
          setRep(data.rep)
          setSessions(data.sessions)
          setAnalytics(data.analytics)
        }

        if (missionsRes.ok) {
          const data = await missionsRes.json()
          setMissions(data.filter((m: any) => m.rep_id === repId))
        }

        if (notesRes.ok) {
          setNotes(await notesRes.json())
        }
      } catch (err) {
        console.error('Failed to fetch rep intelligence', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [repId])

  const uniqueScenarios = useMemo(() => {
    const map = new Map<string, string>()
    sessions.forEach(s => {
      if (s.scenario_id && s.scenario_name) map.set(s.scenario_id, s.scenario_name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [sessions])

  const filteredSessions = useMemo(() => {
    if (selectedScenarioFilter === 'all') return sessions
    return sessions.filter(s => s.scenario_id === selectedScenarioFilter)
  }, [sessions, selectedScenarioFilter])

  const filteredMissions = useMemo(() => {
    if (selectedScenarioFilter === 'all') return missions
    return missions.filter(m => m.scenario_id === selectedScenarioFilter)
  }, [missions, selectedScenarioFilter])

  const filteredAnalytics = useMemo(() => {
    if (selectedScenarioFilter === 'all') return analytics
    if (!filteredSessions.length) return { avgScore: 0, trendData: [], radarData: [] }
    
    let totalScore = 0
    const trendData = filteredSessions.slice().reverse().map(s => {
      totalScore += (s.feedback_json?.overall_score || 0)
      return {
        date: new Date(s.completed_at).toLocaleDateString(),
        score: s.feedback_json?.overall_score || 0
      }
    })
    const avgScore = Math.round(totalScore / filteredSessions.length)

    const skillTotals: any = {}
    const skillCounts: any = {}
    filteredSessions.forEach(s => {
      const scores = s.feedback_json?.scores || {}
      Object.entries(scores).forEach(([skill, val]) => {
        const numVal = typeof val === 'object' && val !== null ? ((val as any).score || 0) : (val as number || 0)
        skillTotals[skill] = (skillTotals[skill] || 0) + numVal
        skillCounts[skill] = (skillCounts[skill] || 0) + 1
      })
    })

    const radarData = Object.keys(skillTotals).map(skill => {
      const avg = Math.round(skillTotals[skill] / skillCounts[skill])
      return {
        subject: skill.replace('_', ' ').substring(0, 15),
        A: avg <= 20 ? avg * 5 : avg,
        fullMark: 100
      }
    })

    return { avgScore, trendData, radarData }
  }, [filteredSessions, analytics, selectedScenarioFilter])

  const history = useMemo(() => {
    const items = [
      ...filteredSessions.map(s => ({ type: 'session', date: s.completed_at, data: s })),
      ...filteredMissions.map(m => ({ type: 'mission', date: m.assigned_at, data: m })),
      ...notes.map(n => ({ type: 'note', date: n.created_at, data: n }))
    ]
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [filteredSessions, filteredMissions, notes])

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !selectedSession) return
    
    setIsExporting(true)
    try {
      const element = reportRef.current
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#F8FAFC',
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      })
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      })
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
      pdf.save(`${rep.name.toLowerCase().replace(' ', '_')}_${selectedSession.scenario_name.toLowerCase().replace(' ', '_')}_report.pdf`)
    } catch (err) {
      console.error('PDF Export Error:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this training session?')) return
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/sessions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.id !== id))
      }
    } catch (err) {
      console.error('Delete failed', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2C5282]"></div>
      </div>
    )
  }

  if (!rep) return <div className="text-center py-20 text-[#64748B] font-semibold">Rep not found.</div>

  return (
    <div className="space-y-8 pb-12 relative">
      {/* Report Modal - Full Screen Overlay */}
      {selectedSession && (
        <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-white rounded-2xl w-full max-w-[1000px] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
               <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 sticky top-0 z-10 flex justify-between items-center">
                  <div>
                     <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Session Report</p>
                     <h2 className="text-xl font-bold text-[#1A2A3A] tracking-tight">{selectedSession.scenario_name}</h2>
                  </div>
                  <div className="flex items-center gap-4">
                     <button 
                       onClick={handleDownloadPDF}
                       disabled={isExporting}
                       className="px-4 py-2 bg-white border border-[#E2E8F0] hover:bg-gray-50 disabled:opacity-50 text-[#1A2A3A] font-semibold text-sm rounded-lg transition-all"
                     >
                        {isExporting ? 'Exporting...' : 'Export PDF'}
                     </button>
                     <button 
                       onClick={() => setSelectedSession(null)} 
                       className="p-2 hover:bg-gray-100 rounded-full transition-colors text-[#64748B]"
                     >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                     </button>
                  </div>
               </div>

               <div ref={reportRef} className="p-8 space-y-8 bg-[#F8FAFC] flex-1">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                     <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                        <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-4">Executive Summary</h3>
                        <p className="text-base text-[#1A2A3A] leading-relaxed">
                           {selectedSession.feedback_json.evaluation_summary || selectedSession.feedback_json.summary || "No summary provided."}
                        </p>
                     </div>
                     <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Overall Score</p>
                        <p className={`text-5xl font-bold tracking-tight ${selectedSession.feedback_json.overall_score >= 80 ? 'text-green-600' : selectedSession.feedback_json.overall_score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                           {selectedSession.feedback_json.overall_score}%
                        </p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                        <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-4">Strengths</h3>
                        <ul className="space-y-3">
                           {selectedSession.feedback_json.strengths?.map((s: string, i: number) => (
                             <li key={i} className="flex items-start gap-3">
                                <span className="text-green-500 mt-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg></span>
                                <span className="text-sm text-[#1A2A3A]">{s}</span>
                             </li>
                           ))}
                        </ul>
                     </div>
                     <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm">
                        <h3 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-4">Areas for Improvement</h3>
                        <ul className="space-y-3">
                           {(selectedSession.feedback_json.weaknesses || selectedSession.feedback_json.improvements)?.map((w: string, i: number) => (
                             <li key={i} className="flex items-start gap-3">
                                <span className="text-red-500 mt-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></span>
                                <span className="text-sm text-[#1A2A3A]">{w}</span>
                             </li>
                           ))}
                        </ul>
                     </div>
                  </div>
               </div>
           </div>
        </div>
      )}

      {/* Main Page Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 shadow-sm flex flex-col lg:flex-row items-center lg:items-start gap-8">
         <div className="w-24 h-24 bg-[#EBF8FF] text-[#2C5282] rounded-full flex items-center justify-center text-4xl font-bold shadow-sm shrink-0">
            {rep.name.charAt(0).toUpperCase()}
         </div>
         
         <div className="flex-1 text-center lg:text-left flex flex-col justify-center h-full pt-1">
            <h1 className="text-3xl font-bold text-[#1A2A3A] tracking-tight mb-1">{rep.name}</h1>
            <p className="text-sm text-[#64748B] mb-6">{rep.email}</p>
            
            <div className="flex flex-wrap gap-8 justify-center lg:justify-start">
               <div>
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Avg Proficiency</p>
                  <p className={`text-2xl font-bold ${filteredAnalytics?.avgScore >= 80 ? 'text-green-600' : filteredAnalytics?.avgScore >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                     {filteredAnalytics?.avgScore || 0}%
                  </p>
               </div>
               <div>
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">Deployments</p>
                  <p className="text-2xl font-bold text-[#1A2A3A]">{filteredMissions.length}</p>
               </div>
            </div>
         </div>

         <div className="w-full lg:w-72 flex flex-col gap-4">
            <select 
              value={selectedScenarioFilter}
              onChange={(e) => setSelectedScenarioFilter(e.target.value)}
              className="w-full h-10 bg-white border border-[#E2E8F0] rounded-lg px-3 text-sm font-semibold text-[#1A2A3A] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors"
            >
              <option value="all">All Personas</option>
              {uniqueScenarios.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <Link href="/training" className="flex items-center justify-center w-full h-10 bg-[#2C5282] hover:bg-[#1A365D] text-white font-semibold text-sm rounded-lg transition-colors">
               Assign Mission
            </Link>
         </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-[#E2E8F0] overflow-x-auto scrollbar-hide">
         <div className="flex gap-8 px-2">
            {TABS.map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
                  activeTab === tab ? 'border-[#2C5282] text-[#2C5282]' : 'border-transparent text-[#64748B] hover:text-[#1A2A3A]'
                }`}
              >
                {tab}
              </button>
            ))}
         </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
         {activeTab === 'Overview' && (
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in">
              <div className="lg:col-span-2 bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
                 <h3 className="text-sm font-semibold text-[#1A2A3A] mb-6">Proficiency Trajectory</h3>
                 <div className="h-[300px] w-full">
                    {filteredAnalytics?.trendData?.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={filteredAnalytics.trendData}>
                             <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                             <XAxis dataKey="date" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                             <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                             <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                             <Line type="monotone" dataKey="score" stroke="#2C5282" strokeWidth={3} dot={{ r: 4, fill: '#2C5282' }} />
                          </LineChart>
                       </ResponsiveContainer>
                    ) : (
                       <div className="w-full h-full flex items-center justify-center text-sm text-[#64748B]">No trajectory data available.</div>
                    )}
                 </div>
              </div>

              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
                 <h3 className="text-sm font-semibold text-[#1A2A3A] mb-6">Competency Matrix</h3>
                 <div className="h-[300px] w-full">
                    {filteredAnalytics?.radarData?.length > 0 ? (
                       <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={filteredAnalytics.radarData}>
                             <PolarGrid stroke="#E2E8F0" />
                             <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748B', fontSize: 10, fontWeight: 600 }} />
                             <Radar name={rep.name} dataKey="A" stroke="#2C5282" fill="#2C5282" fillOpacity={0.2} />
                          </RadarChart>
                       </ResponsiveContainer>
                    ) : (
                       <div className="w-full h-full flex items-center justify-center text-sm text-[#64748B]">No radar data available.</div>
                    )}
                 </div>
              </div>
           </div>
         )}

         {activeTab === 'Intelligence' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in">
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
                 <h3 className="text-sm font-semibold text-[#1A2A3A] mb-6">Skill Breakdown</h3>
                 <div className="space-y-6">
                    {filteredAnalytics?.radarData?.length > 0 ? filteredAnalytics.radarData.map((skill: any, idx: number) => (
                      <div key={idx}>
                         <div className="flex justify-between items-center text-sm font-medium mb-2">
                            <span className="text-[#64748B] capitalize">{skill.subject}</span>
                            <span className={skill.A > 80 ? 'text-green-600' : skill.A < 60 ? 'text-red-500' : 'text-[#1A2A3A]'}>{skill.A}%</span>
                         </div>
                         <div className="w-full bg-[#F1F5F9] h-2 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-500 ${skill.A > 80 ? 'bg-green-500' : skill.A < 60 ? 'bg-red-500' : 'bg-[#2C5282]'}`} style={{ width: `${skill.A}%` }}></div>
                         </div>
                      </div>
                    )) : <div className="text-sm text-[#64748B]">No skill data available.</div>}
                 </div>
              </div>
              
              <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
                 <h3 className="text-sm font-semibold text-[#1A2A3A] mb-6">Persona Engagement</h3>
                 <div className="space-y-4">
                    {analytics?.personaPerformanceData?.map((p: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                         <div>
                            <p className="text-sm font-semibold text-[#1A2A3A]">{p.type}</p>
                            <p className="text-xs text-[#64748B] mt-1">{p.sessionsCompleted} sessions</p>
                         </div>
                         <div className={`text-xl font-bold ${p.avgScore > 80 ? 'text-green-600' : 'text-[#1A2A3A]'}`}>{p.avgScore}%</div>
                      </div>
                    )) || <div className="text-sm text-[#64748B]">No persona engagement data available.</div>}
                 </div>
              </div>
           </div>
         )}

         {activeTab === 'Sessions' && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden animate-in fade-in">
               <div className="p-6 border-b border-[#E2E8F0] flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-[#1A2A3A]">Session History</h3>
                  <span className="text-xs font-semibold text-[#64748B] px-3 py-1 bg-[#F8FAFC] rounded-full border border-[#E2E8F0]">
                     {filteredSessions.length} Total
                  </span>
               </div>
               
               {filteredSessions.length > 0 ? (
                  <div className="overflow-x-auto">
                     <table className="w-full text-left text-sm">
                        <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                           <tr>
                              <th className="px-6 py-4 font-semibold text-[#64748B]">Scenario</th>
                              <th className="px-6 py-4 font-semibold text-[#64748B]">Persona</th>
                              <th className="px-6 py-4 font-semibold text-[#64748B]">Date</th>
                              <th className="px-6 py-4 font-semibold text-[#64748B] text-right">Score</th>
                              <th className="px-6 py-4 font-semibold text-[#64748B] text-right">Actions</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F0]">
                           {filteredSessions.map(s => (
                             <tr key={s.id} onClick={() => setSelectedSession(s)} className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group">
                                <td className="px-6 py-4 font-medium text-[#1A2A3A]">{s.scenario_name}</td>
                                <td className="px-6 py-4 text-[#64748B]">{s.persona_type}</td>
                                <td className="px-6 py-4 text-[#64748B]">{new Date(s.completed_at).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-right">
                                   <span className={`font-bold ${s.feedback_json.overall_score > 80 ? 'text-green-600' : 'text-[#1A2A3A]'}`}>
                                      {s.feedback_json.overall_score}%
                                   </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                   <button 
                                     onClick={(e) => handleDeleteSession(e, s.id)} 
                                     className="text-red-500 hover:text-red-700 font-semibold text-xs transition-colors"
                                   >
                                     Delete
                                   </button>
                                </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               ) : (
                  <div className="p-8 text-center text-sm text-[#64748B]">No sessions found for this selection.</div>
               )}
            </div>
         )}

         {activeTab === 'Missions' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
              {filteredMissions.length > 0 ? filteredMissions.map(m => (
                <div key={m.id} className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm relative hover:shadow-md transition-shadow">
                   <div className="absolute top-6 right-6">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        m.status === 'Completed' ? 'bg-green-50 text-green-700' :
                        m.status === 'Overdue' ? 'bg-red-50 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {m.status}
                      </span>
                   </div>

                   <h4 className="text-lg font-bold text-[#1A2A3A] mb-2 pr-20">{m.scenario_name}</h4>
                   <p className="text-sm text-[#64748B] mb-6">
                     Priority: <span className={m.priority === 'High' ? 'text-red-500 font-semibold' : 'text-[#1A2A3A]'}>{m.priority}</span>
                   </p>

                   <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                         <p className="text-xs font-semibold text-[#64748B] mb-1">Target</p>
                         <p className="text-sm font-bold text-[#1A2A3A]">85%+</p>
                      </div>
                      <div className="bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0]">
                         <p className="text-xs font-semibold text-[#64748B] mb-1">Deadline</p>
                         <p className="text-sm font-bold text-[#1A2A3A]">{new Date(m.deadline).toLocaleDateString()}</p>
                      </div>
                   </div>

                   {m.status === 'Completed' ? (
                      <div className="pt-4 border-t border-[#E2E8F0] flex justify-between items-center">
                         <div>
                            <p className="text-xs font-semibold text-[#64748B]">Score</p>
                            <p className="text-xl font-bold text-green-600">{m.completed_score}%</p>
                         </div>
                         {m.session_id && (
                           <button 
                             onClick={() => router.push(`/training/review/${m.session_id}`)}
                             className="text-sm font-semibold text-[#2C5282] hover:text-[#1A365D] transition-colors"
                           >
                             Review
                           </button>
                         )}
                      </div>
                   ) : (
                      <div className="w-full h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                         <div className="h-full bg-[#2C5282]" style={{ width: '30%' }}></div>
                      </div>
                   )}
                </div>
              )) : <div className="col-span-full text-center py-8 text-sm text-[#64748B]">No missions found for this selection.</div>}
           </div>
         )}

         {activeTab === 'History' && (
           <div className="max-w-3xl mx-auto animate-in fade-in space-y-6">
              {history.length > 0 ? history.map((item, idx) => (
                <div 
                   key={idx} 
                   onClick={() => item.type === 'session' && router.push(`/training/review/${item.data.id}`)}
                   className={`bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm group ${item.type === 'session' ? 'cursor-pointer hover:border-[#2C5282] transition-colors' : ''}`}
                >
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <p className="text-xs font-semibold text-[#64748B] mb-1">{new Date(item.date).toLocaleDateString()} at {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                         <h4 className="text-base font-bold text-[#1A2A3A]">
                            {item.type === 'session' ? `Completed ${item.data.scenario_name}` :
                             item.type === 'mission' ? `Assigned ${item.data.scenario_name}` :
                             `Received Coaching Note`}
                         </h4>
                      </div>
                       <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold px-3 py-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full text-[#64748B] capitalize">{item.type}</span>
                       </div>
                    </div>
                   
                   {item.type === 'session' && (
                      <div className="mt-4 pt-4 border-t border-[#E2E8F0] flex gap-6 items-center">
                         <div className="text-center shrink-0">
                            <p className="text-xs font-semibold text-[#64748B] mb-1">Score</p>
                            <p className="text-xl font-bold text-green-600">{item.data.feedback_json.overall_score}%</p>
                         </div>
                         <div className="text-sm text-[#475569] leading-relaxed">
                            {item.data.feedback_json.evaluation_summary?.slice(0, 150)}...
                         </div>
                      </div>
                   )}

                   {item.type === 'note' && (
                      <div className="mt-4 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] text-sm text-[#475569] leading-relaxed">
                         {item.data.note_text}
                      </div>
                   )}
                </div>
              )) : <div className="text-center py-8 text-sm text-[#64748B]">No history available.</div>}
           </div>
         )}
      </div>
    </div>
  )
}

export default function RepDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2C5282]"></div></div>}>
      <RepDetailContent />
    </Suspense>
  )
}
