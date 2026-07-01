'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function PerformancePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const [recentSessions, setRecentSessions] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return

        const headers = { 'Authorization': `Bearer ${token}` }

        const [analyticsRes, sessionsRes] = await Promise.all([
          fetch(`${API}/api/users/my-analytics`, { headers }),
          fetch(`${API}/api/sessions/my-sessions`, { headers })
        ])

        if (analyticsRes.ok) setAnalytics(await analyticsRes.json())
        if (sessionsRes.ok) {
          const sessions = await sessionsRes.json()
          setRecentSessions(sessions.filter((s: any) => s.feedback_json && s.feedback_json.overall_score).slice(0, 10))
        }
      } catch (err) {
        console.error('Failed to fetch performance data', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#2C5282]"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-24 text-left">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-[#1A2A3A] tracking-tight">Performance Analytics</h1>
        <p className="text-[#64748B] font-medium text-base">Comprehensive growth review and multi-dimensional proficiency mapping.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Growth Trajectory */}
        <section className="bg-white border border-[#E2E8F0] rounded-[2.5rem] p-10 shadow-sm space-y-10">
           <div className="flex justify-between items-center px-2">
              <h2 className="text-[10px] font-black text-[#1A2A3A] uppercase tracking-[0.2em]">Growth Trajectory</h2>
              <span className="text-[10px] text-[#2C5282] font-black uppercase tracking-widest">+18% Optimization Index</span>
           </div>
           <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics?.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D8CCBC" vertical={false} />
                  <XAxis dataKey="date" stroke="#7B6F63" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#7B6F63" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#F6F1E8', border: '1px solid #D8CCBC', borderRadius: '1.5rem' }} 
                    itemStyle={{ color: '#7D8461', fontWeight: 'bold' }} 
                  />
                  <Line type="monotone" dataKey="score" stroke="#7D8461" strokeWidth={4} dot={{ r: 4, fill: '#7D8461', stroke: '#F6F1E8', strokeWidth: 2 }} activeDot={{ r: 6, stroke: '#7D8461', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
           </div>
        </section>

        {/* Skill Matrix */}
        <section className="bg-white border border-[#E2E8F0] rounded-[2.5rem] p-10 shadow-sm space-y-10">
           <div className="flex justify-between items-center px-2">
              <h2 className="text-[10px] font-black text-[#1A2A3A] uppercase tracking-[0.2em]">Proficiency Radar</h2>
              <span className="text-[10px] text-[#64748B] font-black uppercase tracking-widest">Aggregate Analysis</span>
           </div>
           <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analytics?.radarData}>
                  <PolarGrid stroke="#D8CCBC" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#7B6F63', fontSize: 10, fontWeight: 'bold' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="My Avg" dataKey="A" stroke="#7D8461" fill="#7D8461" fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
           </div>
        </section>
      </div>

      {/* Persona Breakdown */}
      <section className="bg-white border border-[#E2E8F0] rounded-[2.5rem] p-12 shadow-sm space-y-12">
         <h2 className="text-[10px] font-black text-[#1A2A3A] uppercase tracking-[0.3em] px-2">Persona Intelligence Correlation</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10">
            {analytics?.personaPerformanceData?.map((p: any, idx: number) => (
              <div key={idx} className="bg-white border border-[#E2E8F0] rounded-[2rem] p-10 hover:border-[#2C5282]/40 transition-all group shadow-sm">
                 <div className="flex justify-between items-start mb-8">
                    <div>
                       <h4 className="text-xl font-bold text-[#1A2A3A] uppercase tracking-tight leading-tight">{p.type}</h4>
                       <p className="text-[9px] text-[#64748B] uppercase font-black tracking-[0.2em] mt-1">{p.persona_name}</p>
                    </div>
                    <div className={`text-3xl font-extrabold tracking-tighter ${p.avgScore >= 80 ? 'text-[#2C5282]' : p.avgScore >= 60 ? 'text-[#1A2A3A]' : 'text-[#64748B]'}`}>
                       {p.avgScore}%
                    </div>
                 </div>

                 <div className="space-y-4 pt-8 border-t border-[#E2E8F0]/50">
                    <div className="flex justify-between items-center">
                       <span className="text-[9px] text-[#64748B] font-black uppercase tracking-widest">Sessions</span>
                       <span className="text-xs text-[#1A2A3A] font-extrabold">{p.sessionsCompleted}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-[9px] text-[#64748B] font-black uppercase tracking-widest">Peak Strength</span>
                       <span className="text-[10px] text-[#2C5282] font-black uppercase tracking-widest">{p.strongestSkill}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-[9px] text-[#64748B] font-black uppercase tracking-widest">Growth Vector</span>
                       <span className="text-[10px] text-[#64748B] font-black uppercase tracking-widest">{p.weakestSkill}</span>
                    </div>
                 </div>
                 
                 <div className="mt-8 w-full bg-[#F8FAFC]/50 h-2 rounded-full overflow-hidden border border-[#E2E8F0]/30">
                    <div 
                       className={`h-full transition-all duration-1000 ${p.avgScore >= 80 ? 'bg-[#2C5282]' : p.avgScore >= 60 ? 'bg-[#D6C2A8]' : 'bg-red-500'}`} 
                       style={{ width: `${p.avgScore}%` }}
                    ></div>
                 </div>
              </div>
            ))}
         </div>
      </section>
    </div>
  )
}
