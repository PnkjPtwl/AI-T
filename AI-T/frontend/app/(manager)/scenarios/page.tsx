'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Share, Search, FileText } from 'lucide-react'
import PersonaDetailsSidebar from '@/components/manager/PersonaDetailsSidebar'
import AssignTrainingWizard from '@/components/manager/AssignTrainingWizard'
import SharePersonaModal from '@/components/manager/SharePersonaModal'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function ManagerScenariosPage() {
  const router = useRouter()
  const [scenarios, setScenarios] = useState<any[]>([])
  const [reps, setReps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPersona, setSelectedPersona] = useState<any>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // Assign Training Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [wizardScenarioId, setWizardScenarioId] = useState('')

  const [searchTerm, setSearchTerm] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('All')

  // Share modal state
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [shareScenario, setShareScenario] = useState<any>(null)

  const fetchScenariosAndReps = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const headers = { Authorization: `Bearer ${token}` }

      const [scenRes, repsRes] = await Promise.all([
        fetch(`${API}/api/scenarios`, { headers }),
        fetch(`${API}/api/users/reps`, { headers })
      ])

      if (scenRes.ok) setScenarios(await scenRes.json())
      if (repsRes.ok) setReps(await repsRes.json())
    } catch (err) {
      console.error('Failed to fetch scenarios', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScenariosAndReps()
  }, [])

  const filteredScenarios = useMemo(() => {
    let result = [...scenarios]
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        s =>
          (s.persona_name?.toLowerCase() || '').includes(term) ||
          (s.contact_title?.toLowerCase() || '').includes(term) ||
          (s.contact_company?.toLowerCase() || '').includes(term)
      )
    }
    if (difficultyFilter !== 'All') {
      result = result.filter(s => (s.difficulty || '').toLowerCase() === difficultyFilter.toLowerCase())
    }
    
    // Sort by latest created by default
    result.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
      return dateB - dateA
    })
    
    return result
  }, [scenarios, searchTerm, difficultyFilter])

  const handleOpenDetails = (scenario: any) => {
    setSelectedPersona(scenario)
    setIsSidebarOpen(true)
  }

  const handleAssignClick = (scenarioId: string) => {
    setWizardScenarioId(scenarioId)
    setIsWizardOpen(true)
  }

  const handleShareClick = (scenario: any) => {
    setShareScenario(scenario)
    setIsShareOpen(true)
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
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">Persona Library</h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            Browse, manage, and assign AI training personas to your sales representatives.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/scenarios/new"
            className="px-5 py-2.5 bg-[#1E1B4B] hover:bg-[#2E2A72] text-white text-sm font-medium rounded-xl shadow-md transition-colors flex items-center gap-2 group"
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Create New Persona</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by persona, role, or company..."
            className="w-full max-w-sm h-10 bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 text-sm text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1E1B4B]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#64748B]">Difficulty:</span>
          {(['All', 'Beginner', 'Intermediate', 'Advanced'] as const).map(diff => (
            <button
              key={diff}
              onClick={() => setDifficultyFilter(diff)}
              className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
                difficultyFilter === diff
                  ? 'bg-[#1E1B4B] text-white shadow-sm font-medium'
                  : 'bg-gray-50 text-[#64748B] border border-gray-200 hover:bg-gray-100 font-normal'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>
      </div>

      {/* Persona Data Table (Figma media__1785585779255.png) */}
      <div className="bg-white border border-gray-200/80 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-[#64748B] uppercase tracking-wider">
            <tr>
              <th className="p-4 font-semibold">PERSONA</th>
              <th className="p-4 font-semibold">ROLE & COMPANY</th>
              <th className="p-4 font-semibold">DIFFICULTY</th>
              <th className="p-4 font-semibold">SCORECARD</th>
              <th className="p-4 font-semibold">USAGE</th>
              <th className="p-4 font-semibold">LAST UPDATED</th>
              <th className="p-4 font-semibold text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-[#334155]">
            {filteredScenarios.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-[#64748B]">
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="w-8 h-8 text-gray-400" />
                    <p className="font-medium text-sm text-[#1E293B]">No personas found</p>
                    <p className="text-sm">Create your first training persona to get started.</p>
                  </div>
                </td>
              </tr>
            ) : filteredScenarios.map((sc: any) => {
              const metricsCount = typeof sc.metrics_count === 'number'
                ? sc.metrics_count
                : Array.isArray(sc.scorecard_metrics) ? sc.scorecard_metrics.length : 0
              const assignedCount = typeof sc.assigned_count === 'number' ? sc.assigned_count : 0
              const updatedAgo = sc.updated_ago || 'Recently'
              return (
              <tr
                key={sc.id}
                onClick={() => handleOpenDetails(sc)}
                className="hover:bg-gray-50/80 transition-colors cursor-pointer"
              >
                <td className="p-4 flex items-center gap-2">
                  <span className="font-semibold text-[15px] text-[#1E293B]">{sc.persona_name || sc.contact_title || 'Unnamed'}</span>
                  {sc.is_shared && (
                    <span className="ml-2 text-purple-600 text-[10px] font-medium uppercase tracking-wider">
                      (Shared)
                    </span>
                  )}
                </td>
                <td className="p-4">
                  <p className="font-medium text-[#1E293B]">{sc.contact_title || '—'}</p>
                  <p className="text-xs text-[#64748B]">{sc.contact_company || '—'}</p>
                </td>
                <td className="p-4">
                  <span className="text-[#64748B]">
                    {sc.difficulty || 'N/A'}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-[#64748B]">
                    {metricsCount} Metric{metricsCount !== 1 ? 's' : ''}
                  </span>
                </td>
                <td className="p-4">
                  <span className="text-[#64748B]">
                    {assignedCount > 0 ? `Assigned ${assignedCount}x` : 'Not assigned'}
                  </span>
                </td>
                <td className="p-4 text-[#64748B]">{updatedAgo}</td>
                <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2 justify-end">
                    {!sc.is_shared && (
                      <button
                        onClick={() => handleShareClick(sc)}
                        className="p-2 text-[#64748B] hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-all"
                        title="Share with other managers"
                      >
                        <Share className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleAssignClick(sc.id)}
                      className="px-3.5 py-1.5 bg-[#1E1B4B] hover:bg-[#2E2A72] text-white font-medium text-xs rounded-xl shadow-xs transition-colors"
                    >
                      Assign
                    </button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* Persona Details Slide-over Sidebar (Figma media__1785585779255.png) */}
      <PersonaDetailsSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        persona={selectedPersona}
        onAssign={scenarioId => {
          setIsSidebarOpen(false)
          handleAssignClick(scenarioId)
        }}
        onEdit={scenarioId => router.push(`/scenarios/new?edit=${scenarioId}`)}
        onDuplicate={scenarioId => router.push(`/scenarios/new?duplicate=${scenarioId}`)}
      />

      {/* Assign Training 4-Step Wizard Modal */}
      <AssignTrainingWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        scenarios={scenarios}
        reps={reps}
        initialScenarioId={wizardScenarioId}
        onSuccess={() => fetchScenariosAndReps()}
      />

      {/* Share Persona Modal */}
      <SharePersonaModal
        isOpen={isShareOpen}
        onClose={() => {
          setIsShareOpen(false)
          fetchScenariosAndReps()
        }}
        scenario={shareScenario}
      />
    </div>
  )
}
