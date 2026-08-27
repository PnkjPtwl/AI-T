'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

type Filter = 'all' | 'pending' | 'completed'

export default function TrainingCenter() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
        const [scenRes, assignRes] = await Promise.all([
          fetch(`${API}/api/scenarios`, { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch(`${API}/api/users/my-assignments`, { headers: { 'Authorization': `Bearer ${token}` } })
        ])
        if (assignRes.ok) {
          const data = await assignRes.json()
          setAssignments(data)
        }
      } catch (err) {
        console.error('[TrainingCenter] Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2C5282]"></div>
      </div>
    )
  }

  const now = Date.now()

  const getStatus = (a: any) => {
    if (a.status === 'Completed' || a.status?.toLowerCase() === 'completed') return 'completed'
    if (a.deadline) {
      const dl = new Date(a.deadline)
      dl.setHours(23, 59, 59, 999)
      if (now > dl.getTime()) return 'overdue'
    }
    return 'pending'
  }

  const filtered = assignments.filter(a => {
    const s = getStatus(a)
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'pending' ? (s === 'pending' || s === 'overdue') :
      filter === 'completed' ? s === 'completed' : true

    const q = search.toLowerCase()
    const matchesSearch = !q || a.scenario?.persona_name?.toLowerCase().includes(q)
    return matchesFilter && matchesSearch
  })

  const counts = {
    all: assignments.length,
    pending: assignments.filter(a => { const s = getStatus(a); return s === 'pending' || s === 'overdue' }).length,
    completed: assignments.filter(a => getStatus(a) === 'completed').length,
  }

  const statusBadge = (a: any) => {
    const s = getStatus(a)
    if (s === 'completed') return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-green-50 text-green-700 uppercase tracking-wider">Completed</span>
    if (s === 'overdue') return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-50 text-[#ba1a1a] uppercase tracking-wider">Overdue</span>
    return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 uppercase tracking-wider">Pending</span>
  }

  const TABS: { id: Filter; label: string }[] = [
    { id: 'pending', label: 'Active' },
    { id: 'completed', label: 'Completed' },
    { id: 'all', label: 'All' },
  ]

  return (
    <div className="space-y-6 pb-12 font-['Inter'] max-w-[1360px] mx-auto text-[#0b1c30]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B]">Assignments</h1>
          <p className="text-[14px] text-slate-500 mt-1">Complete your required personas and practice scenarios.</p>
        </div>
        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-2 shadow-sm w-full md:w-64 focus-within:border-[#4b41e1] focus-within:ring-2 focus-within:ring-indigo-50 transition-all">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
          </svg>
          <input
            type="text"
            placeholder="Search personas..."
            className="text-[13px] text-[#0b1c30] outline-none bg-transparent w-full placeholder:text-slate-400"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-md w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-4 py-1.5 text-[13px] font-semibold rounded-md transition-all ${
              filter === t.id
                ? 'bg-white text-[#1E293B] shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded-sm ${filter === t.id ? 'bg-[#eff4ff] text-[#4b41e1]' : 'bg-slate-200 text-slate-500'}`}>
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden min-h-[340px]">
        {filtered.length === 0 ? (
          <div className="h-[340px] flex items-center justify-center text-slate-400 text-[13px]">No assignments match this filter.</div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Scenario</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Deadline</th>
                <th className="text-center px-6 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Attempts</th>
                <th className="text-right px-6 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                <th className="text-center px-6 py-3 text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a: any) => {
                const s = getStatus(a)
                const scenario = a.scenario || {}
                const dl = a.deadline ? new Date(a.deadline) : null
                const diffHours = dl ? (dl.getTime() - now) / (1000 * 60 * 60) : null
                const isUrgent = diffHours !== null && diffHours >= 0 && diffHours <= 24

                return (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-[#1E293B]">{scenario.contact_title ? `${scenario.contact_title} - ${scenario.contact_company}` : scenario.persona_name || '—'}</p>
                      {isUrgent && (
                        <span className="text-[11px] text-[#ba1a1a] font-bold animate-pulse">Due in {Math.round(diffHours!)} hrs 🔥</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{statusBadge(a)}</td>
                    <td className="px-6 py-4 text-slate-500">
                      {dl ? dl.toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {Math.min(a.attempts_count ?? a.attemptsCount ?? 0, a.max_attempts ?? a.maxAttempts ?? 3)} / {a.max_attempts ?? a.maxAttempts ?? 3}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {s === 'completed' ? (
                        <span className={`font-bold ${a.score >= 80 ? 'text-green-700' : a.score >= 60 ? 'text-amber-700' : 'text-[#ba1a1a]'}`}>
                          {a.score}%
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {s === 'completed' ? (
                        <button
                          onClick={() => router.push(`/rep/train/${scenario.id}/review?sessionId=${a.session_id}`)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-200 text-[#0b1c30] text-[13px] font-semibold rounded-md hover:bg-slate-50 transition-all"
                        >
                          <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                          Report
                        </button>
                      ) : (a.is_limit_reached || a.isLimitReached) ? (
                        <button
                          onClick={() => router.push(`/rep/train/${scenario.id}/review?sessionId=${a.session_id}`)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white border border-slate-200 text-[#0b1c30] text-[13px] font-semibold rounded-md hover:bg-slate-50 transition-all"
                        >
                          Review & Submit
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push(`/rep/train/${scenario.id}/briefing?assignmentId=${a.id}`)}
                          className={`inline-flex items-center gap-1.5 px-4 py-1.5 text-white text-[13px] font-semibold rounded-md transition-all ${isUrgent ? 'bg-[#ba1a1a] hover:bg-[#93000a]' : 'bg-[#4b41e1] hover:bg-[#3b31cc]'}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                          Start
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
