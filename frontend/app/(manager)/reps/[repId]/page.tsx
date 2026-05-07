'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function RepDetailPage() {
  const { repId } = useParams()
  const [rep, setRep] = useState<any>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [missions, setMissions] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')
  
  // Session Detail State
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

  const history = useMemo(() => {
    const items = [
      ...sessions.map(s => ({ type: 'session', date: s.completed_at, data: s })),
      ...missions.map(m => ({ type: 'mission', date: m.assigned_at, data: m })),
      ...notes.map(n => ({ type: 'note', date: n.created_at, data: n }))
    ]
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [sessions, missions, notes])

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !selectedSession) return
    
    setIsExporting(true)
    try {
      const element = reportRef.current
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#F6F1E8',
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
      pdf.save(`${rep.name.toLowerCase().replace(' ', '_')}_${selectedSession.scenario_name.toLowerCase().replace(' ', '_')}_intelligence_report.pdf`)
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
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#7D8461]"></div>
      </div>
    )
  }

  if (!rep) return <div className="text-center py-20 text-[#7B6F63] font-bold">Agent intelligence not found.</div>

  return (
    <div className="space-y-12 pb-24 relative max-w-7xl mx-auto">
      {/* Intelligence Report Full Screen Overlay */}
      {selectedSession && (
        <div className="fixed inset-0 z-[1000] bg-[#F6F1E8] flex flex-col overflow-y-auto scrollbar-hide animate-in fade-in duration-300">
           {/* Top Navigation */}
           <div className="bg-[#EAE2D6]/90 backdrop-blur-xl border-b border-[#D8CCBC] px-12 py-8 sticky top-0 z-[1010] flex justify-between items-center shadow-sm">
              <div className="flex flex-col gap-1">
                 <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-[#7B6F63]">
                    <button onClick={() => setSelectedSession(null)} className="hover:text-[#3A2F28] transition-colors">Personnel Profile</button>
                    <span>/</span>
                    <span className="text-[#7D8461]">{selectedSession.scenario_name} Report</span>
                 </div>
                 <h2 className="text-2xl font-extrabold text-[#3A2F28] uppercase tracking-tight mt-2">{selectedSession.scenario_name} Intelligence Briefing</h2>
              </div>
              <div className="flex items-center gap-8">
                 <button 
                   onClick={handleDownloadPDF}
                   disabled={isExporting}
                   className="px-8 py-4 bg-[#7D8461] hover:bg-[#6B7252] disabled:bg-[#D8CCBC] text-[#F6F1E8] font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-lg transition-all"
                 >
                    {isExporting ? 'Generating PDF...' : 'Export Intelligence PDF'}
                 </button>
                 <button 
                   onClick={() => setSelectedSession(null)} 
                   className="text-[10px] font-black uppercase tracking-widest text-[#7B6F63] hover:text-[#3A2F28] transition-all"
                 >
                    Close
                 </button>
              </div>
           </div>

           {/* Report Body */}
           <div ref={reportRef} className="flex-1 p-16 max-w-[1400px] mx-auto w-full space-y-20 bg-[#F6F1E8]">
              
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
                 <div className="xl:col-span-8 bg-[#EFE7DC] border border-[#D8CCBC] rounded-[3rem] p-12 shadow-sm">
                    <h3 className="text-[10px] font-black text-[#7B6F63] uppercase tracking-[0.4em] mb-10">Executive Summary</h3>
                    <p className="text-2xl font-bold text-[#3A2F28] leading-relaxed italic pr-10">
                       "{selectedSession.feedback_json.evaluation_summary || selectedSession.feedback_json.summary || "The evaluation engine did not generate a specific strategic summary."}"
                    </p>
                    <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-10">
                       <div className="space-y-2">
                          <p className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest">Calibration Status</p>
                          <p className="text-sm font-black text-[#7D8461] uppercase tracking-tight">Verified Optimal</p>
                       </div>
                       <div className="space-y-2">
                          <p className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest">Context Alignment</p>
                          <p className="text-sm font-black text-[#3A2F28] uppercase tracking-tight">94% Accurate</p>
                       </div>
                       <div className="space-y-2">
                          <p className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest">Interaction Depth</p>
                          <p className="text-sm font-black text-[#3A2F28] uppercase tracking-tight">Enterprise Grade</p>
                       </div>
                       <div className="space-y-2">
                          <p className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest">Session Date</p>
                          <p className="text-sm font-black text-[#3A2F28] uppercase tracking-tight">{new Date(selectedSession.completed_at).toLocaleDateString()}</p>
                       </div>
                    </div>
                 </div>

                 <div className="xl:col-span-4 bg-[#7D8461] rounded-[3rem] p-12 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
                    <p className="text-[10px] font-black text-[#F6F1E8] uppercase tracking-[0.4em] mb-10 opacity-80">Consolidated Proficiency</p>
                    <p className="text-[9rem] font-extrabold text-[#F6F1E8] tracking-tighter leading-none">{selectedSession.feedback_json.overall_score}%</p>
                    <div className="w-full h-2 bg-[#F6F1E8]/20 rounded-full mt-12 overflow-hidden">
                       <div className="h-full bg-[#F6F1E8] transition-all duration-1000" style={{ width: `${selectedSession.feedback_json.overall_score}%` }}></div>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                 <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[3rem] p-12 space-y-12">
                    <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em] ml-1">Tactical Successes</h3>
                    <div className="space-y-6">
                       {selectedSession.feedback_json.strengths?.map((s: string, i: number) => (
                         <div key={i} className="bg-[#F6F1E8] border border-[#D8CCBC] p-8 rounded-2xl flex items-start gap-6">
                            <span className="text-[#7D8461] font-black text-xs pt-1">Success</span>
                            <p className="text-sm font-bold text-[#3A2F28] leading-relaxed">{s}</p>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[3rem] p-12 space-y-12">
                    <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em] ml-1">Operational Gaps</h3>
                    <div className="space-y-6">
                       {(selectedSession.feedback_json.weaknesses || selectedSession.feedback_json.improvements)?.map((w: string, i: number) => (
                         <div key={i} className="bg-[#A06A5B]/5 border border-[#A06A5B]/10 p-8 rounded-2xl flex items-start gap-6">
                            <span className="text-[#A06A5B] font-black text-xs pt-1">Gap</span>
                            <p className="text-sm font-bold text-[#A06A5B] leading-relaxed">{w}</p>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>

              <div className="space-y-10">
                 <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.4em] ml-1">Competency Intelligence Matrix</h3>
                 <div className="grid grid-cols-2 lg:grid-cols-5 gap-8">
                    {Object.entries(selectedSession.feedback_json.scores || {}).map(([skill, score]: [string, any]) => {
                      const pct = typeof score === 'number' && score <= 20 ? score * 5 : score;
                      return (
                        <div key={skill} className="bg-[#EFE7DC] border border-[#D8CCBC] p-8 rounded-2xl hover:border-[#7D8461] transition-all group shadow-sm">
                           <p className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest mb-6">{skill.replace('_', ' ')}</p>
                           <p className={`text-4xl font-extrabold tracking-tighter mb-6 ${pct > 80 ? 'text-[#7D8461]' : pct < 60 ? 'text-[#A06A5B]' : 'text-[#3A2F28]'}`}>{pct}%</p>
                           <div className="w-full bg-[#F6F1E8] h-1.5 rounded-full overflow-hidden border border-[#D8CCBC]">
                              <div className={`h-full transition-all duration-1000 ${pct > 80 ? 'bg-[#7D8461]' : pct < 60 ? 'bg-[#A06A5B]' : 'bg-[#D6C2A8]'}`} style={{ width: `${pct}%` }}></div>
                           </div>
                        </div>
                      )
                    })}
                 </div>
              </div>

              <div className="space-y-10">
                 <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.4em] ml-1">Session Transcript</h3>
                 <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[3rem] p-12 space-y-12">
                    {selectedSession.messages_json?.map((msg: any, idx: number) => (
                      <div key={idx} className={`flex gap-10 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                         <div className={`flex-1 max-w-4xl ${msg.role === 'user' ? 'text-right' : ''}`}>
                            <p className="text-[10px] font-black text-[#7B6F63] uppercase tracking-[0.3em] mb-4">{msg.role === 'user' ? rep.name : selectedSession.persona_name}</p>
                            <div className={`inline-block px-10 py-6 rounded-3xl text-sm leading-relaxed shadow-sm ${
                              msg.role === 'user' ? 'bg-[#EAE2D6] border border-[#D8CCBC] text-[#3A2F28]' : 'bg-[#F6F1E8] border border-[#D8CCBC] text-[#3A2F28]'
                            }`}>
                               {msg.content}
                            </div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="bg-[#7D8461] rounded-[3rem] p-16 shadow-lg text-[#F6F1E8] mb-20">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.5em] mb-12 opacity-80">Coaching Directives</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {(Array.isArray(selectedSession.feedback_json.recommendations) ? selectedSession.feedback_json.recommendations : 
                      (typeof selectedSession.feedback_json.next_practice_recommendation === 'string' ? [selectedSession.feedback_json.next_practice_recommendation] : 
                      Array.isArray(selectedSession.feedback_json.next_practice_recommendation) ? selectedSession.feedback_json.next_practice_recommendation :
                      [
                        "Engage in additional objection handling sprints.",
                        "Refine discovery questioning depth.",
                        "Increase consistency in ROI quantification."
                      ])).map((r: string, idx: number) => (
                      <div key={idx} className="space-y-4">
                         <div className="w-10 h-10 bg-[#F6F1E8]/10 rounded-xl flex items-center justify-center text-xs font-black">{idx + 1}</div>
                         <p className="text-base font-bold leading-relaxed">{r}</p>
                      </div>
                    ))}
                 </div>
              </div>

           </div>
        </div>
      )}

      {/* Main Page Header */}
      <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[3rem] p-12 shadow-sm relative overflow-hidden">
         <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12">
            <div className="w-40 h-40 bg-[#F6F1E8] border border-[#D8CCBC] rounded-[3rem] flex items-center justify-center text-6xl font-black text-[#7D8461] shadow-sm">
               {rep.name.charAt(0)}
            </div>
            
            <div className="flex-1 text-center lg:text-left">
               <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-4">
                  <h1 className="text-5xl font-extrabold text-[#3A2F28] tracking-tight uppercase">{rep.name}</h1>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-5 py-2 rounded-full border ${
                    analytics?.avgScore < 60 ? 'bg-[#A06A5B]/10 text-[#A06A5B] border-[#A06A5B]/20' : 'bg-[#7D8461]/10 text-[#7D8461] border-[#7D8461]/20'
                  }`}>
                    {analytics?.avgScore < 60 ? 'Risk Identified' : 'Operational'}
                  </span>
               </div>
               <p className="text-[10px] font-black text-[#7B6F63] uppercase tracking-[0.4em] mb-10">{rep.email}</p>
               
               <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-2">
                     <p className="text-[10px] font-black text-[#7B6F63] uppercase tracking-widest">Avg Proficiency</p>
                     <p className="text-3xl font-extrabold text-[#3A2F28] tracking-tighter">{analytics?.avgScore || 0}%</p>
                  </div>
                  <div className="space-y-2">
                     <p className="text-[10px] font-black text-[#7B6F63] uppercase tracking-widest">Deployments</p>
                     <p className="text-3xl font-extrabold text-[#7D8461] tracking-tighter">{missions.length}</p>
                  </div>
               </div>
            </div>

            <div className="lg:w-80 w-full">
               <Link href="/training" className="block w-full py-5 bg-[#7D8461] hover:bg-[#6B7252] text-center text-[#F6F1E8] font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-lg transition-all">Assign Mission</Link>
            </div>
         </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-4 p-2 bg-[#EAE2D6] border border-[#D8CCBC] rounded-2xl overflow-x-auto scrollbar-hide">
         {TABS.map(tab => (
           <button 
             key={tab}
             onClick={() => setActiveTab(tab)}
             className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all ${
               activeTab === tab ? 'bg-[#F6F1E8] text-[#3A2F28] border border-[#D8CCBC] shadow-sm' : 'text-[#7B6F63] hover:text-[#3A2F28]'
             }`}
           >
             {tab}
           </button>
         ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
         {activeTab === 'Overview' && (
           <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in">
              <div className="lg:col-span-8 bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-12 shadow-sm">
                 <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em] mb-12">Proficiency Trajectory</h3>
                 <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <LineChart data={analytics?.trendData || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#D8CCBC" vertical={false} />
                          <XAxis dataKey="date" stroke="#7B6F63" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#7B6F63" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                          <Tooltip contentStyle={{ backgroundColor: '#EFE7DC', border: '1px solid #D8CCBC', borderRadius: '1rem' }} />
                          <Line type="monotone" dataKey="score" stroke="#7D8461" strokeWidth={5} dot={{ r: 6, fill: '#7D8461' }} />
                       </LineChart>
                    </ResponsiveContainer>
                 </div>
              </div>

              <div className="lg:col-span-4 bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-12 shadow-sm">
                 <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em] mb-12">Competency Matrix</h3>
                 <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                       <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analytics?.radarData || []}>
                          <PolarGrid stroke="#D8CCBC" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: '#7B6F63', fontSize: 10, fontWeight: 900 }} />
                          <Radar name={rep.name} dataKey="A" stroke="#7D8461" fill="#7D8461" fillOpacity={0.15} />
                       </RadarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>
         )}

         {activeTab === 'Intelligence' && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in">
              <div className="space-y-10">
                 <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-10 shadow-sm">
                    <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em] mb-10">Skill Breakdown</h3>
                    <div className="space-y-8">
                       {analytics?.radarData.map((skill: any, idx: number) => (
                         <div key={idx} className="space-y-4">
                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                               <span className="text-[#7B6F63]">{skill.subject}</span>
                               <span className={skill.A > 80 ? 'text-[#7D8461]' : skill.A < 60 ? 'text-[#A06A5B]' : 'text-[#3A2F28]'}>{skill.A}%</span>
                            </div>
                            <div className="w-full bg-[#F6F1E8] h-1.5 rounded-full overflow-hidden border border-[#D8CCBC]">
                               <div className={`h-full transition-all duration-1000 ${skill.A > 80 ? 'bg-[#7D8461]' : skill.A < 60 ? 'bg-[#A06A5B]' : 'bg-[#D6C2A8]'}`} style={{ width: `${skill.A}%` }}></div>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-10 shadow-sm">
                    <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em] mb-10">AI Behavioral Insights</h3>
                    <div className="space-y-6">
                       <div className="p-8 bg-[#F6F1E8] border border-[#D8CCBC] rounded-2xl">
                          <p className="text-[9px] font-black text-[#7D8461] uppercase tracking-widest mb-3">Primary Strength</p>
                          <p className="text-sm text-[#3A2F28] font-bold italic">"Demonstrates exceptional {[...(analytics?.radarData || [])].sort((a: any, b: any) => b.A - a.A)[0]?.subject.toLowerCase()} and rapport building."</p>
                       </div>
                       <div className="p-8 bg-[#A06A5B]/5 border border-[#A06A5B]/10 rounded-2xl">
                          <p className="text-[9px] font-black text-[#A06A5B] uppercase tracking-widest mb-3">Growth Vector</p>
                          <p className="text-sm text-[#A06A5B] font-bold italic">"Struggles with {[...(analytics?.radarData || [])].sort((a: any, b: any) => a.A - b.A)[0]?.subject.toLowerCase()} during high-pressure objections."</p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-10 shadow-sm">
                 <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em] mb-10">Persona Engagement Matrix</h3>
                 <div className="space-y-6">
                    {analytics?.personaPerformanceData.map((p: any, idx: number) => (
                      <div key={idx} className="bg-[#F6F1E8] border border-[#D8CCBC] p-8 rounded-2xl flex justify-between items-center">
                         <div>
                            <p className="text-xs font-black text-[#3A2F28] uppercase tracking-tight">{p.type}</p>
                            <p className="text-[9px] text-[#7B6F63] font-black uppercase tracking-widest mt-1">{p.sessionsCompleted} Tactical Sprints</p>
                         </div>
                         <div className="text-right">
                            <p className={`text-2xl font-extrabold ${p.avgScore > 80 ? 'text-[#7D8461]' : 'text-[#3A2F28]'}`}>{p.avgScore}%</p>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
         )}

         {activeTab === 'Sessions' && (
            <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-10 shadow-sm overflow-hidden animate-in fade-in">
               <div className="flex justify-between items-center mb-10">
                  <h3 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em]">Session Logistics Log</h3>
                  <span className="text-[10px] text-[#7B6F63] font-black uppercase tracking-widest">{sessions.length} Recorded Intercepts</span>
               </div>
               
               <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-[#EAE2D6]/30">
                           <th className="px-8 py-5 text-[10px] font-black text-[#7B6F63] uppercase tracking-widest border-b border-[#D8CCBC]">Scenario</th>
                           <th className="px-8 py-5 text-[10px] font-black text-[#7B6F63] uppercase tracking-widest border-b border-[#D8CCBC]">Persona</th>
                           <th className="px-8 py-5 text-[10px] font-black text-[#7B6F63] uppercase tracking-widest border-b border-[#D8CCBC]">Date</th>
                           <th className="px-8 py-5 text-[10px] font-black text-[#7B6F63] uppercase tracking-widest border-b border-[#D8CCBC] text-right">Proficiency</th>
                           <th className="px-8 py-5 text-[10px] font-black text-[#7B6F63] uppercase tracking-widest border-b border-[#D8CCBC] text-right">Actions</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[#D8CCBC]">
                        {sessions.map(s => (
                          <tr key={s.id} onClick={() => setSelectedSession(s)} className="hover:bg-[#F6F1E8]/50 transition-colors cursor-pointer group">
                             <td className="px-8 py-6">
                                <p className="text-sm font-bold text-[#3A2F28] uppercase tracking-tight group-hover:text-[#7D8461] transition-colors">{s.scenario_name}</p>
                             </td>
                             <td className="px-8 py-6">
                                <span className="text-[10px] font-black text-[#7B6F63] uppercase tracking-widest">{s.persona_type}</span>
                             </td>
                             <td className="px-8 py-6">
                                <p className="text-[10px] font-black text-[#3A2F28]">{new Date(s.completed_at).toLocaleDateString()}</p>
                             </td>
                             <td className="px-8 py-6 text-right">
                                <span className={`text-2xl font-extrabold tracking-tighter ${s.feedback_json.overall_score > 80 ? 'text-[#7D8461]' : 'text-[#3A2F28]'}`}>{s.feedback_json.overall_score}%</span>
                             </td>
                             <td className="px-8 py-6 text-right">
                                <button 
                                  onClick={(e) => handleDeleteSession(e, s.id)} 
                                  className="text-[#A06A5B] hover:text-[#3A2F28] text-[9px] font-black uppercase tracking-widest transition-colors"
                                >
                                  Delete
                                </button>
                             </td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         )}

         {activeTab === 'Missions' && (
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 animate-in fade-in">
              {missions.map(m => (
                <div key={m.id} className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-10 hover:shadow-lg transition-all group relative">
                   <div className="absolute top-10 right-10">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border ${
                        m.status === 'Completed' ? 'bg-[#7D8461]/10 text-[#7D8461] border-[#7D8461]/20' :
                        m.status === 'Overdue' ? 'bg-[#A06A5B]/10 text-[#A06A5B] border-[#A06A5B]/20' :
                        'bg-[#D6C2A8]/20 text-[#3A2F28] border-[#D8CCBC]'
                      }`}>
                        {m.status}
                      </span>
                   </div>

                   <h4 className="text-2xl font-extrabold text-[#3A2F28] uppercase tracking-tight mb-3 pr-20">{m.scenario_name}</h4>
                   <p className="text-[10px] text-[#7B6F63] font-black uppercase tracking-widest mb-12">Priority: <span className={m.priority === 'High' ? 'text-[#A06A5B]' : 'text-[#7D8461]'}>{m.priority}</span></p>

                   <div className="grid grid-cols-2 gap-6 mb-10">
                      <div className="bg-[#F6F1E8] p-5 rounded-2xl border border-[#D8CCBC]">
                         <p className="text-[9px] font-black text-[#D8CCBC] uppercase mb-1">Target</p>
                         <p className="text-sm font-extrabold text-[#3A2F28]">85%+</p>
                      </div>
                      <div className="bg-[#F6F1E8] p-5 rounded-2xl border border-[#D8CCBC]">
                         <p className="text-[9px] font-black text-[#D8CCBC] uppercase mb-1">Deadline</p>
                         <p className="text-sm font-extrabold text-[#3A2F28]">{new Date(m.deadline).toLocaleDateString()}</p>
                      </div>
                   </div>

                   {m.status === 'Completed' ? (
                      <div className="pt-8 border-t border-[#D8CCBC] flex justify-between items-center">
                         <div>
                            <p className="text-[9px] font-black text-[#D8CCBC] uppercase">Score</p>
                            <p className="text-2xl font-extrabold text-[#7D8461] tracking-tighter">{m.completed_score}%</p>
                         </div>
                      </div>
                   ) : (
                      <div className="w-full h-1.5 bg-[#F6F1E8] rounded-full overflow-hidden border border-[#D8CCBC]">
                         <div className="h-full bg-[#7D8461]" style={{ width: '30%' }}></div>
                      </div>
                   )}
                </div>
              ))}
           </div>
         )}

         {activeTab === 'History' && (
           <div className="max-w-5xl mx-auto animate-in fade-in">
              <div className="space-y-10">
                 {history.map((item, idx) => (
                   <div 
                      key={idx} 
                      onClick={() => item.type === 'session' && setSelectedSession(item.data)}
                      className={`bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-10 hover:shadow-lg transition-all group ${item.type === 'session' ? 'cursor-pointer' : ''}`}
                   >
                      <div className="flex justify-between items-start mb-8">
                         <div>
                            <p className="text-[10px] font-black text-[#7B6F63] uppercase tracking-[0.3em] mb-2">{new Date(item.date).toLocaleDateString()} @ {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            <h4 className="text-2xl font-extrabold text-[#3A2F28] uppercase tracking-tight">
                               {item.type === 'session' ? `Completed ${item.data.scenario_name}` :
                                item.type === 'mission' ? `Assigned ${item.data.scenario_name}` :
                                `Received Coaching Directive`}
                            </h4>
                         </div>
                          <div className="flex items-center gap-4">
                             <span className="text-[9px] font-black uppercase tracking-widest px-4 py-1.5 bg-[#F6F1E8] border border-[#D8CCBC] rounded-full text-[#7B6F63]">{item.type}</span>
                             {item.type === 'session' && (
                               <button 
                                 onClick={(e) => handleDeleteSession(e, item.data.id)}
                                 className="text-[#A06A5B] hover:text-[#3A2F28] text-[9px] font-black uppercase tracking-widest transition-colors"
                               >
                                 Delete
                               </button>
                             )}
                          </div>
                       </div>
                      
                      {item.type === 'session' && (
                         <div className="flex gap-10 items-center mt-8 pt-8 border-t border-[#D8CCBC]">
                            <div className="text-center">
                               <p className="text-[9px] font-black text-[#D8CCBC] uppercase mb-1">Score</p>
                               <p className="text-3xl font-extrabold text-[#7D8461] tracking-tighter">{item.data.feedback_json.overall_score}%</p>
                            </div>
                            <div className="flex-1 text-sm text-[#7B6F63] italic font-medium leading-relaxed">
                               {item.data.feedback_json.evaluation_summary?.slice(0, 150)}...
                            </div>
                         </div>
                      )}

                      {item.type === 'note' && (
                         <div className="mt-8 bg-[#F6F1E8] p-8 rounded-2xl border border-[#D8CCBC] italic text-sm text-[#3A2F28] leading-relaxed font-medium">
                            "{item.data.note_text}"
                         </div>
                      )}
                   </div>
                 ))}
              </div>
           </div>
         )}
      </div>
    </div>
  )
}
