'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

interface SessionSnapshotModalProps {
  isOpen: boolean
  onClose: () => void
  snapshotData?: any
  scenarioId?: string
  sessionId?: string
}

export default function SessionSnapshotModal({
  isOpen,
  onClose,
  snapshotData,
  scenarioId,
  sessionId
}: SessionSnapshotModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  // Skill Name Formatter
  const formatSkillName = (key: string) => {
    const map: Record<string, string> = {
      'value_communication': 'Value Communication',
      'customer_understanding': 'Customer Understanding',
      'objection_concern_handling': 'Objection & Concern Handling',
      'active_listening_engagement': 'Active Listening & Engagement',
      'communication_professionalism': 'Communication & Professionalism',
      'next_steps_call_effectiveness': 'Next Steps & Call Effectiveness'
    }
    if (map[key]) return map[key]
    return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  // Read real snapshot feedback from DB
  const rawSkillBreakdown = snapshotData?.skill_breakdown || snapshotData?.partial_feedback?.scores || {
    'Value Communication': 75,
    'Customer Understanding': 70,
    'Objection & Concern Handling': 65,
    'Active Listening & Engagement': 80
  }

  const skillBreakdown = Object.entries(rawSkillBreakdown).reduce((acc: any, [key, val]: [string, any]) => {
    const formatted = formatSkillName(key)
    const numVal = typeof val === 'number' && val > 0 ? val : 70
    acc[formatted] = numVal
    return acc
  }, {})

  const rawStrengths = snapshotData?.whats_going_well || snapshotData?.partial_feedback?.strengths
  const whatsGoingWell = Array.isArray(rawStrengths) && rawStrengths.length > 0
    ? rawStrengths
    : [
        'Active listening and steady pacing',
        'Maintained positive customer sentiment'
      ]

  const rawImprovements = snapshotData?.needs_attention || snapshotData?.partial_feedback?.improvements
  const needsAttention = Array.isArray(rawImprovements) && rawImprovements.length > 0
    ? rawImprovements
    : [
        'Explore technical requirements in greater depth',
        'Reinforce value proposition before moving to next stage'
      ]

  const lastQuestionUser = snapshotData?.last_question_user || "Could you walk me through your current process?"
  const lastQuestionPersona = snapshotData?.last_question_persona || snapshotData?.last_question || "We are currently evaluating solutions to streamline operations."
  const nextStepTip = snapshotData?.next_step_tip || "Tip: Connect their operational pain points to specific product capabilities."

  const currentStage = snapshotData?.current_stage || "Opening"
  const stagesCompletedText = snapshotData?.stages_completed || "1 / 5"

  const handleResume = () => {
    onClose()
    if (scenarioId) {
      if (sessionId) {
        router.push(`/rep/train/${scenarioId}/briefing?sessionId=${sessionId}`)
      } else {
        router.push(`/rep/train/${scenarioId}`)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-[540px] rounded-[20px] shadow-2xl overflow-hidden border border-gray-100 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-[800] text-[#1E293B] tracking-tight">Session Snapshot</h2>
            <p className="text-xs text-[#64748B] font-[500] mt-0.5">Performance up to this point in the conversation</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors text-lg"
          >
            ×
          </button>
        </div>

        <div className="p-7 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Skill Breakdown */}
          <div className="bg-gray-50/50 border border-gray-200/60 rounded-[16px] p-5 space-y-4">
            <h3 className="text-xs font-[800] text-[#64748B] tracking-wider uppercase">SKILL BREAKDOWN</h3>
            <div className="space-y-3.5">
              {Object.entries(skillBreakdown).map(([skill, score]: [string, any]) => {
                const numericScore = typeof score === 'number' ? score : 70
                let barColor = 'bg-purple-600'
                if (numericScore < 50) barColor = 'bg-red-500'
                else if (numericScore < 70) barColor = 'bg-amber-500'

                return (
                  <div key={skill} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-[600] text-[#334155]">
                      <span>{skill}</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} transition-all duration-500 rounded-full`}
                        style={{ width: `${Math.min(100, Math.max(0, numericScore))}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Side by Side Feedback Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* What's Going Well */}
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-[16px] p-4 space-y-2.5">
              <h4 className="text-xs font-[800] text-[#166534] tracking-wider uppercase flex items-center gap-1.5">
                WHAT'S GOING WELL
              </h4>
              <ul className="space-y-2">
                {whatsGoingWell.map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-xs font-[500] text-[#15803D]">
                    <span className="text-[#16A34A] font-[700] text-sm">✓</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Needs Attention */}
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[16px] p-4 space-y-2.5">
              <h4 className="text-xs font-[800] text-[#92400E] tracking-wider uppercase flex items-center gap-1.5">
                NEEDS ATTENTION
              </h4>
              <ul className="space-y-2">
                {needsAttention.map((item: string, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-xs font-[500] text-[#B45309]">
                    <span className="text-[#D97706] font-[700] text-sm">⚠️</span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Last Question Discussed */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[16px] p-5 space-y-3">
            <h3 className="text-xs font-[800] text-[#64748B] tracking-wider uppercase">LAST QUESTION DISCUSSED</h3>
            <div className="space-y-3">
              {/* Rep Bubble */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#1E293B] text-white flex items-center justify-center text-xs font-[700] shrink-0">
                  Y
                </div>
                <div className="bg-white border border-gray-200/80 rounded-2xl rounded-tl-none p-3.5 text-xs text-[#334155] leading-relaxed shadow-sm flex-1">
                  {lastQuestionUser}
                </div>
              </div>

              {/* Persona Bubble */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-xs font-[700] shrink-0">
                  S
                </div>
                <div className="bg-white border border-gray-200/80 rounded-2xl rounded-tl-none p-3.5 text-xs text-[#334155] leading-relaxed shadow-sm flex-1">
                  {lastQuestionPersona}
                </div>
              </div>
            </div>
            <p className="text-[11px] font-[500] text-[#64748B] bg-white/60 p-2.5 rounded-lg border border-gray-100 italic">
              {nextStepTip}
            </p>
          </div>

          {/* Conversation Progress */}
          <div className="bg-gray-50/50 border border-gray-200/60 rounded-[16px] p-5 space-y-3">
            <h3 className="text-xs font-[800] text-[#64748B] tracking-wider uppercase">CONVERSATION PROGRESS</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3.5 rounded-xl border border-gray-200/60 shadow-sm">
                <p className="text-[11px] font-[600] text-[#64748B]">Current Stage</p>
                <p className="text-sm font-[800] text-[#1E293B] mt-1">{currentStage}</p>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-gray-200/60 shadow-sm">
                <p className="text-[11px] font-[600] text-[#64748B]">Stages Completed</p>
                <p className="text-sm font-[800] text-[#1E293B] mt-1">{stagesCompletedText}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-7 py-4 bg-gray-50/80 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-[700] text-[#334155] hover:bg-white transition-colors"
          >
            Close Summary
          </button>
          <button
            onClick={handleResume}
            className="px-6 py-2.5 rounded-xl bg-[#1E1B4B] hover:bg-[#2E2A72] text-white text-xs font-[700] flex items-center gap-2 shadow-md transition-colors"
          >
            <span>▷</span> Resume Training
          </button>
        </div>
      </div>
    </div>
  )
}
