'use client'

import React, { useState, useEffect } from 'react'

interface AssignTrainingWizardProps {
  isOpen: boolean
  onClose: () => void
  scenarios: any[]
  reps: any[]
  onSuccess: () => void
  initialData?: {
    scenarioId?: string
    repId?: string
    mode?: string
    priority?: string
  }
}

export default function AssignTrainingWizard({
  isOpen,
  onClose,
  scenarios = [],
  reps = [],
  onSuccess,
  initialData
}: AssignTrainingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Form State
  const [trainingMode, setTrainingMode] = useState<'Exam Mode' | 'Coach Mode' | 'Learning Mode'>('Exam Mode')
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0]?.id || '')
  const [selectedRepIds, setSelectedRepIds] = useState<string[]>([])
  const [deadline, setDeadline] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  })
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('High')
  const [notes, setNotes] = useState('')
  const [notifyImmediate, setNotifyImmediate] = useState(true)
  const [notifyReminder, setNotifyReminder] = useState(true)
  const [notifyCompletion, setNotifyCompletion] = useState(true)
  const [avatarType, setAvatarType] = useState<'female' | 'male'>('female')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (initialData?.scenarioId) setSelectedScenarioId(initialData.scenarioId)
      else if (scenarios && scenarios.length > 0) setSelectedScenarioId(scenarios[0].id)
      
      if (initialData?.repId) setSelectedRepIds([initialData.repId])
      else setSelectedRepIds([])

      if (initialData?.mode) setTrainingMode(initialData.mode as any)
      else setTrainingMode('Exam Mode')

      if (initialData?.priority) setPriority(initialData.priority as any)
      else setPriority('High')
      
      setStep(1)
    }
  }, [isOpen, initialData, scenarios])

  if (!isOpen) return null

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0] || {
    id: 'scen-1',
    persona_name: 'Technical Discovery',
    contact_title: 'Sarah Chen',
    contact_company: 'Acme Technologies',
    difficulty: 'Advanced',
    estimated_duration_mins: 30,
    skills: ['Discovery', 'Qualification', 'Active Listening', 'Objection Handling']
  }

  const getSkillsList = (scenario: any) => {
    const raw = scenario?.target_skills || scenario?.targetSkills || scenario?.skills_evaluated || scenario?.skills || ['Discovery', 'Qualification', 'Active Listening', 'Objection Handling']
    if (typeof raw === 'string') return raw.split(',').map((s: string) => s.trim()).filter(Boolean)
    return Array.isArray(raw) ? raw : []
  }

  const selectedRepsList = reps.filter(r => selectedRepIds.includes(r.id))

  const handleToggleRep = (repId: string) => {
    if (selectedRepIds.includes(repId)) {
      setSelectedRepIds(selectedRepIds.filter(id => id !== repId))
    } else {
      setSelectedRepIds([...selectedRepIds, repId])
    }
  }

  const handleToggleAllReps = () => {
    if (selectedRepIds.length === reps.length) {
      setSelectedRepIds([])
    } else {
      setSelectedRepIds(reps.map(r => r.id))
    }
  }

  const handleFinishAssignment = async () => {
    setAssigning(true)
    try {
      const token = localStorage.getItem('token')
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

      const isUuid = (str: string) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
      const validSelectedRepIds = selectedRepIds.filter(id => isUuid(id))
      if (validSelectedRepIds.length === 0) {
        alert('Please select at least one sales representative.')
        setAssigning(false)
        return
      }
      const finalRepIds = validSelectedRepIds

      const res = await fetch(`${API}/api/users/assign-training`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          repIds: finalRepIds,
          scenarioId: isUuid(selectedScenario?.id) ? selectedScenario.id : (isUuid(scenarios[0]?.id) ? scenarios[0].id : selectedScenario?.id),
          deadline,
          priority,
          avatarType,
          trainingMode,
          notes,
          notifyImmediate,
          notifyReminder,
          notifyCompletion
        })
      })

      if (res.ok) {
        onSuccess()
        onClose()
      } else {
        const errData = await res.json().catch(() => ({}))
        alert(errData.error || 'Failed to assign training.')
      }
    } catch (err) {
      console.error(err)
      alert('Error creating assignment.')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-[900px] rounded-[24px] shadow-2xl overflow-hidden border border-gray-100 my-6">
        {/* Header */}
        <div className="bg-[#1E1B4B] text-white px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-[800]">Assign Training</h2>
            <p className="text-xs text-purple-200 mt-0.5">Configure and assign a training scenario to your sales representatives</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg"
          >
            ×
          </button>
        </div>

        {/* 4-Step Progress Indicator */}
        <div className="px-8 py-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-[800] ${step > 1 ? 'bg-green-600 text-white' : step === 1 ? 'bg-[#1E1B4B] text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > 1 ? '✓' : '1'}
              </div>
              <span className={`text-xs font-[700] ${step === 1 ? 'text-[#1E1B4B]' : 'text-gray-500'}`}>Training Mode</span>
            </div>
            <div className={`h-0.5 flex-1 mx-3 ${step > 1 ? 'bg-green-600' : 'bg-gray-200'}`}></div>

            {/* Step 2 */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-[800] ${step > 2 ? 'bg-green-600 text-white' : step === 2 ? 'bg-[#1E1B4B] text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > 2 ? '✓' : '2'}
              </div>
              <span className={`text-xs font-[700] ${step === 2 ? 'text-[#1E1B4B]' : 'text-gray-500'}`}>Select Training</span>
            </div>
            <div className={`h-0.5 flex-1 mx-3 ${step > 2 ? 'bg-green-600' : 'bg-gray-200'}`}></div>

            {/* Step 3 */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-[800] ${step > 3 ? 'bg-green-600 text-white' : step === 3 ? 'bg-[#1E1B4B] text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > 3 ? '✓' : '3'}
              </div>
              <span className={`text-xs font-[700] ${step === 3 ? 'text-[#1E1B4B]' : 'text-gray-500'}`}>Assign Representatives</span>
            </div>
            <div className={`h-0.5 flex-1 mx-3 ${step > 3 ? 'bg-green-600' : 'bg-gray-200'}`}></div>

            {/* Step 4 */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-[800] ${step === 4 ? 'bg-[#1E1B4B] text-white' : 'bg-gray-200 text-gray-500'}`}>
                4
              </div>
              <span className={`text-xs font-[700] ${step === 4 ? 'text-[#1E1B4B]' : 'text-gray-500'}`}>Review & Confirm</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-8 max-h-[65vh] overflow-y-auto">
          {/* STEP 1: Training Mode (Figma media__1785586342661.png) */}
          {step === 1 && (
            <div className="space-y-6">
              <p className="text-xs text-[#64748B] text-center font-[500]">
                Select how the AI will assist during this training session. This setting applies to all assigned representatives.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Exam Mode Card */}
                <div
                  onClick={() => setTrainingMode('Exam Mode')}
                  className={`border rounded-2xl p-6 cursor-pointer transition-all flex flex-col justify-between ${
                    trainingMode === 'Exam Mode'
                      ? 'border-[#1E1B4B] bg-purple-50/20 ring-2 ring-[#1E1B4B]/20 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">📝</span>
                      <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 font-[700] text-[10px] rounded-md">
                        Assessment
                      </span>
                    </div>
                    <h3 className="text-base font-[800] text-[#1E293B]">Exam Mode</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Evaluate the sales representative without any live assistance.
                    </p>

                    <ul className="space-y-1.5 pt-3 border-t border-gray-100 text-[11px] text-[#475569]">
                      <li className="flex items-center gap-2"><span className="text-gray-400">⦿</span> Customer Sentiment</li>
                      <li className="flex items-center gap-2"><span className="text-gray-400">⦿</span> Speaking Pace</li>
                      <li className="flex items-center gap-2"><span className="text-gray-400">⦿</span> Silence Detection</li>
                      <li className="flex items-center gap-2"><span className="text-gray-400">⦿</span> Post-session feedback</li>
                      <li className="flex items-center gap-2"><span className="text-gray-400">⦿</span> AI Scorecard</li>
                      <li className="flex items-center gap-2"><span className="text-gray-400">⦿</span> No real-time hints</li>
                    </ul>
                  </div>
                </div>

                {/* Coach Mode Card */}
                <div
                  onClick={() => setTrainingMode('Coach Mode')}
                  className={`border rounded-2xl p-6 cursor-pointer transition-all flex flex-col justify-between ${
                    trainingMode === 'Coach Mode'
                      ? 'border-[#1E1B4B] bg-purple-50/20 ring-2 ring-[#1E1B4B]/20 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">🎯</span>
                      <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 font-[700] text-[10px] rounded-md">
                        Guided Coaching
                      </span>
                    </div>
                    <h3 className="text-base font-[800] text-[#1E293B]">Coach Mode</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Provide real-time coaching while allowing the rep to drive the conversation independently.
                    </p>

                    <ul className="space-y-1.5 pt-3 border-t border-gray-100 text-[11px] text-[#475569]">
                      <li className="flex items-center gap-2"><span className="text-purple-600">⦿</span> Live AI hints</li>
                      <li className="flex items-center gap-2"><span className="text-purple-600">⦿</span> Customer Sentiment</li>
                      <li className="flex items-center gap-2"><span className="text-purple-600">⦿</span> Emotion Detection</li>
                      <li className="flex items-center gap-2"><span className="text-purple-600">⦿</span> Talk-to-Listen Ratio</li>
                      <li className="flex items-center gap-2"><span className="text-purple-600">⦿</span> Speaking Pace</li>
                      <li className="flex items-center gap-2"><span className="text-purple-600">⦿</span> Objection hints</li>
                    </ul>
                  </div>
                </div>

                {/* Learning Mode Card */}
                <div
                  onClick={() => setTrainingMode('Learning Mode')}
                  className={`border rounded-2xl p-6 cursor-pointer transition-all flex flex-col justify-between ${
                    trainingMode === 'Learning Mode'
                      ? 'border-[#1E1B4B] bg-purple-50/20 ring-2 ring-[#1E1B4B]/20 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">🚀</span>
                      <span className="px-2.5 py-0.5 bg-purple-100 text-purple-700 font-[700] text-[10px] rounded-md">
                        AI Assisted
                      </span>
                    </div>
                    <h3 className="text-base font-[800] text-[#1E293B]">Learning Mode</h3>
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      An AI-assisted learning experience with proactive recommendations and coaching throughout the call.
                    </p>

                    <ul className="space-y-1.5 pt-3 border-t border-gray-100 text-[11px] text-[#475569]">
                      <li className="flex items-center gap-2"><span className="text-purple-600">⦿</span> Everything in Coach Mode</li>
                      <li className="flex items-center gap-2"><span className="text-purple-600">⦿</span> Product recommendations</li>
                      <li className="flex items-center gap-2"><span className="text-purple-600">⦿</span> Full objection responses</li>
                      <li className="flex items-center gap-2"><span className="text-purple-600">⦿</span> Follow-up suggestions</li>
                      <li className="flex items-center gap-2"><span className="text-purple-600">⦿</span> Battle cards & MEDDICC</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Select Training (Figma media__1785586349626.png) */}
          {step === 2 && (
            <div className="max-w-xl mx-auto space-y-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
                <h3 className="text-xs font-[800] text-[#64748B] tracking-wider uppercase">TRAINING CONFIGURATION</h3>

                <div className="space-y-1.5">
                  <label className="text-xs font-[700] text-[#1E293B]">Training Scenario</label>
                  <select
                    value={selectedScenarioId}
                    onChange={e => setSelectedScenarioId(e.target.value)}
                    className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-3.5 text-xs font-[600] text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1E1B4B]"
                  >
                    {scenarios.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.persona_name || s.contact_title || 'Technical Discovery'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-[600] text-gray-400">Deals (Optional)</label>
                  <input
                    disabled
                    placeholder="Select a deal..."
                    className="w-full h-11 bg-gray-100 border border-gray-200 rounded-xl px-3.5 text-xs text-gray-400 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-[700] text-[#1E293B]">Scenario Difficulty</label>
                  <div>
                    <span className="inline-flex items-center px-3 py-1.5 bg-[#1E1B4B]/5 text-[#1E1B4B] text-xs font-[700] rounded-lg border border-[#1E1B4B]/10">
                      {selectedScenario?.difficulty || 'Advanced'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-[700] text-[#1E293B]">AI Voice Persona</label>
                  <div className="flex gap-4 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="avatarType" 
                        value="female" 
                        checked={avatarType === 'female'} 
                        onChange={() => setAvatarType('female')}
                        className="text-[#1E1B4B] focus:ring-[#1E1B4B]"
                      />
                      <span className="text-xs font-[600] text-[#1E293B]">Female Voice</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="avatarType" 
                        value="male" 
                        checked={avatarType === 'male'} 
                        onChange={() => setAvatarType('male')}
                        className="text-[#1E1B4B] focus:ring-[#1E1B4B]"
                      />
                      <span className="text-xs font-[600] text-[#1E293B]">Male Voice</span>
                    </label>
                  </div>
                </div>

                {/* Scenario Details Preview Card */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/80 space-y-2">
                  <p className="text-[10px] font-[800] text-[#64748B] uppercase">SCENARIO DETAILS</p>
                  <p className="text-xs font-[700] text-[#1E293B]">⏱️ {selectedScenario?.estimated_duration_mins || 30} mins</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {getSkillsList(selectedScenario).map((skill: string, idx: number) => (
                      <span key={idx} className="px-2.5 py-1 bg-white border border-gray-200 text-[#475569] text-[10px] font-[600] rounded-md">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Assign Representatives (Figma media__1785586355204.png) */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  placeholder="Search representatives..."
                  className="w-full max-w-sm h-10 bg-gray-50 border border-gray-200 rounded-xl px-3.5 text-xs text-[#1E293B] focus:outline-none"
                />
                <span className="text-xs text-[#64748B] font-[600]">
                  Selected: <span className="font-[800] text-[#1E1B4B]">{selectedRepIds.length}</span>
                </span>
              </div>

              {/* Data Table */}
              <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-[800] text-[#64748B] uppercase tracking-wider">
                    <tr>
                      <th className="p-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedRepIds.length === reps.length && reps.length > 0}
                          onChange={handleToggleAllReps}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                      </th>
                      <th className="p-4">SALES REP</th>
                      <th className="p-4">TEAM</th>
                      <th className="p-4">MANAGER</th>
                      <th className="p-4">ASSIGNMENTS</th>
                      <th className="p-4">AVG SCORE</th>
                      <th className="p-4">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-[500] text-[#334155]">
                    {reps.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-[#64748B]">
                          <div className="flex flex-col items-center gap-3">
                            <span className="text-4xl">👥</span>
                            <p className="font-[700] text-sm text-[#1E293B]">No representatives found</p>
                            <p className="text-xs">Add sales reps to your organization to assign training.</p>
                          </div>
                        </td>
                      </tr>
                    ) : reps
                    .filter((r: any) => !r.name?.toLowerCase().includes('lokesh') && r.role !== 'manager')
                    .map((r: any) => {
                      const isChecked = selectedRepIds.includes(r.id)
                      return (
                        <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="p-4">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleRep(r.id)}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                          </td>
                          <td className="p-4 font-[700] text-[#1E293B] flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-[#1E1B4B] text-white flex items-center justify-center text-[10px] font-[800]">
                              {r.name?.substring(0, 2).toUpperCase() || 'PK'}
                            </div>
                            <span>{r.name}</span>
                          </td>
                          <td className="p-4 text-[#64748B]">{r.team_name || 'Enterprise'}</td>
                          <td className="p-4 text-[#64748B]">Lokesh (Manager)</td>
                          <td className="p-4">{r.session_count || 0}</td>
                          <td className="p-4 font-[700] text-green-600">{r.overall_score !== undefined && r.overall_score !== null ? `${r.overall_score}%` : 'N/A'}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 text-[10px] font-[700] rounded-full ${['Needs Coaching', 'High Risk'].includes(r.status) ? 'bg-red-50 text-red-700' : r.status === 'On Leave' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                              ● {r.status || 'Active'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: Review & Confirm (Figma media__1785583167921.png) */}
          {step === 4 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Details Column */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
                  <h3 className="text-xs font-[800] text-[#64748B] tracking-wider uppercase">ASSIGNMENT DETAILS</h3>

                  <div className="space-y-1.5">
                    <label className="text-xs font-[700] text-[#1E293B]">Deadline*</label>
                    <input
                      type="date"
                      value={deadline}
                      onChange={e => setDeadline(e.target.value)}
                      className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-3.5 text-xs text-[#1E293B] focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-[700] text-[#1E293B]">Priority</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['Low', 'Medium', 'High'] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`py-2.5 rounded-xl border text-xs font-[700] transition-colors ${
                            priority === p
                              ? p === 'High'
                                ? 'bg-red-50 border-red-500 text-red-600'
                                : 'bg-purple-50 border-purple-600 text-purple-700'
                              : 'bg-white border-gray-200 text-[#64748B]'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-[700] text-[#1E293B]">Assignment Notes (optional)</label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Add any context or instructions for the representatives..."
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#1E293B] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Right Assignment Preview Column */}
              <div className="lg:col-span-5 bg-[#1E1B4B] text-white rounded-2xl p-6 space-y-5 shadow-lg">
                <div>
                  <p className="text-[10px] font-[800] text-purple-300 uppercase tracking-wider">ASSIGNMENT PREVIEW</p>
                  <h3 className="text-xl font-[800] mt-1">{selectedScenario?.persona_name || 'Technical Discovery'}</h3>
                </div>

                <div className="space-y-3 text-xs border-t border-purple-900/50 pt-4">
                  <div className="flex justify-between text-purple-200">
                    <span>Training Mode</span>
                    <span className="font-[700] text-white">{trainingMode}</span>
                  </div>
                  <div className="flex justify-between text-purple-200">
                    <span>Training</span>
                    <span className="font-[700] text-white">{selectedScenario?.persona_name || 'Technical Discovery'}</span>
                  </div>
                  <div className="flex justify-between text-purple-200">
                    <span>Type</span>
                    <span className="font-[700] text-white">Voice Call</span>
                  </div>
                  <div className="flex justify-between text-purple-200">
                    <span>AI Voice</span>
                    <span className="font-[700] text-white capitalize">{avatarType}</span>
                  </div>
                  <div className="flex justify-between text-purple-200">
                    <span>Difficulty</span>
                    <span className="font-[700] text-white">{selectedScenario?.difficulty || 'Advanced'}</span>
                  </div>
                  <div className="flex justify-between text-purple-200">
                    <span>Assigned To</span>
                    <span className="font-[700] text-white">{selectedRepIds.length || 1} Representative</span>
                  </div>
                  <div className="flex justify-between text-purple-200">
                    <span>Deadline</span>
                    <span className="font-[700] text-white">{deadline}</span>
                  </div>
                  <div className="flex justify-between text-purple-200">
                    <span>Priority</span>
                    <span className="font-[700] text-red-300">{priority}</span>
                  </div>
                  <div className="flex justify-between text-purple-200">
                    <span>Est. Duration</span>
                    <span className="font-[700] text-white">30 mins</span>
                  </div>
                </div>

                {/* Representatives */}
                <div className="pt-3 border-t border-purple-900/50 space-y-2">
                  <p className="text-[10px] font-[800] text-purple-300 uppercase">Representatives</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedRepsList.length > 0 ? selectedRepsList : []).map((r: any, idx: number) => (
                      <span key={idx} className="px-2.5 py-1 bg-white/10 text-white text-[11px] font-[600] rounded-md border border-white/10">
                        {r.name?.split(' ')[0] || 'Unknown'}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Skills Covered */}
                <div className="pt-3 border-t border-purple-900/50 space-y-2">
                  <p className="text-[10px] font-[800] text-purple-300 uppercase">Skills Covered</p>
                  <div className="flex flex-wrap gap-1.5">
                    {getSkillsList(selectedScenario).map((skill: string, idx: number) => (
                      <span key={idx} className="px-2.5 py-1 bg-red-500/20 text-red-200 text-[10px] font-[700] rounded-full border border-red-400/30">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-[700] text-[#334155] hover:bg-white transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep((step - 1) as any)}
                className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-[700] text-[#334155] hover:bg-white transition-colors"
              >
                ← Back
              </button>
            )}

            {step < 4 ? (
              <button
                onClick={() => {
                  if (step === 3 && selectedRepIds.length === 0) {
                    alert('Please select at least one sales representative.')
                    return
                  }
                  setStep((step + 1) as any)
                }}
                className="px-6 py-2.5 rounded-xl bg-[#1E1B4B] hover:bg-[#2E2A72] text-white text-xs font-[700] shadow-md transition-colors"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={handleFinishAssignment}
                disabled={assigning}
                className="px-6 py-2.5 rounded-xl bg-[#1E1B4B] hover:bg-[#2E2A72] text-white text-xs font-[700] shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {assigning ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>✓ Assign Training</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
