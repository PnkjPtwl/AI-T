'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ScorecardMetric {
  name: string
  description: string
  weight: number
}

export default function NewScenarioPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [transcriptPreview, setTranscriptPreview] = useState('')

  // Questions & Categories state
  const [categories, setCategories] = useState<string[]>(['Opening', 'Discovery'])
  const PRESET_CATEGORIES = ['Opening', 'Discovery', 'Pitch & Presentation', 'Objection Handling', 'Closing', 'Product Knowledge']
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [questions, setQuestions] = useState<any[]>([])
  const [newQuestionText, setNewQuestionText] = useState('')
  const [newQuestionCategory, setNewQuestionCategory] = useState('Opening')

  // Dynamic scorecard state
  const [scorecardMetrics, setScorecardMetrics] = useState<ScorecardMetric[]>([])
  const [generatingScorecard, setGeneratingScorecard] = useState(false)
  const [scorecardGenerated, setScorecardGenerated] = useState(false)
  const [newCustomMetric, setNewCustomMetric] = useState({ name: '', weight: 0 })

  const [formData, setFormData] = useState({
    persona_name: '',
    difficulty: 'beginner',
    target_skills: '',
    objection_style: '',
    personality_traits: '',
    context_text: '',
    custom_prompt: '',
    contact_title: '',
    contact_company: '',
  })

  const totalWeight = scorecardMetrics.reduce((sum, m) => sum + (m.weight || 0), 0)
  const remainingWeight = 100 - totalWeight

  const handleAudioGenerate = async () => {
    if (!file) { setError('Please select an audio/video file first.'); return }
    setIsGenerating(true); setError('')
    try {
      const token = localStorage.getItem('token')
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${API}/api/persona/from-audio`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate persona')
      const personaData = data.data
      let combinedTraits = personaData.personality_traits || ''
      if (personaData.communication_style) combinedTraits += ` | Communication Style: ${personaData.communication_style}`
      let contextText = formData.context_text
      if (personaData.decision_drivers) {
        const driversStr = `Decision Drivers: ${personaData.decision_drivers}`
        contextText = contextText ? `${contextText}\n\n${driversStr}` : driversStr
      }
      setFormData(prev => ({
        ...prev,
        persona_name: personaData.persona_name || prev.persona_name,
        difficulty: personaData.difficulty || prev.difficulty,
        objection_style: personaData.objection_style || prev.objection_style,
        personality_traits: combinedTraits || prev.personality_traits,
        target_skills: personaData.target_skills || prev.target_skills,
        context_text: contextText,
        custom_prompt: data.generatedPrompt || ''
      }))
      setTranscriptPreview(data.transcriptPreview || '')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerateScorecard = async () => {
    setGeneratingScorecard(true); setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/scenarios/generate-scorecard`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_text: formData.context_text,
          personality_traits: formData.personality_traits,
          objection_style: formData.objection_style,
          target_skills: formData.target_skills,
          contact_title: formData.contact_title,
          contact_company: formData.contact_company,
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate scorecard')
      setScorecardMetrics(data.map((m: any) => ({ ...m, weight: 0 })))
      setScorecardGenerated(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingScorecard(false)
    }
  }

  const updateMetricWeight = (idx: number, weight: number) => {
    setScorecardMetrics(prev => prev.map((m, i) => i === idx ? { ...m, weight } : m))
  }

  const deleteMetric = (idx: number) => {
    setScorecardMetrics(prev => prev.filter((_, i) => i !== idx))
  }

  const addCustomMetric = () => {
    if (!newCustomMetric.name.trim()) return
    setScorecardMetrics(prev => [...prev, { name: newCustomMetric.name.trim(), description: 'Custom criterion added by manager.', weight: newCustomMetric.weight || 0 }])
    setNewCustomMetric({ name: '', weight: 0 })
  }

  const handleGenerateQuestions = async () => {
    setGeneratingQuestions(true)
    try {
      const token = localStorage.getItem('token')
      const catArray = categories.length > 0 ? categories : ['General']
      const res = await fetch(`${API}/api/questions/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: catArray,
          context_text: formData.context_text,
          persona_name: formData.persona_name,
          persona_type: formData.contact_title || 'Prospect'
        })
      })
      if (res.ok) {
        const generated = await res.json()
        const newQs = generated.map((q: any) => ({ ...q, rating: q.rating || 0, id: q.id || Math.random().toString(), selected: true }))
        setQuestions(prev => [...prev, ...newQs])
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to generate questions')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGeneratingQuestions(false)
    }
  }

  const handleRateQuestion = async (qId: string, rating: number) => {
    try {
      const token = localStorage.getItem('token')
      const question = questions.find(q => q.id === qId)
      if (!question) return
      let dbId = question.dbId || (question.isBank ? question.id : null)
      if (!dbId) {
        const res = await fetch(`${API}/api/questions`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: question.category, question_text: question.text })
        })
        const data = await res.json()
        dbId = data.id
        setQuestions(prev => prev.map(q => q.id === qId ? { ...q, dbId } : q))
      }
      await fetch(`${API}/api/questions/rate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dbId, rating })
      })
      setQuestions(prev => prev.map(q => q.id === qId ? { ...q, rating } : q))
    } catch (err) { console.error(err) }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')

    if (step === 1) {
      if (!formData.persona_name.trim()) { setError('Persona Name is required.'); return }
    } else if (step === 2) {
      if (!formData.target_skills.trim()) { setError('Target Skills are required.'); return }
      if (!formData.personality_traits.trim()) { setError('Personality Traits are required.'); return }
      if (!formData.objection_style.trim()) { setError('Objection Protocol is required.'); return }
      if (!formData.context_text.trim()) { setError('Scenario Context is required.'); return }
    } else if (step === 3) {
      if (scorecardMetrics.length === 0) { setError('Please generate or add at least one scorecard metric.'); return }
      if (totalWeight !== 100) { setError(`Total weight is ${totalWeight}%. It must be exactly 100%.`); return }
    } else if (step === 4) {
      const selectedQuestions = questions.filter(q => q.selected)
      if (selectedQuestions.length === 0) { setError('Please select or add at least one evaluation question.'); return }
    }

    if (step < 5) { setStep(step + 1); return }

    setLoading(true); setError('')
    try {
      const token = localStorage.getItem('token')
      const selectedQuestions = questions.filter(q => q.selected)

      let finalContext = formData.context_text
      if (selectedQuestions.length > 0) {
        finalContext += `\n\n[MANDATORY EVALUATION RUBRIC - The Rep must ask these questions]:\n`
        selectedQuestions.forEach(q => { finalContext += `- [${q.category}] ${q.text}\n` })
      }

      const res = await fetch(`${API}/api/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          context_text: finalContext,
          scorecard_metrics: scorecardMetrics,
          evaluation_questions: selectedQuestions.map(q => ({ category: q.category, question_text: q.text, question_type: 'boolean' }))
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create scenario')
      }

      router.push('/scenarios')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const displayLabel = (formData.contact_title && formData.contact_company)
    ? `${formData.contact_title} - ${formData.contact_company}`
    : formData.contact_title || formData.contact_company || formData.persona_name || '—'

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div>
        <Link href="/scenarios" className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-500 hover:text-gray-900 transition-colors mb-[16px] block">
          ← Back to Personas
        </Link>
        <h1 className="text-[24px] md:text-[28px] font-[700] tracking-[-0.3px] text-gray-900">Create New Persona</h1>
        <p className="text-[14px] md:text-[15px] text-gray-500 font-[400] mt-1 leading-[1.6]">Design an AI persona for your team to practice against.</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[
          { n: 1, label: 'Basics' },
          { n: 2, label: 'Context' },
          { n: 3, label: 'Scorecard' },
          { n: 4, label: 'Questions' },
          { n: 5, label: 'Review' },
        ].map(({ n, label }) => (
          <div key={n} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === n ? 'bg-[#2C5282] text-white' : step > n ? 'bg-green-500 text-white' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
                {step > n ? '✓' : n}
              </div>
              <span className="text-[10px] font-[600] uppercase tracking-[0.5px] text-gray-500 hidden md:block">{label}</span>
            </div>
            {n < 5 && <div className={`flex-1 h-1 mx-2 ${step > n ? 'bg-green-500' : 'bg-[#E2E8F0]'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-900/10 rounded-[12px] p-[24px] md:p-[32px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        {error && (
          <div className="mb-[24px] p-[16px] bg-red-50 border border-red-200 text-red-600 rounded-[10px] text-[14px] font-[500]">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* STEP 1: Basics */}
          {step === 1 && (
            <div className="space-y-[32px] animate-in fade-in duration-300">
              {/* Optional audio generate */}
              <div className="bg-gray-50/50 border border-gray-900/10 rounded-[10px] p-[20px] md:p-[24px]">
                <h3 className="text-[14px] md:text-[15px] font-[600] text-gray-900 mb-1">Optional: Generate from Call Audio</h3>
                <p className="text-[13px] text-gray-500 mb-[16px]">Upload a sales call recording to let AI automatically extract the persona's traits and style.</p>
                <div className="flex flex-col md:flex-row gap-[12px]">
                  <input type="file" accept="audio/*,video/*" onChange={e => setFile(e.target.files?.[0] || null)} className="flex-1 bg-white border border-gray-900/10 rounded-[10px] px-[12px] py-[8px] text-[14px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors h-[40px] md:h-[44px]" />
                  <button type="button" onClick={handleAudioGenerate} disabled={isGenerating || !file} className="bg-[#2C5282] text-white font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-[#1A365D] disabled:opacity-40 disabled:cursor-not-allowed">
                    {isGenerating ? 'Analyzing...' : 'Generate Profile'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
                <div className="space-y-[8px]">
                  <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block">Designation (Title)</label>
                  <input type="text" value={formData.contact_title} onChange={e => setFormData({ ...formData, contact_title: e.target.value })} placeholder="e.g. VP of Sales" className="w-full h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors" />
                </div>
                <div className="space-y-[8px]">
                  <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block">Company</label>
                  <input type="text" value={formData.contact_company} onChange={e => setFormData({ ...formData, contact_company: e.target.value })} className="w-full h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors" placeholder="e.g. Acme Corp" />
                </div>
              </div>

              <div className="space-y-[8px]">
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block">Persona Name <span className="text-red-500 ml-1">*</span> <span className="text-gray-400 font-[400] normal-case tracking-normal">(internal reference only)</span></label>
                <input type="text" required value={formData.persona_name} onChange={e => setFormData({ ...formData, persona_name: e.target.value })} className="w-full h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors" placeholder="Internal name for context only" />
              </div>

              <div className="space-y-[8px]">
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block">Difficulty</label>
                <select value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: e.target.value })} className="w-full h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 2: Persona Context & Behavior */}
          {step === 2 && (
            <div className="space-y-[24px] animate-in fade-in duration-300">
              <h2 className="text-[18px] md:text-[20px] font-[600] text-gray-900 mb-[24px]">Persona Context & Behavior</h2>
              
              <div className="space-y-[8px]">
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block">Target Skills (AI Training Focus) <span className="text-red-500 ml-1">*</span></label>
                <textarea rows={2} value={formData.target_skills} onChange={e => setFormData({...formData, target_skills: e.target.value})} className="w-full bg-white border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors resize-y" placeholder="e.g. Needs Discovery, Handling Pricing Objections" />
              </div>
              <div className="space-y-[8px]">
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block">Personality Traits <span className="text-red-500 ml-1">*</span></label>
                <textarea rows={2} required value={formData.personality_traits} onChange={e => setFormData({...formData, personality_traits: e.target.value})} className="w-full bg-white border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors resize-y" placeholder="e.g. Impatient, Data-driven, Skeptical" />
              </div>
              <div className="space-y-[8px]">
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block">Objection Protocol <span className="text-red-500 ml-1">*</span></label>
                <textarea rows={2} required value={formData.objection_style} onChange={e => setFormData({...formData, objection_style: e.target.value})} className="w-full bg-white border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors resize-y" placeholder="e.g. Frequently asks 'Why is this so expensive?'" />
              </div>
              <div className="space-y-[8px]">
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block">Scenario Context <span className="text-red-500 ml-1">*</span></label>
                <textarea rows={4} value={formData.context_text} onChange={e => setFormData({...formData, context_text: e.target.value})} className="w-full bg-white border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors resize-y" placeholder="Background details about the company, current stack, pain points, etc." />
              </div>
            </div>
          )}

          {/* STEP 3: Dynamic Scorecard Metrics */}
          {step === 3 && (
            <div className="space-y-[24px] animate-in fade-in duration-300">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[18px] md:text-[20px] font-[600] text-gray-900">Scorecard Metrics</h2>
                  <p className="text-[14px] text-gray-500 mt-1 leading-[1.6]">AI generates scoring criteria based on your persona's context. You then set the weights.</p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateScorecard}
                  disabled={generatingScorecard}
                  className="flex-shrink-0 flex items-center gap-[8px] bg-[#2C5282] text-white font-[600] py-[10px] px-[20px] rounded-[10px] transition-all duration-200 hover:bg-[#1A365D] disabled:opacity-40 disabled:cursor-not-allowed text-[14px]"
                >
                  {generatingScorecard ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Generating...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>{scorecardGenerated ? 'Regenerate' : 'Generate Scorecard'}</>
                  )}
                </button>
              </div>

              {/* Weight tracker */}
              {scorecardMetrics.length > 0 && (
                <div className={`flex items-center justify-between px-[16px] py-[12px] rounded-[10px] border ${totalWeight > 100 ? 'bg-red-50 border-red-200' : remainingWeight === 0 ? 'bg-green-50 border-green-200' : 'bg-[#EBF8FF] border-[#BEE3F8]'}`}>
                  <div className="flex items-center gap-[8px]">
                    <div className={`w-2 h-2 rounded-full ${totalWeight > 100 ? 'bg-red-500' : remainingWeight === 0 ? 'bg-green-500' : 'bg-[#2C5282]'}`} />
                    <span className="text-[13px] font-[600] text-gray-900">Total Weight: {totalWeight}%</span>
                  </div>
                  <span className={`text-[13px] font-[700] ${totalWeight > 100 ? 'text-red-600' : remainingWeight === 0 ? 'text-green-600' : 'text-[#2C5282]'}`}>
                    {totalWeight > 100 ? `${totalWeight - 100}% over limit` : remainingWeight === 0 ? 'Fully allocated' : `${remainingWeight}% remaining`}
                  </span>
                </div>
              )}

              {/* Metrics list */}
              {scorecardMetrics.length > 0 ? (
                <div className="space-y-[10px]">
                  {scorecardMetrics.map((metric, idx) => (
                    <div key={idx} className="border border-[#2C5282]/20 bg-[#2C5282]/[0.03] rounded-[10px] p-[16px]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-[700] text-gray-900">{metric.name}</p>
                          <p className="text-[13px] text-gray-500 mt-[4px] leading-[1.5]">{metric.description}</p>
                        </div>
                        <div className="flex items-center gap-[8px] flex-shrink-0">
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={metric.weight || ''}
                              onChange={e => updateMetricWeight(idx, parseInt(e.target.value) || 0)}
                              placeholder="0"
                              className="w-[72px] h-[36px] border border-[#2C5282]/30 rounded-[8px] px-[8px] text-[14px] font-[600] text-[#2C5282] focus:outline-none focus:border-[#2C5282] bg-white text-right pr-[22px]"
                            />
                            <span className="absolute right-[7px] top-1/2 -translate-y-1/2 text-[12px] text-[#2C5282] font-[600] pointer-events-none">%</span>
                          </div>
                          <button type="button" onClick={() => deleteMetric(idx)} className="w-8 h-8 flex items-center justify-center rounded-[8px] text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !generatingScorecard ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-300 rounded-[12px] bg-gray-50/50">
                  <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  <p className="text-[14px] font-[600] text-gray-500">No scorecard metrics yet</p>
                  <p className="text-[13px] text-gray-400 mt-1">Click "Generate Scorecard" above to create criteria from your persona context</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-8 h-8 border-2 border-[#2C5282]/30 border-t-[#2C5282] rounded-full animate-spin mb-4" />
                  <p className="text-[14px] text-gray-500">AI is analyzing your persona context...</p>
                </div>
              )}

              {/* Add custom metric */}
              <div className="pt-[16px] border-t border-gray-900/10">
                <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[10px]">Add Custom Criterion</p>
                <div className="flex gap-[10px] items-end">
                  <div className="flex-1 space-y-[6px]">
                    <input
                      type="text"
                      value={newCustomMetric.name}
                      onChange={e => setNewCustomMetric(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Industry Knowledge, ROI Justification"
                      className="w-full h-[40px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors"
                    />
                  </div>
                  <div className="relative w-[80px]">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newCustomMetric.weight || ''}
                      onChange={e => setNewCustomMetric(prev => ({ ...prev, weight: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      className="w-full h-[40px] border border-gray-900/10 rounded-[10px] px-[8px] text-[14px] font-[600] text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2C5282] bg-white text-right pr-[22px]"
                    />
                    <span className="absolute right-[7px] top-1/2 -translate-y-1/2 text-[12px] text-gray-500 pointer-events-none">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={addCustomMetric}
                    disabled={!newCustomMetric.name.trim()}
                    className="h-[40px] px-[16px] border border-[#2C5282] text-[#2C5282] font-[600] rounded-[10px] transition-all duration-200 hover:bg-[#2C5282]/5 disabled:opacity-40 disabled:cursor-not-allowed text-[14px] whitespace-nowrap"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Question Bank */}
          {step === 4 && (
            <div className="space-y-[24px] animate-in fade-in duration-300">
              <h2 className="text-[18px] md:text-[20px] font-[600] text-gray-900 mb-[8px]">Evaluation Question Bank <span className="text-red-500 ml-1">*</span></h2>
              <p className="text-[14px] text-gray-500 mb-[24px] leading-[1.6]">Select the questions you want the AI to evaluate the Rep on.</p>

              <div className="bg-gray-50/50 border border-gray-900/10 rounded-[12px] p-[20px] md:p-[24px]">
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[12px] block">Select Categories</label>
                <div className="flex flex-wrap gap-[8px] mb-[16px]">
                  {PRESET_CATEGORIES.map(cat => {
                    const isSelected = categories.includes(cat)
                    return (
                      <button key={cat} type="button" onClick={() => { if (isSelected) setCategories(categories.filter(c => c !== cat)); else setCategories([...categories, cat]) }} className={`px-[16px] py-[8px] rounded-[10px] text-[13px] md:text-[14px] font-[600] transition-all duration-200 border ${isSelected ? 'bg-[#2C5282] text-white border-[#2C5282]' : 'bg-white text-gray-700 border-gray-900/10 hover:border-gray-900/30'}`}>
                        {cat}
                      </button>
                    )
                  })}
                </div>
                <div className="flex justify-end mt-[16px] pt-[16px] border-t border-gray-900/10">
                  <button type="button" onClick={handleGenerateQuestions} disabled={generatingQuestions || categories.length === 0} className="bg-[#2C5282] text-white font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-[#1A365D] disabled:opacity-40 disabled:cursor-not-allowed text-[14px]">
                    {generatingQuestions ? 'Generating...' : 'Fetch AI Questions'}
                  </button>
                </div>
              </div>

              {questions.length > 0 && (
                <div className="space-y-[12px] mt-[24px]">
                  {questions.map((q) => (
                    <div key={q.id} className={`p-[16px] bg-white border rounded-[10px] flex items-start gap-[16px] transition-colors duration-200 ${q.selected ? 'border-[#2C5282] bg-[#2C5282]/5' : 'border-gray-900/10'}`}>
                      <input type="checkbox" checked={q.selected} onChange={() => setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, selected: !x.selected } : x))} className="mt-[2px] w-[16px] h-[16px] rounded accent-[#2C5282]" />
                      <div className="flex-1">
                        <div className="flex items-center gap-[8px] mb-[4px]">
                          <span className="text-[10px] font-[600] uppercase tracking-[0.6px] text-[#2C5282] bg-blue-500/15 px-[8px] py-[2px] rounded-full">{q.category}</span>
                          {q.isBank && <span className="text-[10px] font-[600] uppercase tracking-[0.6px] text-amber-700 bg-amber-500/15 px-[8px] py-[2px] rounded-full">From Bank</span>}
                          {!q.isBank && <span className="text-[10px] font-[600] uppercase tracking-[0.6px] text-emerald-700 bg-emerald-500/15 px-[8px] py-[2px] rounded-full">AI Generated</span>}
                        </div>
                        <input type="text" value={q.text} onChange={(e) => setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, text: e.target.value } : x))} className="w-full bg-transparent text-[14px] text-gray-900 font-[400] leading-[1.6] border-none outline-none focus:ring-0 p-0" />
                      </div>
                      <div className="flex flex-col items-end gap-[4px]">
                        <p className="text-[10px] font-[600] text-gray-500 uppercase tracking-[0.6px]">Rate to Bank</p>
                        <div className="flex gap-[2px]">
                          {[1,2,3,4,5].map(star => (
                            <button key={star} type="button" onClick={() => handleRateQuestion(q.id, star)} className={`text-[18px] focus:outline-none hover:scale-110 transition-transform duration-200 ${q.rating >= star || (q.isBank && (q.rating || 0) >= star) ? 'text-amber-400' : 'text-gray-200 hover:text-amber-200'}`}>★</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-[12px] mt-[16px]">
                <select value={newQuestionCategory} onChange={e => setNewQuestionCategory(e.target.value)} className="h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors">
                  {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="General">General</option>
                  <option value="Custom">Custom</option>
                </select>
                <input type="text" value={newQuestionText} onChange={e => setNewQuestionText(e.target.value)} placeholder="Manually add a question to include..." className="flex-1 h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors" />
                <button type="button" onClick={() => { if (newQuestionText) { setQuestions(prev => [{ id: Math.random().toString(), category: newQuestionCategory, text: newQuestionText, rating: 0, selected: true, isBank: false }, ...prev]); setNewQuestionText('') } }} className="border border-gray-900/20 text-gray-700 font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-gray-50 text-[14px]">
                  Add Custom
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Review & Finalize */}
          {step === 5 && (
            <div className="space-y-[24px] animate-in fade-in duration-300">
              <h2 className="text-[18px] md:text-[20px] font-[600] text-gray-900 mb-[8px]">Review & Finalize</h2>
              <p className="text-[14px] text-gray-500 mb-[24px] leading-[1.6]">Review your persona details before saving.</p>

              <div className="bg-gray-50/50 border border-gray-900/10 rounded-[12px] p-[20px] md:p-[24px] grid grid-cols-1 md:grid-cols-2 gap-[24px]">
                <div className="col-span-1 md:col-span-2">
                  <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[4px]">Display Label</p>
                  <p className="text-[18px] md:text-[20px] text-gray-900 font-[700]">{displayLabel}</p>
                </div>
                <div>
                  <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[4px]">Difficulty</p>
                  <p className="text-[14px] md:text-[15px] text-gray-900 font-[500] capitalize">{formData.difficulty}</p>
                </div>
                <div>
                  <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[4px]">Scorecard Metrics</p>
                  <p className="text-[14px] text-gray-900 font-[500]">{scorecardMetrics.length} criteria · {totalWeight}% total weight</p>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[8px]">Scoring Criteria</p>
                  <div className="flex flex-wrap gap-[8px]">
                    {scorecardMetrics.map(m => (
                      <span key={m.name} className="px-[12px] py-[6px] bg-[#2C5282]/10 text-[#2C5282] rounded-[8px] text-[13px] font-[600]">
                        {m.name} {m.weight > 0 ? `· ${m.weight}%` : ''}
                      </span>
                    ))}
                    {scorecardMetrics.length === 0 && <span className="text-gray-400 text-[14px]">No metrics defined</span>}
                  </div>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[8px]">Selected Questions</p>
                  <ul className="list-disc pl-[20px] text-[14px] text-gray-900 space-y-[4px]">
                    {questions.filter(q => q.selected).map(q => (
                      <li key={q.id}><span className="font-[600] text-[#2C5282]">[{q.category}]</span> {q.text}</li>
                    ))}
                    {questions.filter(q => q.selected).length === 0 && <li className="text-gray-500 list-none -ml-[20px]">No evaluation questions selected.</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center pt-[32px] border-t border-gray-900/10">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="border border-gray-900/20 text-gray-700 font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-gray-50 text-[14px]">Back</button>
            ) : (
              <Link href="/scenarios" className="border border-gray-900/20 text-gray-700 font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-gray-50 text-[14px] text-center inline-block">Cancel</Link>
            )}

            <button type="submit" disabled={loading} className="bg-[#2C5282] text-white font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-[#1A365D] disabled:opacity-40 disabled:cursor-not-allowed text-[14px] flex items-center gap-[8px]">
              {loading ? 'Processing...' : step < 5 ? 'Next Step' : 'Create Persona'}
              {step < 5 && <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
