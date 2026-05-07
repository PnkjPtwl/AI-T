'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function RepDashboard() {
   const router = useRouter()
   const [loading, setLoading] = useState(true)
   const [repName, setRepName] = useState('')
   const [analytics, setAnalytics] = useState<any>(null)
   const [recentSessions, setRecentSessions] = useState<any[]>([])
   const [assignments, setAssignments] = useState<any[]>([])
   const [notes, setNotes] = useState<any[]>([])

   useEffect(() => {
      const fetchData = async () => {
         try {
            const token = localStorage.getItem('token')
            if (!token) return

            const headers = { 'Authorization': `Bearer ${token}` }

            const [userRes, analyticsRes, assignmentsRes, notesRes, sessionsRes] = await Promise.all([
               fetch(`${API}/api/users/me`, { headers }),
               fetch(`${API}/api/users/my-analytics`, { headers }),
               fetch(`${API}/api/users/my-assignments`, { headers }),
               fetch(`${API}/api/users/my-notes`, { headers }),
               fetch(`${API}/api/sessions/my-sessions`, { headers })
            ])

            if (userRes.ok) {
               const user = await userRes.json()
               setRepName(user.name)
            }
            if (analyticsRes.ok) setAnalytics(await analyticsRes.json())
            if (assignmentsRes.ok) {
               const data = await assignmentsRes.json()
               console.log('[RepDashboard] Fetched assignments:', data)
               setAssignments(data)
            }
            if (notesRes.ok) setNotes(await notesRes.json())
            if (sessionsRes.ok) {
               const sessions = await sessionsRes.json()
               console.log('[RepDashboard] Fetched sessions:', sessions)
               setRecentSessions(sessions.filter((s: any) => s.feedback_json && s.feedback_json.overall_score).slice(0, 5))
            }
         } catch (err) {
            console.error('Failed to fetch data', err)
         } finally {
            setLoading(false)
         }
      }

      fetchData()
   }, [])

   if (loading) {
      return (
         <div className="h-[60vh] flex items-center justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#7D8461]"></div>
         </div>
      )
   }

   const activeAssignments = assignments.filter(a => a.status !== 'Completed')
   const completedAssignments = assignments.filter(a => a.status === 'Completed')

   return (
      <div className="max-w-7xl mx-auto space-y-12 pb-20">
         {/* Header */}
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
               <h1 className="text-4xl font-extrabold text-[#3A2F28] tracking-tight">Bonjour, {repName.split(' ')[0]} 🌿</h1>
               <p className="text-[#7B6F63] font-medium mt-2 text-base">Your daily performance briefing and training metrics are ready.</p>
            </div>

         </div>

         {/* 1. Missions Section */}
         <section className="space-y-12">
            <div className="flex justify-between items-center px-2">
               <h2 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em] flex items-center gap-3">
                  <span className="w-2 h-2 bg-[#7D8461] rounded-full"></span>
                  Tactical Mission Command
               </h2>
               <Link href="/rep/train" className="text-[10px] font-black text-[#7D8461] uppercase tracking-widest hover:underline">Full Library →</Link>
            </div>
 
            {assignments.length === 0 ? (
               <div className="bg-[#EAE2D6]/40 border border-dashed border-[#D8CCBC] rounded-[2.5rem] p-24 text-center">
                  <p className="text-[#7B6F63] font-black uppercase tracking-[0.2em] text-[10px]">No tactical missions deployed yet.</p>
               </div>
            ) : (
               <div className="space-y-12">
                  {/* Active Sub-section */}
                  {activeAssignments.length > 0 && (
                     <div className="space-y-8">
                        <h3 className="text-[9px] font-black text-[#7D8461] uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                           <span className="w-1.5 h-1.5 bg-[#7D8461] rounded-full animate-pulse"></span>
                           Active Deployments
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                           {activeAssignments.map((assign) => (
                              <div key={assign.id} className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2rem] p-10 hover:shadow-xl transition-all group flex flex-col">
                                 <div className="flex justify-between items-start mb-8">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border ${assign.status === 'Overdue' ? 'bg-[#A06A5B]/10 text-[#A06A5B] border-[#A06A5B]/20' : 'bg-[#7D8461]/10 text-[#7D8461] border-[#7D8461]/20'
                                       }`}>
                                       {assign.status}
                                    </span>
                                    <span className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest">Due {new Date(assign.deadline).toLocaleDateString()}</span>
                                 </div>
                                 <h3 className="text-2xl font-bold text-[#3A2F28] mb-4 leading-tight flex-1">{assign.scenario_name}</h3>
 
                                 <div className="flex items-center justify-between mt-8 pt-8 border-t border-[#D8CCBC]/50">
                                    <div>
                                       <p className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest mb-1">Priority</p>
                                       <p className={`text-xs font-bold uppercase tracking-tight ${assign.priority === 'High' ? 'text-[#A06A5B]' : 'text-[#3A2F28]'}`}>{assign.priority}</p>
                                    </div>
                                    <button
                                       onClick={() => router.push(`/rep/train/${assign.scenario_id}/briefing?assignmentId=${assign.id}`)}
                                       className="px-8 py-3 bg-[#7D8461] hover:bg-[#6B7252] text-[#F6F1E8] text-[10px] font-black uppercase tracking-[0.15em] rounded-2xl transition-all shadow-md"
                                    >
                                       Briefing
                                    </button>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}
 
                  {/* Completed Sub-section */}
                  {completedAssignments.length > 0 && (
                     <div className="space-y-8">
                        <h3 className="text-[9px] font-black text-[#7B6F63] uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                           <span className="w-1.5 h-1.5 bg-[#D8CCBC] rounded-full"></span>
                           Mission Archive
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                           {completedAssignments.map((assign) => (
                              <div key={assign.id} className="bg-[#EAE2D6]/40 border border-[#D8CCBC] rounded-[2rem] p-10 grayscale-[0.5] hover:grayscale-0 transition-all group flex flex-col">
                                 <div className="flex justify-between items-start mb-8">
                                    <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border bg-[#7D8461]/20 text-[#7D8461] border-[#7D8461]/30">
                                       {assign.status}
                                    </span>
                                    <span className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest">
                                       Score: <span className="text-[#3A2F28] font-black">{assign.score || 0}%</span>
                                    </span>
                                 </div>
                                 <h3 className="text-2xl font-bold text-[#3A2F28]/60 group-hover:text-[#3A2F28] mb-4 leading-tight flex-1">{assign.scenario_name}</h3>
 
                                 <div className="flex items-center justify-between mt-8 pt-8 border-t border-[#D8CCBC]/50">
                                    <p className="text-[10px] font-bold text-[#7B6F63] uppercase tracking-widest">
                                       Analyzed {new Date(assign.completed_at).toLocaleDateString()}
                                    </p>
                                    <Link
                                       href={`/rep/train/${assign.scenario_id}/review?sessionId=${assign.session_id}`}
                                       className="text-[10px] font-black text-[#7D8461] uppercase tracking-widest hover:underline"
                                    >
                                       View Report →
                                    </Link>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </div>
                  )}
               </div>
            )}
         </section>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            {/* Left Col */}
            <div className="lg:col-span-8 space-y-12">
               {/* Performance Status Section */}
               <section className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] overflow-hidden shadow-sm">
                  <div className="p-10 border-b border-[#D8CCBC]/50 flex justify-between items-center bg-[#D6C2A8]/10">
                     <div>
                        <h2 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em]">Performance Intelligence</h2>
                        <p className="text-xs text-[#7B6F63] font-medium mt-1">Cross-functional metric analysis</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-black text-[#7D8461] uppercase tracking-[0.2em] mb-1">Proficiency Index</p>
                        <p className="text-6xl font-extrabold text-[#3A2F28] tracking-tighter">{analytics?.avgScore || 0}%</p>
                     </div>
                  </div>

                  <div className="p-12 grid grid-cols-1 md:grid-cols-2 gap-12">
                     {/* Skill Highlights */}
                     <div className="space-y-10">
                        <div className="p-8 bg-[#D6C2A8]/10 border border-[#D8CCBC]/30 rounded-[2rem] space-y-3">
                           <p className="text-[9px] font-black text-[#7D8461] uppercase tracking-[0.2em]">Primary Strength</p>
                           <h4 className="text-xl font-bold text-[#3A2F28]">{analytics?.strongestSkill || 'Active Listening'}</h4>
                           <div className="flex items-center gap-2 text-[#7D8461] font-black text-[10px] uppercase tracking-widest">
                              <span>{analytics?.trendValue >= 0 ? '↑' : '↓'}</span>
                              <span>{Math.abs(analytics?.trendValue || 0)}% Optimization</span>
                           </div>
                        </div>
                        <div className="p-8 bg-[#A06A5B]/5 border border-[#A06A5B]/10 rounded-[2rem] space-y-3">
                           <p className="text-[9px] font-black text-[#A06A5B] uppercase tracking-[0.2em]">Strategic Focus</p>
                           <h4 className="text-xl font-bold text-[#3A2F28]">{analytics?.weakestSkill || 'Objection Handling'}</h4>
                           <div className="flex items-center gap-2 text-[#A06A5B] font-black text-[10px] uppercase tracking-widest">
                              <span>⚙️</span>
                              <span>Target for next session</span>
                           </div>
                        </div>
                     </div>

                     {/* AI Recommendations */}
                     <div className="space-y-8">
                        <h4 className="text-[10px] font-black text-[#7B6F63] uppercase tracking-[0.3em] mb-2">Practice Directives</h4>
                        <div className="space-y-5">
                           {[
                              { title: 'The Skeptical Buyer', difficulty: 'Hard', type: 'Negotiation' },
                              { title: 'Discovery Deep-Dive', difficulty: 'Medium', type: 'Discovery' }
                           ].map((rec, i) => (
                              <div key={i} className="flex items-center gap-6 p-6 bg-[#F6F1E8] rounded-[1.5rem] border border-[#D8CCBC] hover:border-[#7D8461] transition-all cursor-pointer shadow-sm">
                                 <div className="w-12 h-12 bg-[#EAE2D6] border border-[#D8CCBC] rounded-xl flex items-center justify-center text-[#7D8461] font-black text-xs">
                                    {rec.difficulty === 'Hard' ? 'H' : 'M'}
                                 </div>
                                 <div className="flex-1">
                                    <p className="text-sm font-bold text-[#3A2F28] uppercase tracking-tight">{rec.title}</p>
                                    <p className="text-[9px] text-[#7B6F63] font-black uppercase tracking-[0.2em] mt-1">{rec.type}</p>
                                 </div>
                                 <span className="text-[#D8CCBC]">→</span>
                              </div>
                           ))}
                        </div>
                     </div>
                  </div>
               </section>

               {/* Skill Matrix */}
               <section className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-12 shadow-sm">
                  <div className="flex justify-between items-center mb-12 px-2">
                     <h2 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em]">Competency Architecture</h2>
                  </div>

                  <div className="space-y-12">
                     {analytics?.radarData?.map((skill: any, i: number) => (
                        <div key={i} className="space-y-5">
                           <div className="flex justify-between items-end">
                              <p className="text-xs font-black text-[#3A2F28] uppercase tracking-widest">{skill.subject}</p>
                              <p className="text-sm font-extrabold text-[#7D8461]">{skill.A}%</p>
                           </div>
                           <div className="w-full bg-[#F6F1E8] h-2.5 rounded-full overflow-hidden border border-[#D8CCBC]/30">
                              <div
                                 className="h-full bg-[#7D8461] rounded-full transition-all duration-1000"
                                 style={{ width: `${skill.A}%` }}
                              ></div>
                           </div>
                        </div>
                     ))}
                  </div>
               </section>

               {/* Recent Reports Table */}
               <section className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] overflow-hidden shadow-sm">
                  <div className="p-10 border-b border-[#D8CCBC]/50 bg-[#D6C2A8]/10">
                     <h2 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em]">Operational Repository</h2>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="luxury-table">
                        <thead>
                           <tr>
                              <th className="text-[9px] font-black text-[#7B6F63] uppercase tracking-[0.2em]">Mission Identity</th>
                              <th className="text-[9px] font-black text-[#7B6F63] uppercase tracking-[0.2em]">Completion Date</th>
                              <th className="text-right text-[9px] font-black text-[#7B6F63] uppercase tracking-[0.2em]">Score Index</th>
                           </tr>
                        </thead>
                        <tbody>
                           {recentSessions.map((session) => (
                              <tr key={session.id} onClick={() => router.push(`/rep/train/${session.scenario_id}/review?sessionId=${session.id}`)} className="cursor-pointer group">
                                 <td>
                                    <p className="font-bold text-[#3A2F28] group-hover:text-[#7D8461] transition-colors uppercase tracking-tight">{session.scenario_name}</p>
                                    <p className="text-[9px] text-[#7B6F63] font-black uppercase tracking-[0.2em] mt-1">Tactical Analysis</p>
                                 </td>
                                 <td className="text-[10px] font-bold text-[#7B6F63] uppercase tracking-widest">{new Date(session.completed_at).toLocaleDateString()}</td>
                                 <td className="text-right">
                                    <span className={`text-xl font-black ${session.feedback_json.overall_score >= 80 ? 'text-[#7D8461]' : 'text-[#3A2F28]'}`}>
                                       {session.feedback_json.overall_score}%
                                    </span>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               </section>
            </div>

            {/* Right Col */}
            <div className="lg:col-span-4 space-y-12">
               {/* Coaching Briefing */}
               <section className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-10 shadow-sm">
                  <div className="flex justify-between items-center mb-10">
                     <h2 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em]">Manager Directives</h2>
                     <span className="bg-[#7D8461] text-[#F6F1E8] text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest">{notes.length} NEW</span>
                  </div>

                  <div className="space-y-8">
                     {notes.slice(0, 3).map((note) => (
                        <div key={note.id} className="p-8 bg-[#F6F1E8] border border-[#D8CCBC] rounded-[2rem] hover:border-[#7D8461] transition-all group">
                           <div className="flex justify-between items-center mb-6">
                              <p className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest">{new Date(note.created_at).toLocaleDateString()}</p>
                              <div className={`w-2.5 h-2.5 rounded-full ${note.priority === 'High' ? 'bg-[#A06A5B]' : 'bg-[#7D8461]'}`}></div>
                           </div>
                           <p className="text-sm font-medium text-[#3A2F28] italic leading-relaxed">
                              "{note.note_text.length > 120 ? note.note_text.substring(0, 120) + '...' : note.note_text}"
                           </p>
                           <div className="flex justify-between items-center mt-8 pt-8 border-t border-[#D8CCBC]/50">
                              <p className="text-[9px] font-black text-[#7D8461] uppercase tracking-[0.2em]">{note.manager_name}</p>
                              <button className="text-[9px] font-black text-[#7B6F63] hover:text-[#3A2F28] uppercase tracking-[0.2em] transition-colors">Archive</button>
                           </div>
                        </div>
                     ))}
                     <Link href="/rep/coaching" className="block w-full text-center py-2 text-[9px] font-black text-[#7B6F63] hover:text-[#3A2F28] uppercase tracking-[0.3em]">Historical Archive →</Link>
                  </div>
               </section>


               {/* activity timeline */}
               <section className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-10 shadow-sm">
                  <h2 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em] mb-12">Session History</h2>
                  <div className="space-y-12 relative pl-4">
                     <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-[#D8CCBC]/40"></div>

                     {[
                        { type: 'COMPLETED', title: 'Discovery Simulation', date: '2h ago', icon: '🎯' },
                        { type: 'FEEDBACK', title: 'Note from Manager', date: '5h ago', icon: '💬' },
                        { type: 'SCORE', title: '+5% Skill Boost', date: 'Yesterday', icon: '📈' }
                     ].map((item, i) => (
                        <div key={i} className="relative flex gap-8 items-start">
                           <div className="w-5 h-5 rounded-full bg-[#F6F1E8] border-2 border-[#7D8461] z-10 shadow-sm"></div>
                           <div className="space-y-2">
                              <p className="text-[9px] font-black text-[#7B6F63] uppercase tracking-[0.2em]">{item.date} • {item.type}</p>
                              <p className="text-xs font-bold text-[#3A2F28] uppercase tracking-tight leading-tight">{item.title}</p>
                           </div>
                        </div>
                     ))}
                  </div>
               </section>
            </div>
         </div>
      </div>
   )
}
