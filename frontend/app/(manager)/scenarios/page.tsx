'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ScorecardMetric {
  name: string
  description: string
  weight: number
}

function getDisplayLabel(scenario: any): string {
  const title = scenario.contact_title || ''
  const company = scenario.contact_company || ''
  if (title && company) return `${title} - ${company}`
  if (title) return title
  if (company) return company
  return scenario.persona_name || 'Unnamed Persona'
}

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

  // New custom metric input for edit mode
  const [newCustomMetric, setNewCustomMetric] = useState({ name: '', weight: 0 })

  const [editForm, setEditForm] = useState({
    persona_name: '',
    difficulty: '',
    context_text: '',
    personality_traits: '',
    objection_style: '',
    conversation_expectations: '',
    target_skills: '',
    contact_company: '',
    contact_title: '',
    scorecard_metrics: [] as ScorecardMetric[],
  })

  const totalWeight = editForm.scorecard_metrics.reduce((sum, m) => sum + (m.weight || 0), 0)
  const remainingWeight = 100 - totalWeight

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

  useEffect(() => { fetchScenarios() }, [])

  const filteredScenarios = useMemo(() => {
    let result = [...scenarios]
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(s =>
        (s.display_label?.toLowerCase() || '').includes(term) ||
        (s.persona_name?.toLowerCase() || '').includes(term) ||
        (s.contact_title?.toLowerCase() || '').includes(term) ||
        (s.contact_company?.toLowerCase() || '').includes(term)
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
        setEditForm({
          persona_name: d.persona_name || '',
          difficulty: d.difficulty || 'intermediate',
          context_text: d.context_text || '',
          personality_traits: d.personality_traits || '',
          objection_style: d.objection_style || '',
          conversation_expectations: d.conversation_expectations || '',
          target_skills: d.target_skills || '',
          contact_company: d.contact_company || '',
          contact_title: d.contact_title || '',
          scorecard_metrics: d.scorecard_metrics || [],
        })
      }
    } catch (err) {
      console.error(err)
      setSelectedScenario(scenario)
    }
  }

  const handleUpdate = async () => {
    setSaving(true); setError('')
    if (totalWeight !== 100) {
      setError(`Total weight is ${totalWeight}%. It must be exactly 100%.`)
      setSaving(false); return
    }
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/scenarios/${selectedScenario.id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })
      if (res.ok) {
        const updated = await res.json()
        setSelectedScenario({ ...selectedScenario, ...updated })
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
        method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setSelectedScenario(null); setShowDeleteConfirm(false); fetchScenarios()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete')
      }
    } finally {
      setDeleting(false)
    }
  }

  const updateMetricWeight = (idx: number, weight: number) => {
    setEditForm(f => ({
      ...f,
      scorecard_metrics: f.scorecard_metrics.map((m, i) => i === idx ? { ...m, weight } : m)
    }))
  }

  const deleteMetric = (idx: number) => {
    setEditForm(f => ({
      ...f,
      scorecard_metrics: f.scorecard_metrics.filter((_, i) => i !== idx)
    }))
  }

  const addCustomMetric = () => {
    if (!newCustomMetric.name.trim()) return
    setEditForm(f => ({
      ...f,
      scorecard_metrics: [...f.scorecard_metrics, {
        name: newCustomMetric.name.trim(),
        description: 'Custom criterion added by manager.',
        weight: newCustomMetric.weight || 0
      }]
    }))
    setNewCustomMetric({ name: '', weight: 0 })
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
          <h1 className="text-[24px] md:text-[28px] font-[700] tracking-[-0.3px] text-gray-900">Persona Library</h1>
          <p className="text-[14px] md:text-[15px] text-gray-500 font-[400] mt-1 leading-[1.6]">AI Persona Catalog & Behavioral Architecture</p>
        </div>
        <div className="flex flex-wrap gap-[12px] items-center">
          <div className="relative">
            <svg className="absolute left-[12px] top-1/2 -translate-y-1/2 w-[16px] h-[16px] text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" placeholder="Search personas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-[36px] pr-[16px] h-[40px] md:h-[44px] border border-gray-900/10 rounded-[10px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] focus:border-transparent w-56" />
          </div>
          <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} className="h-[40px] md:h-[44px] border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] focus:border-transparent">
            <option value="All">All Difficulty</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <Link href="/scenarios/new" className="flex items-center justify-center gap-[8px] bg-[#2C5282] hover:bg-[#1A365D] text-white py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] font-[600] text-[14px] transition-all duration-200 shadow-sm">
            <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            New Persona
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-900/10 rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        {filteredScenarios.length === 0 ? (
          <div className="p-16 text-center text-sm text-[#64748B]">No personas found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-900/10 bg-gray-50/50">
                <th className="rounded-tl-[12px] text-left px-[24px] py-[16px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Persona</th>
                <th className="text-left px-[24px] py-[16px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Difficulty</th>
                <th className="text-left px-[24px] py-[16px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Target Skills</th>
                <th className="text-left px-[24px] py-[16px] text-[12px] font-[600] text-gray-900/70 uppercase tracking-[0.6px]">Scorecard</th>
                <th className="rounded-tr-[12px] px-[24px] py-[16px]"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-900/5">
              {filteredScenarios.map((s) => (
                <tr key={s.id} onClick={() => handleRowClick(s)} className="hover:bg-gray-900/[0.04] cursor-pointer transition-colors duration-200 h-[48px]">
                  <td className="px-[24px] py-[12px]">
                    <span className="font-[600] text-gray-900">{getDisplayLabel(s)}</span>
                  </td>
                  <td className="px-[24px] py-[12px]">
                    <span className={`text-[11px] font-[600] uppercase tracking-[0.6px] ${s.difficulty === 'advanced' ? 'text-red-600' : s.difficulty === 'beginner' ? 'text-green-600' : 'text-amber-600'}`}>
                      {s.difficulty || 'intermediate'}
                    </span>
                  </td>
                  <td className="px-[24px] py-[12px] text-[14px] text-gray-500 max-w-[300px] relative group">
                    <div className="line-clamp-2">{s.target_skills || '—'}</div>
                  </td>
                  <td className="px-[24px] py-[12px]">
                    {s.scorecard_metrics && s.scorecard_metrics.length > 0 ? (
                      <span className="text-[12px] font-[600] text-[#2C5282] bg-[#2C5282]/10 px-[10px] py-[4px] rounded-full">
                        {s.scorecard_metrics.length} metrics
                      </span>
                    ) : (
                      <span className="text-[12px] text-gray-400">—</span>
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
                <p className="text-[12px] font-[400] text-gray-500 mb-1">← Back to Personas</p>
                <h2 className="text-[18px] md:text-[20px] font-[600] text-gray-900">
                  {getDisplayLabel(isEditing ? editForm : selectedScenario)}
                </h2>
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
                    <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Persona Name <span className="text-gray-400 font-[400] normal-case">(internal)</span></label>
                    <input readOnly={!isEditing} value={isEditing ? editForm.persona_name : selectedScenario.persona_name} onChange={(e) => setEditForm({...editForm, persona_name: e.target.value})} className="w-full h-[40px] md:h-[44px] border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] read-only:bg-gray-50/50" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Designation (Title)</label>
                    <input readOnly={!isEditing} value={isEditing ? editForm.contact_title : (selectedScenario.contact_title || '')} onChange={(e) => setEditForm(prev => ({ ...prev, contact_title: e.target.value }))} className="w-full h-[40px] md:h-[44px] border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] read-only:bg-gray-50/50" />
                  </div>
                </div>
                <div className="mt-[16px]">
                  <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Company</label>
                  <input readOnly={!isEditing} value={isEditing ? editForm.contact_company : (selectedScenario.contact_company || '')} onChange={(e) => setEditForm(prev => ({ ...prev, contact_company: e.target.value }))} placeholder={!isEditing ? 'Not specified' : 'e.g. TechFlow Inc'} className="w-full h-[40px] md:h-[44px] border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] read-only:bg-gray-50/50" />
                </div>
                <div className="mt-[16px]">
                  <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Personality Traits</label>
                  <textarea readOnly={!isEditing} value={isEditing ? editForm.personality_traits : (selectedScenario.personality_traits || '')} onChange={(e) => setEditForm({...editForm, personality_traits: e.target.value})} rows={3} className="w-full border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] resize-none read-only:bg-gray-50/50" />
                </div>
                <div className="mt-[16px]">
                  <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Objection Style</label>
                  <textarea readOnly={!isEditing} value={isEditing ? editForm.objection_style : (selectedScenario.objection_style || '')} onChange={(e) => setEditForm({...editForm, objection_style: e.target.value})} rows={3} className="w-full border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] resize-none read-only:bg-gray-50/50" />
                </div>
              </section>

              {/* Meeting Context */}
              <section className="border border-gray-900/10 rounded-[12px] p-[20px] md:p-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                <h3 className="text-[18px] font-[600] text-gray-900 mb-[24px]">Meeting Context</h3>
                <div>
                  <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Target Skills</label>
                  <textarea readOnly={!isEditing} value={isEditing ? editForm.target_skills : (selectedScenario.target_skills || '')} onChange={(e) => setEditForm({...editForm, target_skills: e.target.value})} rows={2} className="w-full border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] resize-none read-only:bg-gray-50/50" />
                </div>
                <div className="mt-[16px]">
                  <label className="block text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[6px]">Scenario Context</label>
                  <textarea readOnly={!isEditing} value={isEditing ? editForm.context_text : (selectedScenario.context_text || '')} onChange={(e) => setEditForm({...editForm, context_text: e.target.value})} rows={4} className="w-full border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] resize-none read-only:bg-gray-50/50" />
                </div>
              </section>

              {/* Scorecard Metrics */}
              <section className="border border-gray-900/10 rounded-[12px] p-[20px] md:p-[24px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                <div className="flex items-start justify-between mb-[20px]">
                  <div>
                    <h3 className="text-[18px] font-[600] text-gray-900">Scorecard Metrics</h3>
                    <p className="text-[13px] text-gray-500 mt-0.5">
                      {isEditing
                        ? 'Adjust weights, remove metrics, or add custom criteria. AI re-generation is not available in edit mode.'
                        : `${(selectedScenario.scorecard_metrics || []).length} criteria defined for this persona.`
                      }
                    </p>
                  </div>
                </div>

                {/* Weight tracker (edit mode only) */}
                {isEditing && editForm.scorecard_metrics.length > 0 && (
                  <div className={`flex items-center justify-between px-[16px] py-[12px] rounded-[10px] border mb-[16px] ${totalWeight > 100 ? 'bg-red-50 border-red-200' : remainingWeight === 0 ? 'bg-green-50 border-green-200' : 'bg-[#EBF8FF] border-[#BEE3F8]'}`}>
                    <span className="text-[13px] font-[600] text-gray-900">Total: {totalWeight}%</span>
                    <span className={`text-[13px] font-[700] ${totalWeight > 100 ? 'text-red-600' : remainingWeight === 0 ? 'text-green-600' : 'text-[#2C5282]'}`}>
                      {totalWeight > 100 ? `${totalWeight - 100}% over limit` : remainingWeight === 0 ? 'Fully allocated' : `${remainingWeight}% remaining`}
                    </span>
                  </div>
                )}

                {/* Metrics display */}
                {isEditing ? (
                  <div className="space-y-[10px]">
                    {editForm.scorecard_metrics.map((metric, idx) => (
                      <div key={idx} className="border border-[#2C5282]/20 bg-[#2C5282]/[0.03] rounded-[10px] p-[14px]">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-[700] text-gray-900">{metric.name}</p>
                            {metric.description && <p className="text-[12px] text-gray-500 mt-[3px] leading-[1.5]">{metric.description}</p>}
                          </div>
                          <div className="flex items-center gap-[8px] flex-shrink-0">
                            <div className="relative">
                              <input type="number" min="0" max="100" value={metric.weight || ''} onChange={e => updateMetricWeight(idx, parseInt(e.target.value) || 0)} placeholder="0" className="w-[72px] h-[36px] border border-[#2C5282]/30 rounded-[8px] px-[8px] text-[14px] font-[600] text-[#2C5282] focus:outline-none focus:border-[#2C5282] bg-white text-right pr-[22px]" />
                              <span className="absolute right-[7px] top-1/2 -translate-y-1/2 text-[12px] text-[#2C5282] font-[600] pointer-events-none">%</span>
                            </div>
                            <button type="button" onClick={() => deleteMetric(idx)} className="w-8 h-8 flex items-center justify-center rounded-[8px] text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Add custom metric */}
                    <div className="pt-[12px] border-t border-gray-900/10 mt-[12px]">
                      <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[10px]">Add Custom Criterion</p>
                      <div className="flex gap-[10px] items-center">
                        <input type="text" value={newCustomMetric.name} onChange={e => setNewCustomMetric(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Industry Knowledge" className="flex-1 h-[40px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors" />
                        <div className="relative w-[80px]">
                          <input type="number" min="0" max="100" value={newCustomMetric.weight || ''} onChange={e => setNewCustomMetric(prev => ({ ...prev, weight: parseInt(e.target.value) || 0 }))} placeholder="0" className="w-full h-[40px] border border-gray-900/10 rounded-[10px] px-[8px] text-[14px] font-[600] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2C5282] bg-white text-right pr-[22px]" />
                          <span className="absolute right-[7px] top-1/2 -translate-y-1/2 text-[12px] text-gray-500 pointer-events-none">%</span>
                        </div>
                        <button type="button" onClick={addCustomMetric} disabled={!newCustomMetric.name.trim()} className="h-[40px] px-[14px] border border-[#2C5282] text-[#2C5282] font-[600] rounded-[10px] transition-all duration-200 hover:bg-[#2C5282]/5 disabled:opacity-40 text-[14px] whitespace-nowrap">+ Add</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-[8px]">
                    {(selectedScenario.scorecard_metrics || []).length > 0 ? (
                      (selectedScenario.scorecard_metrics || []).map((metric: ScorecardMetric, idx: number) => (
                        <div key={idx} className="flex items-center justify-between gap-[12px] px-[16px] py-[12px] border border-gray-900/10 rounded-[10px]">
                          <div>
                            <p className="text-[14px] text-gray-900 font-[600]">{metric.name}</p>
                            {metric.description && <p className="text-[12px] text-gray-500 mt-[2px]">{metric.description}</p>}
                          </div>
                          {metric.weight > 0 && (
                            <span className="text-[13px] font-[700] text-[#2C5282] bg-[#2C5282]/10 px-[10px] py-[4px] rounded-[6px] flex-shrink-0">{metric.weight}%</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-[14px] text-gray-400 italic">No scorecard metrics defined for this persona.</p>
                    )}
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
            <p className="text-[14px] text-gray-500 mb-[24px] leading-[1.6]">Are you sure you want to permanently delete <strong className="font-[600] text-gray-900">{getDisplayLabel(selectedScenario)}</strong>?</p>
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
