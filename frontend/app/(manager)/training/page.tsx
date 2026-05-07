'use client'

import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function TrainingPage() {
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
  const [editingAssignment, setEditingAssignment] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)

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

      if (repsRes.ok) {
        const data = await repsRes.json()
        console.log('[ManagerTraining] Fetched reps:', data)
        setReps(data)
      }
      if (scenariosRes.ok) {
        const data = await scenariosRes.json()
        console.log('[ManagerTraining] Fetched scenarios:', data)
        setScenarios(data)
      }
      if (assignmentsRes.ok) {
        const data = await assignmentsRes.json()
        console.log('[ManagerTraining] Fetched assignments:', data)
        setAssignments(data)
      }
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
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          repIds: selectedRepIds,
          scenarioId: selectedScenarioId,
          deadline,
          priority
        })
      })

      if (res.ok) {
        setSuccess('Missions deployed successfully.')
        setShowAssignModal(false)
        setSelectedRepIds([])
        fetchData()
        setTimeout(() => setSuccess(''), 4000)
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

  const handleUpdate = async () => {
    if (!editingAssignment) return
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/users/assignments/${editingAssignment.id}`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          deadline: editingAssignment.deadline,
          priority: editingAssignment.priority,
          status: editingAssignment.status,
          rep_id: editingAssignment.rep_id,
          scenario_id: editingAssignment.scenario_id
        })
      })
      if (res.ok) {
        setShowEditModal(false)
        fetchData()
      }
    } catch (err) {
      console.error('Update failed', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#7D8461]"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
        <div>
          <h1 className="text-4xl font-extrabold text-[#3A2F28] tracking-tight">Mission Control</h1>
          <p className="text-[#7B6F63] font-medium mt-2 text-base">Deploy and monitor team training assignments.</p>
        </div>
        <button 
          onClick={() => setShowAssignModal(true)}
          className="px-8 py-4 bg-[#7D8461] hover:bg-[#6B7252] text-[#F6F1E8] font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-md transition-all"
        >
          Deploy New Mission
        </button>
      </div>

      {success && (
        <div className="p-5 bg-[#EAE2D6] border border-[#D8CCBC] rounded-2xl text-[#7D8461] text-xs font-black uppercase tracking-widest animate-in fade-in slide-in-from-top-2">
          {success}
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
         <div className="bg-[#EFE7DC] border border-[#D8CCBC] p-8 rounded-[2.5rem] shadow-sm">
            <p className="text-[10px] font-black text-[#7B6F63] uppercase tracking-[0.3em] mb-4">Active Missions</p>
            <p className="text-4xl font-extrabold text-[#3A2F28] tracking-tighter">{assignments.filter(a => a.status !== 'Completed').length}</p>
         </div>
         <div className="bg-[#EFE7DC] border border-[#D8CCBC] p-8 rounded-[2.5rem] shadow-sm">
            <p className="text-[10px] font-black text-[#7B6F63] uppercase tracking-[0.3em] mb-4">Total Assignments</p>
            <p className="text-4xl font-extrabold text-[#7D8461] tracking-tighter">{assignments.length}</p>
         </div>
         <div className="bg-[#EFE7DC] border border-[#D8CCBC] p-8 rounded-[2.5rem] shadow-sm">
            <p className="text-[10px] font-black text-[#7B6F63] uppercase tracking-[0.3em] mb-4">Success Rate</p>
            <p className="text-4xl font-extrabold text-[#7D8461] tracking-tighter">
               {assignments.length > 0 ? Math.round((assignments.filter(a => a.status === 'Completed').length / assignments.length) * 100) : 0}%
            </p>
         </div>
      </div>

      {/* Assignment List */}
      <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] shadow-sm overflow-hidden">
         <div className="px-10 py-8 border-b border-[#D8CCBC] bg-[#EAE2D6]/50">
            <h2 className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.3em]">Mission Deployment Tracking</h2>
         </div>
         
         {assignments.length === 0 ? (
           <div className="p-24 text-center">
              <p className="text-[#7B6F63] font-black uppercase tracking-[0.3em] text-[10px]">No active missions deployed.</p>
           </div>
         ) : (
           <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-[#EAE2D6]/30">
                       <th className="px-10 py-5 text-[10px] font-black text-[#7B6F63] uppercase tracking-widest border-b border-[#D8CCBC]">Representative</th>
                       <th className="px-10 py-5 text-[10px] font-black text-[#7B6F63] uppercase tracking-widest border-b border-[#D8CCBC]">Scenario</th>
                       <th className="px-10 py-5 text-[10px] font-black text-[#7B6F63] uppercase tracking-widest border-b border-[#D8CCBC]">Status</th>
                       <th className="px-10 py-5 text-[10px] font-black text-[#7B6F63] uppercase tracking-widest border-b border-[#D8CCBC]">Deadline</th>
                       <th className="px-10 py-5 text-[10px] font-black text-[#7B6F63] uppercase tracking-widest border-b border-[#D8CCBC] text-right">Performance</th>
                       <th className="px-10 py-5 text-[10px] font-black text-[#7B6F63] uppercase tracking-widest border-b border-[#D8CCBC] text-right">Actions</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-[#D8CCBC]">
                    {assignments.map((assign) => (
                      <tr key={assign.id} className="hover:bg-[#F6F1E8]/50 transition-colors">
                         <td className="px-10 py-6">
                            <p className="text-sm font-bold text-[#3A2F28] uppercase tracking-tight">{assign.rep_name}</p>
                            <p className="text-[9px] text-[#7B6F63] font-black uppercase tracking-[0.2em] mt-1">Field Personnel</p>
                         </td>
                         <td className="px-10 py-6">
                            <p className="text-sm font-bold text-[#3A2F28] uppercase tracking-tight">{assign.scenario_name}</p>
                            <p className="text-[9px] text-[#7B6F63] font-black uppercase tracking-[0.2em] mt-1">{assign.difficulty}</p>
                         </td>
                         <td className="px-10 py-6">
                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                              assign.status === 'Completed' ? 'bg-[#7D8461]/10 text-[#7D8461] border-[#7D8461]/20' : 
                              assign.status === 'Overdue' ? 'bg-[#A06A5B]/10 text-[#A06A5B] border-[#A06A5B]/20' : 
                              'bg-[#D6C2A8]/10 text-[#3A2F28] border-[#D8CCBC]'
                            }`}>
                               {assign.status}
                            </span>
                         </td>
                         <td className="px-10 py-6 text-xs font-bold text-[#7B6F63]">
                            {new Date(assign.deadline).toLocaleDateString()}
                         </td>
                         <td className="px-10 py-6 text-right">
                            {assign.status === 'Completed' ? (
                              <span className="text-2xl font-extrabold text-[#7D8461] tracking-tighter">{assign.score}%</span>
                            ) : (
                              <span className="text-[9px] font-black text-[#D8CCBC] uppercase tracking-widest">Pending</span>
                            )}
                         </td>
                         <td className="px-10 py-6 text-right space-x-4">
                             <button 
                               onClick={() => {
                                 setEditingAssignment({...assign, deadline: assign.deadline.split('T')[0]})
                                 setShowEditModal(true)
                               }} 
                               className="text-[#7D8461] hover:text-[#3A2F28] text-[9px] font-black uppercase tracking-widest transition-colors"
                             >
                               Edit
                             </button>
                             <button 
                               onClick={() => handleDelete(assign.id)} 
                               className="text-[#A06A5B] hover:text-[#3A2F28] text-[9px] font-black uppercase tracking-widest transition-colors"
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

      {/* Modal - Assign Training */}
      {showAssignModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in">
          <div className="absolute inset-0 bg-[#3A2F28]/40 backdrop-blur-sm" onClick={() => setShowAssignModal(false)}></div>
          <div className="relative w-full max-w-2xl bg-[#F6F1E8] border border-[#D8CCBC] rounded-[3rem] shadow-2xl overflow-hidden p-12">
             <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-3xl font-extrabold text-[#3A2F28] tracking-tight">Deploy New Mission</h2>
                  <p className="text-sm text-[#7B6F63] mt-1">Select agents and intelligence scenario.</p>
                </div>
                <button onClick={() => setShowAssignModal(false)} className="text-[10px] font-black uppercase tracking-widest text-[#7B6F63] hover:text-[#3A2F28]">Close</button>
             </div>

             <div className="space-y-8">
                {/* Reps Selection */}
                <div className="space-y-4">
                   <label className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em] ml-1">Target Representatives</label>
                   <div className="flex flex-wrap gap-2.5">
                     {reps.map(r => (
                       <button 
                         key={r.id}
                         onClick={() => {
                           if (selectedRepIds.includes(r.id)) {
                             setSelectedRepIds(selectedRepIds.filter(id => id !== r.id))
                           } else {
                             setSelectedRepIds([...selectedRepIds, r.id])
                           }
                         }}
                         className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                           selectedRepIds.includes(r.id) ? 'bg-[#7D8461] border-[#7D8461] text-[#F6F1E8] shadow-md' : 'bg-[#EFE7DC] border-[#D8CCBC] text-[#3A2F28] hover:border-[#7D8461]'
                         }`}
                       >
                         {r.name}
                       </button>
                     ))}
                   </div>
                </div>

                {/* Scenario Selection */}
                <div className="space-y-4">
                   <label className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em] ml-1">Mission Scenario</label>
                   <select 
                     value={selectedScenarioId}
                     onChange={(e) => setSelectedScenarioId(e.target.value)}
                     className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all appearance-none"
                   >
                      <option value="">Select AI Persona...</option>
                      {scenarios.map(s => <option key={s.id} value={s.id}>{s.persona_name} ({s.difficulty})</option>)}
                   </select>
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-4">
                     <label className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em] ml-1">Deadline</label>
                     <input 
                       type="date" 
                       value={deadline}
                       onChange={(e) => setDeadline(e.target.value)}
                       className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all"
                     />
                   </div>
                   <div className="space-y-4">
                     <label className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em] ml-1">Priority</label>
                     <select 
                       value={priority}
                       onChange={(e) => setPriority(e.target.value)}
                       className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all appearance-none"
                     >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                     </select>
                   </div>
                </div>

                <button 
                  onClick={handleAssign}
                  disabled={assigning || selectedRepIds.length === 0 || !selectedScenarioId}
                  className="w-full py-5 bg-[#7D8461] hover:bg-[#6B7252] text-[#F6F1E8] font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-[#7D8461]/20 transition-all disabled:opacity-50 mt-4"
                >
                  {assigning ? 'Initializing Deployment...' : 'Authorize Mission Deployment'}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {showEditModal && editingAssignment && (
        <div className="fixed inset-0 bg-[#3A2F28]/60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-[#F6F1E8] w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden border border-[#D8CCBC]">
             <div className="px-12 py-10 border-b border-[#D8CCBC] flex justify-between items-center bg-[#EAE2D6]/30">
                <div>
                  <h2 className="text-xl font-black text-[#3A2F28] uppercase tracking-tighter">Modify Mission</h2>
                  <p className="text-sm text-[#7B6F63] mt-1">Update parameters for {editingAssignment.rep_name}</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="text-[10px] font-black uppercase tracking-widest text-[#7B6F63] hover:text-[#3A2F28]">Cancel</button>
             </div>

             <div className="p-12 space-y-8 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em] ml-1">Representative</label>
                      <select 
                        value={editingAssignment.rep_id}
                        onChange={(e) => setEditingAssignment({...editingAssignment, rep_id: e.target.value})}
                        className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all appearance-none"
                      >
                         {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                   </div>
                   <div className="space-y-4">
                      <label className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em] ml-1">AI Persona</label>
                      <select 
                        value={editingAssignment.scenario_id}
                        onChange={(e) => setEditingAssignment({...editingAssignment, scenario_id: e.target.value})}
                        className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all appearance-none"
                      >
                         {scenarios.map(s => <option key={s.id} value={s.id}>{s.persona_name}</option>)}
                      </select>
                   </div>
                </div>

                <div className="space-y-4">
                   <label className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em] ml-1">Deadline</label>
                   <input 
                     type="date" 
                     value={editingAssignment.deadline}
                     onChange={(e) => setEditingAssignment({...editingAssignment, deadline: e.target.value})}
                     className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all"
                   />
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-4">
                     <label className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em] ml-1">Priority</label>
                     <select 
                       value={editingAssignment.priority}
                       onChange={(e) => setEditingAssignment({...editingAssignment, priority: e.target.value})}
                       className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all appearance-none"
                     >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                     </select>
                   </div>
                   <div className="space-y-4">
                     <label className="text-[10px] font-black text-[#3A2F28] uppercase tracking-[0.2em] ml-1">Status</label>
                     <select 
                       value={editingAssignment.status}
                       onChange={(e) => setEditingAssignment({...editingAssignment, status: e.target.value})}
                       className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all appearance-none"
                     >
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Overdue">Overdue</option>
                     </select>
                   </div>
                </div>

                <button 
                  onClick={handleUpdate}
                  className="w-full py-5 bg-[#7D8461] hover:bg-[#6B7252] text-[#F6F1E8] font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-[#7D8461]/20 transition-all mt-4"
                >
                  Update Mission Parameters
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  )
}
