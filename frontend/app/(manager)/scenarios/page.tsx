'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function ManagerScenariosPage() {
  const [scenarios, setScenarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedScenario, setSelectedScenario] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('All')
  const [SCORECARD_METRICS, setScorecardMetrics] = useState<string[]>([])

  const [editForm, setEditForm] = useState({
    persona_name: '',
    persona_type: '',
    difficulty: '',
    context_text: '',
    personality_traits: '',
    evaluation_focus: '',
    objection_style: '',
    conversation_expectations: '',
    target_skills: '',
    // New Figma fields
    contact_company: '',
    contact_title: '',
    motivations: '',
    communication_style: '',
    rep_objective: '',
    background_for_trainee: '',
    selected_metrics: [] as string[],
    metric_weights: {} as Record<string, number>,
  })

  const fetchScenarios = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const res = await fetch(`${API}/api/scenarios`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (res.ok) setScenarios(await res.json())
    } catch (err) {
      console.error('Failed to fetch scenarios', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchScorecardMetrics = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const res = await fetch(`${API}/api/scenarios/scorecard-metrics`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setScorecardMetrics(data.map((m: any) => m.name))
      }
    } catch (err) {
      console.error('Failed to fetch scorecard metrics', err)
    }
  }

  useEffect(() => { fetchScenarios(); fetchScorecardMetrics() }, [])

  const filteredScenarios = useMemo(() => {
    let result = [...scenarios]
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(s =>
        (s.persona_name?.toLowerCase() || '').includes(term) ||
        (s.persona_type?.toLowerCase() || '').includes(term)
      )
    }
    if (difficultyFilter !== 'All') {
      result = result.filter(s => (s.difficulty || '').toLowerCase() === difficultyFilter.toLowerCase())
    }
    return result
  }, [scenarios, searchTerm, difficultyFilter])

  const handleRowClick = async (scenario: any) => {
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/scenarios/${scenario.id}`, { headers: { 'Authorization': `Bearer ${token}` } })
      if (res.ok) {
        const d = await res.json()
        setSelectedScenario(d)

        // Parse metrics from evaluation_focus — match against canonical metrics
        const savedMetrics = d.evaluation_focus
          ? SCORECARD_METRICS.filter(m => d.evaluation_focus.includes(m))
          : []

        setEditForm({
          persona_name: d.persona_name || '',
          persona_type: d.persona_type || '',
          difficulty: d.difficulty || 'Medium',
          context_text: d.context_text || '',
          personality_traits: d.personality_traits || '',
          evaluation_focus: d.evaluation_focus || '',
          objection_style: d.objection_style || '',
          conversation_expectations: d.conversation_expectations || '',
          target_skills: d.target_skills || '',
          contact_company: d.contact_company || '',
          contact_title: d.contact_title || '',
          motivations: d.personality_traits || '',
          communication_style: d.objection_style || '',
          rep_objective: d.conversation_expectations || '',
          background_for_trainee: '',
          selected_metrics: savedMetrics.length > 0 ? savedMetrics : SCORECARD_METRICS.slice(0, 3),
          metric_weights: d.metric_weights || {},
        })
      }
    } catch (err) {
      console.error(err)
      setSelectedScenario(scenario)
    }
  }

  const handleUpdate = async () => {
    setSaving(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      // Pack the Figma fields back into the existing schema
      const payload = {
        ...editForm,
        personality_traits: editForm.motivations || editForm.personality_traits,
        objection_style: editForm.communication_style || editForm.objection_style,
        conversation_expectations: editForm.rep_objective || editForm.conversation_expectations,
        evaluation_focus: editForm.selected_metrics.join(', '),
      }
      
      const weightsSum = Object.entries(editForm.metric_weights)
        .filter(([k]) => editForm.selected_metrics.includes(k))
        .reduce((sum, [_, v]) => sum + (v || 0), 0)
        
      if (weightsSum !== 100 && editForm.selected_metrics.length > 0 && Object.keys(editForm.metric_weights).length > 0) {
         if (!window.confirm(`Your metric weights sum to ${weightsSum}% (should be 100%). Do you want to save anyway?`)) {
           setSaving(false)
           return
         }
      }

      const res = await fetch(`${API}/api/scenarios/${selectedScenario.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        setSelectedScenario(await res.json())
        setIsEditing(false)
        fetchScenarios()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to update')
      }
    } catch (err) {
      setError('An error occurred while saving.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/scenarios/${selectedScenario.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setSelectedScenario(null)
        setShowDeleteConfirm(false)
        fetchScenarios()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete')
      }
    } finally {
      setDeleting(false)
    }
  }

  const toggleMetric = (metric: string) => {
    setEditForm(f => ({
      ...f,
      selected_metrics: f.selected_metrics.includes(metric)
        ? f.selected_metrics.filter(m => m !== metric)
        : [...f.selected_metrics, metric]
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2C5282]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-[32px] md:space-y-[40px] pb-12">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-[16px]">
        <div>
          <h1 className="text-[24px] md:text-[28px] font-[700] tracking-[-0.3px] text-gray-900">Scenario Library</h1>
          <p className="text-[14px] md:text-[15px] text-gray-500 font-[400] mt-1 leading-[1.6]">AI Persona Catalog & Behavioral Architecture</p>
        </div>
        <div className="flex flex-wrap gap-[12px] items-center">
          <div className="relative">
            <svg className="absolute left-[12px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input
              type="text"
              placeholder="Search scenarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-[36px] pr-[16px] h-[40px] md:h-[44px] border border-gray-900/10 rounded-[10px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] focus:border-transparent w-56"
            />
          </div>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="h-[40px] md:h-[44px] border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] focus:border-transparent"
          >
            <option value="All">All Difficulty</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <Link
            href="/scenarios/new"
            className="flex items-center justify-center gap-[8px] bg-[#2C5282] hover:bg-[#1A365D] text-white py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] font-[600] text-[14px] transition-all duration-200 shadow-sm"
          >
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New Scenario
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-900/10 rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        {filteredScenarios.length === 0 ? (
          <div className="p-16 text-center text-sm text-[#64748B]">No scenarios found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-900/10 bg-gray-50/50">
                <th className="rounded-tl-[12px] text-left px-[24px] py-[16px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Persona</th>
                <th className="text-left px-[24px] py-[16px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Type</th>
                <th className="text-left px-[24px] py-[16px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Difficulty</th>
                <th className="text-left px-[24px] py-[16px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Target Skills</th>
                <th className="rounded-tr-[12px] px-[24px] py-[16px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900/5">
              {filteredScenarios.map((s) => (
                <tr key={s.id} onClick={() => handleRowClick(s)} className="hover:bg-gray-900/[0.04] cursor-pointer transition-colors duration-200 h-[48px]">
                  <td className="px-[24px] py-[12px]">
                    <span className="font-[600] text-gray-900">{s.persona_name}</span>
                  </td>
                  <td className="px-[24px] py-[12px] text-[14px] text-gray-500">{s.persona_type}</td>
                  <td className="px-[24px] py-[12px]">
                    <span className={`text-[11px] font-[600] uppercase tracking-[0.6px] ${
                      s.difficulty === 'advanced' ? 'text-red-600' :
                      s.difficulty === 'beginner' ? 'text-green-600' :
                      'text-amber-600'
                    }`}>{s.difficulty || 'intermediate'}</span>
                  </td>
                  <td className="px-[24px] py-[12px] text-[14px] text-gray-500 max-w-[300px] relative group">
                    <div className="line-clamp-2">{s.target_skills || '—'}</div>
                    {s.target_skills && s.target_skills.length > 50 && (
                      <div 
                        onClick={(e) => e.stopPropagation()}
                        className="absolute left-[24px] top-1/2 -translate-y-1/2 hidden group-hover:block w-[400px] max-h-[150px] overflow-y-auto p-4 bg-white border border-gray-900/10 text-gray-700 text-[13px] leading-[1.6] rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] z-[9999] whitespace-normal pointer-events-auto"
                      >
                        {s.target_skills}
                      </div>
                    )}
                  </td>
                  <td className="px-[24px] py-[12px] text-right">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#2C5282] hover:bg-[#EBF8FF] transition-all cursor-pointer">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail / Edit Modal */}
      {selectedScenario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-[24px]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!isEditing) setSelectedScenario(null) }} />
          <div className="relative w-full max-w-[720px] bg-white rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.12)] overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-[32px] py-[24px] border-b border-gray-900/10 bg-white sticky top-0 z-10">
              <div>
                <p className="text-[12px] font-[400] text-gray-500 mb-1">← Back to Dashboard</p>
                <h2 className="text-[18px] md:text-[20px] font-[600] text-gray-900">{selectedScenario.persona_name}</h2>
                <p className="text-[13px] md:text-[14px] text-gray-500 font-[400] mt-0.5">Review the training setup and start when ready</p>
              </div>
              <div className="flex gap-[12px] items-center">
                {!isEditing ? (
                  <>
                    <button onClick={() => setIsEditing(true)} className="border border-[#2C5282] text-[#2C5282] font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-[#2C5282]/5 text-[14px]">Edit</button>
                    <button onClick={() => setShowDeleteConfirm(true)} className="border border-red-500 text-red-500 font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-red-500/5 text-[14px]">Delete</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setIsEditing(false)} className="border border-gray-900/20 text-gray-700 font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-gray-50 text-[14px]">Cancel</button>
                    <button onClick={handleUpdate} disabled={saving} className="bg-[#2C5282] text-white font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-[#1A365D] disabled:opacity-40 disabled:cursor-not-allowed text-[14px]">{saving ? 'Saving...' : 'Save Changes'}</button>
                  </>
                )}
                <button onClick={() => { if (!isEditing) setSelectedScenario(null) }} className="text-gray-400 hover:text-gray-900 ml-[8px] transition-colors">
                  <svg className="w-[20px] h-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            <div className="p-[32px] overflow-y-auto space-y-[32px]">
              {error && <p className="text-red-500 text-[14px]">{error}</p>}

              {/* Contact Persona */}
              <section className="border border-gray-900/10 rounded-[12px] p-[20px] md:p-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                <h3 className="text-[18px] font-[600] text-gray-900 mb-[24px]">Contact Persona</h3>
                <div className="grid grid-cols-2 gap-[16px]">
                  <div>
                    <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Name</label>
                    <input
                      readOnly={!isEditing}
                      value={isEditing ? editForm.persona_name : selectedScenario.persona_name}
                      onChange={(e) => setEditForm({...editForm, persona_name: e.target.value})}
                      className="w-full h-[40px] md:h-[44px] border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] read-only:bg-gray-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Designation (Title)</label>
                    <input
                      readOnly={!isEditing}
                      value={isEditing ? editForm.contact_title : (selectedScenario.contact_title || selectedScenario.persona_type)}
                      onChange={(e) => setEditForm(prev => ({ ...prev, contact_title: e.target.value }))}
                      className="w-full h-[40px] md:h-[44px] border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] read-only:bg-gray-50/50"
                    />
                  </div>
                </div>
                <div className="mt-[16px]">
                  <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Company</label>
                  <input
                    readOnly={!isEditing}
                    value={isEditing ? editForm.contact_company : (selectedScenario.contact_company || '')}
                    onChange={(e) => setEditForm(prev => ({ ...prev, contact_company: e.target.value }))}
                    placeholder={!isEditing ? 'Not specified' : 'e.g. TechFlow Inc'}
                    className="w-full h-[40px] md:h-[44px] border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] read-only:bg-gray-50/50"
                  />
                </div>
                <div className="mt-[16px]">
                  <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Motivations & Priorities</label>
                  <textarea
                    readOnly={!isEditing}
                    value={isEditing ? editForm.motivations : (selectedScenario.personality_traits || '')}
                    onChange={(e) => setEditForm({...editForm, motivations: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] resize-none read-only:bg-gray-50/50"
                  />
                </div>
                <div className="mt-[16px]">
                  <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Communication Style</label>
                  <textarea
                    readOnly={!isEditing}
                    value={isEditing ? editForm.communication_style : (selectedScenario.objection_style || '')}
                    onChange={(e) => setEditForm({...editForm, communication_style: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] resize-none read-only:bg-gray-50/50"
                  />
                </div>
              </section>

              {/* Meeting Context */}
              <section className="border border-gray-900/10 rounded-[12px] p-[20px] md:p-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                <h3 className="text-[18px] font-[600] text-gray-900 mb-[24px]">Meeting Context</h3>
                <div>
                  <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Meeting Scenario</label>
                  <input
                    readOnly={!isEditing}
                    value={isEditing ? editForm.persona_type : selectedScenario.persona_type}
                    onChange={(e) => setEditForm({...editForm, persona_type: e.target.value})}
                    className="w-full h-[40px] md:h-[44px] border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] read-only:bg-gray-50/50"
                  />
                </div>
                <div className="mt-[16px]">
                  <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Rep Objective</label>
                  <textarea
                    readOnly={!isEditing}
                    value={isEditing ? editForm.rep_objective : (selectedScenario.conversation_expectations || '')}
                    onChange={(e) => setEditForm({...editForm, rep_objective: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] resize-none read-only:bg-gray-50/50"
                  />
                </div>
                <div className="mt-[16px]">
                  <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Background for Trainee</label>
                  <textarea
                    readOnly={!isEditing}
                    value={isEditing ? editForm.background_for_trainee : (selectedScenario.background_for_trainee || selectedScenario.context_text?.replace(/\[SCENARIO:.*?\]\s*/g, '').replace(/\[SCENARIO_METADATA:\s*({[\s\S]*?})\]/, '').trim() || '')}
                    onChange={(e) => setEditForm({...editForm, background_for_trainee: e.target.value})}
                    rows={3}
                    className="w-full border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] resize-none read-only:bg-gray-50/50"
                  />
                </div>
              </section>

              {/* Scorecard Metrics */}
              <section className="border border-gray-900/10 rounded-[12px] p-[20px] md:p-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-[24px]">
                  <div>
                    <h3 className="text-[18px] font-[600] text-gray-900">Scorecard Metrics</h3>
                    <p className="text-[13px] md:text-[14px] text-gray-500 font-[400] mt-0.5">
                      {isEditing ? `${editForm.selected_metrics.length} of ${SCORECARD_METRICS.length} categories selected` : (
                        (() => {
                          const matchedMetrics = SCORECARD_METRICS.filter(m => selectedScenario.evaluation_focus?.includes(m))
                          return matchedMetrics.length > 0 ? matchedMetrics.join(', ') : (selectedScenario.evaluation_focus || 'Not specified')
                        })()
                      )}
                    </p>
                  </div>
                  {isEditing && (
                    <button
                      onClick={() => setEditForm(f => ({ ...f, selected_metrics: SCORECARD_METRICS }))}
                      className="border border-[#2C5282] text-[#2C5282] font-[600] py-[6px] px-[12px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-[#2C5282]/5 text-[12px]"
                    >
                      Select All
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-[8px]">
                    {SCORECARD_METRICS.map((metric) => (
                      <div key={metric} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-[12px] px-[16px] py-[12px] border rounded-[10px] transition-all duration-200 ${editForm.selected_metrics.includes(metric) ? 'border-[#2C5282] bg-[#2C5282]/5' : 'border-gray-900/10 hover:border-gray-900/30'}`}>
                        <label className="flex items-center gap-[12px] cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={editForm.selected_metrics.includes(metric)}
                            onChange={() => toggleMetric(metric)}
                            className="w-[16px] h-[16px] rounded accent-[#2C5282]"
                          />
                          <span className={`text-[14px] font-[600] ${editForm.selected_metrics.includes(metric) ? 'text-[#2C5282]' : 'text-gray-700'}`}>{metric}</span>
                        </label>
                        {editForm.selected_metrics.includes(metric) && (
                          <div className="flex items-center gap-[8px] pl-[28px] sm:pl-0">
                            <span className="text-[12px] text-gray-500 font-[500]">Weight:</span>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={editForm.metric_weights[metric] || ''}
                                onChange={(e) => setEditForm(f => ({
                                  ...f,
                                  metric_weights: { ...f.metric_weights, [metric]: parseInt(e.target.value) || 0 }
                                }))}
                                className="w-[70px] h-[32px] border border-[#2C5282]/30 rounded-[6px] px-[8px] text-[14px] font-[600] text-[#2C5282] focus:outline-none focus:border-[#2C5282] bg-white text-right pr-[24px]"
                              />
                              <span className="absolute right-[8px] top-1/2 -translate-y-1/2 text-[12px] text-[#2C5282] font-[600] pointer-events-none">%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-[8px]">
                    {SCORECARD_METRICS.map((metric) => {
                      const isSelected = selectedScenario.evaluation_focus?.includes(metric) || false
                      const weight = selectedScenario.metric_weights?.[metric]
                      return (
                        <div key={metric} className="flex items-center justify-between gap-[12px] px-[16px] py-[12px] border border-gray-900/10 rounded-[10px]">
                          <div className="flex items-center gap-[12px]">
                            <div className={`w-[16px] h-[16px] rounded border-[2px] flex items-center justify-center ${isSelected ? 'border-[#2C5282] bg-[#2C5282]' : 'border-gray-300'}`}>
                              {isSelected && <svg className="w-[10px] h-[10px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                            </div>
                            <span className="text-[14px] text-gray-900 font-[600]">{metric}</span>
                          </div>
                          {isSelected && weight !== undefined && (
                            <span className="text-[13px] font-[700] text-[#2C5282] bg-[#2C5282]/10 px-[10px] py-[4px] rounded-[6px]">{weight}%</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-[24px]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-[12px] p-[32px] max-w-[400px] w-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] text-center">
            <h3 className="text-[18px] md:text-[20px] font-[600] text-gray-900 mb-[8px]">Delete Scenario?</h3>
            <p className="text-[14px] text-gray-500 mb-[24px] leading-[1.6]">Are you sure you want to permanently delete <strong className="font-[600] text-gray-900">{selectedScenario?.persona_name}</strong>?</p>
            <div className="flex gap-[12px]">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 border border-gray-900/20 text-gray-700 font-[600] py-[8px] md:py-[10px] rounded-[10px] transition-all duration-200 hover:bg-gray-50 text-[14px]">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-600 text-white font-[600] py-[8px] md:py-[10px] rounded-[10px] transition-all duration-200 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-[14px]">{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
