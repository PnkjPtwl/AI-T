import React, { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, X, ArrowLeft, Search, ChevronDown, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'

function getScenarioDisplayLabel(scenario: { name?: string; contact_title?: string; contact_company?: string }): string {
  return scenario.name || 'Unknown Training'
}

export default function TrainingAnalyticsDrawer({ assignments }: { assignments: any[] }) {
  const router = useRouter()
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  
  // New State for Slider Redesign
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFlags, setStatusFlags] = useState<string[]>([])
  const [expandedReps, setExpandedReps] = useState<Set<string>>(new Set())

  const toggleExpand = (repId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedReps(prev => {
      const next = new Set(prev)
      if (next.has(repId)) next.delete(repId)
      else next.add(repId)
      return next
    })
  }

  const toggleFlag = (flag: string) => {
    setStatusFlags(prev => {
      if (prev.includes(flag)) return prev.filter(f => f !== flag)
      return [...prev, flag]
    })
  }

  // Group assignments by Scenario for the main table
  const scenariosMap: Record<string, { id: string, name: string, assignments: any[], activeCount: number }> = {}
  
  assignments.forEach((a: any) => {
    const scenarioId = a.scenario_id
    if (!scenarioId) return;

    if (!scenariosMap[scenarioId]) {
      scenariosMap[scenarioId] = {
        id: scenarioId,
        name: a.scenario_name || 'Unknown Training',
        assignments: [],
        activeCount: 0
      }
    }
    scenariosMap[scenarioId].assignments.push(a)
    if (a.status !== 'Completed') {
      scenariosMap[scenarioId].activeCount++
    }
  })

  const scenariosArray = Object.values(scenariosMap)
  const selectedScenario = selectedScenarioId ? scenariosMap[selectedScenarioId] : null;

  // Process data for the Drawer
  const groupedReps = useMemo(() => {
    if (!selectedScenario) return []

    // 1. Filter by Status Flags (at attempt level)
    let filteredAttempts = selectedScenario.assignments
    if (statusFlags.length > 0) {
      filteredAttempts = filteredAttempts.filter(a => statusFlags.includes(a.status))
    }

    // 2. Group by Rep
    const repMap: Record<string, any> = {}
    filteredAttempts.forEach(a => {
      if (!repMap[a.rep_id]) {
        repMap[a.rep_id] = {
          id: a.rep_id,
          name: a.rep_name || 'Unknown',
          initials: (a.rep_name || 'U').split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
          attempts: []
        }
      }
      repMap[a.rep_id].attempts.push(a)
    })

    // 3. Filter by Search (at rep level)
    let repList = Object.values(repMap)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      repList = repList.filter(r => r.name.toLowerCase().includes(q))
    }

    // 4. Sort Attempts Chronologically
    repList.forEach(r => {
      r.attempts.sort((a: any, b: any) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    })

    return repList
  }, [selectedScenario, statusFlags, searchQuery])


  // Helpers for Status Colors
  const getStatusColor = (status: string) => {
    if (status === 'Completed') return 'bg-green-500'
    if (status === 'Overdue') return 'bg-red-500'
    if (status === 'Pending') return 'bg-gray-300'
    return 'bg-yellow-500'
  }
  
  const getStatusBgText = (status: string) => {
    if (status === 'Completed') return 'bg-green-100 text-green-700'
    if (status === 'Overdue') return 'bg-red-100 text-red-700'
    if (status === 'Pending') return 'bg-gray-100 text-gray-600'
    return 'bg-yellow-100 text-yellow-700'
  }

  return (
    <>
      {/* Training list table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-sm mt-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <tr>
                <th className="px-6 py-4 font-semibold text-[#64748B] text-xs">Persona</th>
                <th className="px-6 py-4 font-semibold text-[#64748B] text-xs text-center">Assigned</th>
                <th className="px-6 py-4 font-semibold text-[#64748B] text-xs text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-[#64748B] text-xs text-center">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {scenariosArray.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-[#64748B]">
                    No training assignments found.
                  </td>
                </tr>
              ) : (
                scenariosArray.map((scenario) => {
                  const isActive = scenario.activeCount > 0;
                  const completedCount = scenario.assignments.filter(a => a.status === 'Completed').length;

                  return (
                    <tr key={scenario.id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-6 py-5 font-semibold text-[#1A2A3A]">{scenario.name}</td>
                      <td className="px-6 py-5 text-center font-medium text-[#1A2A3A]">{scenario.assignments.length}</td>
                      <td className="px-6 py-5 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-[#64748B]'}`}>
                          {isActive ? `${scenario.activeCount} Active · ${completedCount} Completed` : `All done`}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <button 
                          onClick={() => {
                            setSelectedScenarioId(scenario.id)
                            setSearchQuery('')
                            setStatusFlags([])
                            setExpandedReps(new Set())
                          }}
                          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#2C5282]/30 text-[#2C5282] hover:bg-[#2C5282]/5 transition-colors text-sm font-medium"
                        >
                          <Eye className="w-4 h-4" /> Review
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Slide-Over Drawer */}
      {selectedScenarioId && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Overlay */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedScenarioId(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-[600px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-[#E2E8F0] flex flex-col gap-4 bg-white z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedScenarioId(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors text-[#64748B]"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-lg font-semibold text-[#1A2A3A]">
                      {selectedScenario?.name} — {selectedScenario?.assignments.length} rep{selectedScenario?.assignments.length !== 1 ? 's' : ''}
                    </h2>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedScenarioId(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-[#64748B]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Search & Filters */}
              <div className="flex flex-col gap-3 mt-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search reps..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-[36px] bg-gray-50 border border-gray-200 rounded-[8px] pl-9 pr-3 text-sm focus:outline-none focus:border-[#2C5282] focus:bg-white transition-colors"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'Not started', status: 'Pending', color: 'bg-gray-400' },
                    { label: 'In progress', status: 'In Progress', color: 'bg-yellow-500' },
                    { label: 'Completed', status: 'Completed', color: 'bg-green-500' },
                    { label: 'Overdue', status: 'Overdue', color: 'bg-red-500' }
                  ].map(f => {
                    const isActive = statusFlags.includes(f.status)
                    return (
                      <button 
                        key={f.status}
                        onClick={() => toggleFlag(f.status)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all border ${
                          isActive ? 'bg-gray-800 text-white border-gray-800 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${f.color}`} />
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#F8FAFC]">
              {groupedReps.length === 0 ? (
                <div className="p-12 text-center text-[#64748B] flex flex-col items-center gap-2">
                  <Search className="w-8 h-8 text-gray-300" />
                  <p>No reps match {searchQuery ? `"${searchQuery}"` : 'the active filters'}.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedReps.map((rep) => {
                    const attempts = rep.attempts
                    const isMultiple = attempts.length > 1
                    const isExpanded = expandedReps.has(rep.id)

                    // Compute Summary for Multiple
                    let summaryText = ''
                    let TrendIcon = null
                    let trendColor = ''

                    if (isMultiple) {
                      const allCompleted = attempts.every((a: any) => a.status === 'Completed')
                      if (allCompleted) {
                        const maxScore = Math.max(...attempts.map((a:any) => a.score || 0))
                        summaryText = `${attempts.length} done · best ${maxScore}%`
                        
                        const firstScore = attempts[0].score || 0
                        const lastScore = attempts[attempts.length - 1].score || 0
                        
                        if (lastScore > firstScore) {
                          TrendIcon = TrendingUp
                          trendColor = 'text-green-600'
                        } else if (lastScore < firstScore) {
                          TrendIcon = TrendingDown
                          trendColor = 'text-red-500'
                        } else {
                          TrendIcon = Minus
                          trendColor = 'text-gray-400'
                        }
                      } else {
                        const done = attempts.filter((a:any) => a.status === 'Completed').length
                        const prog = attempts.filter((a:any) => a.status === 'In Progress').length
                        const pend = attempts.filter((a:any) => a.status === 'Pending').length
                        const over = attempts.filter((a:any) => a.status === 'Overdue').length
                        
                        const parts = []
                        if (done) parts.push(`${done} done`)
                        if (prog) parts.push(`${prog} in progress`)
                        if (pend) parts.push(`${pend} pending`)
                        if (over) parts.push(`${over} overdue`)
                        summaryText = parts.join(' · ')
                      }
                    } else {
                      // Single attempt row logic
                      summaryText = `Due: ${new Date(attempts[0].deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    }

                    return (
                      <div key={rep.id} className="bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden transition-all">
                        {/* Main Row */}
                        <div 
                          className={`flex items-center justify-between p-4 ${isMultiple ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                          onClick={(e) => isMultiple ? toggleExpand(rep.id, e) : undefined}
                        >
                          <div className="flex items-center gap-4 w-1/3 min-w-[200px]">
                            {/* Generic Avatar */}
                            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-[#2C5282] text-white shadow-sm flex-shrink-0">
                              {rep.initials}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-[#1A2A3A] truncate">{rep.name}</span>
                              <div className="flex items-center gap-1.5 text-xs text-[#64748B] mt-0.5">
                                {summaryText}
                                {TrendIcon && <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />}
                              </div>
                            </div>
                          </div>

                          {/* Right Side - Dots & Status or Single Status */}
                          <div className="flex items-center gap-4">
                            {isMultiple ? (
                              <>
                                {/* Status Dots */}
                                <div className="flex items-center gap-1.5">
                                  {attempts.slice(0, 3).map((a: any, idx: number) => (
                                    <div 
                                      key={idx}
                                      className={`w-2 h-2 rounded-full ${getStatusColor(a.status)}`}
                                      title={`${a.status === 'Pending' ? 'Not started' : a.status === 'In Progress' ? 'In progress' : a.status === 'Overdue' ? 'Missed' : a.status}${a.score !== null && a.status === 'Completed' ? ` (${a.score}%)` : ''}`}
                                    />
                                  ))}
                                  {attempts.length > 3 && (
                                    <span className="text-[10px] font-bold text-[#64748B] ml-0.5">+{attempts.length - 3}</span>
                                  )}
                                </div>
                                <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </>
                            ) : (
                              // Single Attempt Action/Status
                              <>
                                {attempts[0].status === 'Completed' && (
                                  <span className="text-sm font-medium text-[#64748B]">Score: {attempts[0].score || 0}%</span>
                                )}
                                <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${getStatusBgText(attempts[0].status)}`}>
                                  {attempts[0].status === 'Pending' ? 'Not started' : attempts[0].status === 'In Progress' ? 'In progress' : attempts[0].status === 'Overdue' ? 'Missed' : attempts[0].status}
                                </span>
                              </>
                            )}

                            {/* Stats Link Chevron */}
                            {attempts.some((a: any) => a.status === 'Completed') && (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/reps/${rep.id}?persona=${encodeURIComponent(selectedScenario?.name || '')}`)
                                }}
                                className="p-1.5 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer ml-2 text-blue-600 hover:text-blue-700"
                                title="View Rep Stats"
                              >
                                <ArrowRight className="w-4 h-4 stroke-[2.5px]" />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expanded Sub-rows */}
                        {isMultiple && isExpanded && (
                          <div className="bg-gray-50/50 border-t border-gray-100 p-2 space-y-1">
                            {attempts.map((a: any, idx: number) => (
                              <div 
                                key={idx} 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/reps/${a.rep_id}?persona=${encodeURIComponent(selectedScenario?.name || '')}`)
                                }}
                                className="flex items-center justify-between py-2 px-4 ml-[40px] rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-gray-200"
                              >
                                <div className="text-sm text-gray-600">
                                  Due: {new Date(a.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                                <div className="flex items-center gap-4">
                                  {a.status === 'Completed' && (
                                    <span className="text-sm font-medium text-[#64748B]">Score: {a.score || 0}%</span>
                                  )}
                                  <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${getStatusBgText(a.status)}`}>
                                    {a.status === 'Pending' ? 'Not started' : a.status === 'In Progress' ? 'In progress' : a.status === 'Overdue' ? 'Missed' : a.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
