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

  // Build chart data from recent sessions sorted by date
  const chartData = [...recentSessions]
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Sessions Completed</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{recentSessions.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Average Score</p>
          <p className={`text-3xl font-bold mt-2 ${scoreColor(avgScore)}`}>{avgScore}%</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Best Score</p>
          <p className={`text-3xl font-bold mt-2 ${scoreColor(best)}`}>{best}%</p>
        </div>
      </div>

      {/* Chart — full width */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900 mb-6">Score Over Time</h2>
        {chartData.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">No session data yet.</div>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
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
