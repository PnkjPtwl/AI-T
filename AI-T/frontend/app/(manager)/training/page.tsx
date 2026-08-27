'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, ClipboardList } from 'lucide-react'
import AssignTrainingWizard from '@/components/manager/AssignTrainingWizard'
import AssignmentDetailsSidebar from '@/components/manager/AssignmentDetailsSidebar'
import ReassignModal from '@/components/manager/ReassignModal'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function ManagerTrainingPage() {
  const [reps, setReps] = useState<any[]>([])
  const [scenarios, setScenarios] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modals & Sidebars
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [wizardInitialData, setWizardInitialData] = useState<any>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null)
  const [isReassignOpen, setIsReassignOpen] = useState(false)
  const [selectedReassignAssignment, setSelectedReassignAssignment] = useState<any>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [modeFilter, setModeFilter] = useState('All')
  const [sortBy, setSortBy] = useState<'default' | 'score-desc' | 'score-asc'>('default')

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const headers = { Authorization: `Bearer ${token}` }

      const [repsRes, scenariosRes, assignmentsRes] = await Promise.all([
        fetch(`${API}/api/users/reps`, { headers }),
        fetch(`${API}/api/scenarios`, { headers }),
        fetch(`${API}/api/users/team-assignments`, { headers })
      ])

      if (repsRes.ok) setReps(await repsRes.json())
      if (scenariosRes.ok) setScenarios(await scenariosRes.json())
      if (assignmentsRes.ok) setAssignments(await assignmentsRes.json())
    } catch (err) {
      console.error('[ManagerTraining] Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredAssignments = useMemo(() => {
    let result = [...assignments]
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        a =>
          (a.rep_name?.toLowerCase() || '').includes(term) ||
          (a.scenario_name?.toLowerCase() || '').includes(term) ||
          (a.persona_name?.toLowerCase() || '').includes(term)
      )
    }
    if (statusFilter !== 'All') {
      result = result.filter(a => (a.status || '').toLowerCase() === statusFilter.toLowerCase())
    }
    if (modeFilter !== 'All') {
      result = result.filter(a => (a.training_mode || a.trainingMode || 'Coach Mode').toLowerCase() === modeFilter.toLowerCase())
    }

    if (sortBy === 'score-desc') {
      result.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    } else if (sortBy === 'score-asc') {
      result.sort((a, b) => {
        if (a.score === null || a.score === undefined) return 1
        if (b.score === null || b.score === undefined) return -1
        return a.score - b.score
      })
    }
    return result
  }, [assignments, searchTerm, statusFilter, modeFilter, sortBy])

  const handleRowClick = (assign: any) => {
    setSelectedAssignment(assign)
    setIsSidebarOpen(true)
  }

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#1E1B4B]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12 font-['Plus_Jakarta_Sans'] max-w-[1360px] mx-auto text-sm">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">Training Management</h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Monitor, assign, and review training assignments across your entire sales organization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsWizardOpen(true)}
            className="px-5 py-2.5 bg-[#1E1B4B] hover:bg-[#2E2A72] text-white text-sm font-medium rounded-xl shadow-md transition-colors flex items-center gap-2 group"
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Assign Training</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by sales rep, scenario, or persona..."
            className="w-full max-w-sm h-10 bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1E1B4B]"
          />
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#64748B]">Sort:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="h-9 bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm font-medium text-[#1E293B] focus:outline-none"
            >
              <option value="default">Default (Latest)</option>
              <option value="score-desc">Score: High to Low</option>
              <option value="score-asc">Score: Low to High</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#64748B]">Mode:</span>
            <select
              value={modeFilter}
              onChange={e => setModeFilter(e.target.value)}
              className="h-9 bg-gray-50 border border-gray-200 rounded-xl px-3 text-sm font-medium text-[#1E293B] focus:outline-none"
            >
              <option value="All">All Modes</option>
              <option value="Exam Mode">Exam Mode</option>
              <option value="Coach Mode">Coach Mode</option>
              <option value="Learning Mode">Learning Mode</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#64748B]">Status:</span>
            {(['All', 'In Progress', 'Completed', 'Overdue', 'Pending'] as const).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                  statusFilter === st
                    ? 'bg-[#1E1B4B] text-white shadow-sm font-medium'
                    : 'bg-gray-50 text-[#64748B] border border-gray-200 hover:bg-gray-100 font-normal'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Assignments Data Table (Figma media__1785585971677.png) */}
      <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
            <tr>
              <th className="p-4 font-semibold">SALES REP</th>
              <th className="p-4 font-semibold">SCENARIO & PERSONA</th>
              <th className="p-4 font-semibold">MODE</th>
              <th className="p-4 font-semibold">PRIORITY</th>
              <th className="p-4 font-semibold">DUE DATE</th>
              <th className="p-4 font-semibold">SCORE</th>
              <th className="p-4 font-semibold">STATUS</th>
              <th className="p-4 font-semibold text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-[#334155]">
            {filteredAssignments.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-[#64748B]">
                  <div className="flex flex-col items-center gap-3">
                    <ClipboardList className="w-8 h-8 text-gray-400" />
                    <p className="font-medium text-sm text-[#1E293B]">No assignments found</p>
                    <p className="text-sm">Create a new assignment using the &quot;Assign Training&quot; button above.</p>
                  </div>
                </td>
              </tr>
            ) : filteredAssignments.map((assign: any) => {
              let badge = (
                <span className="text-amber-600 font-medium">
                  ● {assign.status || 'In Progress'}
                </span>
              )
              if (assign.status === 'Completed') {
                badge = (
                  <span className="text-green-600 font-medium">
                    ● Completed
                  </span>
                )
              } else if (assign.status === 'Overdue') {
                badge = (
                  <span className="text-red-600 font-medium">
                    ● Overdue
                  </span>
                )
              }

              return (
                <tr
                  key={assign.id}
                  onClick={() => handleRowClick(assign)}
                  className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                >
                  <td className="p-4">
                    <span className="font-semibold text-[15px] text-[#1E293B]">{assign.rep_name || 'Sales Rep'}</span>
                  </td>

                  <td className="p-4">
                    <p className="font-medium text-[#1E293B]">{assign.scenario_name || assign.scenario?.persona_name || 'Technical Discovery'}</p>
                    <p className="text-xs text-[#64748B]">{assign.persona_name || assign.scenario?.persona_name || 'Prospect'} · {assign.company || assign.scenario?.contact_company || 'Company'}</p>
                  </td>

                  <td className="p-4">
                    <span className="text-[#64748B]">
                      {assign.training_mode || assign.trainingMode || 'Coach Mode'}
                    </span>
                  </td>

                  <td className={`p-4 font-medium ${
                    (assign.priority || 'High') === 'High' ? 'text-red-600' :
                    (assign.priority || 'High') === 'Medium' ? 'text-orange-500' :
                    'text-emerald-600'
                  }`}>
                    {assign.priority || 'High'}
                  </td>

                  <td className="p-4 text-[#64748B]">{assign.deadline ? new Date(assign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No Due Date'}</td>

                  <td className="p-4">
                    {assign.score ? (
                      <span className="font-semibold text-[#1E1B4B]">{Math.round(assign.score)}%</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>

                  <td className="p-4">{badge}</td>

                  <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedReassignAssignment(assign)
                          setIsReassignOpen(true)
                        }}
                        className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs rounded-xl transition-colors"
                      >
                        Reassign
                      </button>
                      <button
                        onClick={() => handleRowClick(assign)}
                        className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-[#334155] font-medium text-xs rounded-xl transition-colors"
                      >
                        Details →
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Assignment Details Slide-over Sidebar (Figma media__1785585971677.png) */}
      <AssignmentDetailsSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        assignment={selectedAssignment}
        onMarkComplete={() => fetchData()}
        onReassign={(id) => {
          if (selectedAssignment) {
            setWizardInitialData({
              scenarioId: selectedAssignment.scenario_id,
              repId: selectedAssignment.rep_id,
              mode: selectedAssignment.mode,
              priority: selectedAssignment.priority
            })
          }
          setIsSidebarOpen(false)
          setIsWizardOpen(true)
        }}
      />

      {/* Assign Training 4-Step Wizard Modal */}
      <AssignTrainingWizard
        isOpen={isWizardOpen}
        onClose={() => {
          setIsWizardOpen(false)
          setWizardInitialData(null)
        }}
        scenarios={scenarios}
        reps={reps}
        onSuccess={() => fetchData()}
        initialData={wizardInitialData}
      />

      {/* Reassign Modal */}
      <ReassignModal
        isOpen={isReassignOpen}
        onClose={() => {
          setIsReassignOpen(false)
          setSelectedReassignAssignment(null)
        }}
        assignment={selectedReassignAssignment}
        onSuccess={() => fetchData()}
      />
    </div>
  )
}
