'use client'

import React from 'react'

interface PersonaDetailsSidebarProps {
  isOpen: boolean
  onClose: () => void
  persona: any
  onAssign?: (scenarioId: string) => void
  onEdit?: (scenarioId: string) => void
  onDuplicate?: (scenarioId: string) => void
}

export default function PersonaDetailsSidebar({
  isOpen,
  onClose,
  persona,
  onAssign,
  onEdit,
  onDuplicate
}: PersonaDetailsSidebarProps) {
  if (!isOpen || !persona) return null

  // Fallbacks matching Figma media__1785585779255.png
  const personaName = persona.persona_name || persona.contact_title || 'Sarah Chen'
  const roleTitle = persona.contact_title || 'VP of Engineering'
  const company = persona.contact_company || 'Acme Technologies'
  const difficulty = persona.difficulty || 'Advanced'
  const tags = persona.tags || ['SaaS', 'Technical Buyer']

  // Helper to parse strings or arrays safely
  const parseList = (val: any, fallback: any[]): any[] => {
    if (Array.isArray(val)) return val
    if (typeof val === 'string' && val.trim().length > 0) {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) return parsed
      } catch (e) {}
      return val.split(',').map(s => s.trim()).filter(Boolean)
    }
    return fallback
  }

  // Safe renderer for any list item (whether string or object with name/title/label)
  const formatItemLabel = (item: any): string => {
    if (typeof item === 'string') return item
    if (typeof item === 'number') return String(item)
    if (item && typeof item === 'object') {
      return item.name || item.title || item.label || item.metric || JSON.stringify(item)
    }
    return ''
  }

  // Clean raw text if used (strip out questions, metadata tags, etc.)
  const cleanContext = (persona.context_text || '')
    .replace(/\[SCENARIO_METADATA:\s*\{[\s\S]*?\}\]/g, '')
    .replace(/\[MANDATORY EVALUATION RUBRIC[\s\S]*?(?=\n\[|$)/g, '')
    .replace(/-\s*\[(Opening|Closing|Discovery|Objection|Pitch|Technical|General)\][^\n]*/gi, '')
    .replace(/Questions the Rep should aim to ask:[^\n]*/gi, '')
    .replace(/\n{2,}/g, ' ')
    .trim()

  // Build clean AI profile summary from persona fields
  const buildProfileSummary = (): string => {
    const name = persona.persona_name || persona.contact_title || 'This persona'
    const role = persona.contact_title || ''
    const company = persona.contact_company || ''
    const industry = persona.industry || ''
    const parts: string[] = []

    if (role && company) {
      parts.push(`${name} is a ${role} at ${company}${industry ? ` in the ${industry} industry` : ''}.`)
    } else if (role) {
      parts.push(`${name} is a ${role}.`)
    }

    if (persona.customer_background) {
      parts.push(persona.customer_background)
    } else if (cleanContext && cleanContext.length > 10 && !cleanContext.includes('Questions the Rep')) {
      parts.push(cleanContext)
    }

    if (persona.communication_style && typeof persona.communication_style === 'string') {
      parts.push(persona.communication_style)
    }

    if (persona.objection_style && typeof persona.objection_style === 'string' && persona.objection_style.length < 200) {
      parts.push(`Objection style: ${persona.objection_style}`)
    } else if (persona.personality_traits) {
      const traits = typeof persona.personality_traits === 'string'
        ? persona.personality_traits.split(',').slice(0, 3).map((t: string) => t.trim()).join(', ')
        : Array.isArray(persona.personality_traits) ? persona.personality_traits.slice(0, 3).join(', ') : ''
      if (traits) parts.push(`Key traits: ${traits}.`)
    }

    return parts.join(' ').substring(0, 450) || `${name}${role ? ` — ${role}` : ''}${company ? ` at ${company}` : ''}.`
  }

  const aiBehaviorProfile = persona.ai_behavior_profile || persona.aiBehaviorProfile || persona.customer_background || buildProfileSummary()

  const communicationStyle = persona.communication_style ||
    'Direct and concise. Prefers written proposals, detailed specs, and demos over high-level pitches.'

  // Derivation helper for Pain Points
  const derivePainPoints = (): any[] => {
    const direct = parseList(persona.pain_points || persona.expected_objections || persona.painPoints, [])
    if (direct.length > 0) return direct

    const derived: string[] = []
    if (persona.objection_style && typeof persona.objection_style === 'string') {
      const parts = persona.objection_style.split(/[\n,;.]/).map((s: string) => s.trim()).filter((s: string) => s.length > 5)
      derived.push(...parts.slice(0, 3))
    }

    if (cleanContext && derived.length < 3) {
      const sentences = cleanContext.split(/(?<=[.!?])\s+/)
      for (const sentence of sentences) {
        if (/pain|challenge|issue|problem|slow|timeline|cost|risk|complexity|integration|legacy|difficulty|concern|manual|specification|compliance|quality/i.test(sentence)) {
          const trimmed = sentence.trim().substring(0, 70)
          if (trimmed && !derived.includes(trimmed)) derived.push(trimmed)
        }
      }
    }

    if (derived.length === 0 && persona.target_skills) {
      const skills = parseList(persona.target_skills, [])
      skills.forEach((sk: any) => {
        const str = formatItemLabel(sk)
        if (str) derived.push(`Evaluating ${str.toLowerCase()}`)
      })
    }

    return derived.slice(0, 4)
  }

  // Derivation helper for Business Goals
  const deriveBusinessGoals = (): any[] => {
    const direct = parseList(persona.business_goals || persona.priority_goals || persona.businessGoals, [])
    if (direct.length > 0) return direct

    const derived: string[] = []
    if (persona.meeting_objective) {
      derived.push(persona.meeting_objective.substring(0, 70))
    }

    if (cleanContext) {
      const sentences = cleanContext.split(/(?<=[.!?])\s+/)
      for (const sentence of sentences) {
        if (/goal|aim|reduce|increase|improve|modernize|achieve|scale|optimize|transition|capability|quality|supplier|performance/i.test(sentence)) {
          const trimmed = sentence.trim().substring(0, 70)
          if (trimmed && !derived.includes(trimmed)) derived.push(trimmed)
        }
      }
    }

    if (derived.length === 0 && persona.personality_traits) {
      const traits = parseList(persona.personality_traits, [])
      traits.forEach((t: any) => {
        const str = formatItemLabel(t)
        if (str && str.length > 3) derived.push(`${str.trim()} evaluation & standards`)
      })
    }

    return derived.slice(0, 4)
  }

  // Derivation helper for Decision Drivers
  const deriveDecisionDrivers = (): any[] => {
    const direct = parseList(persona.decision_drivers || persona.decisionDrivers, [])
    if (direct.length > 0) return direct

    const derived: string[] = []
    const scorecard = parseList(persona.scorecard_metrics || persona.scorecard_json || persona.evalScorecard, [])
    scorecard.forEach((m: any) => {
      const label = formatItemLabel(m)
      if (label && !derived.includes(label)) derived.push(label)
    })

    if (derived.length === 0 && persona.tags) {
      const tags = parseList(persona.tags, [])
      tags.forEach((t: any) => {
        const label = formatItemLabel(t)
        if (label) derived.push(label)
      })
    }

    return derived.slice(0, 4)
  }

  const painPoints = derivePainPoints()
  const businessGoals = deriveBusinessGoals()
  const decisionDrivers = deriveDecisionDrivers()
  const targetSkills = parseList(persona.target_skills || persona.skills_evaluated || persona.targetSkills, [])
  const scorecardMetrics = parseList(persona.scorecard_metrics || persona.scorecard_json || persona.evalScorecard || persona.scorecard, [])

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div className="bg-white w-full max-w-[500px] h-full shadow-2xl flex flex-col justify-between border-l border-gray-200 animate-slideLeft">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#1E1B4B] text-white font-[800] flex items-center justify-center text-sm shadow-sm">
              SC
            </div>
            <div>
              <h2 className="text-xl font-[800] text-[#1E293B]">{personaName}</h2>
              <p className="text-xs text-[#64748B] font-[500]">{roleTitle}</p>
              <p className="text-xs text-purple-600 font-[600]">{company}</p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="px-2.5 py-0.5 bg-red-50 text-red-600 font-[700] text-[10px] rounded-md">
                  {difficulty}
                </span>
                {tags.map((t: string, idx: number) => (
                  <span key={idx} className="px-2.5 py-0.5 bg-gray-100 text-[#475569] font-[600] text-[10px] rounded-md">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-colors text-base"
          >
            ×
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto text-xs">
          {/* AI Behavior Profile */}
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-[800] text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
              ℹ️ AI BEHAVIOR PROFILE
            </h3>
            <p className="text-[#334155] leading-relaxed bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
              {aiBehaviorProfile}
            </p>
          </div>

          {/* Communication Style */}
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">COMMUNICATION STYLE</h3>
            <p className="text-[#334155] leading-relaxed bg-gray-50/80 p-3.5 rounded-xl border border-gray-100">
              {communicationStyle}
            </p>
          </div>

          {/* Pain Points & Business Goals */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">PAIN POINTS</h3>
              <ul className="space-y-1.5 text-[#334155]">
                {painPoints.length === 0 && <span className="text-gray-400 italic">Not specified</span>}
                {painPoints.map((item: any, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-red-500 font-[700]">●</span>
                    <span className="leading-tight">{formatItemLabel(item)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">BUSINESS GOALS</h3>
              <ul className="space-y-1.5 text-[#334155]">
                {businessGoals.length === 0 && <span className="text-gray-400 italic">Not specified</span>}
                {businessGoals.map((item: any, idx: number) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-green-600 font-[700]">✓</span>
                    <span className="leading-tight">{formatItemLabel(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Decision Drivers */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <h3 className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">DECISION DRIVERS</h3>
            <div className="flex flex-wrap gap-1.5">
              {decisionDrivers.length === 0 && <span className="text-gray-400 italic">Not specified</span>}
              {decisionDrivers.map((driver: any, idx: number) => (
                <span key={idx} className="px-3 py-1 bg-gray-100 text-[#334155] text-[11px] font-[600] rounded-full">
                  {formatItemLabel(driver)}
                </span>
              ))}
            </div>
          </div>

          {/* Target Skills */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <h3 className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">TARGET SKILLS</h3>
            <div className="flex flex-wrap gap-1.5">
              {targetSkills.length === 0 && <span className="text-gray-400 italic">Not specified</span>}
              {targetSkills.map((skill: any, idx: number) => (
                <span key={idx} className="px-3 py-1 bg-purple-50 text-purple-700 text-[11px] font-[700] rounded-full">
                  {formatItemLabel(skill)}
                </span>
              ))}
            </div>
          </div>

          {/* Evaluation Scorecard */}
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">EVALUATION SCORECARD</h3>
              {scorecardMetrics.length > 0 && (
                <span className="text-[10px] font-[700] text-purple-600 cursor-pointer hover:underline">
                  View all {scorecardMetrics.length} metrics →
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {scorecardMetrics.length === 0 && <span className="text-gray-400 italic">Not specified</span>}
              {scorecardMetrics.map((m: any, idx: number) => {
                const label = formatItemLabel(m)
                const weight = typeof m === 'object' && m?.weight ? ` (${m.weight}%)` : ''
                return (
                  <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-[700] rounded-lg border border-blue-100">
                    ⚡ {label}{weight}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <button
            onClick={() => onDuplicate && onDuplicate(persona.id)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-[700] text-[#334155] hover:bg-gray-100 transition-colors"
          >
            Duplicate
          </button>
          <button
            onClick={() => onEdit && onEdit(persona.id)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-[700] text-[#334155] hover:bg-gray-100 transition-colors"
          >
            Edit Persona
          </button>
          <button
            onClick={() => {
              onClose()
              if (onAssign) onAssign(persona.id)
            }}
            className="px-5 py-2 rounded-xl bg-[#1E1B4B] hover:bg-[#2E2A72] text-white text-xs font-[700] shadow-md transition-colors"
          >
            Assign Persona
          </button>
        </div>
      </div>
    </div>
  )
}
