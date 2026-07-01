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
  const [assigning, setAssigning] = useState(false)
  const [success, setSuccess] = useState('')

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
        body: JSON.stringify({ repIds: selectedRepIds, scenarioId: selectedScenarioId, deadline, priority })
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
    'Completed': 'bg-green-50 text-green-700 border-green-200',
    'Overdue': 'bg-red-50 text-red-600 border-red-200',
    'In Progress': 'bg-yellow-50 text-yellow-700 border-yellow-200',
    'Pending': 'bg-[#F8FAFC] text-[#64748B] border-[#E2E8F0]',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2C5282]"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-[24px] pb-[48px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-[16px]">
        <div>
          <h1 className="text-[24px] md:text-[28px] font-[700] tracking-[-0.3px] text-gray-900">Training Management</h1>
          <p className="text-[14px] md:text-[15px] font-[400] text-gray-500 mt-1 leading-[1.6]">Deploy and monitor team training assignments.</p>
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
          <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70">Active Missions</p>
          <p className="text-[32px] md:text-[36px] font-[700] tracking-[-1px] text-gray-900 mt-[8px]">{assignments.filter(a => a.status !== 'Completed').length}</p>
        </div>
        <div className="bg-white border border-gray-900/10 rounded-[12px] p-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70">Total Assignments</p>
          <p className="text-[32px] md:text-[36px] font-[700] tracking-[-1px] text-[#2C5282] mt-[8px]">{assignments.length}</p>
        </div>
        <div className="bg-white border border-gray-900/10 rounded-[12px] p-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70">Success Rate</p>
          <p className="text-[32px] md:text-[36px] font-[700] tracking-[-1px] text-green-600 mt-[8px]">
            {assignments.length > 0 ? Math.round((assignments.filter(a => a.status === 'Completed').length / assignments.length) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Assignment Table */}
      <div className="bg-white border border-gray-900/10 rounded-[12px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <div className="px-[24px] py-[16px] border-b border-gray-900/10 bg-gray-50/50">
          <h2 className="text-[14px] md:text-[15px] font-[600] text-gray-900">Assignment Tracking</h2>
        </div>
        
        {assignments.length === 0 ? (
          <div className="p-[64px] text-center text-[14px] md:text-[15px] text-gray-500 font-[400]">No assignments yet. Click "Assign Training" to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="border-b border-gray-900/10 bg-gray-50/30">
                  <th className="text-left px-[24px] py-[12px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Rep</th>
                  <th className="text-left px-[24px] py-[12px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Scenario</th>
                  <th className="text-left px-[24px] py-[12px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Status</th>
                  <th className="text-left px-[24px] py-[12px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Deadline</th>
                  <th className="text-right px-[24px] py-[12px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Score</th>
                  <th className="text-right px-[24px] py-[12px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-900/5">
                {assignments.map((assign) => (
                  <tr key={assign.id} className="hover:bg-gray-50/50 transition-colors duration-150">
                    <td className="px-[24px] py-[16px]">
                      <p className="font-[500] text-gray-900 text-[14px] md:text-[15px]">{assign.rep_name}</p>
                      <p className="text-[13px] text-gray-500 mt-[2px]">Sales Rep</p>
                    </td>
                    <td className="px-[24px] py-[16px]">
                      <p className="font-[500] text-gray-900 text-[14px] md:text-[15px]">{assign.scenario_name}</p>
                      <p className="text-[13px] text-gray-500 mt-[2px]">{assign.difficulty}</p>
                    </td>
                    <td className="px-[24px] py-[16px]">
                      <span className={`inline-flex items-center px-[10px] py-[2px] rounded-full text-[12px] font-[600] tracking-[0.6px] uppercase border ${statusColor[assign.status] || 'bg-gray-50 text-gray-500 border-gray-900/10'}`}>
                        {assign.status}
                      </span>
                    </td>
                    <td className="px-[24px] py-[16px] text-[14px] text-gray-500 font-[400]">
                      {new Date(assign.deadline).toLocaleDateString()}
                    </td>
                    <td className="px-[24px] py-[16px] text-right">
                      {assign.status === 'Completed' ? (
                        <span className="text-[18px] md:text-[20px] font-[700] tracking-[-0.3px] text-green-600">{assign.score}%</span>
                      ) : (
                        <span className="text-[13px] text-gray-500 font-[400]">Pending</span>
                      )}
                    </td>
                    <td className="px-[24px] py-[16px] text-right space-x-[12px]">
                      {assign.status === 'Completed' && assign.session_id && (
                        <button 
                          onClick={() => router.push(`/training/review/${assign.session_id}`)}
                          className="text-green-600 hover:text-green-700 hover:underline text-[13px] font-[600] transition-colors"
                        >
                          Review
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(assign.id)} 
                        className="text-red-600 hover:text-red-700 hover:underline text-[13px] font-[600] transition-colors"
                      >
                        Delete
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
              <div>
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block mb-[8px]">Select Representatives</label>
                <div className="flex flex-wrap gap-[8px]">
                  {reps.filter(r => {
                    // Filter out reps who are already assigned to the selected scenario
                    if (!selectedScenarioId) return true;
                    return !assignments.some(a => a.rep_id === r.id && a.scenario_id === selectedScenarioId && a.status !== 'Completed');
                  }).map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        if (selectedRepIds.includes(r.id)) setSelectedRepIds(selectedRepIds.filter(id => id !== r.id))
                        else setSelectedRepIds([...selectedRepIds, r.id])
                      }}
                      className={`px-[12px] py-[6px] rounded-[8px] text-[13px] font-[600] border transition-all duration-200 ${selectedRepIds.includes(r.id) ? 'bg-[#2C5282] border-[#2C5282] text-white shadow-sm' : 'bg-white border-gray-900/10 text-gray-700 hover:border-gray-900/30'}`}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block mb-[8px]">Training Scenario</label>
                <select
                  value={selectedScenarioId}
                  onChange={(e) => {
                    setSelectedScenarioId(e.target.value);
                    // Clear selected reps when scenario changes to avoid assigning excluded reps
                    setSelectedRepIds([]);
                  }}
                  className="w-full h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors"
                >
                  <option value="">Select scenario...</option>
                  {scenarios.map(s => <option key={s.id} value={s.id}>{s.persona_name} ({s.difficulty})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-[16px]">
                <div>
                  <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block mb-[8px]">Deadline</label>
                  <input
                    type="date"
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
