'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function NewScenarioPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [transcriptPreview, setTranscriptPreview] = useState('')

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/scenarios`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
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

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
        <div>
          <Link href="/scenarios" className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7B6F63] hover:text-[#3A2F28] transition-colors mb-4 block">
            Back to Scenarios
          </Link>
          <h1 className="text-4xl font-extrabold text-[#3A2F28] tracking-tight">Create Scenario</h1>
          <p className="text-[#7B6F63] font-medium text-base mt-2">Design an AI persona for representative operational training.</p>
        </div>
      </div>

      <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-12 shadow-sm">
        {error && (
          <div className="mb-10 p-6 bg-[#A06A5B]/10 border border-[#A06A5B]/20 text-[#A06A5B] rounded-2xl text-[10px] font-black uppercase tracking-widest">
            {error}
          </div>
        )}

        {/* AI Generation Section */}
        <div className="mb-12 p-8 bg-[#F6F1E8] border border-[#D8CCBC] rounded-[2rem]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
            <div>
              <h3 className="text-lg font-extrabold text-[#3A2F28]">AI Assistant: Generate Persona</h3>
              <p className="text-xs text-[#7B6F63] mt-1">Upload an audio/video recording of a sales call to automatically extract and generate a persona.</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <input 
              type="file" 
              accept="audio/*,video/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="flex-1 bg-white border border-[#D8CCBC] rounded-xl px-4 py-3 text-sm text-[#3A2F28] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#EFE7DC] file:text-[#3A2F28] hover:file:bg-[#D8CCBC] transition-all"
            />
            <button 
              type="button"
              onClick={async () => {
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
                  
                  // Combine traits with communication style for storage
                  let combinedTraits = personaData.personality_traits || ''
                  if (personaData.communication_style) {
                    combinedTraits += ` | Communication Style: ${personaData.communication_style}`
                  }

                  // Append decision drivers to context text if empty
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
              }}
              disabled={isGenerating || !file}
              className="w-full sm:w-auto px-8 py-4 bg-[#D6C2A8] hover:bg-[#C5B095] disabled:opacity-50 disabled:hover:bg-[#D6C2A8] text-[#3A2F28] text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-sm transition-all whitespace-nowrap"
            >
              {isGenerating ? 'Analyzing Audio...' : 'Generate from Audio'}
            </button>
          </div>

          {transcriptPreview && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#7D8461] list-none flex items-center gap-2">
                  Diarized Transcript Preview
                </span>
              </div>
              <div 
                onClick={() => setExpandedField({ id: 'transcript', title: 'Diarized Transcript Preview', value: transcriptPreview, readOnly: true })}
                className="p-4 bg-white border border-[#D8CCBC] rounded-xl text-xs text-[#7B6F63] h-24 overflow-hidden whitespace-pre-wrap font-mono relative cursor-pointer hover:border-[#7D8461] transition-all"
              >
                {transcriptPreview}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              </div>
            </div>
          )}

          {formData.custom_prompt !== undefined && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest block">
                    AI Persona System Prompt
                  </label>
                  {formData.custom_prompt !== '' && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#7D8461] bg-[#7D8461]/10 px-2 py-1 rounded">
                      Custom Prompt Active
                    </span>
                  )}
                </div>
              </div>
              <textarea 
                value={formData.custom_prompt}
                onClick={() => setExpandedField({ id: 'custom_prompt', title: 'AI Persona System Prompt', value: formData.custom_prompt, readOnly: false })}
                readOnly
                rows={3}
                className="w-full bg-white border border-[#D8CCBC] rounded-xl px-6 py-4 text-sm font-medium text-[#3A2F28] outline-none resize-none cursor-pointer hover:border-[#7D8461] transition-all"
                placeholder="The prompt will be generated here. Click to edit."
              />
              <div className="flex justify-between items-center mt-3">
                <p className="text-[9px] text-[#7B6F63] italic max-w-xl">
                  * You can edit this prompt directly. If edited, the custom prompt will override the structured fields below at runtime.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const rebuiltPrompt = `You are a ${formData.persona_type} named ${formData.persona_name || '[Name]'}.
You are highly ${formData.personality_traits || '[Traits]'}.
Your communication style is: ${(formData as any).communication_style || 'professional'}.
You frequently raise objections such as: ${formData.objection_style || '[Objections]'}.
You make decisions based on: ${(formData as any).decision_drivers || 'logic and value'}.
Maintain this behavior consistently and challenge vague responses.`;
                    setFormData({ ...formData, custom_prompt: rebuiltPrompt });
                  }}
                  className="px-4 py-2 bg-[#EFE7DC] hover:bg-[#D8CCBC] text-[#3A2F28] text-[9px] font-black uppercase tracking-widest rounded-lg transition-all"
                >
                  Regenerate Prompt from Fields
                </button>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          
          {/* Persona Name */}
          <div className="space-y-4">
            <label htmlFor="persona_name" className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">
              Persona Name
            </label>
            <input
              id="persona_name"
              type="text"
              required
              placeholder="e.g. John Smith"
              value={formData.persona_name}
              onChange={(e) => setFormData({ ...formData, persona_name: e.target.value })}
              className="w-full bg-[#F6F1E8] border border-[#D8CCBC] rounded-2xl px-8 py-4 text-sm font-bold text-[#3A2F28] placeholder:text-[#7B6F63]/30 focus:border-[#7D8461] outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Persona Type */}
            <div className="space-y-4">
              <label htmlFor="persona_type" className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">
                Persona Type
              </label>
              <select
                id="persona_type"
                value={formData.persona_type}
                onChange={(e) => setFormData({ ...formData, persona_type: e.target.value })}
                className="w-full bg-[#F6F1E8] border border-[#D8CCBC] rounded-2xl px-8 py-4 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all appearance-none"
              >
                <option value="Careful Budgeter (Very price-conscious)">Careful Budgeter (Very price-conscious)</option>
                <option value="Easy Supporter (Already interested)">Easy Supporter (Already interested)</option>
                <option value="Tech Deep-Diver (Wants technical details)">Tech Deep-Diver (Wants technical details)</option>
                <option value="Busy Boss (Short on time)">Busy Boss (Short on time)</option>
                <option value="Comparison Shopper (Evaluating options)">Comparison Shopper (Evaluating options)</option>
                <option value="Doubtful Buyer (Not fully convinced)">Doubtful Buyer (Not fully convinced)</option>
                <option value="Curious Explorer (Just exploring)">Curious Explorer (Just exploring)</option>
                <option value="Not Interested (Low engagement)">Not Interested (Low engagement)</option>
              </select>
            </div>

            {/* Difficulty */}
            <div className="space-y-4">
              <label htmlFor="difficulty" className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">
                Difficulty
              </label>
              <select
                id="difficulty"
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="w-full bg-[#F6F1E8] border border-[#D8CCBC] rounded-2xl px-8 py-4 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all appearance-none"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          {/* New Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
             <div className="space-y-4">
               <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">Target Skills</label>
               <input
                 type="text"
                 placeholder="Click to edit Target Skills..."
                 value={(formData as any).target_skills || ''}
                 onClick={() => setExpandedField({ id: 'target_skills', title: 'Target Skills', value: (formData as any).target_skills || '', readOnly: false })}
                 readOnly
                 className="w-full bg-[#F6F1E8] border border-[#D8CCBC] rounded-2xl px-8 py-4 text-sm font-bold text-[#3A2F28] outline-none cursor-pointer hover:border-[#7D8461] transition-all truncate"
               />
             </div>
             <div className="space-y-4">
               <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">Evaluation Focus (comma separated)</label>
               <input
                 type="text"
                 placeholder="Click to edit Evaluation Focus..."
                 value={(formData as any).evaluation_focus || ''}
                 onClick={() => setExpandedField({ id: 'evaluation_focus', title: 'Evaluation Focus', value: (formData as any).evaluation_focus || '', readOnly: false })}
                 readOnly
                 className="w-full bg-[#F6F1E8] border border-[#D8CCBC] rounded-2xl px-8 py-4 text-sm font-bold text-[#3A2F28] outline-none cursor-pointer hover:border-[#7D8461] transition-all truncate"
               />
             </div>
          </div>

          <div className="space-y-4">
             <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">Objection Protocol</label>
             <input
               type="text"
               placeholder="Click to edit Objection Protocol..."
               value={(formData as any).objection_style || ''}
               onClick={() => setExpandedField({ id: 'objection_style', title: 'Objection Protocol', value: (formData as any).objection_style || '', readOnly: false })}
               readOnly
               className="w-full bg-[#F6F1E8] border border-[#D8CCBC] rounded-2xl px-8 py-4 text-sm font-bold text-[#3A2F28] outline-none cursor-pointer hover:border-[#7D8461] transition-all truncate"
             />
          </div>

          <div className="space-y-4">
             <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">Personality Traits</label>
             <textarea
               rows={2}
               placeholder="Click to edit Personality Traits..."
               value={(formData as any).personality_traits || ''}
               onClick={() => setExpandedField({ id: 'personality_traits', title: 'Personality Traits', value: formData.personality_traits, readOnly: false })}
               readOnly
               className="w-full bg-[#F6F1E8] border border-[#D8CCBC] rounded-2xl px-8 py-4 text-sm font-medium text-[#3A2F28] outline-none cursor-pointer hover:border-[#7D8461] transition-all resize-none"
             />
          </div>

          {/* Context Text */}
          <div className="space-y-4">
            <label htmlFor="context_text" className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">
              Scenario Context & Background
            </label>
            <textarea
              id="context_text"
              rows={3}
              placeholder="Click to edit Context & Background..."
              value={formData.context_text}
              onClick={() => setExpandedField({ id: 'context_text', title: 'Scenario Context & Background', value: formData.context_text, readOnly: false })}
              readOnly
              className="w-full bg-[#F6F1E8] border border-[#D8CCBC] rounded-2xl px-8 py-6 text-sm font-medium text-[#3A2F28] placeholder:text-[#7B6F63]/30 outline-none cursor-pointer hover:border-[#7D8461] transition-all resize-none"
            />
          </div>

          <div className="pt-8 flex justify-end gap-6">
            <Link
              href="/scenarios"
              className="px-8 py-4 text-[#7B6F63] hover:text-[#3A2F28] text-[10px] font-black uppercase tracking-widest transition-all"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-10 py-4 bg-[#7D8461] hover:bg-[#6B7252] text-[#F6F1E8] font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-lg transition-all disabled:opacity-50 active:scale-95"
            >
              {loading ? 'Initializing...' : 'Authorize Persona Creation'}
            </button>
          </div>

        </form>
      </div>

      {/* Expanded Modal */}
      {expandedField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-[#F6F1E8] border border-[#D8CCBC] rounded-[2rem] shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center p-8 border-b border-[#D8CCBC]/50">
              <h2 className="text-xl font-extrabold text-[#3A2F28] tracking-tight">{expandedField.title}</h2>
              <button 
                type="button"
                onClick={() => setExpandedField(null)}
                className="w-10 h-10 rounded-full bg-[#EFE7DC] hover:bg-[#D8CCBC] flex items-center justify-center text-[#7B6F63] transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-8 overflow-y-auto">
              {expandedField.readOnly ? (
                <div className="text-sm text-[#3A2F28] whitespace-pre-wrap font-mono leading-relaxed">
                  {expandedField.value}
                </div>
              ) : (
                <textarea
                  value={expandedField.value}
                  onChange={(e) => handleModalChange(e.target.value)}
                  className="w-full min-h-[50vh] bg-white border border-[#D8CCBC] rounded-2xl p-6 text-sm font-medium text-[#3A2F28] focus:border-[#7D8461] outline-none resize-none transition-all leading-relaxed"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
