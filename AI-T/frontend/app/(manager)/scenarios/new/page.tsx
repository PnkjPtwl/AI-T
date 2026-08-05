'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface ScorecardMetric {
  name: string
  description: string
  weight: number
}

interface EvalQuestion {
  id: string
  category: string
  text: string
  rating: number
}

// ─── DiceBear avatar URL builder ──────────────────────────────────────────────
type AvatarStyle = 'bottts-neutral' | 'lorelei-neutral' | 'personas' | 'big-smile' | 'notionists-neutral'

function getDiceBearUrl(seed: string, style: AvatarStyle = 'bottts-neutral', options: Record<string, string> = {}) {
  const params = new URLSearchParams({ seed, ...options }).toString()
  return `https://api.dicebear.com/9.x/${style}/svg?${params}`
}

const AVATAR_PRESETS = [
  { id: 'alex',    name: 'Alex',    style: 'lorelei-neutral'     as AvatarStyle, tag: 'Analytical & Calm',     desc: 'Methodical, data-driven' },
  { id: 'morgan',  name: 'Morgan',  style: 'personas'            as AvatarStyle, tag: 'Skeptical & Focused',   desc: 'Skeptical, ROI-focused' },
  { id: 'jordan',  name: 'Jordan',  style: 'big-smile'           as AvatarStyle, tag: 'Friendly & Open',       desc: 'Collaborative, open' },
  { id: 'taylor',  name: 'Taylor',  style: 'notionists-neutral'  as AvatarStyle, tag: 'Detail-Oriented',       desc: 'Technical, precise' },
  { id: 'riley',   name: 'Riley',   style: 'personas'            as AvatarStyle, tag: 'Risk-Averse & Steady',  desc: 'Conservative, thorough' },
  { id: 'casey',   name: 'Casey',   style: 'lorelei-neutral'     as AvatarStyle, tag: 'Direct & Assertive',    desc: 'Decisive, results-focused' },
]

export default function NewScenarioPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const duplicateId = searchParams.get('duplicate')
  const loadScenarioId = editId || duplicateId
  const isEditMode = !!editId

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isGeneratingScorecard, setIsGeneratingScorecard] = useState(false)

  // ── Scorecard state ──────────────────────────────────────────────────────────
  const [scorecardMetrics, setScorecardMetrics] = useState<ScorecardMetric[]>([])
  const [scorecardGenerated, setScorecardGenerated] = useState(false)
  const [newCustomMetric, setNewCustomMetric] = useState({ name: '', weight: 10 })

  // ── Questions state ──────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<EvalQuestion[]>([])
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false)
  const [newCustomQuestion, setNewCustomQuestion] = useState({ text: '', category: '' })

  // ── Avatar state ─────────────────────────────────────────────────────────────
  const [avatarTab, setAvatarTab] = useState<'AI' | 'Upload'>('AI')
  const [selectedAvatarId, setSelectedAvatarId] = useState('alex')
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [skinTone, setSkinTone] = useState('light')
  const [hairColor, setHairColor] = useState('brown')
  const [expression, setExpression] = useState('default')

  // ── Form data ────────────────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    persona_name: '',
    difficulty: 'Advanced',
    target_skills: '',
    objection_style: '',
    personality_traits: '',
    context_text: '',
    contact_title: '',
    contact_company: '',
  })

  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [kbAccounts, setKbAccounts] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (loadScenarioId) {
      const token = localStorage.getItem('token')
      setLoading(true)
      fetch(`${API}/api/scenarios/${loadScenarioId}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setFormData({
              persona_name: duplicateId ? `${data.persona_name} (Copy)` : (data.persona_name || ''),
              difficulty: data.difficulty || 'Advanced',
              target_skills: data.target_skills || '',
              objection_style: data.objection_style || '',
              personality_traits: data.personality_traits || '',
              context_text: data.context_text || '',
              contact_title: data.contact_title || '',
              contact_company: data.contact_company || '',
            })
            if (data.scorecard_metrics && Array.isArray(data.scorecard_metrics)) {
              setScorecardMetrics(data.scorecard_metrics)
              setScorecardGenerated(true)
            } else if (data.scorecard_json) {
              setScorecardMetrics(data.scorecard_json)
              setScorecardGenerated(true)
            }
            if (data.account_name) {
              setSelectedAccount(data.account_name)
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [loadScenarioId, duplicateId])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    fetch(`${API}/api/scenarios/kb-accounts`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data?.accounts?.length) setKbAccounts(data.accounts) })
      .catch(() => {})
  }, [])

  const totalWeight = scorecardMetrics.reduce((sum, m) => sum + (m.weight || 0), 0)

  // ── Auto-generate on step entry ──────────────────────────────────────────────
  useEffect(() => {
    if (step === 3 && !scorecardGenerated && formData.context_text) {
      handleGenerateScorecard()
    }
    if (step === 5 && questions.length === 0) {
      handleGenerateQuestions()
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate Scorecard ───────────────────────────────────────────────────────
  const handleGenerateScorecard = async () => {
    setIsGeneratingScorecard(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/scenarios/generate-scorecard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          context_text: formData.context_text,
          personality_traits: formData.personality_traits,
          objection_style: formData.objection_style,
          target_skills: formData.target_skills,
          contact_title: formData.contact_title,
          contact_company: formData.contact_company,
          account_name: selectedAccount || null
        })
      })
      if (res.ok) {
        const metrics: Array<{ name: string; description: string }> = await res.json()
        const count = metrics.length || 1
        const baseWeight = Math.floor(100 / count)
        const remainder = 100 - baseWeight * count
        const withWeights: ScorecardMetric[] = metrics.map((m, i) => ({
          ...m,
          weight: baseWeight + (i === 0 ? remainder : 0)
        }))
        setScorecardMetrics(withWeights)
        setScorecardGenerated(true)
      } else {
        const d = await res.json()
        setError(d.error || 'Failed to generate scorecard metrics.')
      }
    } catch (err) {
      setError('Failed to connect to AI service.')
    } finally {
      setIsGeneratingScorecard(false)
    }
  }

  // ── Generate Questions ───────────────────────────────────────────────────────
  const handleGenerateQuestions = async () => {
    setIsGeneratingQuestions(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const categories = scorecardMetrics.length > 0 
        ? scorecardMetrics.map(m => m.name)
        : ['Discovery', 'Objection Handling', 'Value Proposition', 'Closing Skills']

      const res = await fetch(`${API}/api/questions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          categories,
          scorecard_metrics: scorecardMetrics,
          context_text: formData.context_text,
          persona_name: formData.persona_name,
          persona_type: formData.contact_title,
          account_name: selectedAccount || null
        })
      })
      if (res.ok) {
        const data = await res.json()
        const questionsArray = Array.isArray(data) ? data : (data.questions || [])
        if (questionsArray && Array.isArray(questionsArray)) {
          const mapped: EvalQuestion[] = questionsArray.map((q: any, i: number) => ({
            id: `ai-${Date.now()}-${i}`,
            category: q.category || 'General',
            text: q.text || q.question || q.question_text || 'Probing question',
            rating: q.rating || 0
          }))
          setQuestions(mapped)
        }
      } else {
        const d = await res.json()
        setError(d.error || 'Failed to generate questions.')
      }
    } catch (err) {
      setError('Failed to connect to AI service.')
    } finally {
      setIsGeneratingQuestions(false)
    }
  }

  const addCustomQuestion = () => {
    if (!newCustomQuestion.text.trim()) return
    setQuestions(prev => [
      ...prev, 
      { 
        id: `custom-${Date.now()}`, 
        text: newCustomQuestion.text, 
        category: newCustomQuestion.category || 'General', 
        rating: 0 
      }
    ])
    setNewCustomQuestion({ text: '', category: '' })
  }

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  const rateQuestion = (id: string, rating: number) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, rating } : q))
  }

  // ── Avatar Upload ────────────────────────────────────────────────────────────
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setUploadingAvatar(true)
    
    const token = localStorage.getItem('token')
    const fd = new FormData()
    fd.append('avatar', f)

    try {
      const res = await fetch(`${API}/api/scenarios/upload-avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      })
      if (res.ok) {
        const data = await res.json()
        setUploadedImageUrl(data.avatarUrl)
        setAvatarTab('Upload')
        setSelectedAvatarId('custom')
      } else {
        const d = await res.json()
        setError(d.error || 'Failed to upload image')
      }
    } catch (err) {
      setError('Connection error during upload')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const getAvatarUrl = (preset: typeof AVATAR_PRESETS[0]) => {
    const hairParam = hairColor === 'black' ? 'black' : hairColor === 'blonde' ? 'blonde01' : hairColor === 'gray' ? 'gray' : 'brown01'
    const bgColor = skinTone === 'light' ? 'f5e6d3' : skinTone === 'medium' ? 'd4a574' : skinTone === 'dark' ? '8b5e3c' : 'fdbcb4'
    return getDiceBearUrl(preset.id, preset.style, {
      backgroundColor: bgColor,
      ...(preset.style === 'personas' ? { hair: hairParam } : {})
    })
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const selectedPreset = AVATAR_PRESETS.find(p => p.id === selectedAvatarId)
      const avatarUrl = avatarTab === 'Upload' && uploadedImageUrl
        ? uploadedImageUrl
        : selectedPreset ? getAvatarUrl(selectedPreset) : ''

      const evalQuestions = questions.map(q => ({
        category: q.category,
        question_text: q.text,
        confidence_score: q.rating > 0 ? (q.rating / 5) * 100 : null
      }))

      const url = isEditMode ? `${API}/api/scenarios/${editId}` : `${API}/api/scenarios`
      const method = isEditMode ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          scorecard_metrics: scorecardMetrics,
          evaluation_questions: evalQuestions,
          avatar_id: selectedAvatarId,
          avatar_url: avatarUrl,
          avatar_config: { skinTone, hairColor, expression, style: selectedPreset?.style || 'lorelei-neutral' },
          account_name: selectedAccount || null
        })
      })

      if (res.ok) {
        router.push('/scenarios')
      } else {
        const d = await res.json()
        setError(d.error || 'Failed to create persona')
      }
    } catch (err) {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  const handleAccountSelect = (accId: string) => {
    setSelectedAccount(accId)
    if (accId) {
      const acc = kbAccounts.find(a => a.id === accId) || { name: accId }
      const accName = acc.name
      setFormData(prev => ({
        ...prev,
        persona_name: prev.persona_name || accName,
        contact_company: prev.contact_company || accName,
        context_text: prev.context_text || `Sales roleplay session with ${accName} regarding their business needs and goals.`
      }))
    }
  }

  const weightColor = (total: number) => total === 100 ? 'text-green-600' : total > 100 ? 'text-red-500' : 'text-amber-500'

  return (
    <div className="space-y-8 pb-16 font-sans max-w-[960px] mx-auto text-xs">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/scenarios" className="text-[#64748B] hover:text-[#1E293B] font-[600]">
          ← Back to Personas
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-[800] text-[#1E293B]">{isEditMode ? 'Edit Persona' : 'Create New Persona'}</h1>
        <p className="text-xs text-[#64748B]">Design an AI persona for your team to practice against.</p>
      </div>

      {/* 6-Step Stepper */}
      <div className="flex items-center justify-between max-w-xl mx-auto py-3">
        {[
          { num: 1, label: 'Basics' },
          { num: 2, label: 'Context' },
          { num: 3, label: 'Scorecard' },
          { num: 4, label: 'Avatar' },
          { num: 5, label: 'Questions' },
          { num: 6, label: 'Review' }
        ].map((s, idx) => (
          <div key={s.num} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center font-[800] ${
              step > s.num ? 'bg-green-600 text-white' : step === s.num ? 'bg-[#1E1B4B] text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > s.num ? '✓' : s.num}
            </div>
            <span className={`font-[700] ${step === s.num ? 'text-[#1E1B4B]' : 'text-gray-400'}`}>{s.label}</span>
            {idx < 5 && <div className={`w-6 h-0.5 ${step > s.num + 1 ? 'bg-green-600' : 'bg-gray-200'}`}></div>}
          </div>
        ))}
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl font-[600] border border-red-200">{error}</div>}

      {/* ── STEP 1: BASICS ──────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 space-y-6 shadow-sm">
          {kbAccounts.length > 0 && (
            <div className="bg-purple-50/40 border border-purple-200/60 rounded-2xl p-4 space-y-2">
              <span className="font-[800] text-purple-900 text-xs flex items-center gap-1.5">✨ Auto-fill from Knowledge Base</span>
              <select value={selectedAccount} onChange={e => handleAccountSelect(e.target.value)}
                className="w-full h-10 bg-white border border-purple-200 rounded-xl px-3 text-xs text-[#1E293B] focus:outline-none">
                <option value="">Select account (optional)</option>
                {kbAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}

          <div className="space-y-4 pt-2">
            <h3 className="font-[800] text-[#1E293B] uppercase text-[10px] tracking-wider">PERSONA DETAILS</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-[700] text-[#1E293B]">Persona Name*</label>
                <input type="text" value={formData.persona_name} onChange={e => setFormData({ ...formData, persona_name: e.target.value })}
                  placeholder="e.g. Sarah Chen" className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-3.5 text-xs text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#1E1B4B]/20" />
              </div>
              <div className="space-y-1.5">
                <label className="font-[700] text-[#1E293B]">Difficulty*</label>
                <select value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
                  className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-3.5 text-xs text-[#1E293B] focus:outline-none">
                  <option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Expert</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-[700] text-[#1E293B]">Designation / Title</label>
                <input type="text" value={formData.contact_title} onChange={e => setFormData({ ...formData, contact_title: e.target.value })}
                  placeholder="e.g. VP of Engineering" className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-3.5 text-xs text-[#1E293B] focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="font-[700] text-[#1E293B]">Company</label>
                <input type="text" value={formData.contact_company} onChange={e => setFormData({ ...formData, contact_company: e.target.value })}
                  placeholder="e.g. Acme Corp" className="w-full h-11 bg-gray-50 border border-gray-200 rounded-xl px-3.5 text-xs text-[#1E293B] focus:outline-none" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: CONTEXT & BEHAVIOR ──────────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 space-y-6 shadow-sm">
          <div><h3 className="font-[800] text-[#1E293B] text-sm">PERSONA CONTEXT & BEHAVIOR</h3></div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1.5"><label className="font-[700] text-[#1E293B]">Target Skills (AI Training Focus)*</label>
              <textarea rows={3} value={formData.target_skills} onChange={e => setFormData({ ...formData, target_skills: e.target.value })} placeholder="e.g. Needs Discovery, Handling Pricing Objections" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#1E293B] focus:outline-none" />
            </div>
            <div className="space-y-1.5"><label className="font-[700] text-[#1E293B]">Personality Traits*</label>
              <textarea rows={3} value={formData.personality_traits} onChange={e => setFormData({ ...formData, personality_traits: e.target.value })} placeholder="e.g. Data-driven, Skeptical, Impatient" className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#1E293B] focus:outline-none" />
            </div>
          </div>
          <div className="space-y-1.5"><label className="font-[700] text-[#1E293B]">Objection Protocol*</label>
            <textarea rows={3} value={formData.objection_style} onChange={e => setFormData({ ...formData, objection_style: e.target.value })} placeholder='e.g. Frequently challenges pricing' className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#1E293B] focus:outline-none" />
          </div>
          <div className="space-y-1.5"><label className="font-[700] text-[#1E293B]">Scenario Context*</label>
            <textarea rows={5} value={formData.context_text} onChange={e => setFormData({ ...formData, context_text: e.target.value })} placeholder="Background details about the company, current stack, pain points, goals..." className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-[#1E293B] focus:outline-none" />
          </div>
        </div>
      )}

      {/* ── STEP 3: SCORECARD ───────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-[800] text-[#1E293B] text-sm">Scorecard Metrics</h3>
              <p className="text-xs text-[#64748B]">AI generates scoring criteria based on your persona's context.</p>
            </div>
            <button type="button" disabled={isGeneratingScorecard} onClick={handleGenerateScorecard}
              className="px-4 py-2 bg-[#1E1B4B] hover:bg-[#2E2A72] disabled:opacity-60 text-white font-[700] rounded-xl text-xs flex items-center gap-1.5 transition-colors">
              {isGeneratingScorecard ? <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span> : '🔄 Regenerate'}
            </button>
          </div>

          {isGeneratingScorecard ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-[#64748B]">
              <div className="w-10 h-10 border-4 border-[#1E1B4B] border-t-transparent rounded-full animate-spin"></div>
              <p className="font-[600] text-xs">Analyzing persona context & generating scorecard…</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-[10px] font-[800] text-[#64748B] uppercase">{scorecardMetrics.length} CRITERIA</span>
                <span className={`text-xs font-[800] ${weightColor(totalWeight)}`}>Total: {totalWeight}%</span>
              </div>
              <div className="space-y-2">
                {scorecardMetrics.map((m, idx) => (
                  <div key={idx} className="flex items-start justify-between p-3.5 bg-gray-50 border border-gray-200/80 rounded-xl text-xs gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="font-[800] text-[#64748B] text-xs mt-0.5">{idx + 1}</span>
                      <div className="min-w-0">
                        <span className="font-[700] text-[#1E293B] block">{m.name}</span>
                        {m.description && <span className="text-[10px] text-[#64748B] block mt-0.5">{m.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 font-[700]">
                      <button type="button" onClick={() => setScorecardMetrics(prev => prev.map((item, i) => i === idx ? { ...item, weight: Math.max(0, item.weight - 5) } : item))} className="w-7 h-7 bg-white border border-gray-200 rounded-lg">−</button>
                      <span className="w-10 text-center">{m.weight}%</span>
                      <button type="button" onClick={() => setScorecardMetrics(prev => prev.map((item, i) => i === idx ? { ...item, weight: Math.min(100, item.weight + 5) } : item))} className="w-7 h-7 bg-white border border-gray-200 rounded-lg">+</button>
                      <button type="button" onClick={() => setScorecardMetrics(prev => prev.filter((_, i) => i !== idx))} className="w-7 h-7 text-red-400 hover:bg-red-50 rounded-lg ml-1">×</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-gray-100 flex items-center gap-3">
                <input type="text" value={newCustomMetric.name} onChange={e => setNewCustomMetric({ ...newCustomMetric, name: e.target.value })} placeholder="e.g. ROI Justification" className="flex-1 h-10 bg-gray-50 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none" />
                <input type="number" value={newCustomMetric.weight} onChange={e => setNewCustomMetric({ ...newCustomMetric, weight: Number(e.target.value) })} className="w-16 h-10 bg-gray-50 border border-gray-200 rounded-xl px-2 text-center text-xs font-[700]" />
                <button type="button" onClick={() => { if (newCustomMetric.name) { setScorecardMetrics([...scorecardMetrics, { ...newCustomMetric, description: '' }]); setNewCustomMetric({ name: '', weight: 10 }) } }} className="px-4 py-2 bg-[#1E1B4B] text-white rounded-xl font-[700] text-xs">+ Add</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STEP 4: AVATAR ──────────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl w-fit">
            {(['AI', 'Upload'] as const).map(tab => (
              <button key={tab} type="button" onClick={() => setAvatarTab(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-[700] transition-colors ${avatarTab === tab ? 'bg-white text-[#1E1B4B] shadow-sm' : 'text-[#64748B]'}`}>
                {tab === 'AI' ? '🤖 AI Avatars' : '📷 Upload Photo'}
              </button>
            ))}
          </div>

          {avatarTab === 'AI' ? (
            <>
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div className="space-y-2"><p className="text-[10px] font-[800] text-[#64748B] uppercase">Skin Tone</p>
                  <div className="flex gap-2">
                    {[{ id: 'light', c: '#fce8d5' }, { id: 'medium', c: '#d4a574' }, { id: 'dark', c: '#8b5e3c' }].map(t => (
                      <button key={t.id} type="button" onClick={() => setSkinTone(t.id)} style={{ backgroundColor: t.c }} className={`w-8 h-8 rounded-full border-2 ${skinTone === t.id ? 'border-[#1E1B4B] scale-110' : 'border-white'}`} />
                    ))}
                  </div>
                </div>
                <div className="space-y-2"><p className="text-[10px] font-[800] text-[#64748B] uppercase">Hair Color</p>
                  <div className="flex gap-2">
                    {[{ id: 'black', c: '#1a1a1a' }, { id: 'brown', c: '#6b3d2e' }, { id: 'blonde', c: '#d4a843' }].map(h => (
                      <button key={h.id} type="button" onClick={() => setHairColor(h.id)} style={{ backgroundColor: h.c }} className={`w-8 h-8 rounded-full border-2 ${hairColor === h.id ? 'border-[#1E1B4B] scale-110' : 'border-white'}`} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {AVATAR_PRESETS.map(av => (
                  <div key={av.id} onClick={() => { setSelectedAvatarId(av.id); setAvatarTab('AI') }}
                    className={`border rounded-2xl p-4 text-center cursor-pointer transition-all ${selectedAvatarId === av.id ? 'border-[#1E1B4B] ring-2 ring-[#1E1B4B]/20 bg-purple-50/20' : 'border-gray-200'}`}>
                    <div className="w-20 h-20 rounded-full mx-auto overflow-hidden bg-gray-50">
                      <img src={getAvatarUrl(av)} alt={av.name} className="w-full h-full object-cover" />
                    </div>
                    <p className="font-[800] mt-2">{av.name}</p>
                    <p className="text-[9px] text-[#64748B]">{av.tag}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-purple-200 rounded-2xl p-10 bg-purple-50/20 flex flex-col items-center justify-center cursor-pointer">
                {uploadedImageUrl ? (
                  <img src={uploadedImageUrl} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-[#1E1B4B]" />
                ) : (
                  <>
                    <div className="text-2xl mb-2">📷</div>
                    <p className="font-[700]">Upload photo</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </div>
          )}
        </div>
      )}

      {/* ── STEP 5: QUESTIONS ───────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-[800] text-[#1E293B] text-sm">Evaluation Question Bank</h3>
              <p className="text-xs text-[#64748B]">Generate specific probing questions based on the persona context and scorecard metrics.</p>
            </div>
            <button type="button" disabled={isGeneratingQuestions} onClick={handleGenerateQuestions}
              className="px-4 py-2 bg-[#1E1B4B] hover:bg-[#2E2A72] disabled:opacity-60 text-white font-[700] rounded-xl text-xs flex items-center gap-1.5">
              {isGeneratingQuestions ? <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span> : '✨ AI Generate Questions'}
            </button>
          </div>

          {isGeneratingQuestions ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-[#64748B]">
              <div className="w-10 h-10 border-4 border-[#1E1B4B] border-t-transparent rounded-full animate-spin"></div>
              <p className="font-[600] text-xs">Generating relevant questions based on your context...</p>
            </div>
          ) : questions.length === 0 ? (
             <div className="p-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-center text-[#64748B]">
               <span className="text-3xl block mb-2">❓</span>
               <p className="font-[700] text-sm text-[#1E293B]">No questions generated yet</p>
               <p className="text-xs mt-1">Click the AI Generate button or manually add questions below.</p>
             </div>
          ) : (
            <div className="space-y-3">
              {questions.map(q => (
                <div key={q.id} className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-4 text-xs">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 font-[800] text-[9px] rounded uppercase">{q.category}</span>
                      {q.id.startsWith('ai-') && <span className="text-[10px] text-purple-500 font-[800]">AI Generated</span>}
                    </div>
                    <p className="font-[600] text-[#1E293B]">{q.text}</p>
                    
                    {/* Star Rating for Question */}
                    <div className="flex items-center gap-1 mt-2">
                      <span className="text-[10px] font-[700] text-[#64748B] mr-1">Rate relevance:</span>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} type="button" onClick={() => rateQuestion(q.id, star)}
                          className={`text-base leading-none transition-colors ${q.rating >= star ? 'text-amber-400' : 'text-gray-300 hover:text-amber-200'}`}>
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-600 mt-1 flex items-center justify-center w-6 h-6">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
            <p className="text-[10px] font-[800] text-[#64748B] uppercase">Add Manual Question</p>
            <div className="flex items-center gap-3">
              <select value={newCustomQuestion.category} onChange={e => setNewCustomQuestion({...newCustomQuestion, category: e.target.value})}
                className="w-1/4 h-10 bg-gray-50 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none">
                <option value="">Select Metric / Category</option>
                {scorecardMetrics.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                <option value="General">General</option>
              </select>
              <input type="text" value={newCustomQuestion.text} onChange={e => setNewCustomQuestion({...newCustomQuestion, text: e.target.value})}
                placeholder="e.g. Can you explain your rollback procedure?" className="flex-1 h-10 bg-gray-50 border border-gray-200 rounded-xl px-3 text-xs focus:outline-none" />
              <button type="button" onClick={addCustomQuestion} className="px-4 py-2 bg-[#1E1B4B] text-white rounded-xl font-[700] text-xs whitespace-nowrap">+ Add</button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 6: REVIEW & PUBLISH ────────────────────────────────────────────── */}
      {step === 6 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 space-y-6 shadow-sm text-xs">
          <h3 className="font-[800] text-[#1E293B] text-sm">Review Persona Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <p><strong>Name:</strong> {formData.persona_name}</p>
              <p><strong>Title:</strong> {formData.contact_title} at {formData.contact_company}</p>
              <p><strong>Scorecard:</strong> {scorecardMetrics.length} metrics ({totalWeight}%)</p>
              <p><strong>Questions:</strong> {questions.length} included</p>
            </div>
            <div className="flex items-center gap-4 p-4 bg-purple-50/40 rounded-xl border border-purple-100">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#1E1B4B] bg-gray-50">
                <img src={avatarTab === 'Upload' && uploadedImageUrl ? uploadedImageUrl : getAvatarUrl(AVATAR_PRESETS.find(p => p.id === selectedAvatarId) || AVATAR_PRESETS[0])} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="font-[800]">{formData.persona_name}</p>
                <span className="px-2 py-0.5 bg-red-50 text-red-600 font-[700] text-[10px] rounded-md">{formData.difficulty}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stepper Footer ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <button type="button" onClick={() => step > 1 && setStep(step - 1)} disabled={step === 1}
          className="px-5 py-2.5 rounded-xl border border-gray-300 font-[700] hover:bg-gray-50 disabled:opacity-40">← Previous</button>
        {step < 6 ? (
          <button type="button" onClick={() => setStep(step + 1)} className="px-6 py-2.5 rounded-xl bg-[#1E1B4B] text-white font-[700] shadow-md">Next Step →</button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={loading || !formData.persona_name}
            className="px-7 py-2.5 rounded-xl bg-green-600 text-white font-[700] shadow-md disabled:opacity-50">
            {loading ? 'Saving...' : (isEditMode ? '✓ Save Changes' : '✓ Publish Persona')}
          </button>
        )}
      </div>
    </div>
  )
}
