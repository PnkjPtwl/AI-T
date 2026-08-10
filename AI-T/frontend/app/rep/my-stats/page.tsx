'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const scoreColor = (score: number) =>
  score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-500'

const scoreBg = (score: number) =>
  score >= 80 ? 'bg-green-50 border-green-200' : score >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'

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
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-lg text-sm">
          <p className="text-gray-400 text-xs mb-1">{item.date}</p>
          <p className={`font-bold text-lg ${scoreColor(item.score)}`}>{item.score}%</p>
          {item.scenario && <p className="text-gray-400 text-xs mt-1 truncate max-w-[160px]">{item.scenario}</p>}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Stats</h1>
        <p className="text-base text-gray-500 mt-1">Your training performance over time.</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sessions Completed</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{analytics?.sessionsCount ?? recentSessions.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Average Score</p>
          <p className={`text-3xl font-bold mt-2 ${scoreColor(analytics?.avgScore ?? avgScore)}`}>{analytics?.avgScore ?? avgScore}%</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Best Score</p>
          <p className={`text-3xl font-bold mt-2 ${scoreColor(analytics?.bestScore ?? best)}`}>{analytics?.bestScore ?? best}%</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Practice Time</p>
          <p className="text-3xl font-bold text-[#1E1B4B] mt-2">{analytics?.totalPracticeTimeHrs ?? 0} hrs</p>
        </div>
      </div>

      {/* Chart — full width */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-base font-semibold text-gray-900">Score Over Time</h2>
          {uniquePersonas.length > 0 && (
            <select
              value={selectedPersona}
              onChange={(e) => setSelectedPersona(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-700 outline-none focus:ring-2 focus:ring-[#2C5282]"
            >
              <option value="All">All Personas</option>
              {uniquePersonas.map((p: any) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>
        {chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No session data yet.</div>
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
                  stroke="#2C5282"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2C5282', stroke: '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: '#2C5282', strokeWidth: 2, fill: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Skill Breakdown */}
      {analytics?.radarData?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-5">Skill Breakdown</h2>
          <div className="space-y-3">
            {[...(analytics.radarData as any[])].sort((a: any, b: any) => b.A - a.A).map((skill: any, idx: number) => (
              <div key={idx} className="flex items-center gap-4">
                <span className="text-xs font-semibold text-gray-600 w-44 shrink-0 truncate">{skill.subject}</span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${skill.A >= 80 ? 'bg-green-500' : skill.A >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${skill.A}%` }}
                  />
                </div>
                <span className={`text-xs font-bold w-10 text-right ${scoreColor(skill.A)}`}>{skill.A}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights Cards */}
      {analytics?.strongestSkill && analytics.strongestSkill !== 'N/A' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-5">
            <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">🏆 Strongest Skill</p>
            <p className="text-sm font-bold text-gray-900">{analytics.strongestSkill}</p>
            <p className="text-xs text-gray-600 mt-1">Keep leveraging this strength in complex sales scenarios.</p>
          </div>
          {analytics?.weakestSkill && analytics.weakestSkill !== 'N/A' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">📈 Growth Area</p>
              <p className="text-sm font-bold text-gray-900">{analytics.weakestSkill}</p>
              <p className="text-xs text-gray-600 mt-1">Focus your next practice sessions on improving this skill.</p>
            </div>
          )}
        </div>
      )}

      {/* Persona Breakdown */}
      {analytics?.personaPerformanceData?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">Performance by Persona</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Persona</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sessions</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Peak Strength</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Growth Area</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analytics.personaPerformanceData.map((p: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{p.persona_name}</td>
                  <td className="px-6 py-4 text-gray-500">{p.type}</td>
                  <td className="px-6 py-4 text-right text-gray-700 font-semibold">{p.sessionsCompleted}</td>
                  <td className="px-6 py-4 text-[#2C5282] text-xs font-semibold uppercase tracking-wide">{p.strongestSkill}</td>
                  <td className="px-6 py-4 text-gray-500 text-xs uppercase tracking-wide">{p.weakestSkill}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-bold text-base ${scoreColor(p.avgScore)}`}>{p.avgScore}%</span>
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
