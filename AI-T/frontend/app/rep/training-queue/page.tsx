'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ListChecks } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

type StatusTab = 'All' | 'In Progress' | 'Not Started' | 'Overdue'

export default function TrainingQueuePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<any[]>([])
  const [filterTab, setFilterTab] = useState<StatusTab>('All')
  const [quickFilter, setQuickFilter] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch(`${API}/api/reps/me/dashboard`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setAssignments(data?.assignments || [])
        }
      } catch (err) {
        console.error('Failed to load training queue', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[#1E293B]"></div>
      </div>
    )
  }

  // Only show non-completed assignments
  const activeAssignments = assignments.filter(
    (a: any) => a.status !== 'Completed'
  )

  const filteredAssignments = activeAssignments.filter((item: any) => {
    if (filterTab !== 'All' && item.status !== filterTab) return false
    if (quickFilter === 'Today' && !item.lastAttemptText?.includes('today')) return false
    if (quickFilter === 'Overdue' && item.status !== 'Overdue') return false
    if (quickFilter === 'High Priority' && item.priority !== 'High') return false
    if (quickFilter === 'Advanced' && item.difficulty !== 'Advanced') return false
    return true
  })

  const countByStatus = (status: string) =>
    activeAssignments.filter((a: any) => a.status === status).length

  return (
    <div className="space-y-8 pb-12 font-['Inter'] max-w-[1360px] mx-auto text-[#0b1c30]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B] tracking-tight flex items-center gap-3">
            <ListChecks className="w-6 h-6 text-[#4b41e1]" />
            Training Queue
          </h1>
          <p className="text-[14px] text-slate-500 font-medium mt-1">
            Your active, in-progress, and overdue training sessions.
          </p>
        </div>
        <span className="text-[13px] text-slate-500 font-semibold bg-white border border-slate-200 px-3 py-1.5 rounded-md shadow-sm">
          {filteredAssignments.length} of {activeAssignments.length} shown
        </span>
      </div>

      {/* Status Tabs + Quick Filters */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-4 overflow-x-auto">
          {(['All', 'In Progress', 'Not Started', 'Overdue'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold whitespace-nowrap transition-colors border ${
                filterTab === tab
                  ? 'bg-[#1E293B] text-white border-[#1E293B]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab}
              {tab !== 'All' && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-sm font-bold ${
                  filterTab === tab ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab === 'In Progress' ? countByStatus('In Progress') :
                   tab === 'Not Started' ? countByStatus('Not Started') :
                   countByStatus('Overdue')}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[13px] overflow-x-auto pb-1">
          <span className="font-semibold text-slate-500 mr-2">Quick:</span>
          {['Today', 'Overdue', 'High Priority', 'Advanced', 'Due This Week'].map((pill) => (
            <button
              key={pill}
              onClick={() => setQuickFilter(quickFilter === pill ? null : pill)}
              className={`px-3 py-1.5 rounded-md border text-[12px] font-medium transition-colors ${
                quickFilter === pill
                  ? 'bg-[#eff4ff] text-[#4b41e1] border-[#c3c0ff]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {pill}
            </button>
          ))}
        </div>
      </div>

      {/* Assignment Cards */}
      {filteredAssignments.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-16 text-center shadow-sm">
          <ListChecks className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-[#1E293B]">No assignments found</p>
          <p className="text-[13px] text-slate-500 mt-1">Adjust your filters or check back later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssignments.map((assign: any) => {
            let statusClass = 'bg-slate-50 text-slate-700 border-slate-200'
            if (assign.status === 'Overdue') statusClass = 'bg-red-50 text-[#ba1a1a] border-[#ffdad6]'
            else if (assign.status === 'In Progress') statusClass = 'bg-[#eff4ff] text-[#4b41e1] border-[#c3c0ff]'

            return (
              <div
                key={assign.id}
                onClick={() => {
                  if (assign.isLimitReached && assign.status !== 'In Progress') {
                    alert(`Maximum attempt limit reached for this training.`)
                    return
                  }
                  router.push(`/rep/train/${assign.scenarioId}/briefing?${assign.id ? `assignmentId=${assign.id}&` : ''}mode=${encodeURIComponent(assign.trainingMode || 'Coach Mode')}`)
                }}
                className={`bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 group ${assign.isLimitReached && assign.status !== 'In Progress' ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1E293B] text-white font-bold text-[13px] flex items-center justify-center">
                        {assign.personaName?.substring(0, 2).toUpperCase() || 'SC'}
                      </div>
                      <div>
                        <h3 className="font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B] text-[15px] group-hover:text-[#4b41e1] transition-colors">
                          {assign.personaName}
                        </h3>
                        <p className="text-[12px] text-slate-500">{assign.roleTitle}</p>
                        <p className="text-[11px] font-semibold text-[#4b41e1]">{assign.company}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border uppercase tracking-wider ${statusClass}`}>
                      {assign.status}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-semibold text-[#1E293B] text-[14px]">{assign.title}</h4>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(assign.tags || []).map((tag: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 bg-slate-50 border border-slate-100 text-slate-600 text-[11px] font-medium rounded-md">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[13px] pt-4 border-t border-slate-100">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">DIFFICULTY</p>
                      <p className={`font-semibold ${
                        assign.difficulty === 'beginner' ? 'text-emerald-700' :
                        assign.difficulty === 'intermediate' ? 'text-amber-700' : 'text-red-700'
                      }`}>{assign.difficulty}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">DURATION</p>
                      <p className="font-semibold text-[#1E293B]">{assign.durationMins} min</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[13px]">
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">DUE DATE</p>
                      <p className="font-medium text-[#1E293B]">{assign.dueDate}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">AVG SCORE</p>
                      <p className="font-bold text-[#1E293B]">
                        {assign.avgScore ? `${assign.avgScore} /100` : 'Not attempted'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[12px] text-slate-500">
                  <span>{assign.lastAttemptText}</span>
                  <span className="text-[#4b41e1] font-semibold group-hover:translate-x-1 transition-transform">
                    {assign.isLimitReached && assign.status !== 'In Progress' ? (
                      <span className="text-slate-400 font-semibold">Limit Reached</span>
                    ) : assign.status === 'In Progress' ? (
                      assign.hasPausedSession ? 'Resume →' : `Try Again (${assign.attemptsCount ?? 0}/${assign.maxAttempts ?? 5}) →`
                    ) : (
                      `Start (${assign.attemptsCount ?? 0}/${assign.maxAttempts ?? 5}) →`
                    )}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

