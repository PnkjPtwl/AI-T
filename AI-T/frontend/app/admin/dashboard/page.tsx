'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, UserCircle, AlertCircle, ClipboardList } from 'lucide-react'

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
    <div className="space-y-8 pb-12 font-['Inter'] max-w-[1360px] mx-auto text-[#0b1c30]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-md shadow-lg text-[13px] font-semibold transition-all animate-in slide-in-from-right ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-[#ba1a1a] text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B] tracking-tight">User Management</h1>
          <p className="text-[14px] text-slate-500 mt-1">Assign reps to managers and manage team hierarchy.</p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Managers" value={stats.totalManagers} icon={<Users className="w-6 h-6" />} color="blue" />
          <StatCard label="Total Reps" value={stats.totalReps} icon={<UserCircle className="w-6 h-6" />} color="emerald" />
          <StatCard label="Unassigned Reps" value={stats.unassignedReps} icon={<AlertCircle className="w-6 h-6" />} color={stats.unassignedReps > 0 ? 'amber' : 'emerald'} />
          <StatCard label="Unassigned Managers" value={stats.unassignedManagers} icon={<ClipboardList className="w-6 h-6" />} color={stats.unassignedManagers > 0 ? 'amber' : 'emerald'} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Managers Panel */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
            <h2 className="text-[15px] font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B]">Managers</h2>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-md">{managers.length}</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {managers.length === 0 ? (
              <div className="px-6 py-12 text-center text-[13px] text-slate-400 font-medium">No managers found</div>
            ) : (
              managers.map(manager => (
                <div key={manager.id} className="group">
                  <button
                    onClick={() => toggleManagerExpand(manager.id)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-[#4b41e1] text-white flex items-center justify-center text-[13px] font-bold">
                        {manager.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#1E293B]">{manager.name}</p>
                        <p className="text-[12px] text-slate-500">{manager.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                        manager.rep_count > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {manager.rep_count} rep{manager.rep_count !== 1 ? 's' : ''}
                      </span>
                      <svg className={`w-4 h-4 text-slate-400 transition-transform ${expandedManager === manager.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded: Show assigned reps */}
                  {expandedManager === manager.id && (
                    <div className="px-6 pb-4 bg-slate-50">
                      {!managerReps[manager.id] ? (
                        <p className="text-[12px] text-slate-500 py-3">Loading reps...</p>
                      ) : managerReps[manager.id].length === 0 ? (
                        <p className="text-[12px] text-slate-500 py-3 italic">No reps assigned yet</p>
                      ) : (
                        <div className="space-y-2 pt-2">
                          {managerReps[manager.id].map(rep => (
                            <div key={rep.id} className="flex items-center justify-between px-3 py-2 bg-white rounded-md border border-slate-200">
                              <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center text-[10px] font-bold border border-emerald-200">
                                  {rep.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-[12px] font-semibold text-[#1E293B]">{rep.name}</p>
                                  <p className="text-[11px] text-slate-500">{rep.email}</p>
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
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
            <h2 className="text-[15px] font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B]">Unassigned Reps</h2>
            <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md ${
              unassignedReps.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
            }`}>
              {unassignedReps.length}
            </span>
          </div>

          {unassignedReps.length > 0 && (
            <div className="px-6 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <select
                  value={selectedManager}
                  onChange={(e) => setSelectedManager(e.target.value)}
                  className="flex-1 text-[13px] font-medium bg-white border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#4b41e1] text-slate-700"
                >
                  <option value="">Select manager to assign to...</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>{m.name} ({m.rep_count} reps)</option>
                  ))}
                </select>
                <button
                  onClick={handleBulkAssign}
                  disabled={selectedReps.length === 0 || !selectedManager || actionLoading}
                  className="px-4 py-1.5 bg-[#4b41e1] hover:bg-[#3b33b3] text-white text-[12px] font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Assign {selectedReps.length > 0 ? `(${selectedReps.length})` : ''}
                </button>
              </div>
            </div>
          )}

          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {unassignedReps.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <span className="text-3xl mb-3 block">✅</span>
                <p className="text-[13px] text-emerald-600 font-semibold">All reps are assigned!</p>
              </div>
            ) : (
              unassignedReps.map(rep => (
                <div key={rep.id} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={selectedReps.includes(rep.id)}
                      onChange={() => toggleRepSelection(rep.id)}
                      className="w-4 h-4 rounded-[4px] border-slate-300 text-[#4b41e1] focus:ring-[#4b41e1]"
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-md bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center text-[10px] font-bold">
                        {rep.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[#1E293B]">{rep.name}</p>
                        <p className="text-[12px] text-slate-500">{rep.email}</p>
                      </div>
                    </div>
                  </label>

                  {/* Quick assign dropdown */}
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleAssignRep(rep.id, e.target.value)
                      e.target.value = ''
                    }}
                    className="text-[11px] font-semibold bg-white text-slate-600 border border-slate-200 rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-[#4b41e1] cursor-pointer"
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
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-white">
          <h2 className="text-[15px] font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B]">All Representatives</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-3 text-left text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Rep</th>
                <th className="px-6 py-3 text-left text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Assigned To</th>
                <th className="px-6 py-3 text-left text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allReps.map(rep => (
                <tr key={rep.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-md ${rep.is_assigned ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'} flex items-center justify-center text-[10px] font-bold`}>
                        {rep.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-[#1E293B]">{rep.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{rep.email}</td>
                  <td className="px-6 py-4 font-semibold text-[#1E293B]">
                    {rep.manager_name || <span className="text-amber-600 italic font-normal">Unassigned</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                      rep.is_assigned ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
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

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    red: 'bg-red-50 border-[#ffdad6] text-[#ba1a1a]',
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between relative overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorMap[color] ? colorMap[color].split(' ')[0] : 'bg-indigo-50'}`}></div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-3xl font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B]">{value}</span>
      </div>
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}
