'use client'

import { useState, useEffect } from 'react'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, Cell
} from 'recharts'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return

        const headers = { 'Authorization': `Bearer ${token}` }
        const analyticsRes = await fetch(`${API}/api/users/team-analytics`, { headers })
        if (analyticsRes.ok) {
          const data = await analyticsRes.json()
          setAnalytics(data)
        }
      } catch (err) {
        console.error('Failed to fetch analytics', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-600"></div>
      </div>
    )
  }

  if (!analytics) return <div className="text-center py-20 text-[#64748B] font-bold">No intelligence data available yet.</div>

  return (
    <div className="space-y-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-4xl font-extrabold text-[#1A2A3A] tracking-tight">Intelligence Matrix</h1>
        <p className="text-[#64748B] font-medium text-base mt-2">Strategic Performance & Skill Analytics</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Trend Analysis */}
        <div className="lg:col-span-8 bg-white border border-[#E2E8F0] rounded-[2.5rem] p-12 shadow-sm">
           <div className="flex justify-between items-center mb-12">
              <h3 className="text-[10px] font-black text-[#1A2A3A] uppercase tracking-[0.3em]">Proficiency Trajectory</h3>
              <span className="text-[9px] text-[#64748B] font-black uppercase tracking-widest bg-[#F8FAFC] px-5 py-2 rounded-xl border border-[#E2E8F0]">System Live</span>
           </div>
           <div className="h-[400px] w-full">
             <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#EFE7DC', border: '1px solid #D8CCBC', borderRadius: '1.5rem', boxShadow: '0 10px 25px -5px rgba(58, 47, 40, 0.1)' }} 
                    itemStyle={{ color: '#7D8461', fontWeight: '800', fontSize: '12px' }} 
                  />
                  <Line type="monotone" dataKey="score" stroke="#2C5282" strokeWidth={4} dot={{ r: 4, fill: '#7D8461', strokeWidth: 2, stroke: '#F6F1E8' }} activeDot={{ r: 6, stroke: '#7D8461', strokeWidth: 2 }} />
                </LineChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Skill Matrix */}
        <div className="lg:col-span-4 bg-white border border-[#E2E8F0] rounded-[2.5rem] p-12 shadow-sm">
           <div className="mb-12">
             <h3 className="text-[10px] font-black text-[#1A2A3A] uppercase tracking-[0.3em]">Core Competency</h3>
           </div>
           <div className="h-[400px] w-full">
             <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analytics.radarData}>
                  <PolarGrid stroke="#E2E8F0" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#7B6F63', fontSize: 9, fontWeight: 800 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar name="Team Avg" dataKey="A" stroke="#2C5282" fill="#2C5282" fillOpacity={0.15} />
                </RadarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Persona performance */}
        <div className="bg-white border border-[#E2E8F0] rounded-[2.5rem] p-12 shadow-sm">
           <div className="mb-12">
             <h3 className="text-[10px] font-black text-[#1A2A3A] uppercase tracking-[0.3em]">Persona Engagement Analytics</h3>
           </div>
           <div className="space-y-8">
             {analytics.personaPerformanceData?.map((p: any, idx: number) => (
               <div key={idx} className="bg-[#F8FAFC] border border-[#E2E8F0] p-8 rounded-[2rem] hover:border-green-600 transition-all">
                 <div className="flex justify-between items-center mb-6">
                    <div>
                      <p className="text-base font-bold text-[#1A2A3A] uppercase tracking-tight">{p.type}</p>
                      <p className="text-[9px] text-[#64748B] font-black uppercase tracking-[0.2em] mt-1">Operational Proficiency</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-extrabold ${p.avgScore < 60 ? 'text-red-500' : p.avgScore < 75 ? 'text-[#D6C2A8]' : 'text-green-600'}`}>{p.avgScore}%</p>
                    </div>
                 </div>
                 <div className="w-full bg-[#F1F5F9] h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${p.avgScore < 60 ? 'bg-red-500' : p.avgScore < 75 ? 'bg-yellow-400' : 'bg-[#2C5282]'}`} 
                      style={{ width: `${p.avgScore}%` }}
                    ></div>
                 </div>
               </div>
             ))}
           </div>
        </div>

        {/* Scenario success rates */}
        <div className="bg-white border border-[#E2E8F0] rounded-[2.5rem] p-12 shadow-sm">
           <div className="mb-12">
             <h3 className="text-[10px] font-black text-[#1A2A3A] uppercase tracking-[0.3em]">Mission Success Correlation</h3>
           </div>
           <div className="h-[400px] w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.scenarioData} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={10} width={120} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'rgba(214, 194, 168, 0.15)' }} 
                    contentStyle={{ backgroundColor: '#EFE7DC', border: '1px solid #D8CCBC', borderRadius: '1.5rem' }} 
                  />
                  <Bar dataKey="score" radius={[0, 10, 10, 0]} barSize={24}>
                    {analytics.scenarioData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.score >= 80 ? '#7D8461' : entry.score >= 60 ? '#D6C2A8' : '#A06A5B'} />
                    ))}
                  </Bar>
                </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
    </div>
  )
}
