'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function TrainingPage() {
  const router = useRouter()
  const [reps, setReps] = useState<any[]>([])
  const [scenarios, setScenarios] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = useState('')
  const [deadline, setDeadline] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [avatarType, setAvatarType] = useState('female')
  const [assigning, setAssigning] = useState(false)
  const [success, setSuccess] = useState('')
  const [showRepDropdown, setShowRepDropdown] = useState(false)
  const [assignmentToDelete, setAssignmentToDelete] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'status', direction: 'asc' })

  // Filter States
  const [filterReps, setFilterReps] = useState<string[]>([])
  const [filterPersonas, setFilterPersonas] = useState<string[]>([])
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const [repSearchText, setRepSearchText] = useState('')
  const [personaSearchText, setPersonaSearchText] = useState('')
  const [activeFilterTab, setActiveFilterTab] = useState<'reps' | 'personas' | 'status'>('reps')
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false)
      }
    }
    if (isFilterMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isFilterMenuOpen])

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const headers = { 'Authorization': `Bearer ${token}` }
      
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
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    setDeadline(nextWeek.toISOString().split('T')[0])

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const statusParam = params.get('status')
      if (statusParam) {
        setFilterStatuses([statusParam])
      }
    }
  }, [])

  const handleAssign = async () => {
    if (selectedRepIds.length === 0 || !selectedScenarioId || !deadline) return
    setAssigning(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/users/assign-training`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ repIds: selectedRepIds, scenarioId: selectedScenarioId, deadline, priority, avatarType })
      })
      if (res.ok) {
        setSuccess('Training assigned successfully.')
        setShowAssignModal(false)
        setSelectedRepIds([])
        fetchData()
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err) {
      console.error('Assignment failed', err)
    } finally {
      setAssigning(false)
    }
  }

  const handleDelete = (id: string) => {
    setAssignmentToDelete(id)
  }

  const handleDeleteConfirm = async () => {
    if (!assignmentToDelete) return;
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/users/assignments/${assignmentToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) fetchData()
    } catch (err) {
      console.error('Delete failed', err)
    } finally {
      setAssignmentToDelete(null)
    }
  }
  const statusColor: Record<string, string> = {
    'Completed': 'text-green-600',
    'Overdue': 'text-red-600',
    'In Progress': 'text-yellow-600',
    'Pending': 'text-gray-500',
  }

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const getSortedAssignments = (assigns: any[]) => {
    const filtered = assigns.filter(a => {
      const matchRep = filterReps.length === 0 || filterReps.includes(a.rep_id);
      const matchPersona = filterPersonas.length === 0 || filterPersonas.includes(a.scenario_id);
      const matchStatus = filterStatuses.length === 0 || filterStatuses.includes(a.status);
      return matchRep && matchPersona && matchStatus;
    })
    if (!sortConfig) return filtered

    return [...filtered].sort((a, b) => {
      if (sortConfig.key === 'rep') {
        return sortConfig.direction === 'asc' ? a.rep_name.localeCompare(b.rep_name) : b.rep_name.localeCompare(a.rep_name)
      }
      if (sortConfig.key === 'scenario') {
        return sortConfig.direction === 'asc' ? a.scenario_name.localeCompare(b.scenario_name) : b.scenario_name.localeCompare(a.scenario_name)
      }
      if (sortConfig.key === 'status') {
        const statusOrder: Record<string, number> = { 'Pending': 1, 'In Progress': 2, 'Completed': 3 }
        const valA = statusOrder[a.status] || 4
        const valB = statusOrder[b.status] || 4
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA
      }
      if (sortConfig.key === 'deadline') {
        const dateA = new Date(a.deadline).getTime()
        const dateB = new Date(b.deadline).getTime()
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA
      }
      return 0
    })
  }

  const renderSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <svg className="w-4 h-4 ml-1 inline text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>
    return sortConfig.direction === 'asc' 
      ? <svg className="w-4 h-4 ml-1 inline text-[#2C5282]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
      : <svg className="w-4 h-4 ml-1 inline text-[#2C5282]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2C5282]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-[24px] pb-[48px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-[16px]">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Training Management</h1>
          <p className="text-base text-gray-500 mt-1">Deploy and monitor team training assignments.</p>
        </div>
        <button 
          onClick={() => {
            setSelectedRepIds([])
            setSelectedScenarioId('')
            setShowAssignModal(true)
          }}
          className="bg-[#2C5282] text-white font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-[#1A365D] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-[8px]"
        >
          <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Assign Persona
        </button>
      </div>

      {success && (
        <div className="p-[16px] bg-green-50 border border-green-200 rounded-[10px] text-green-700 text-[14px] font-[500]">
          {success}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[24px]">
        <div className="bg-white border border-gray-900/10 rounded-[12px] p-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-900/70">Active Assignments</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{assignments.filter(a => a.status !== 'Completed').length}</p>
        </div>
        <div className="bg-white border border-gray-900/10 rounded-[12px] p-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-900/70">Total Assignments</p>
          <p className="text-3xl font-bold text-[#2C5282] mt-2">{assignments.length}</p>
        </div>
        <div className="bg-white border border-gray-900/10 rounded-[12px] p-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <p className="text-sm font-semibold uppercase tracking-wider text-gray-900/70">Success Rate</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {assignments.length > 0 ? Math.round((assignments.filter(a => a.status === 'Completed').length / assignments.length) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Assignment Table */}
      <div className="bg-white border border-gray-900/10 rounded-[12px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)] min-h-[450px] flex flex-col">
        <div className="px-[24px] py-[16px] border-b border-gray-900/10 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Assignment Tracking</h2>
          
          {/* Multi-select Filter */}
          <div className="relative" ref={filterRef}>
            <button 
              onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              className="flex items-center gap-2 h-[36px] bg-white border border-[#E2E8F0] rounded-[8px] px-[16px] text-sm font-medium text-[#1A2A3A] hover:bg-gray-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
              Filter
              {(filterReps.length > 0 || filterPersonas.length > 0 || filterStatuses.length > 0) && (
                <span className="ml-1 bg-[#2C5282] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {filterReps.length + filterPersonas.length + filterStatuses.length}
                </span>
              )}
            </button>

            {isFilterMenuOpen && (
              <div className="absolute right-0 mt-2 w-[480px] bg-white border border-[#E2E8F0] rounded-[12px] shadow-xl z-10 overflow-hidden flex flex-col h-[350px]">
                <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-semibold text-gray-900 text-sm">Filters</h3>
                  <button onClick={() => { setFilterReps([]); setFilterPersonas([]); setFilterStatuses([]); setRepSearchText(''); setPersonaSearchText(''); }} className="text-xs font-semibold text-[#2C5282] hover:underline">Clear all</button>
                </div>
                
                <div className="flex flex-1 overflow-hidden">
                  {/* Left Sidebar */}
                  <div className="w-[140px] bg-gray-50/30 border-r border-gray-100 flex flex-col p-2 space-y-1">
                    <button onClick={() => setActiveFilterTab('reps')} className={`text-left px-3 py-2 text-sm rounded-md transition-colors ${activeFilterTab === 'reps' ? 'bg-white font-bold shadow-sm border border-gray-100 text-[#2C5282]' : 'text-gray-600 hover:bg-gray-100'}`}>Representatives</button>
                    <button onClick={() => setActiveFilterTab('personas')} className={`text-left px-3 py-2 text-sm rounded-md transition-colors ${activeFilterTab === 'personas' ? 'bg-white font-bold shadow-sm border border-gray-100 text-[#2C5282]' : 'text-gray-600 hover:bg-gray-100'}`}>Personas</button>
                    <button onClick={() => setActiveFilterTab('status')} className={`text-left px-3 py-2 text-sm rounded-md transition-colors ${activeFilterTab === 'status' ? 'bg-white font-bold shadow-sm border border-gray-100 text-[#2C5282]' : 'text-gray-600 hover:bg-gray-100'}`}>Status</button>
                  </div>
                  
                  {/* Right Content Area */}
                  <div className="flex-1 flex flex-col p-4 overflow-hidden">
                    {activeFilterTab === 'reps' && (
                      <>
                        <input type="text" placeholder="Search reps..." value={repSearchText} onChange={(e) => setRepSearchText(e.target.value)} className="w-full h-[32px] border border-gray-200 rounded-[6px] px-3 text-sm mb-3 focus:outline-none focus:border-[#2C5282] flex-shrink-0" />
                        <div className="overflow-y-auto space-y-2 pr-2">
                          {reps.filter(r => r.name.toLowerCase().includes(repSearchText.toLowerCase())).map(rep => (
                            <label key={rep.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={filterReps.includes(rep.id)} onChange={(e) => {
                                if (e.target.checked) setFilterReps([...filterReps, rep.id])
                                else setFilterReps(filterReps.filter(id => id !== rep.id))
                              }} className="rounded border-gray-300 text-[#2C5282] focus:ring-[#2C5282]" />
                              {rep.name}
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                    
                    {activeFilterTab === 'personas' && (
                      <>
                        <input type="text" placeholder="Search personas..." value={personaSearchText} onChange={(e) => setPersonaSearchText(e.target.value)} className="w-full h-[32px] border border-gray-200 rounded-[6px] px-3 text-sm mb-3 focus:outline-none focus:border-[#2C5282] flex-shrink-0" />
                        <div className="overflow-y-auto space-y-2 pr-2">
                          {scenarios.filter(s => (s.display_label || s.persona_name).toLowerCase().includes(personaSearchText.toLowerCase())).map(scenario => (
                            <label key={scenario.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={filterPersonas.includes(scenario.id)} onChange={(e) => {
                                if (e.target.checked) setFilterPersonas([...filterPersonas, scenario.id])
                                else setFilterPersonas(filterPersonas.filter(id => id !== scenario.id))
                              }} className="rounded border-gray-300 text-[#2C5282] focus:ring-[#2C5282]" />
                              {scenario.display_label || scenario.persona_name}
                            </label>
                          ))}
                        </div>
                      </>
                    )}

                    {activeFilterTab === 'status' && (
                      <div className="overflow-y-auto space-y-2 pr-2">
                        {['Pending', 'In Progress', 'Completed', 'Overdue'].map(status => (
                          <label key={status} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                            <input type="checkbox" checked={filterStatuses.includes(status)} onChange={(e) => {
                              if (e.target.checked) setFilterStatuses([...filterStatuses, status])
                              else setFilterStatuses(filterStatuses.filter(s => s !== status))
                            }} className="rounded border-gray-300 text-[#2C5282] focus:ring-[#2C5282]" />
                            {status}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {assignments.length === 0 ? (
          <div className="p-[64px] text-center text-base text-gray-500">No assignments yet. Click "Assign Persona" to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-900/10 bg-gray-50/30">
                  <th className="text-left px-[24px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('rep')}>Rep {renderSortIcon('rep')}</th>
                  <th className="text-left px-[24px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('scenario')}>Persona {renderSortIcon('scenario')}</th>
                  <th className="text-left px-[24px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('status')}>Status {renderSortIcon('status')}</th>
                  <th className="text-left px-[24px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('deadline')}>Deadline {renderSortIcon('deadline')}</th>
                  <th className="text-center px-[24px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider whitespace-nowrap">Score</th>
                  <th className="text-center px-[16px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider w-[60px]">View</th>
                  <th className="text-center px-[16px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider w-[60px]">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-900/5">
                {getSortedAssignments(assignments).map((assign) => (
                  <tr key={assign.id} className="hover:bg-gray-50/50 transition-colors duration-150">
                    <td className="px-[24px] py-[16px]">
                      <p className="font-[500] text-gray-900 text-[14px] md:text-[15px]">{assign.rep_name}</p>
                    </td>
                    <td className="px-[24px] py-[16px]">
                      <p className="font-[500] text-gray-900 text-[14px] md:text-[15px]">{assign.scenario_name}</p>
                    </td>
                    <td className="px-[24px] py-[16px]">
                      <span className={`text-[12px] font-[600] tracking-[0.6px] uppercase ${statusColor[assign.status] || 'text-gray-500'}`}>
                        {assign.status}
                      </span>
                    </td>
                    <td className="px-[24px] py-[16px] text-[14px] text-gray-500 font-[400] whitespace-nowrap">
                      {new Date(assign.deadline).toLocaleDateString()}
                    </td>
                    <td className="px-[24px] py-[16px] text-center whitespace-nowrap">
                      {assign.status === 'Completed' ? (
                        <span className="text-[14px] md:text-[15px] font-[600] text-green-600">{assign.score}%</span>
                      ) : (
                        <span className="text-[13px] text-gray-500 font-[400]">Pending</span>
                      )}
                    </td>
                    {/* View icon */}
                    <td className="px-[16px] py-[16px] text-center">
                      {assign.status === 'Completed' && assign.session_id ? (
                        <button
                          onClick={() => router.push(`/training/review/${assign.session_id}`)}
                          title="View Review"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#2C5282] hover:bg-[#EBF8FF] transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                        </button>
                      ) : (
                        <span className="w-8 h-8 inline-block"/>
                      )}
                    </td>
                    {/* Delete icon */}
                    <td className="px-[16px] py-[16px] text-center">
                      <button
                        onClick={() => handleDelete(assign.id)}
                        title="Delete"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[24px]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAssignModal(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden">
            <div className="flex justify-between items-center px-[24px] py-[20px] border-b border-gray-900/10">
              <h2 className="text-[18px] md:text-[20px] font-[600] text-gray-900">Assign Persona</h2>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-500 hover:text-gray-900 transition-colors">
                <svg className="w-[20px] h-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-[24px] space-y-[20px]">
              <div>
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block mb-[8px]">Training Scenario</label>
                <select
                  value={selectedScenarioId}
                  onChange={(e) => {
                    const newScenarioId = e.target.value;
                    setSelectedScenarioId(newScenarioId);
                    if (newScenarioId) {
                      const validReps = reps.filter(r => !assignments.some(a => a.rep_id === r.id && a.scenario_id === newScenarioId && a.status !== 'Completed'));
                      const validRepIds = validReps.map(r => r.id);
                      setSelectedRepIds(prev => prev.filter(id => validRepIds.includes(id)));
                    } else {
                      setSelectedRepIds([]);
                    }
                  }}
                  className="w-full h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors"
                >
                  <option value="">Select scenario...</option>
                  {scenarios.map(s => <option key={s.id} value={s.id}>{(s.display_label || s.persona_name)} ({s.difficulty})</option>)}
                </select>
              </div>

              <div className="relative">
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block mb-[8px]">Select Representatives</label>
                <div 
                  className="w-full h-[40px] md:h-[44px] border border-gray-900/10 rounded-[10px] px-[12px] flex items-center justify-between cursor-pointer bg-white"
                  onClick={() => setShowRepDropdown(!showRepDropdown)}
                >
                  <span className="text-[14px] text-gray-700 truncate">
                    {selectedRepIds.length > 0 
                      ? `${selectedRepIds.length} rep(s) selected` 
                      : 'Select representatives...'}
                  </span>
                  <svg className={`w-4 h-4 text-gray-500 transition-transform ${showRepDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                
                {showRepDropdown && (
                  <div className="absolute top-[100%] left-0 right-0 mt-[4px] bg-white border border-gray-900/10 rounded-[10px] shadow-lg max-h-[200px] overflow-y-auto z-50 p-[8px]">
                    {reps.filter(r => {
                      if (!selectedScenarioId) return true;
                      return !assignments.some(a => a.rep_id === r.id && a.scenario_id === selectedScenarioId && a.status !== 'Completed');
                    }).length === 0 ? (
                      <div className="text-[13px] text-gray-500 p-[8px]">No eligible reps available</div>
                    ) : (
                      reps.filter(r => {
                        if (!selectedScenarioId) return true;
                        return !assignments.some(a => a.rep_id === r.id && a.scenario_id === selectedScenarioId && a.status !== 'Completed');
                      }).map(r => (
                        <div
                          key={r.id}
                          onClick={() => {
                            if (selectedRepIds.includes(r.id)) setSelectedRepIds(selectedRepIds.filter(id => id !== r.id))
                            else setSelectedRepIds([...selectedRepIds, r.id])
                          }}
                          className={`flex items-center gap-[10px] px-[12px] py-[8px] rounded-[6px] cursor-pointer hover:bg-gray-50 transition-colors ${selectedRepIds.includes(r.id) ? 'bg-gray-50' : ''}`}
                        >
                          <input 
                            type="checkbox" 
                            checked={selectedRepIds.includes(r.id)} 
                            readOnly
                            className="w-[16px] h-[16px] rounded border-gray-300 text-[#2C5282] focus:ring-[#2C5282]" 
                          />
                          <span className="text-[14px] font-[500] text-gray-700">{r.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px]">
                <div>
                  <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block mb-[8px]">Deadline</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block mb-[8px]">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </div>
                <div>
                  <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block mb-[8px]">Avatar</label>
                  <select
                    value={avatarType}
                    onChange={(e) => setAvatarType(e.target.value)}
                    className="w-full h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors"
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-[12px] pt-[8px]">
                <button onClick={() => setShowAssignModal(false)} className="flex-1 border border-gray-900/20 text-gray-700 font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] rounded-[10px] transition-all duration-200 hover:bg-gray-50 text-[14px]">Cancel</button>
                <button
                  onClick={handleAssign}
                  disabled={assigning || selectedRepIds.length === 0 || !selectedScenarioId}
                  className="flex-1 bg-[#2C5282] text-white font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] rounded-[10px] transition-all duration-200 hover:bg-[#1A365D] disabled:opacity-40 disabled:cursor-not-allowed text-[14px]"
                >
                  {assigning ? 'Assigning...' : 'Assign Persona'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {assignmentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 animate-in zoom-in-95 duration-200 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Assignment?</h3>
            <p className="text-gray-500 text-sm mb-6">
              Are you sure you want to permanently delete this assignment?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setAssignmentToDelete(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#2C5282] hover:bg-[#1A365D] text-white font-semibold transition-colors shadow-lg shadow-[#2C5282]/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
