'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

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

  // Scorecard metrics from API
  const [scorecardMetrics, setScorecardMetrics] = useState<string[]>([])
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([])

  const [formData, setFormData] = useState({
    persona_name: '',
    persona_type: 'Careful Budgeter (Very price-conscious)',
    difficulty: 'beginner',
    target_skills: '',
    evaluation_focus: '',
    objection_style: '',
    personality_traits: '',
    context_text: '',
    custom_prompt: ''
  })
  
  const [expandedField, setExpandedField] = useState<{ id: string, title: string, value: string, readOnly: boolean } | null>(null)
  
  const handleModalChange = (val: string) => {
    if (!expandedField || expandedField.readOnly) return;
    setExpandedField({ ...expandedField, value: val });
    if (expandedField.id === 'custom_prompt') setFormData(prev => ({ ...prev, custom_prompt: val }));
    if (expandedField.id === 'personality_traits') setFormData(prev => ({ ...prev, personality_traits: val }));
    if (expandedField.id === 'context_text') setFormData(prev => ({ ...prev, context_text: val }));
    if (expandedField.id === 'target_skills') setFormData(prev => ({ ...prev, target_skills: val }));
    if (expandedField.id === 'evaluation_focus') setFormData(prev => ({ ...prev, evaluation_focus: val }));
    if (expandedField.id === 'objection_style') setFormData(prev => ({ ...prev, objection_style: val }));
  }

  // Fetch canonical scorecard metrics on mount
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return
        const res = await fetch(`${API}/api/scenarios/scorecard-metrics`, { headers: { 'Authorization': `Bearer ${token}` } })
        if (res.ok) {
          const data = await res.json()
          const names = data.map((m: any) => m.name)
          setScorecardMetrics(names)
          setSelectedMetrics(names) // Select all by default
        }
      } catch (err) {
        console.error('Failed to fetch scorecard metrics', err)
      }
    }
    fetchMetrics()
  }, [])

  const handleAudioGenerate = async () => {
    if (!file) {
      setError('Please select an audio/video file first.')
      return
    }
    setIsGenerating(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const fd = new FormData()
      fd.append('file', file)
      
      const res = await fetch(`${API}/api/persona/from-audio`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate persona')
      
      const personaData = data.data
      let combinedTraits = personaData.personality_traits || ''
      if (personaData.communication_style) {
        combinedTraits += ` | Communication Style: ${personaData.communication_style}`
      }
      let contextText = formData.context_text
      if (personaData.decision_drivers) {
         const driversStr = `Decision Drivers: ${personaData.decision_drivers}`
         contextText = contextText ? `${contextText}\n\n${driversStr}` : driversStr
      }
      
      setFormData(prev => ({
        ...prev,
        persona_name: personaData.persona_name || prev.persona_name,
        persona_type: personaData.persona_type || prev.persona_type,
        difficulty: personaData.difficulty || prev.difficulty,
        objection_style: personaData.objection_style || prev.objection_style,
        personality_traits: combinedTraits || prev.personality_traits,
        target_skills: personaData.target_skills || prev.target_skills,
        evaluation_focus: personaData.evaluation_focus || prev.evaluation_focus,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation per step
    if (step === 1) {
      if (!formData.persona_name.trim()) {
        setError('Persona Name is required.')
        return
      }
    } else if (step === 2) {
      if (!formData.target_skills.trim()) {
        setError('Target Skills are required.')
        return
      }
      if (!formData.personality_traits.trim()) {
        setError('Personality Traits are required.')
        return
      }
      if (!formData.objection_style.trim()) {
        setError('Objection Protocol is required.')
        return
      }
      if (!formData.context_text.trim()) {
        setError('Scenario Context is required.')
        return
      }
    } else if (step === 3) {
      const selectedQuestions = questions.filter(q => q.selected)
      if (selectedQuestions.length === 0) {
        setError('Please select or add at least one evaluation question to proceed.')
        return
      }
    }

    if (step < 4) {
      setStep(step + 1)
      return
    }

    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const finalFormData = { ...formData, evaluation_focus: selectedMetrics.join(', ') };
      
      const selectedQuestions = questions.filter(q => q.selected)
      if (selectedQuestions.length > 0) {
        finalFormData.context_text += `\n\n[MANDATORY EVALUATION RUBRIC - The Rep must ask these questions]:\n`;
        selectedQuestions.forEach(q => {
          finalFormData.context_text += `- [${q.category}] ${q.text}\n`;
        });
      }

      const res = await fetch(`${API}/api/scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(finalFormData)
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
          persona_type: formData.persona_type
        })
      })
      if (res.ok) {
        const generated = await res.json()
        // Deduplicate and append
        const newQs = generated.map((q: any) => ({ 
          ...q, 
          rating: q.rating || 0, 
          id: q.id || Math.random().toString(), 
          selected: true // Auto-select AI generated ones
        }))
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
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      {/* Header */}
      <div>
        <Link href="/scenarios" className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-500 hover:text-gray-900 transition-colors mb-[16px] block">
          &larr; Back to Personas
        </Link>
        <h1 className="text-[24px] md:text-[28px] font-[700] tracking-[-0.3px] text-gray-900">Create New Persona</h1>
        <p className="text-[14px] md:text-[15px] text-gray-500 font-[400] mt-1 leading-[1.6]">Design an AI persona for your team to practice against.</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className="flex items-center flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === s ? 'bg-[#2C5282] text-white' : step > s ? 'bg-green-500 text-white' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
              {s}
            </div>
            {s < 4 && <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-green-500' : 'bg-[#E2E8F0]'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-900/10 rounded-[12px] p-[24px] md:p-[32px] shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        {error && (
          <div className="mb-[24px] p-[16px] bg-red-50 border border-red-200 text-red-600 rounded-[10px] text-[14px] font-[500]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* STEP 1: Basics & Audio AI */}
          {step === 1 && (
            <div className="space-y-[32px] animate-in fade-in duration-300">
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

              <div className="space-y-[8px]">
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block">Persona Name <span className="text-red-500 ml-1">*</span></label>
                <input type="text" required value={formData.persona_name} onChange={e => setFormData({ ...formData, persona_name: e.target.value })} className="w-full h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
                <div className="space-y-[8px]">
                  <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block">Persona Type</label>
                  <select value={formData.persona_type} onChange={e => setFormData({ ...formData, persona_type: e.target.value })} className="w-full h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors">
                    <option value="Careful Budgeter (Very price-conscious)">Careful Budgeter (Very price-conscious)</option>
                    <option value="Easy Supporter (Already interested)">Easy Supporter (Already interested)</option>
                    <option value="Tech Deep-Diver (Wants technical details)">Tech Deep-Diver (Wants technical details)</option>
                    <option value="Busy Boss (Short on time)">Busy Boss (Short on time)</option>
                  </select>
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
            </div>
          )}

          {/* STEP 2: Advanced Context */}
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
                <textarea rows={4} value={formData.context_text} onChange={e => setFormData({...formData, context_text: e.target.value})} className="w-full bg-white border border-gray-900/10 rounded-[10px] p-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors resize-y" placeholder="Background details about the company, current stack, etc." />
              </div>

              {/* Scorecard Metrics Selection */}
              {scorecardMetrics.length > 0 && (
                <div className="space-y-[12px] pt-[16px] border-t border-gray-900/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 block">Scorecard Metrics</label>
                      <p className="text-[13px] text-gray-500 mt-1">{selectedMetrics.length} of {scorecardMetrics.length} selected — these define how the AI scores the rep.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMetrics(selectedMetrics.length === scorecardMetrics.length ? [] : [...scorecardMetrics])}
                      className="border border-[#2C5282] text-[#2C5282] font-[600] py-[6px] px-[12px] rounded-[10px] transition-all duration-200 hover:bg-[#2C5282]/5 text-[12px]"
                    >
                      {selectedMetrics.length === scorecardMetrics.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="space-y-[8px]">
                    {scorecardMetrics.map((metric) => (
                      <label key={metric} className={`flex items-center gap-[12px] px-[16px] py-[12px] border rounded-[10px] cursor-pointer transition-all duration-200 ${selectedMetrics.includes(metric) ? 'border-[#2C5282] bg-[#2C5282]/5' : 'border-gray-900/10 hover:border-gray-900/30'}`}>
                        <input
                          type="checkbox"
                          checked={selectedMetrics.includes(metric)}
                          onChange={() => {
                            setSelectedMetrics(prev =>
                              prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]
                            )
                          }}
                          className="w-[16px] h-[16px] rounded accent-[#2C5282]"
                        />
                        <span className={`text-[14px] font-[600] ${selectedMetrics.includes(metric) ? 'text-[#2C5282]' : 'text-gray-700'}`}>{metric}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Question Bank Selection */}
          {step === 3 && (
            <div className="space-y-[24px] animate-in fade-in duration-300">
              <h2 className="text-[18px] md:text-[20px] font-[600] text-gray-900 mb-[8px]">Evaluation Question Bank <span className="text-red-500 ml-1">*</span></h2>
              <p className="text-[14px] text-gray-500 mb-[24px] leading-[1.6]">Select the questions you want the AI to evaluate the Rep on. Our AI will suggest new questions alongside top-rated historical questions.</p>

              <div className="bg-gray-50/50 border border-gray-900/10 rounded-[12px] p-[20px] md:p-[24px]">
                <label className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[12px] block">Select Categories</label>
                <div className="flex flex-wrap gap-[8px] mb-[16px]">
                  {PRESET_CATEGORIES.map(cat => {
                    const isSelected = categories.includes(cat)
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          if (isSelected) setCategories(categories.filter(c => c !== cat))
                          else setCategories([...categories, cat])
                        }}
                        className={`px-[16px] py-[8px] rounded-[10px] text-[13px] md:text-[14px] font-[600] transition-all duration-200 border ${isSelected ? 'bg-[#2C5282] text-white border-[#2C5282]' : 'bg-white text-gray-700 border-gray-900/10 hover:border-gray-900/30'}`}
                      >
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
                      <input 
                        type="checkbox" 
                        checked={q.selected} 
                        onChange={() => setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, selected: !x.selected } : x))}
                        className="mt-[2px] w-[16px] h-[16px] rounded accent-[#2C5282]" 
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-[8px] mb-[4px]">
                          <span className="text-[10px] font-[600] uppercase tracking-[0.6px] text-[#2C5282] bg-blue-500/15 px-[8px] py-[2px] rounded-full">{q.category}</span>
                          {q.isBank && <span className="text-[10px] font-[600] uppercase tracking-[0.6px] text-amber-700 bg-amber-500/15 px-[8px] py-[2px] rounded-full">From Bank</span>}
                          {!q.isBank && <span className="text-[10px] font-[600] uppercase tracking-[0.6px] text-emerald-700 bg-emerald-500/15 px-[8px] py-[2px] rounded-full">AI Generated</span>}
                        </div>
                        <input 
                          type="text" 
                          value={q.text} 
                          onChange={(e) => setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, text: e.target.value } : x))}
                          className="w-full bg-transparent text-[14px] text-gray-900 font-[400] leading-[1.6] border-none outline-none focus:ring-0 p-0"
                        />
                      </div>
                      <div className="flex flex-col items-end gap-[4px]">
                        <p className="text-[10px] font-[600] text-gray-500 uppercase tracking-[0.6px]">Rate to Bank</p>
                        <div className="flex gap-[2px]">
                          {[1,2,3,4,5].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleRateQuestion(q.id, star)}
                              className={`text-[18px] focus:outline-none hover:scale-110 transition-transform duration-200 ${q.rating >= star || (q.isBank && (q.rating || 0) >= star) ? 'text-amber-400' : 'text-gray-200 hover:text-amber-200'}`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-[12px] mt-[16px]">
                <select
                  value={newQuestionCategory}
                  onChange={e => setNewQuestionCategory(e.target.value)}
                  className="h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors"
                >
                  {PRESET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="General">General</option>
                  <option value="Custom">Custom</option>
                </select>
                <input 
                  type="text" 
                  value={newQuestionText} 
                  onChange={e => setNewQuestionText(e.target.value)} 
                  placeholder="Manually add a question to include..." 
                  className="flex-1 h-[40px] md:h-[44px] bg-white border border-gray-900/10 rounded-[10px] px-[12px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2C5282] transition-colors" 
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newQuestionText) {
                      setQuestions(prev => [{ id: Math.random().toString(), category: newQuestionCategory, text: newQuestionText, rating: 0, selected: true, isBank: false }, ...prev])
                      setNewQuestionText('')
                    }
                  }}
                  className="border border-gray-900/20 text-gray-700 font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-gray-50 text-[14px]"
                >
                  Add Custom
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Finalize */}
          {step === 4 && (
            <div className="space-y-[24px] animate-in fade-in duration-300">
              <h2 className="text-[18px] md:text-[20px] font-[600] text-gray-900 mb-[8px]">Review & Finalize</h2>
              <p className="text-[14px] text-gray-500 mb-[24px] leading-[1.6]">Review your persona details before saving.</p>

              <div className="bg-gray-50/50 border border-gray-900/10 rounded-[12px] p-[20px] md:p-[24px] grid grid-cols-1 md:grid-cols-2 gap-[24px]">
                <div>
                  <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[4px]">Name</p>
                  <p className="text-[14px] md:text-[15px] text-gray-900 font-[500]">{formData.persona_name}</p>
                </div>
                <div>
                  <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[4px]">Type</p>
                  <p className="text-[14px] md:text-[15px] text-gray-900 font-[500]">{formData.persona_type}</p>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[8px]">Scorecard Metrics</p>
                  <div className="flex flex-wrap gap-[8px]">
                    {selectedMetrics.length > 0 ? selectedMetrics.map(m => (
                      <span key={m} className="px-[12px] py-[6px] bg-[#2C5282]/10 text-[#2C5282] rounded-[8px] text-[13px] font-[600]">{m}</span>
                    )) : (
                      <span className="text-gray-500 text-[14px]">All metrics will be used (default).</span>
                    )}
                  </div>
                </div>
                <div className="col-span-1 md:col-span-2">
                  <p className="text-[12px] font-[600] uppercase tracking-[0.6px] text-gray-900/70 mb-[8px]">Selected Questions</p>
                  <ul className="list-disc pl-[20px] text-[14px] text-gray-900 space-y-[4px]">
                    {questions.filter(q => q.selected).map(q => (
                      <li key={q.id}><span className="font-[600] text-[#2C5282]">[{q.category}]</span> {q.text}</li>
                    ))}
                    {questions.filter(q => q.selected).length === 0 && <li className="text-gray-500 list-none -ml-[20px]">No specific evaluation questions selected.</li>}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center pt-[32px] border-t border-gray-900/10">
            {step > 1 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="border border-gray-900/20 text-gray-700 font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-gray-50 text-[14px]">
                Back
              </button>
            ) : (
              <Link href="/scenarios" className="border border-gray-900/20 text-gray-700 font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-gray-50 text-[14px] text-center inline-block">
                Cancel
              </Link>
            )}

            <button type="submit" disabled={loading} className="bg-[#2C5282] text-white font-[600] py-[8px] md:py-[10px] px-[16px] md:px-[20px] min-w-[100px] rounded-[10px] transition-all duration-200 hover:bg-[#1A365D] disabled:opacity-40 disabled:cursor-not-allowed text-[14px] flex items-center gap-[8px]">
              {loading ? 'Processing...' : step < 4 ? 'Next Step' : 'Create Persona'}
              {step < 4 && <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
