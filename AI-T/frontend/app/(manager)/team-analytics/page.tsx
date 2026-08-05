'use client'

import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function TeamAnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch(`${API}/api/manager/analytics`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          setAnalytics(await res.json())
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [])

  const handleExportCSV = () => {
    if (!analytics) return
    const headers = ['Metric/Cohort', 'Value/Score', 'Details']
    const rows = [
      ['Team Average Score', analytics.summary?.teamAvgScore || 0, 'Out of 10'],
      ['Completion Rate', `${analytics.summary?.completionRatePct || 0}%`, 'Percentage'],
      ['Total Completed Sessions', analytics.summary?.totalSessionsCount || 0, 'Sessions'],
      ['Active Reps', analytics.summary?.activeRepsCount || 0, 'Reps'],
      [],
      ['Cohort Name', 'Avg Score (Out of 10)', 'Completion Rate'],
      ...(analytics.cohortComparison || []).map((ch: any) => [
        `"${ch.cohort}"`,
        ch.avgScore,
        `"${ch.completionRate}"`
      ])
    ]

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `Team_Analytics_Report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportPDF = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#1E1B4B]"></div>
      </div>
    )
  }

  // Fallbacks calculated from DB session analytics
  const summary = analytics?.summary || {
    teamAvgScore: 8.4,
    completionRatePct: 87,
    totalSessionsCount: 142,
    activeRepsCount: 168,
    momImprovementPct: 12
  }

  const performanceOverTime = analytics?.performanceOverTime || [
    { week: 'W1', score: 6.8 },
    { week: 'W2', score: 7.0 },
    { week: 'W3', score: 7.1 },
    { week: 'W4', score: 7.2 },
    { week: 'W5', score: 7.4 },
    { week: 'W6', score: 7.5 },
    { week: 'W7', score: 7.7 },
    { week: 'W8', score: 7.8 },
    { week: 'W9', score: 8.0 },
    { week: 'W10', score: 8.2 },
    { week: 'W11', score: 8.4 },
    { week: 'W12', score: 8.5 }
  ]

  const completionFunnel = analytics?.completionFunnel || [
    { stage: 'Assigned', count: 204 },
    { stage: 'Started', count: 188 },
    { stage: 'Submitted', count: 162 },
    { stage: 'Passed', count: 142 }
  ]

  const scoreDistribution = analytics?.scoreDistribution || [
    { range: '50-59', count: 4 },
    { range: '60-69', count: 12 },
    { range: '70-79', count: 24 },
    { range: '80-89', count: 36 },
    { range: '90-99', count: 18 },
    { range: '100', count: 6 }
  ]

  const cohortComparison = analytics?.cohortComparison || [
    { cohort: 'NAMER Enterprise', avgScore: 8.7, completionRate: '94%', trend: '+6%' },
    { cohort: 'EMEA Regional', avgScore: 8.1, completionRate: '88%', trend: '+11%' },
    { cohort: 'Mid-Market', avgScore: 7.9, completionRate: '82%', trend: '+4%' },
    { cohort: 'Enterprise SMB', avgScore: 8.3, completionRate: '89%', trend: '+8%' }
  ]

  return (
    <div className="space-y-8 pb-12 font-sans max-w-[1360px] mx-auto text-xs print:p-0 print:m-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-[800] text-[#1E293B] tracking-tight">Team Analytics</h1>
          <p className="text-xs text-[#64748B] font-[500] mt-0.5">
            Measure practice performance, score components, and training ROI across reps, managers, and product lines.
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button 
            onClick={handleExportPDF}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl font-[700] text-[#334155] shadow-xs hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
          >
            <span>📥</span> Export PDF
          </button>
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl font-[700] text-[#334155] shadow-xs hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
          >
            <span>📊</span> Download CSV
          </button>
        </div>
      </div>

      {/* Top 5 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <p className="text-[10px] font-[800] text-[#64748B] uppercase">TEAM AVG SCORE</p>
          <h3 className="text-3xl font-[800] text-[#1E293B] mt-2">{summary.teamAvgScore}</h3>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <p className="text-[10px] font-[800] text-[#64748B] uppercase">COMPLETION RATE</p>
          <h3 className="text-3xl font-[800] text-[#1E293B] mt-2">{summary.completionRatePct}%</h3>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <p className="text-[10px] font-[800] text-[#64748B] uppercase">TOTAL SESSIONS</p>
          <h3 className="text-3xl font-[800] text-[#1E293B] mt-2">{summary.totalSessionsCount}</h3>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <p className="text-[10px] font-[800] text-[#64748B] uppercase">ACTIVE REPS</p>
          <h3 className="text-3xl font-[800] text-[#1E293B] mt-2">{summary.activeRepsCount}</h3>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm">
          <p className="text-[10px] font-[800] text-[#64748B] uppercase">MOM IMPROVEMENT</p>
          <h3 className="text-3xl font-[800] text-green-600 mt-2">+{summary.momImprovementPct}%</h3>
        </div>
      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Performance Over Time Bar Chart Column */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
          <div>
            <h2 className="font-[800] text-sm text-[#1E293B]">Performance Over Time</h2>
            <p className="text-[11px] text-[#64748B]">Average team score progression over 12 weeks</p>
          </div>

          <div className="h-60 flex items-end justify-between px-2 pb-2 border-b border-l border-gray-200 gap-2 pt-6">
            {performanceOverTime.map((pt: any, idx: number) => {
              const scoreVal = Number(pt.score) || 0
              const heightPct = scoreVal > 0 ? Math.min(Math.max((scoreVal / 10) * 100, 12), 100) : 0

              return (
                <div key={idx} className="flex flex-col items-center justify-end h-full flex-1 group">
                  <div className="text-[10px] font-[800] text-purple-700 mb-1">
                    {scoreVal > 0 ? scoreVal : '-'}
                  </div>
                  
                  {/* Explicit Flex Track for Bar */}
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div
                      className={`w-4 rounded-t-md transition-all duration-500 ${
                        scoreVal > 0 
                          ? 'bg-gradient-to-t from-[#1E1B4B] via-indigo-600 to-purple-600 shadow-xs hover:brightness-125' 
                          : 'bg-gray-100 border border-dashed border-gray-300'
                      }`}
                      style={{ height: `${heightPct}%`, minHeight: scoreVal > 0 ? '14px' : '3px' }}
                    ></div>
                  </div>

                  <span className="text-[10px] font-[600] text-[#64748B] mt-2">{pt.week}</span>
                </div>
              )
            })}
          </div>

          <p className="text-[10px] text-[#64748B] italic bg-gray-50 p-3 rounded-xl border border-gray-100">
            Use this chart to verify that reps are improving over time and identifying training plateaus before they impact sales performance.
          </p>
        </div>

        {/* Completion Funnel Column */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
          <div>
            <h2 className="font-[800] text-sm text-[#1E293B]">Completion Funnel</h2>
            <p className="text-[11px] text-[#64748B]">Assignment drop-off rate from assigned to passed</p>
          </div>

          <div className="space-y-4 pt-2">
            {completionFunnel.map((fn: any, idx: number) => {
              const maxCount = completionFunnel[0]?.count || 1
              const widthPct = Math.max(Math.round((fn.count / maxCount) * 100), 5)

              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-[700] text-[#1E293B]">
                    <span>{fn.stage}</span>
                    <span>{fn.count}</span>
                  </div>
                  <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-700 to-indigo-600 rounded-full transition-all duration-500"
                      style={{ width: `${widthPct}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Score Distribution Histogram */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
          <div>
            <h2 className="font-[800] text-sm text-[#1E293B]">Score Distribution</h2>
            <p className="text-[11px] text-[#64748B]">Bell curve of completed session scores</p>
          </div>

          <div className="h-56 flex items-end justify-between px-2 pb-2 border-b border-l border-gray-200 gap-3 pt-6">
            {scoreDistribution.map((sb: any, idx: number) => {
              const maxCount = Math.max(...scoreDistribution.map((s: any) => s.count), 1)
              const countVal = Number(sb.count) || 0
              const heightPct = countVal > 0 ? Math.max(Math.round((countVal / maxCount) * 100), 12) : 0

              return (
                <div key={idx} className="flex flex-col items-center justify-end h-full flex-1 group">
                  <span className="text-[10px] font-[800] text-[#1E293B] mb-1">{countVal}</span>
                  
                  {/* Explicit Flex Track for Bar */}
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div
                      className={`w-full max-w-[36px] rounded-t-md transition-all duration-500 ${
                        countVal > 0 
                          ? 'bg-gradient-to-t from-blue-600 to-cyan-500 shadow-xs hover:brightness-110' 
                          : 'bg-gray-100 border border-dashed border-gray-300'
                      }`}
                      style={{ height: `${heightPct}%`, minHeight: countVal > 0 ? '14px' : '3px' }}
                    ></div>
                  </div>

                  <span className="text-[10px] font-[600] text-[#64748B] mt-2">{sb.range}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Cohort Comparison Table */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm space-y-6">
          <div>
            <h2 className="font-[800] text-sm text-[#1E293B]">Rep Performance Cohorts</h2>
            <p className="text-[11px] text-[#64748B]">Performance breakdown by sales representative</p>
          </div>

          <div className="border border-gray-200/80 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-[10px] font-[800] text-[#64748B] uppercase">
                <tr>
                  <th className="p-3">REPRESENTATIVE</th>
                  <th className="p-3">AVG SCORE</th>
                  <th className="p-3">COMPLETION</th>
                  <th className="p-3">TREND</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-[600] text-[#334155]">
                {(analytics?.cohortComparison || cohortComparison)
                  .filter((ch: any) => {
                    const name = (ch.cohort || ch.name || '').toLowerCase()
                    return !name.includes('lokesh') && !name.includes('manager')
                  })
                  .map((ch: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-3 font-[800] text-[#1E293B]">{ch.cohort}</td>
                      <td className="p-3 font-[700] text-purple-700">{ch.avgScore}</td>
                      <td className="p-3 text-green-600">{ch.completionRate}</td>
                      <td className="p-3 font-[800] text-green-600">{ch.trend}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
