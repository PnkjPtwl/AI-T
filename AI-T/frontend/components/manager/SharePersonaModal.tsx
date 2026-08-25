'use client'

import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface SharePersonaModalProps {
  isOpen: boolean
  onClose: () => void
  scenario: any
}

export default function SharePersonaModal({ isOpen, onClose, scenario }: SharePersonaModalProps) {
  const [managers, setManagers] = useState<any[]>([])
  const [existingShares, setExistingShares] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen || !scenario?.id) return
    setSelectedIds(new Set())
    setSuccess('')
    setError('')
    fetchData()
  }, [isOpen, scenario?.id])

  const fetchData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const headers = { Authorization: `Bearer ${token}` }

      const [managersRes, sharesRes] = await Promise.all([
        fetch(`${API}/api/scenarios/shareable-managers`, { headers }),
        fetch(`${API}/api/scenarios/${scenario.id}/shares`, { headers })
      ])

      if (managersRes.ok) setManagers(await managersRes.json())
      if (sharesRes.ok) setExistingShares(await sharesRes.json())
    } catch (err) {
      console.error('Failed to load share data:', err)
    } finally {
      setLoading(false)
    }
  }

  const alreadySharedIds = new Set(existingShares.map((s: any) => s.shared_with_manager_id))

  const toggleManager = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleShare = async () => {
    if (selectedIds.size === 0) return
    setSharing(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/scenarios/${scenario.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ managerIds: Array.from(selectedIds) })
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to share')
        return
      }

      setSuccess(data.message || 'Shared successfully!')
      setSelectedIds(new Set())
      // Refresh shares list
      await fetchData()
    } catch (err) {
      setError('Network error')
    } finally {
      setSharing(false)
    }
  }

  const handleUnshare = async (targetManagerId: string) => {
    try {
      const token = localStorage.getItem('token')
      await fetch(`${API}/api/scenarios/${scenario.id}/share/${targetManagerId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      await fetchData()
    } catch (err) {
      console.error('Failed to unshare:', err)
    }
  }

  if (!isOpen) return null

  const availableManagers = managers.filter((m: any) => !alreadySharedIds.has(m.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-[#1E1B4B]/5 to-purple-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-[800] text-[#1E293B]">Share Persona</h2>
              <p className="text-xs text-[#64748B] font-[500] mt-0.5">
                Share <span className="font-[700] text-[#1E1B4B]">{scenario?.persona_name || scenario?.contact_title || 'this persona'}</span> with other managers
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-8 py-6 max-h-[60vh] overflow-y-auto space-y-6">
          {/* Already shared */}
          {existingShares.length > 0 && (
            <div>
              <h3 className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-3">
                Currently Shared With ({existingShares.length})
              </h3>
              <div className="space-y-2">
                {existingShares.map((share: any) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between px-4 py-3 bg-green-50 border border-green-100 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-[800]">
                        {(share.manager_name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-[700] text-[#1E293B]">{share.manager_name}</p>
                        <p className="text-[10px] text-[#64748B]">{share.manager_email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUnshare(share.shared_with_manager_id)}
                      className="px-3 py-1 text-[10px] font-[700] text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available to share */}
          <div>
            <h3 className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-3">
              Share With Managers
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-[#1E1B4B]"></div>
              </div>
            ) : availableManagers.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-[#64748B]">
                  {managers.length === 0
                    ? 'No other managers found in the system.'
                    : 'Already shared with all available managers.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableManagers.map((m: any) => {
                  const isSelected = selectedIds.has(m.id)
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggleManager(m.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left ${
                        isSelected
                          ? 'bg-[#1E1B4B]/5 border-[#1E1B4B]/30 ring-1 ring-[#1E1B4B]/20'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[#1E1B4B] border-[#1E1B4B]'
                          : 'border-gray-300'
                      }`}>
                        {isSelected && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-[#1E1B4B] text-white flex items-center justify-center text-xs font-[800]">
                        {(m.name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-[700] text-[#1E293B]">{m.name}</p>
                        <p className="text-[10px] text-[#64748B]">{m.email}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Feedback */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-[700]">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-600 font-[700]">
              ✅ {success}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-xs font-[700] text-[#64748B] bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Close
          </button>
          {availableManagers.length > 0 && (
            <button
              onClick={handleShare}
              disabled={selectedIds.size === 0 || sharing}
              className="px-5 py-2.5 text-xs font-[700] text-white bg-[#1E1B4B] hover:bg-[#2E2A72] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md transition-colors flex items-center gap-2"
            >
              {sharing ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-white"></div>
                  Sharing...
                </>
              ) : (
                <>📤 Share with {selectedIds.size > 0 ? selectedIds.size : ''} Manager{selectedIds.size !== 1 ? 's' : ''}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
