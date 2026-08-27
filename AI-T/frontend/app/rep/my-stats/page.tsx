'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const scoreColor = (score: number) =>
  score >= 80 ? 'text-emerald-700' : score >= 60 ? 'text-amber-700' : 'text-[#ba1a1a]'

const scoreBg = (score: number) =>
  score >= 80 ? 'bg-emerald-50 border-emerald-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-[#ffdad6]'

export default function PerformancePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const [recentSessions, setRecentSessions] = useState<any[]>([])
  const [selectedPersona, setSelectedPersona] = useState<string>('All')

  useEffect(() => {
    // Read from URL on mount
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const persona = params.get('persona')
      if (persona) setSelectedPersona(persona)
    }

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
          setRecentSessions(sessions.filter((s: any) => s.feedback_json && s.feedback_json.overall_score !== undefined).slice(0, 10))
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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2C5282]"></div>
      </div>
    )
  }

  const uniquePersonas = Array.from(new Set(recentSessions.map(s => s.scenario_name).filter(Boolean)))

  // Build chart data from recent sessions sorted by date and filtered by persona
  const chartData = [...recentSessions]
    .filter(s => selectedPersona === 'All' || s.scenario_name === selectedPersona)
    .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
    .map((s, i) => ({
      idx: i + 1,
      date: new Date(s.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      score: s.feedback_json.overall_score,
      scenario: s.scenario_name,
    }))

  const avgScore = recentSessions.length > 0
    ? Math.round(recentSessions.reduce((sum, s) => sum + s.feedback_json.overall_score, 0) / recentSessions.length)
    : 0

  const best = recentSessions.length > 0
    ? Math.max(...recentSessions.map(s => s.feedback_json.overall_score))
    : 0

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload
      return (
        <div className="bg-white border border-slate-200 rounded-md px-4 py-3 shadow-sm text-[13px]">
          <p className="text-slate-500 text-[11px] mb-1 font-semibold tracking-wider uppercase">{item.date}</p>
          <p className={`font-bold text-lg ${scoreColor(item.score)}`}>{item.score}%</p>
          {item.scenario && <p className="text-slate-600 font-medium text-[12px] mt-1 truncate max-w-[160px]">{item.scenario}</p>}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-8 pb-12 font-['Inter'] max-w-[1360px] mx-auto text-[#0b1c30]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B] tracking-tight">My Stats</h1>
        <p className="text-[14px] text-slate-500 mt-1">Your training performance over time.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sessions Completed</p>
          <p className="text-3xl font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B] mt-2">{analytics?.sessionsCount ?? recentSessions.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Average Score</p>
          <p className={`text-3xl font-bold font-['Plus_Jakarta_Sans'] mt-2 ${scoreColor(analytics?.avgScore ?? avgScore)}`}>{analytics?.avgScore ?? avgScore}%</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Best Score</p>
          <p className={`text-3xl font-bold font-['Plus_Jakarta_Sans'] mt-2 ${scoreColor(analytics?.bestScore ?? best)}`}>{analytics?.bestScore ?? best}%</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Practice Time</p>
          <p className="text-3xl font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B] mt-2">{analytics?.totalPracticeTimeHrs ?? 0} hrs</p>
        </div>
      </div>

      {/* Chart — full width */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h2 className="text-[15px] font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B]">Score Over Time</h2>
          {uniquePersonas.length > 0 && (
            <select
              value={selectedPersona}
              onChange={(e) => setSelectedPersona(e.target.value)}
              className="text-[13px] font-medium border border-slate-200 rounded-md px-3 py-1.5 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-[#4b41e1]"
            >
              <option value="All">All Personas</option>
              {uniquePersonas.map((p: any) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>
        {chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-slate-400 text-[13px]">No session data yet.</div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="99%" height="100%" minHeight={300}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="idx" tick={{ fontSize: 12, fill: '#9CA3AF' }} tickLine={false} axisLine={false} label={{ value: 'Session #', position: 'insideBottomRight', offset: -4, fontSize: 11, fill: '#9CA3AF' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#4b41e1"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#4b41e1', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: '#4b41e1', strokeWidth: 2, fill: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Skill Breakdown */}
      {analytics?.radarData?.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <h2 className="text-[15px] font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B] mb-5 border-b border-slate-100 pb-4">Skill Breakdown</h2>
          <div className="space-y-4">
            {[...(analytics.radarData as any[])].sort((a: any, b: any) => b.A - a.A).map((skill: any, idx: number) => (
              <div key={idx} className="flex items-center gap-4">
                <span className="text-[13px] font-semibold text-slate-700 w-44 shrink-0 truncate">{skill.subject}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-md overflow-hidden">
                  <div
                    className={`h-full rounded-md transition-all duration-500 ${skill.A >= 80 ? 'bg-emerald-500' : skill.A >= 60 ? 'bg-amber-500' : 'bg-[#ba1a1a]'}`}
                    style={{ width: `${skill.A}%` }}
                  />
                </div>
                <span className={`text-[12px] font-bold w-10 text-right ${scoreColor(skill.A)}`}>{skill.A}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights Cards */}
      {analytics?.strongestSkill && analytics.strongestSkill !== 'N/A' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="text-emerald-500">🏆</span> Strongest Skill
            </p>
            <p className="text-[14px] font-bold text-[#1E293B]">{analytics.strongestSkill}</p>
            <p className="text-[13px] text-slate-500 mt-1">Keep leveraging this strength in complex sales scenarios.</p>
          </div>
          {analytics?.weakestSkill && analytics.weakestSkill !== 'N/A' && (
            <div className="bg-white border border-slate-200 rounded-lg p-5 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500"></div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span className="text-amber-500">📈</span> Growth Area
              </p>
              <p className="text-[14px] font-bold text-[#1E293B]">{analytics.weakestSkill}</p>
              <p className="text-[13px] text-slate-500 mt-1">Focus your next practice sessions on improving this skill.</p>
            </div>
          )}
        </div>
      )}

      {/* Persona Breakdown */}
      {analytics?.personaPerformanceData?.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-white">
            <h2 className="text-[15px] font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B]">Performance by Persona</h2>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Persona</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="text-right px-6 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Sessions</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Peak Strength</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Growth Area</th>
                <th className="text-right px-6 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Avg Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analytics.personaPerformanceData.map((p: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-[#1E293B]">{p.persona_name}</td>
                  <td className="px-6 py-4 text-slate-500">{p.type}</td>
                  <td className="px-6 py-4 text-right text-slate-700 font-semibold">{p.sessionsCompleted}</td>
                  <td className="px-6 py-4 text-[#4b41e1] text-[11px] font-bold uppercase tracking-wide">{p.strongestSkill}</td>
                  <td className="px-6 py-4 text-slate-500 text-[11px] font-semibold uppercase tracking-wide">{p.weakestSkill}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold text-[14px] ${scoreColor(p.avgScore)}`}>{p.avgScore}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
