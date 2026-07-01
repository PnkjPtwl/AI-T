'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function ManagerDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const headers = { 'Authorization': `Bearer ${token}` }
      const res = await fetch(`${API}/api/users/team-analytics`, { headers })
      if (res.ok) setAnalytics(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2C5282]"></div>
      </div>
    )
  }

  const personas = analytics?.personaComparisonData || []
  const reps = analytics?.repPercentileData || []
  const insights = analytics?.insights || []
  const recommendations = analytics?.recommendations || []
  const summary = analytics?.summaryStats || {}

  const totalAssignments = summary.totalAssignments ?? 0
  const completedAssignments = summary.completedAssignments ?? 0
  const overdueAssignments = summary.overdueAssignments ?? 0
  const totalReps = summary.totalReps ?? reps.length
  const completionPct = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A2A3A] tracking-tight">Team Dashboard</h1>
          <p className="text-[#64748B] text-sm mt-1">Comparative analytics, persona performance and AI-generated insights.</p>
        </div>
        <Link
          href="/scenarios/new"
          className="bg-[#2C5282] hover:bg-[#1A365D] text-white py-2.5 px-5 rounded-xl font-semibold text-sm transition-all shadow-md flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
          New Persona
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Assignments" value={totalAssignments} />
        <KpiCard label="Completed" value={completedAssignments} accent="green" />
        <KpiCard label="Completion Rate" value={`${completionPct}%`} accent={completionPct >= 80 ? 'green' : completionPct >= 50 ? 'yellow' : 'red'} />
        <KpiCard label="Overdue" value={overdueAssignments} alert={overdueAssignments > 0} accent={overdueAssignments > 0 ? 'red' : 'default'} />
      </div>

      {/* AI Insights + Recommendations */}
      {(insights.length > 0 || recommendations.length > 0) && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Insights */}
          {insights.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-4">AI Insights</h2>
              <div className="space-y-3">
                {insights.map((item: any, i: number) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
                    item.type === 'Alert' || item.type === 'Complexity Alert' ? 'bg-red-50 border-red-100' :
                    item.type === 'Team Strength' ? 'bg-green-50 border-green-100' :
                    item.type === 'Skill Gap' ? 'bg-yellow-50 border-yellow-100' :
                    'bg-[#F8FAFC] border-[#E2E8F0]'
                  }`}>
                    <span className="text-lg leading-none mt-0.5">{item.icon}</span>
                    <div>
                      <p className={`text-xs font-semibold mb-0.5 ${
                        item.type === 'Alert' || item.type === 'Complexity Alert' ? 'text-red-600' :
                        item.type === 'Team Strength' ? 'text-green-700' :
                        item.type === 'Skill Gap' ? 'text-yellow-700' :
                        'text-[#2C5282]'
                      }`}>{item.type}</p>
                      <p className="text-sm text-[#374151]">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-4">Recommendations</h2>
              <div className="space-y-3">
                {recommendations.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                    <span className={`mt-0.5 px-2 py-0.5 rounded text-xs font-bold ${
                      r.priority === 'Critical' ? 'bg-red-600 text-white' :
                      r.priority === 'High' ? 'bg-orange-500 text-white' :
                      'bg-[#2C5282] text-white'
                    }`}>{r.priority}</span>
                    <div>
                      <p className="text-xs font-semibold text-[#1A2A3A] mb-0.5">{r.action}</p>
                      <p className="text-sm text-[#64748B]">{r.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Persona Performance Comparison */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#1A2A3A]">Persona Performance</h2>
        {personas.length === 0 ? (
          <div className="p-12 text-center bg-white border border-[#E2E8F0] rounded-2xl">
            <p className="text-sm text-[#64748B]">No persona data yet. Complete training sessions to see comparisons.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {personas.map((p: any, idx: number) => (
              <div key={idx} className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-base font-semibold text-[#1A2A3A]">{p.type}</h3>
                    {p.sessionCount && (
                      <p className="text-xs text-[#64748B] mt-0.5">{p.sessionCount} session{p.sessionCount !== 1 ? 's' : ''}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#64748B] mb-1">Avg Score</p>
                    <p className={`text-2xl font-bold ${p.avgScore >= 75 ? 'text-green-600' : p.avgScore >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{p.avgScore}%</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full mb-4 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${p.avgScore >= 75 ? 'bg-green-500' : p.avgScore >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ width: `${p.avgScore}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#F0FDF4] p-3 rounded-xl border border-green-100">
                    <p className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">▲ Top Performer</p>
                    {p.bestRep ? (
                      <div>
                        <p className="text-sm font-semibold text-[#1A2A3A]">{p.bestRep.name}</p>
                        <p className="text-sm font-bold text-green-600">{p.bestRep.score}%</p>
                      </div>
                    ) : <p className="text-sm text-[#64748B]">—</p>}
                  </div>
                  <div className="bg-[#FFF5F5] p-3 rounded-xl border border-red-100">
                    <p className="text-xs font-medium text-red-600 mb-1 flex items-center gap-1">▼ Needs Coaching</p>
                    {p.worstRep ? (
                      <div>
                        <p className="text-sm font-semibold text-[#1A2A3A]">{p.worstRep.name}</p>
                        <p className="text-sm font-bold text-red-500">{p.worstRep.score}%</p>
                      </div>
                    ) : <p className="text-sm text-[#64748B]">—</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Team Percentile Ranking */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#1A2A3A]">Team Ranking</h2>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-6 py-3.5 text-xs font-semibold text-[#64748B] uppercase tracking-wider">#</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Rep</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Score</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Percentile</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-[#64748B] uppercase tracking-wider max-w-[280px]">Status / AI Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {reps.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-[#64748B]">
                      No reps with activity yet. Assign training sessions to see rankings.
                    </td>
                  </tr>
                ) : (
                  reps.map((rep: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-[#64748B]">#{idx + 1}</td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-semibold text-[#1A2A3A]">{rep.name}</p>
                        {rep.completionRate !== undefined && (
                          <p className="text-xs text-[#64748B] mt-0.5">{rep.completionRate}% complete</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold ${
                          rep.avgScore >= 80 ? 'bg-green-100 text-green-700' :
                          rep.avgScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {rep.avgScore}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-medium text-[#1A2A3A] w-10">{rep.percentile}th</span>
                          <div className="w-24 h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${rep.percentile >= 75 ? 'bg-[#2C5282]' : rep.percentile >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                              style={{ width: `${rep.percentile}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-[280px]">
                        <p className="text-sm text-[#64748B] truncate" title={rep.aiRating}>
                          {rep.aiRating || 'No AI feedback yet'}
                        </p>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

function KpiCard({ label, value, alert, accent = 'default' }: { label: string; value: string | number; alert?: boolean; accent?: 'green' | 'yellow' | 'red' | 'default' }) {
  const valueColor = accent === 'green' ? 'text-green-600' : accent === 'yellow' ? 'text-yellow-600' : accent === 'red' ? 'text-red-600' : 'text-[#1A2A3A]'
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm relative hover:shadow-md transition-all">
      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${valueColor}`}>{value}</p>
      {alert && (
        <span className="absolute top-5 right-5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
      )}
    </div>
  )
}
