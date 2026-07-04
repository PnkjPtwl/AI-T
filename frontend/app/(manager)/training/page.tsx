'use client'

import { useState, useEffect } from 'react'
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
  const [selectedPersonaFilter, setSelectedPersonaFilter] = useState('all')
  const [showRepDropdown, setShowRepDropdown] = useState(false)

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

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/users/assignments/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) fetchData()
    } catch (err) {
      console.error('Delete failed', err)
    }
  }
  const statusColor: Record<string, string> = {
    'Completed': 'text-green-600',
    'Overdue': 'text-red-600',
    'In Progress': 'text-yellow-600',
    'Pending': 'text-gray-500',
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
          onClick={() => setShowAssignModal(true)}
          className="bg-[#2C5282] text-white font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-[#1A365D] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-[8px]"
        >
          <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          Assign Training
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
      <div className="bg-white border border-gray-900/10 rounded-[12px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <div className="px-[24px] py-[16px] border-b border-gray-900/10 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">Assignment Tracking</h2>
          <select 
            value={selectedPersonaFilter}
            onChange={(e) => setSelectedPersonaFilter(e.target.value)}
            className="w-full sm:w-[250px] h-[36px] bg-white border border-[#E2E8F0] rounded-[8px] px-[12px] text-sm font-medium text-[#1A2A3A] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors"
          >
            <option value="all">All Scenarios</option>
            {scenarios.map(s => (
              <option key={s.id} value={s.id}>{s.display_label || s.persona_name}</option>
            ))}
          </select>
        </div>
        
        {assignments.length === 0 ? (
          <div className="p-[64px] text-center text-base text-gray-500">No assignments yet. Click "Assign Training" to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-gray-900/10 bg-gray-50/30">
                  <th className="text-left px-[24px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider">Rep</th>
                  <th className="text-left px-[24px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider">Scenario</th>
                  <th className="text-left px-[24px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="text-left px-[24px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider whitespace-nowrap">Deadline</th>
                  <th className="text-center px-[24px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider whitespace-nowrap">Score</th>
                  <th className="text-center px-[16px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider w-[60px]">View</th>
                  <th className="text-center px-[16px] py-[12px] text-sm font-semibold text-gray-900/70 uppercase tracking-wider w-[60px]">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-900/5">
                {assignments
                  .filter(a => selectedPersonaFilter === 'all' || a.scenario_id === selectedPersonaFilter)
                  .map((assign) => (
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
              <h2 className="text-[18px] md:text-[20px] font-[600] text-gray-900">Assign Training</h2>
              <button onClick={() => setShowAssignModal(false)} className="text-gray-500 hover:text-gray-900 transition-colors">
                <svg className="w-[20px] h-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-[24px] space-y-[20px]">
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
                  {assigning ? 'Assigning...' : 'Assign Training'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
