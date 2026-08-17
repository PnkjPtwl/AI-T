'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ReassignModalProps {
  isOpen: boolean
  onClose: () => void
  assignment: any
  onSuccess: () => void
}

export default function ReassignModal({ isOpen, onClose, assignment, onSuccess }: ReassignModalProps) {
  const [mode, setMode] = useState(assignment?.training_mode || assignment?.trainingMode || 'Coach Mode')
  const [priority, setPriority] = useState(assignment?.priority || 'Medium')
  const [dueDate, setDueDate] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen || !assignment) return null

  const handleReassign = async () => {
    try {
      setIsSubmitting(true)
      setError('')
      const token = localStorage.getItem('token')
      
      const payload = {
        scenarioId: assignment.scenario_id,
        repIds: [assignment.rep_id],
        trainingMode: mode,
        priority: priority,
        deadline: dueDate ? new Date(dueDate).toISOString() : new Date(Date.now() + 14 * 86400000).toISOString(),
        notes: `Reassigned from previous assignment (ID: ${assignment.id})`,
        notifyImmediate: true,
        notifyReminder: true,
        notifyCompletion: true
      }

      const res = await fetch(`${API}/api/manager/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reassign')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-gray-100"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <h2 className="text-xl font-[800] text-[#1E293B]">Reassign Training</h2>
              <p className="text-xs text-[#64748B] font-[500] mt-1">Assign a new attempt for {assignment.rep_name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-[600]">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-[700] text-[#1E293B] mb-2">Training Mode</label>
              <select
                value={mode}
                onChange={e => setMode(e.target.value)}
                className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-sm font-[600] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1E1B4B]/20"
              >
                <option value="Exam Mode">Exam Mode</option>
                <option value="Coach Mode">Coach Mode</option>
                <option value="Learning Mode">Learning Mode</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-[700] text-[#1E293B] mb-2">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-sm font-[600] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1E1B4B]/20"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-[700] text-[#1E293B] mb-2">Due Date (Optional)</label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-4 text-sm font-[600] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1E1B4B]/20"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl font-[700] text-sm text-[#64748B] hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReassign}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl font-[700] text-sm text-white bg-[#1E1B4B] hover:bg-[#2E2A72] transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Reassigning...' : 'Reassign'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
