'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function ManagerDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>({
    totalAssignments: 39,
    pending: 5,
    inProgress: 0,
    completed: 34,
    completionRatePct: 87,
    overdue: 0
  })
  const [personas, setPersonas] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return

        // 1. Fetch assignments summary
        const assignRes = await fetch(`${API}/api/manager/assignments`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (assignRes.ok) {
          const assignData = await assignRes.json()
          const assignmentsList = Array.isArray(assignData) ? assignData : assignData.assignments || []
          
          const total = assignmentsList.length
          const pending = assignmentsList.filter((a: any) => a.status === 'Pending').length
          const inProgress = assignmentsList.filter((a: any) => a.status === 'In Progress').length
          const completed = assignmentsList.filter((a: any) => a.status === 'Completed').length
          const overdue = assignmentsList.filter((a: any) => a.status === 'Overdue').length
          const completionRatePct = total > 0 ? Math.round((completed / total) * 100) : 0

          setStats({
            totalAssignments: total,
            pending,
            inProgress,
            completed,
            completionRatePct,
            overdue
          })
        }

        // 2. Fetch scenarios for Training Analytics table
        const scenRes = await fetch(`${API}/api/scenarios`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (scenRes.ok) {
          const scenData = await scenRes.json()
          const scenariosList = Array.isArray(scenData) ? scenData : scenData.scenarios || []
          setPersonas(scenariosList.slice(0, 6))
        }
      } catch (err) {
        console.error('Error fetching manager dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#1E1B4B]"></div>
      </div>
    )
  }

  const displayPersonas = personas

  return (
    <div className="space-y-8 pb-12 font-sans max-w-[1360px] mx-auto text-xs">
      {/* Header with Title & "+ New Persona" Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-[800] text-[#1E293B] tracking-tight">Team Performance</h1>
          <p className="text-xs text-[#64748B] font-[500] mt-0.5">
            Monitor your team's AI training progress and identify coaching opportunities.
          </p>
        </div>

        <Link
          href="/scenarios/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1E1B4B] hover:bg-[#2A2467] text-white rounded-xl font-[700] text-xs shadow-md transition-all self-start sm:self-auto group"
        >
          <span className="text-sm font-bold group-hover:scale-110 transition-transform">➕</span>
          <span>New Persona</span>
        </Link>
      </div>

      {/* Top 6 KPI Analytics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Assignments */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">Total Assignments</span>
            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs">📊</div>
          </div>
          <div>
            <h3 className="text-2xl font-[800] text-[#1E293B]">{stats.totalAssignments}</h3>
            <p className="text-[10px] font-[600] text-[#94A3B8] mt-0.5">All time</p>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">Pending</span>
            <div className="w-7 h-7 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-xs">⏱️</div>
          </div>
          <div>
            <h3 className="text-2xl font-[800] text-[#1E293B]">{stats.pending}</h3>
            <p className="text-[10px] font-[600] text-[#94A3B8] mt-0.5">Not yet started</p>
          </div>
        </div>

        {/* In-Progress */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">In-Progress</span>
            <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xs">⚡</div>
          </div>
          <div>
            <h3 className="text-2xl font-[800] text-[#1E293B]">{stats.inProgress}</h3>
            <p className="text-[10px] font-[600] text-[#94A3B8] mt-0.5">Currently active</p>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">Completed</span>
            <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">✓</div>
          </div>
          <div>
            <h3 className="text-2xl font-[800] text-[#1E293B]">{stats.completed}</h3>
            <p className="text-[10px] font-[600] text-[#94A3B8] mt-0.5">Successfully done</p>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">Completion Rate</span>
            <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs">📈</div>
          </div>
          <div>
            <h3 className="text-2xl font-[800] text-[#1E293B]">{stats.completionRatePct}%</h3>
            <p className="text-[10px] font-[600] text-[#94A3B8] mt-0.5">Of all assignments</p>
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">Overdue</span>
            <div className="w-7 h-7 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-xs">⚠️</div>
          </div>
          <div>
            <h3 className="text-2xl font-[800] text-[#1E293B]">{stats.overdue}</h3>
            <p className="text-[10px] font-[600] text-[#94A3B8] mt-0.5">Needs attention</p>
          </div>
        </div>
      </div>

      {/* Training Analytics Card (Top / Recent Personas Table) */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-5">
        <div>
          <h2 className="font-[800] text-sm text-[#1E293B]">Training Analytics</h2>
        </div>

        <div className="border border-gray-200/80 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 text-[10px] font-[800] text-[#64748B] uppercase border-b border-gray-200/60">
              <tr>
                <th className="p-4">PERSONA</th>
                <th className="p-4">ASSIGNED</th>
                <th className="p-4">STATUS</th>
                <th className="p-4 text-right">REVIEW</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-[600] text-[#334155]">
              {displayPersonas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-400">
                    No scenarios found. Create your first persona to get started.
                  </td>
                </tr>
              ) : (
                displayPersonas.map((p: any, idx: number) => {
                  const title = p.contact_title || p.persona_name || 'Persona'
                  const company = p.contact_company ? ` - ${p.contact_company}` : ''
                  const displayName = `${title}${company}`

                  return (
                    <tr key={p.id || idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4">
                        <span className="text-[#1E293B] font-[800]">{title}</span>
                        {p.contact_company && <span className="text-[#64748B] font-[600]"> - {p.contact_company}</span>}
                      </td>
                      <td className="p-4 text-[#1E293B] font-[800]">{p.assigned_count || 0}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-[10px] font-[800] uppercase tracking-wider rounded-lg border border-amber-100">
                          {p.active_count || 0} Active • {p.completed_count || 0} Completed
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Link href={`/scenarios/${p.id}`} className="inline-flex items-center gap-1 text-[10px] font-[800] uppercase tracking-wider text-[#64748B] hover:text-[#1E293B] hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-all">
                          <span className="text-red-500">●</span> Review
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
