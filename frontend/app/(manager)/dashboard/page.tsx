'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TrainingAnalyticsDrawer from '../../../components/manager/TrainingAnalyticsDrawer'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function ManagerDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const headers = { 'Authorization': `Bearer ${token}` }
      const [analyticsRes, assignmentsRes] = await Promise.all([
        fetch(`${API}/api/users/team-analytics`, { headers }),
        fetch(`${API}/api/users/team-assignments`, { headers })
      ])
      if (analyticsRes.ok) setAnalytics(await analyticsRes.json())
      if (assignmentsRes.ok) setAssignments(await assignmentsRes.json())
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

  const summary = analytics?.summaryStats || {}

  const totalAssignments = summary.totalAssignments ?? 0
  const completedAssignments = summary.completedAssignments ?? 0
  const overdueAssignments = summary.overdueAssignments ?? 0
  const completionPct = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0

  return (
    <div className="space-y-10 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A2A3A] tracking-tight">Team Dashboard</h1>
          <p className="text-[#64748B] text-sm mt-1">High-level KPIs and team training analytics.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Assignments" value={totalAssignments} />
        <KpiCard label="Completed" value={completedAssignments} accent="green" />
        <KpiCard label="Completion Rate" value={`${completionPct}%`} accent={completionPct >= 80 ? 'green' : completionPct >= 50 ? 'yellow' : 'red'} />
        <KpiCard label="Overdue" value={overdueAssignments} alert={overdueAssignments > 0} accent={overdueAssignments > 0 ? 'red' : 'default'} />
      </div>

      {/* Training Analytics with Expandable Drawer */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#1A2A3A]">Training Analytics</h2>
        <TrainingAnalyticsDrawer assignments={assignments} />
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
