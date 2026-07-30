'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import TrainingAnalyticsDrawer from '../../../components/manager/TrainingAnalyticsDrawer'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function ManagerDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const [assignments, setAssignments] = useState<any[]>([])
  const [selectedRep, setSelectedRep] = useState<string>('all')

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

  const uniqueReps = Array.from(new Set(assignments.map(a => a.rep_id))).map(id => {
    const rep = assignments.find(a => a.rep_id === id)
    return { id, name: rep?.rep_name || 'Unknown' }
  })

  const filteredAssignments = selectedRep === 'all' 
    ? assignments 
    : assignments.filter(a => a.rep_id === selectedRep)

  const totalAssignments = filteredAssignments.length
  const completedAssignments = filteredAssignments.filter(a => a.status === 'Completed').length
  const overdueAssignments = filteredAssignments.filter(a => a.status === 'Overdue').length
  const pendingAssignments = filteredAssignments.filter(a => a.status === 'Pending').length
  const inProgressAssignments = filteredAssignments.filter(a => a.status === 'In Progress').length
  const completionPct = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0

  return (
    <div className="space-y-10 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A2A3A] tracking-tight">Team Dashboard</h1>
          <p className="text-[#64748B] text-sm mt-1">High-level KPIs and team training analytics.</p>
        </div>
        <Link href="/scenarios/new" className="flex items-center justify-center gap-[8px] bg-[#2C5282] hover:bg-[#1A365D] text-white py-[8px] md:py-[10px] px-[16px] md:px-[20px] rounded-[10px] font-[600] text-[14px] transition-all duration-200 shadow-sm">
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          New Persona
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Assignments" value={totalAssignments} href="/training" />
        <KpiCard label="Pending" value={pendingAssignments} href="/training?status=Pending" />
        <KpiCard label="In Progress" value={inProgressAssignments} href="/training?status=In Progress" accent="yellow" />
        <KpiCard label="Completed" value={completedAssignments} href="/training?status=Completed" accent="green" />
        <KpiCard label="Completion Rate" value={`${completionPct}%`} accent={completionPct >= 80 ? 'green' : completionPct >= 50 ? 'yellow' : 'red'} />
        <KpiCard label="Overdue" value={overdueAssignments} alert={overdueAssignments > 0} accent={overdueAssignments > 0 ? 'red' : 'default'} href="/training?status=Overdue" />
      </div>

      {/* Training Analytics with Expandable Drawer */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#1A2A3A]">Training Analytics</h2>
        <TrainingAnalyticsDrawer assignments={assignments} />
      </section>

    </div>
  )
}

function KpiCard({ label, value, alert, accent = 'default', href }: { label: string; value: string | number; alert?: boolean; accent?: 'green' | 'yellow' | 'red' | 'default'; href?: string }) {
  const valueColor = accent === 'green' ? 'text-green-600' : accent === 'yellow' ? 'text-yellow-600' : accent === 'red' ? 'text-red-600' : 'text-[#1A2A3A]'
  
  const CardContent = (
    <div className={`bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-sm relative transition-all h-full ${href ? 'hover:shadow-md hover:border-[#2C5282] cursor-pointer' : 'hover:shadow-sm'}`}>
      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-2 ${valueColor}`}>{value}</p>
      {alert && (
        <span className="absolute top-5 right-5 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
      )}
    </div>
  )

  if (href) {
    return <Link href={href} className="block h-full">{CardContent}</Link>
  }
  return CardContent
}
