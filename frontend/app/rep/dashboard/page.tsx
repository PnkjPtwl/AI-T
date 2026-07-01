'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function RepDashboard() {
   const router = useRouter()
   const [loading, setLoading] = useState(true)
   const [repName, setRepName] = useState('')
   const [userEmail, setUserEmail] = useState('')
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
               setUserEmail(user.email)
            }
            if (analyticsRes.ok) setAnalytics(await analyticsRes.json())
            if (assignmentsRes.ok) setAssignments(await assignmentsRes.json())
            if (notesRes.ok) setNotes(await notesRes.json())
            if (sessionsRes.ok) {
               const sessions = await sessionsRes.json()
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
            <div className="animate-spin rounded-full h-[32px] w-[32px] border-t-2 border-[#2C5282]"></div>
         </div>
      )
   }

   const now = new Date().getTime();

   const activeAssignments = assignments.filter(a => {
      if (a.status === 'Completed') return false;
      
      // Auto-destruct (remove from dashboard) if deadline has passed
      if (a.deadline) {
         const dl = new Date(a.deadline);
         dl.setHours(23, 59, 59, 999);
         if (now > dl.getTime()) {
            return false;
         }
      }
      return true;
   }).sort((a, b) => {
      const timeA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const timeB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return timeA - timeB;
   });

   const completedAssignments = assignments.filter(a => a.status === 'Completed')

   const getDeadlineWarning = (deadlineStr: string) => {
      if (!deadlineStr) return { text: 'No deadline', color: 'text-gray-500' };
      const dl = new Date(deadlineStr);
      dl.setHours(23, 59, 59, 999);
      const diffHours = (dl.getTime() - now) / (1000 * 60 * 60);
      
      if (diffHours < 0) {
         return { text: 'Expired', color: 'text-red-600' };
      } else if (diffHours <= 24) {
         return { text: `Due in ${Math.round(diffHours)} hrs 🔥`, color: 'text-red-600 font-[700] animate-pulse bg-red-50 px-[6px] py-[2px] rounded-[4px]' };
      } else if (diffHours <= 72) {
         return { text: `Due in ${Math.round(diffHours / 24)} days`, color: 'text-amber-600 font-[600]' };
      }
      return { text: `Due ${new Date(deadlineStr).toLocaleDateString()}`, color: 'text-gray-500 font-[500]' };
   }

   return (
      <div className="max-w-[1200px] mx-auto space-y-[32px] pb-[48px]">
         {/* Header */}
         <div>
            <h1 className="text-4xl md:text-5xl font-[800] text-gray-900 tracking-tight">Welcome back, {repName.split(' ')[0]} 👋</h1>
            <p className="text-lg md:text-xl text-gray-600 mt-2 font-[400] leading-relaxed">Here is your daily performance briefing and training metrics.</p>
         </div>

         {/* 1. Missions Section */}
         <section className="space-y-[24px]">
            <div className="flex justify-between items-center">
               <h2 className="text-2xl font-[700] text-gray-900 tracking-tight">Active Trainings</h2>
               <Link href="/rep/train" className="text-base text-[#2C5282] hover:underline font-[600]">View All →</Link>
            </div>
 
            {assignments.length === 0 ? (
               <div className="bg-white border border-gray-900/10 rounded-[12px] p-[64px] text-center shadow-sm">
                  <p className="text-gray-500 text-[15px]">No trainings assigned yet.</p>
               </div>
            ) : (
               <div className="space-y-8">
                  {/* Active Sub-section */}
                  {activeAssignments.length > 0 && (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeAssignments.map((assign) => {
                           const warning = getDeadlineWarning(assign.deadline);
                           const isUrgent = warning.text.includes('hours!');
                           
                           return (
                              <div key={assign.id} className={`bg-white border ${isUrgent ? 'border-red-500 shadow-[0_4px_12px_rgba(239,68,68,0.15)] ring-1 ring-red-500' : 'border-gray-900/10'} rounded-[12px] p-[20px] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col`}>
                                 <div className="flex justify-between items-start mb-[16px]">
                                    <span className="text-[12px] font-[600] px-[8px] py-[2px] rounded-[4px] bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-[0.6px]">
                                       {assign.status}
                                    </span>
                                    <span className={`text-[12px] ${warning.color}`}>{warning.text}</span>
                                 </div>
                                 <h3 className="text-xl font-[600] text-gray-900 mb-[8px] flex-1 leading-[1.4]">{assign.scenario_name}</h3>
   
                                 <div className="flex items-center justify-between mt-[24px] pt-[20px] border-t border-gray-900/10">
                                 <div>
                                    <p className="text-xs font-[600] text-gray-500 uppercase tracking-widest mb-[4px]">Priority</p>
                                    <p className={`text-sm font-[700] ${assign.priority === 'High' ? 'text-red-600' : 'text-gray-900'}`}>{assign.priority}</p>
                                 </div>
                                 <button
                                    onClick={() => router.push(`/rep/train/${assign.scenario_id}/briefing?assignmentId=${assign.id}`)}
                                    className={`px-5 py-2.5 text-white text-sm font-[600] rounded-[8px] transition-all duration-200 ${isUrgent ? 'bg-red-600 hover:bg-red-700 shadow-[0_2px_4px_rgba(239,68,68,0.2)]' : 'bg-[#2C5282] hover:bg-[#1A365D] shadow-sm'}`}
                                 >
                                    Start Training
                                 </button>
                              </div>
                           </div>
                        )})}
                     </div>
                  )}
 
                  {/* Completed Sub-section */}
                  {completedAssignments.length > 0 && (
                     <div className="space-y-[16px]">
                        <h3 className="text-sm font-[600] text-gray-500 uppercase tracking-widest">Completed Trainings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[24px]">
                           {completedAssignments.map((assign) => (
                              <div key={assign.id} className="bg-gray-50/50 border border-gray-900/10 rounded-[12px] p-[24px] flex flex-col opacity-80 hover:opacity-100 transition-all duration-200 hover:shadow-sm">
                                 <div className="flex justify-between items-start mb-[16px]">
                                    <span className="text-[12px] font-[600] px-[8px] py-[2px] rounded-[4px] border bg-green-50 text-green-700 border-green-100 uppercase tracking-[0.6px]">
                                       {assign.status}
                                    </span>
                                    <span className="text-[13px] font-[700] text-gray-900">
                                       Score: {assign.score || 0}%
                                    </span>
                                 </div>
                                 <h3 className="text-xl font-[600] text-gray-900 mb-[8px] flex-1 leading-[1.4]">{assign.scenario_name}</h3>
 
                                 <div className="flex items-center justify-between mt-[24px] pt-[20px] border-t border-gray-900/10">
                                    <p className="text-sm text-gray-500">
                                       Done {new Date(assign.completed_at).toLocaleDateString()}
                                    </p>
                                    <Link
                                       href={`/rep/train/${assign.scenario_id}/review?sessionId=${assign.session_id}`}
                                       className="text-sm font-[600] text-[#2C5282] hover:underline"
                                    >
                                       Review →
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

         <div className="space-y-[32px]">
               {/* Performance Status Section */}
               <section className="bg-white border border-gray-900/10 rounded-[12px] overflow-hidden shadow-sm">
                  <div className="p-8 border-b border-gray-900/10 flex justify-between items-center bg-gray-50/50">
                     <div>
                        <h2 className="text-2xl font-[700] text-gray-900 tracking-tight">Performance Overview</h2>
                     </div>
                     <div className="text-right">
                        <p className="text-xs font-[600] text-gray-500 uppercase tracking-widest mb-[4px]">Average Score</p>
                        <p className="text-4xl font-[700] text-[#2C5282] leading-none">{analytics?.avgScore || 0}%</p>
                     </div>
                  </div>
                  
                  <div className="p-8">
                     {/* Skill Highlights */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
                        <div className="p-6 bg-green-50/50 border border-green-100 rounded-xl">
                           <p className="text-xs font-[600] text-green-700 uppercase tracking-widest mb-2">Top Strength</p>
                           <h4 className="text-xl font-[600] text-gray-900">{analytics?.strongestSkill || 'Active Listening'}</h4>
                        </div>
                        <div className="p-6 bg-yellow-50/50 border border-yellow-100 rounded-xl">
                           <p className="text-xs font-[600] text-yellow-700 uppercase tracking-widest mb-2">Focus Area</p>
                           <h4 className="text-xl font-[600] text-gray-900">{analytics?.weakestSkill || 'Objection Handling'}</h4>
                        </div>
                     </div>
                  </div>
               </section>
               {/* Recent Reports Table */}
               <section className="bg-white border border-gray-900/10 rounded-[12px] overflow-hidden shadow-sm">
                  <div className="p-8 border-b border-gray-900/10 bg-gray-50/50">
                     <h2 className="text-2xl font-[700] text-gray-900 tracking-tight">Recent Sessions</h2>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-base">
                        <thead>
                           <tr className="border-b border-gray-900/10 bg-white">
                              <th className="text-left px-8 py-5 text-xs font-[600] text-gray-500 uppercase tracking-widest">Scenario</th>
                              <th className="text-left px-8 py-5 text-xs font-[600] text-gray-500 uppercase tracking-widest">Date</th>
                              <th className="text-right px-8 py-5 text-xs font-[600] text-gray-500 uppercase tracking-widest">Score</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-900/5 bg-white">
                           {recentSessions.map((session) => (
                              <tr key={session.id} onClick={() => router.push(`/rep/train/${session.scenario_id}/review?sessionId=${session.id}`)} className="cursor-pointer hover:bg-gray-50 transition-colors">
                                 <td className="px-8 py-5">
                                    <p className="font-[600] text-[#2C5282]">{session.scenario_name}</p>
                                 </td>
                                 <td className="px-8 py-5 text-gray-600 font-[400]">{new Date(session.completed_at).toLocaleDateString()}</td>
                                 <td className="px-8 py-5 text-right">
                                    <span className={`font-[700] ${session.feedback_json.overall_score >= 80 ? 'text-green-600' : 'text-gray-900'}`}>
                                       {session.feedback_json.overall_score}%
                                    </span>
                                 </td>
                              </tr>
                           ))}
                           {recentSessions.length === 0 && (
                              <tr>
                                 <td colSpan={3} className="px-[24px] py-[48px] text-center text-gray-500 text-[14px]">
                                    No recent sessions.
                                 </td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </section>
            </div>
      </div>
   )
}
