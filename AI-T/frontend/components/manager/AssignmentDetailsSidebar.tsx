'use client'

import React from 'react'

interface AssignmentDetailsSidebarProps {
  isOpen: boolean
  onClose: () => void
  assignment: any
  onEdit?: (assignmentId: string) => void
  onReassign?: (assignmentId: string) => void
  onMarkComplete?: (assignmentId: string) => void
}

export default function AssignmentDetailsSidebar({
  isOpen,
  onClose,
  assignment,
  onEdit,
  onReassign,
  onMarkComplete
}: AssignmentDetailsSidebarProps) {
  if (!isOpen || !assignment) return null

  // Defaults matching Figma media__1785585971677.png
  const repName = assignment.rep_name || 'Pankaj Kumar'
  const repRole = assignment.rep_role || 'Sales Representative'
  const personaName = assignment.scenario?.persona_name || assignment.persona_name || 'Prospect'
  const company = assignment.scenario?.contact_company || assignment.company || 'Company'
  const scenarioTitle = assignment.scenario_name || assignment.scenario_title || 'Unknown Scenario'
  const status = assignment.status || 'In Progress'
  const difficulty = assignment.difficulty || 'Advanced'
  const priority = assignment.priority || 'High'
  
  const assignedOn = assignment.created_at ? new Date(assignment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (assignment.assigned_on || 'N/A')
  const dueDate = assignment.deadline ? new Date(assignment.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : (assignment.due_date || 'N/A')
  const assignedBy = 'Lokesh (Manager)'
  const industry = assignment.industry || 'Tech'

  const scorePct = assignment.score ? Math.round(assignment.score) : (assignment.score_pct || null)
  const attemptsCount = assignment.attempts_count || (scorePct ? 1 : 0)
  const timePracticedMins = assignment.time_practiced_mins || (scorePct ? 12 : 0)
  const bestScore = assignment.score ? Math.round(assignment.score) : (assignment.best_score || null)

  // Helper to parse strings or arrays safely
  const parseList = (val: any, fallback: string[]): string[] => {
    if (Array.isArray(val)) return val
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.split(',').map(s => s.trim()).filter(Boolean)
    }
    return fallback
  }

  let strengths = parseList(assignment.strengths, [])
  let skillGaps = parseList(assignment.skill_gaps, [])

  if (assignment.feedback) {
    if (Array.isArray(assignment.feedback.strengths)) strengths = assignment.feedback.strengths
    if (Array.isArray(assignment.feedback.areas_for_improvement)) skillGaps = assignment.feedback.areas_for_improvement
    else if (Array.isArray(assignment.feedback.weaknesses)) skillGaps = assignment.feedback.weaknesses
  }

  const generatedActivity = []
  if (assignment.completed_at || assignment.score) {
    generatedActivity.push({ 
      text: `Session completed — Score ${scorePct || 'Pending'}`, 
      time: assignment.completed_at ? new Date(assignment.completed_at).toLocaleDateString() : 'Recently', 
      color: 'bg-green-500' 
    })
  }
  generatedActivity.push({ 
    text: 'Assignment created', 
    time: assignedOn, 
    color: 'bg-purple-500' 
  })

  const recentActivity = Array.isArray(assignment.recent_activity) ? assignment.recent_activity : generatedActivity

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div className="bg-white w-full max-w-[480px] h-full shadow-2xl flex flex-col justify-between border-l border-gray-200 animate-slideLeft">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-[800] text-[#1E293B]">Assignment Details</h2>
              <p className="text-xs text-[#64748B] mt-0.5">{repName} · {scenarioTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors text-base"
            >
              ×
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between bg-white p-3.5 rounded-2xl border border-gray-200/80 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1E1B4B] text-white font-[800] flex items-center justify-center text-xs">
                PK
              </div>
              <div>
                <h3 className="font-[800] text-[#1E293B] text-xs">{repName}</h3>
                <p className="text-[10px] text-[#64748B]">{repRole}</p>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[10px] font-[800] rounded-full border border-amber-100">
              ● {status}
            </span>
          </div>

          <div className="mt-3 bg-purple-50/60 p-3 rounded-xl border border-purple-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#7C3AED] text-white flex items-center justify-center font-[700] text-[10px]">
                SC
              </div>
              <div>
                <p className="font-[700] text-[#1E293B] text-[11px]">{personaName}</p>
                <p className="text-[10px] text-[#64748B]">{company}</p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 bg-white text-purple-700 font-[700] text-[10px] rounded-md border border-purple-200">
              {scenarioTitle}
            </span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto text-xs">
          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-[10px] font-[800] text-[#64748B] uppercase">DIFFICULTY</p>
              <p className="font-[700] text-purple-700 mt-0.5">{difficulty}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-[10px] font-[800] text-[#64748B] uppercase">PRIORITY</p>
              <p className="font-[700] text-red-600 mt-0.5">{priority}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-[10px] font-[800] text-[#64748B] uppercase">ASSIGNED ON</p>
              <p className="font-[600] text-[#1E293B] mt-0.5">{assignedOn}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-[10px] font-[800] text-[#64748B] uppercase">DUE DATE</p>
              <p className="font-[600] text-[#1E293B] mt-0.5">{dueDate}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-[10px] font-[800] text-[#64748B] uppercase">ASSIGNED BY</p>
              <p className="font-[600] text-[#1E293B] mt-0.5">{assignedBy}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
              <p className="text-[10px] font-[800] text-[#64748B] uppercase">INDUSTRY</p>
              <p className="font-[600] text-[#1E293B] mt-0.5">{industry}</p>
            </div>
          </div>

          {/* Progress Section */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <h3 className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">PROGRESS</h3>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between text-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full border-4 border-amber-500 flex items-center justify-center font-[800] text-sm text-[#1E293B]">
                  {scorePct}%
                </div>
              </div>

              <div>
                <p className="text-base font-[800] text-[#1E293B]">{attemptsCount}</p>
                <p className="text-[10px] font-[600] text-[#64748B]">Attempts</p>
              </div>

              <div>
                <p className="text-base font-[800] text-[#1E293B]">{timePracticedMins} min</p>
                <p className="text-[10px] font-[600] text-[#64748B]">Practiced</p>
              </div>

              <div>
                <p className="text-base font-[800] text-[#1E293B]">{bestScore}%</p>
                <p className="text-[10px] font-[600] text-[#64748B]">Best Score</p>
              </div>
            </div>
          </div>

          {/* Strengths & Skill Gaps */}
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div className="space-y-1.5">
              <h4 className="text-[10px] font-[800] text-[#64748B] uppercase">STRENGTHS</h4>
              <ul className="space-y-1 text-[#334155]">
                {strengths.map((s: string, idx: number) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="text-green-600 font-[700]">✓</span> {s}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1.5 pt-2">
              <h4 className="text-[10px] font-[800] text-[#64748B] uppercase">SKILL GAPS</h4>
              <ul className="space-y-1 text-[#334155]">
                {skillGaps.map((g: string, idx: number) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="text-amber-500 font-[700]">⚠️</span> {g}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recent Activity Timeline */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <h3 className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">RECENT ACTIVITY</h3>
            <div className="space-y-3 pl-2 border-l-2 border-gray-200 ml-1">
              {recentActivity.map((act: any, idx: number) => (
                <div key={idx} className="relative pl-4 space-y-0.5">
                  <div className={`absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full ${act.color}`}></div>
                  <p className="font-[700] text-[#1E293B] text-xs">{act.text}</p>
                  <p className="text-[10px] text-[#64748B]">{act.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <button
            onClick={() => onEdit && onEdit(assignment.id)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-[700] text-[#334155] hover:bg-gray-100 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onReassign && onReassign(assignment.id)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-[700] text-[#334155] hover:bg-gray-100 transition-colors"
          >
            Reassign
          </button>
          <button
            onClick={() => {
              onClose()
              if (onMarkComplete) onMarkComplete(assignment.id)
            }}
            className="px-5 py-2 rounded-xl bg-[#1E1B4B] hover:bg-[#2E2A72] text-white text-xs font-[700] shadow-md transition-colors"
          >
            Mark Complete
          </button>
        </div>
      </div>
    </div>
  )
}
