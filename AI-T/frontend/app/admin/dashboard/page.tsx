'use client'

import { useState, useEffect, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Manager {
  id: string
  name: string
  email: string
  org_name: string
  rep_count: number
  created_at: string
}

interface Rep {
  id: string
  name: string
  email: string
  org_name: string
  manager_id: string | null
  manager_name: string | null
  is_assigned: boolean
  created_at: string
}

interface Stats {
  totalManagers: number
  totalReps: number
  assignedReps: number
  unassignedReps: number
  unassignedManagers: number
  totalOrgs: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [managers, setManagers] = useState<Manager[]>([])
  const [unassignedReps, setUnassignedReps] = useState<Rep[]>([])
  const [allReps, setAllReps] = useState<Rep[]>([])
  const [selectedReps, setSelectedReps] = useState<string[]>([])
  const [selectedManager, setSelectedManager] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [expandedManager, setExpandedManager] = useState<string | null>(null)
  const [managerReps, setManagerReps] = useState<Record<string, Rep[]>>({})

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchData = useCallback(async () => {
    if (!token) return
    try {
      const [statsRes, managersRes, unassignedRes, allRepsRes] = await Promise.all([
        fetch(`${API}/api/admin/stats`, { headers }),
        fetch(`${API}/api/admin/managers`, { headers }),
        fetch(`${API}/api/admin/unassigned-reps`, { headers }),
        fetch(`${API}/api/admin/reps`, { headers }),
      ])

      if (statsRes.ok) setStats(await statsRes.json())
      if (managersRes.ok) setManagers(await managersRes.json())
      if (unassignedRes.ok) setUnassignedReps(await unassignedRes.json())
      if (allRepsRes.ok) setAllReps(await allRepsRes.json())
    } catch (err) {
      console.error('Failed to fetch admin data:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchManagerReps = async (managerId: string) => {
    try {
      const res = await fetch(`${API}/api/admin/manager/${managerId}/reps`, { headers })
      if (res.ok) {
        const data = await res.json()
        setManagerReps(prev => ({ ...prev, [managerId]: data }))
      }
    } catch (err) {
      console.error('Failed to fetch manager reps:', err)
    }
  }

  const toggleManagerExpand = (managerId: string) => {
    if (expandedManager === managerId) {
      setExpandedManager(null)
    } else {
      setExpandedManager(managerId)
      if (!managerReps[managerId]) {
        fetchManagerReps(managerId)
      }
    }
  }

  const handleAssignRep = async (repId: string, managerId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/assign-rep`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ repId, managerId })
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || 'Rep assigned successfully', 'success')
        fetchData()
        if (expandedManager) fetchManagerReps(expandedManager)
      } else {
        showToast(data.error || 'Failed to assign rep', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnassignRep = async (repId: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/unassign-rep`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ repId })
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || 'Rep unassigned', 'success')
        fetchData()
        if (expandedManager) fetchManagerReps(expandedManager)
      } else {
        showToast(data.error || 'Failed to unassign', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBulkAssign = async () => {
    if (selectedReps.length === 0 || !selectedManager) return
    setActionLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/bulk-assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ repIds: selectedReps, managerId: selectedManager })
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || 'Reps assigned successfully', 'success')
        setSelectedReps([])
        setSelectedManager('')
        fetchData()
      } else {
        showToast(data.error || 'Failed to bulk assign', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const toggleRepSelection = (repId: string) => {
    setSelectedReps(prev =>
      prev.includes(repId) ? prev.filter(id => id !== repId) : [...prev, repId]
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-[#1E1B4B] rounded-full animate-spin" />
          <p className="text-sm font-[700] text-[#64748B] uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl shadow-2xl text-sm font-[700] transition-all animate-in slide-in-from-right ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-[800] text-[#1E293B] tracking-tight">User Management</h1>
          <p className="text-sm text-[#64748B] font-[500] mt-1">Assign reps to managers and manage team hierarchy</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Managers" value={stats.totalManagers} icon="👔" color="blue" />
          <StatCard label="Total Reps" value={stats.totalReps} icon="🧑‍💼" color="emerald" />
          <StatCard label="Unassigned Reps" value={stats.unassignedReps} icon="⚠️" color={stats.unassignedReps > 0 ? 'amber' : 'emerald'} />
          <StatCard label="Unassigned Managers" value={stats.unassignedManagers} icon="📋" color={stats.unassignedManagers > 0 ? 'amber' : 'emerald'} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Managers Panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-[800] text-[#1E293B] uppercase tracking-wider">Managers</h2>
            <span className="px-2 py-0.5 bg-indigo-50 text-[#1E1B4B] text-[10px] font-[800] rounded-full">{managers.length}</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {managers.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-[#94A3B8] font-[600]">No managers found</div>
            ) : (
              managers.map(manager => (
                <div key={manager.id} className="group">
                  <button
                    onClick={() => toggleManagerExpand(manager.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1E1B4B] to-[#312E81] text-white flex items-center justify-center text-sm font-[800]">
                        {manager.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-[700] text-[#1E293B]">{manager.name}</p>
                        <p className="text-[11px] text-[#94A3B8] font-[500]">{manager.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-[800] ${
                        manager.rep_count > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {manager.rep_count} rep{manager.rep_count !== 1 ? 's' : ''}
                      </span>
                      <svg className={`w-4 h-4 text-[#94A3B8] transition-transform ${expandedManager === manager.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded: Show assigned reps */}
                  {expandedManager === manager.id && (
                    <div className="px-6 pb-4 bg-gray-50/30">
                      {!managerReps[manager.id] ? (
                        <p className="text-xs text-[#94A3B8] py-3">Loading reps...</p>
                      ) : managerReps[manager.id].length === 0 ? (
                        <p className="text-xs text-[#94A3B8] py-3 italic">No reps assigned yet</p>
                      ) : (
                        <div className="space-y-2 pt-2">
                          {managerReps[manager.id].map(rep => (
                            <div key={rep.id} className="flex items-center justify-between px-3 py-2 bg-white rounded-xl border border-gray-100">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-[800]">
                                  {rep.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-xs font-[700] text-[#1E293B]">{rep.name}</p>
                                  <p className="text-[10px] text-[#94A3B8]">{rep.email}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Unassigned Reps Panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-[800] text-[#1E293B] uppercase tracking-wider">Unassigned Reps</h2>
            <span className={`px-2 py-0.5 text-[10px] font-[800] rounded-full ${
              unassignedReps.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {unassignedReps.length}
            </span>
          </div>

          {unassignedReps.length > 0 && (
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <select
                  value={selectedManager}
                  onChange={(e) => setSelectedManager(e.target.value)}
                  className="flex-1 text-xs font-[600] bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400 transition-all"
                >
                  <option value="">Select manager to assign to...</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.rep_count} reps)</option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAssign}
                  disabled={selectedReps.length === 0 || !selectedManager || actionLoading}
                  className="px-4 py-2 bg-[#1E1B4B] hover:bg-[#2A2467] text-white text-[10px] font-[800] uppercase tracking-wider rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Assign {selectedReps.length > 0 ? `(${selectedReps.length})` : ''}
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {unassignedReps.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <span className="text-3xl mb-3 block">✅</span>
                <p className="text-sm text-emerald-600 font-[700]">All reps are assigned!</p>
              </div>
            ) : (
              unassignedReps.map(rep => (
                <div key={rep.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-all">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={selectedReps.includes(rep.id)}
                      onChange={() => toggleRepSelection(rep.id)}
                      className="w-4 h-4 rounded-md border-gray-300 text-[#1E1B4B] focus:ring-[#1E1B4B]"
                    />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-[800]">
                        {rep.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-[700] text-[#1E293B]">{rep.name}</p>
                        <p className="text-[10px] text-[#94A3B8]">{rep.email}</p>
                      </div>
                    </div>
                  </label>

                  {/* Quick assign dropdown */}
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleAssignRep(rep.id, e.target.value)
                      e.target.value = ''
                    }}
                    className="text-[10px] font-[600] bg-transparent border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 cursor-pointer"
                    defaultValue=""
                  >
                    <option value="" disabled>Quick assign →</option>
                    {managers.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* All Reps Overview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-[800] text-[#1E293B] uppercase tracking-wider">All Representatives</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-3 text-left text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">Rep</th>
                <th className="px-6 py-3 text-left text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-3 text-left text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allReps.map(rep => (
                <tr key={rep.id} className="hover:bg-gray-50/30 transition-all">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg ${rep.is_assigned ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} flex items-center justify-center text-[10px] font-[800]`}>
                        {rep.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-[700] text-[#1E293B]">{rep.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-xs text-[#64748B] font-[500]">{rep.email}</td>
                  <td className="px-6 py-3 text-xs font-[600] text-[#1E293B]">
                    {rep.manager_name || <span className="text-amber-600 italic">Unassigned</span>}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-[700] ${
                      rep.is_assigned ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {rep.is_assigned ? 'Assigned' : 'Unassigned'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-indigo-50 border-indigo-100 text-[#1E1B4B]',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    red: 'bg-red-50 border-red-100 text-red-700',
  }

  return (
    <div className={`rounded-2xl border p-5 ${colorMap[color] || colorMap.blue}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-2xl font-[800]">{value}</span>
      </div>
      <p className="text-[10px] font-[800] uppercase tracking-wider opacity-70">{label}</p>
    </div>
  )
}
