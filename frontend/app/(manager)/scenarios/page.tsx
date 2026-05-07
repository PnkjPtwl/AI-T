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
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('All')

  // Edit form state
  const [editForm, setEditForm] = useState({
    persona_name: '',
    persona_type: '',
    difficulty: '',
    context_text: '',
    personality_traits: '',
    evaluation_focus: '',
    objection_style: '',
    conversation_expectations: '',
    target_skills: ''
  })

  const fetchScenarios = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const res = await fetch(`${API}/api/scenarios`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (res.ok) {
        const data = await res.json()
        setScenarios(data)
      }
    } catch (err) {
      console.error('Failed to fetch scenarios', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchScenarios()
  }, [])

  const filteredScenarios = useMemo(() => {
    let result = [...scenarios]
    
    // Normalize difficulty mapping
    const diffMap: Record<string, string[]> = {
      'easy': ['easy', 'beginner', 'low'],
      'intermediate': ['intermediate', 'medium', 'moderate'],
      'hard': ['hard', 'advanced', 'expert', 'high']
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(s => 
        (s.persona_name?.toLowerCase() || '').includes(term) || 
        (s.persona_type?.toLowerCase() || '').includes(term) ||
        (s.context_text?.toLowerCase() || '').includes(term) ||
        (s.target_skills?.toLowerCase() || '').includes(term)
      )
    }

    if (difficultyFilter !== 'All') {
      const targetDiff = difficultyFilter.toLowerCase()
      const validValues = diffMap[targetDiff] || [targetDiff]
      
      result = result.filter(s => {
        const sDiff = (s.difficulty || '').toLowerCase()
        return validValues.includes(sDiff) || sDiff === targetDiff
      })
    }
    
    return result
  }, [scenarios, searchTerm, difficultyFilter])

  const handleRowClick = async (scenario: any) => {
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/scenarios/${scenario.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const fullData = await res.json()
        setSelectedScenario(fullData)
        setEditForm({
          persona_name: fullData.persona_name || '',
          persona_type: fullData.persona_type || '',
          difficulty: fullData.difficulty || 'intermediate',
          context_text: fullData.context_text || '',
          personality_traits: fullData.personality_traits || fullData.personality_description || '',
          evaluation_focus: fullData.evaluation_focus || (fullData.coaching_focus_areas ? fullData.coaching_focus_areas.join(', ') : ''),
          objection_style: fullData.objection_style || (fullData.likely_objections ? fullData.likely_objections.join(', ') : ''),
          conversation_expectations: fullData.conversation_expectations || fullData.sales_rep_goal || '',
          target_skills: fullData.target_skills || ''
        })
      }
    } catch (err) {
      console.error('Failed to fetch scenario details', err)
      setSelectedScenario(scenario)
    }
  }

  const handleUpdate = async () => {
    setSaving(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/scenarios/${selectedScenario.id}`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      })

      if (res.ok) {
        const updated = await res.json()
        setSelectedScenario(updated)
        setIsEditing(false)
        fetchScenarios()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to update scenario')
      }
    } catch (err) {
      setError('An error occurred while saving.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
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
        setError(data.error || 'Failed to delete scenario')
      }
    } catch (err) {
      setError('An error occurred while deleting.')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#7D8461]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-12 pb-24 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold text-[#3A2F28] tracking-tight">Intelligence Library</h1>
          <p className="text-[#7B6F63] font-medium text-base mt-2">AI Persona Catalog & Behavioral Architecture</p>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
           <div className="relative flex-1 lg:w-72">
              <input 
                type="text" 
                placeholder="Search Scenarios..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all placeholder:text-[#7B6F63]/50"
              />
           </div>
           <select 
             value={difficultyFilter}
             onChange={(e) => setDifficultyFilter(e.target.value)}
             className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-8 text-[10px] font-black uppercase tracking-widest text-[#3A2F28] outline-none focus:border-[#7D8461] appearance-none"
           >
              <option value="All">All Difficulty</option>
              <option value="easy">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="hard">Advanced</option>
           </select>
           <Link
             href="/scenarios/new"
             className="px-8 py-4 bg-[#7D8461] hover:bg-[#6B7252] text-[#F6F1E8] font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-md transition-all active:scale-95"
           >
             New Persona
           </Link>
        </div>
      </div>

      {/* Scenarios List */}
      {filteredScenarios.length === 0 ? (
        <div className="bg-[#EAE2D6]/50 border border-dashed border-[#D8CCBC] rounded-[2.5rem] p-40 text-center">
           <p className="text-[#7B6F63] text-sm font-black uppercase tracking-widest">No matching scenarios found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
           {filteredScenarios.map((s) => (
             <div 
               key={s.id} 
               onClick={() => handleRowClick(s)}
               className="group bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-10 hover:shadow-xl transition-all cursor-pointer flex flex-col lg:flex-row items-center gap-12"
             >
                <div className="flex-1 text-center lg:text-left">
                   <div className="flex flex-col lg:flex-row items-center gap-4 mb-3">
                      <h3 className="text-2xl font-extrabold text-[#3A2F28] tracking-tight uppercase">{s.persona_name}</h3>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border ${s.difficulty.toLowerCase() === 'hard' ? 'bg-[#A06A5B]/10 text-[#A06A5B] border-[#A06A5B]/20' : 'bg-[#7D8461]/10 text-[#7D8461] border-[#7D8461]/20'}`}>
                         {s.difficulty}
                      </span>
                   </div>
                   <p className="text-[10px] font-black text-[#7B6F63] uppercase tracking-[0.3em]">{s.persona_type}</p>
                </div>

                <div className="hidden lg:block flex-1 max-w-md">
                   <p className="text-sm text-[#7B6F63] line-clamp-2 italic leading-relaxed font-medium">
                      {s.context_text?.replace(/\[SCENARIO:.*?\]\s*/g, '').replace(/\[SCENARIO_METADATA:\s*({.*?})\]/s, '').trim()}
                   </p>
                </div>

                <div className="flex items-center gap-12 text-right">
                   <div className="hidden sm:block">
                      <p className="text-[9px] font-black text-[#D8CCBC] uppercase tracking-widest mb-1">Target Skills</p>
                      <p className="text-[10px] font-bold text-[#3A2F28] uppercase tracking-tight">{s.target_skills || 'General Sales'}</p>
                   </div>
                   <div className="text-[10px] font-black text-[#7B6F63] uppercase tracking-widest group-hover:text-[#3A2F28] transition-colors">
                      View Detail
                   </div>
                </div>
             </div>
           ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedScenario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-8 animate-in fade-in">
          <div className="absolute inset-0 bg-[#3A2F28]/40 backdrop-blur-md" onClick={() => { if (!isEditing) setSelectedScenario(null) }}></div>
          <div className="relative w-full max-w-6xl bg-[#F6F1E8] border border-[#D8CCBC] rounded-[3rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-12 border-b border-[#D8CCBC] flex justify-between items-center bg-[#EAE2D6]/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-8">
                <div>
                  <h2 className="text-3xl font-extrabold text-[#3A2F28] tracking-tight uppercase">{selectedScenario.persona_name}</h2>
                  <p className="text-[10px] font-black text-[#7B6F63] uppercase tracking-[0.4em] mt-2">{selectedScenario.persona_type} • {selectedScenario.difficulty} Intelligence</p>
                </div>
              </div>
              <div className="flex gap-4">
                {!isEditing ? (
                  <>
                    <button onClick={() => setIsEditing(true)} className="px-8 py-4 bg-[#EFE7DC] hover:bg-[#EAE2D6] text-[#3A2F28] text-[10px] font-black uppercase tracking-widest rounded-2xl border border-[#D8CCBC] transition-all">Edit Architecture</button>
                    <button onClick={() => setShowDeleteConfirm(true)} className="px-8 py-4 bg-[#A06A5B]/10 hover:bg-[#A06A5B] text-[#A06A5B] hover:text-[#F6F1E8] text-[10px] font-black uppercase tracking-widest rounded-2xl border border-[#A06A5B]/20 transition-all">Decommission</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setIsEditing(false)} className="px-8 py-4 bg-[#EFE7DC] hover:bg-[#EAE2D6] text-[#3A2F28] text-[10px] font-black uppercase tracking-widest rounded-2xl border border-[#D8CCBC] transition-all">Cancel</button>
                    <button onClick={handleUpdate} disabled={saving} className="px-8 py-4 bg-[#7D8461] hover:bg-[#6B7252] text-[#F6F1E8] text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all">{saving ? 'Syncing...' : 'Commit Changes'}</button>
                  </>
                )}
                <button onClick={() => { if (!isEditing) setSelectedScenario(null) }} className="text-[10px] font-black uppercase tracking-widest text-[#7B6F63] hover:text-[#3A2F28] ml-6">Close</button>
              </div>
            </div>

            <div className="p-16 overflow-y-auto scrollbar-thin">
              {!isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-20">
                    <div className="md:col-span-7 space-y-16">
                       <section>
                          <h4 className="text-[10px] font-black uppercase text-[#7B6F63] tracking-[0.4em] mb-8 ml-1">Operational Context</h4>
                          <div className="bg-[#EAE2D6] border border-[#D8CCBC] rounded-[2.5rem] p-10">
                             <p className="text-[#3A2F28] leading-relaxed text-sm whitespace-pre-wrap font-medium">{selectedScenario.context_text?.replace(/\[SCENARIO:.*?\]\s*/g, '').replace(/\[SCENARIO_METADATA:\s*({.*?})\]/s, '').trim()}</p>
                          </div>
                       </section>
                       <section>
                          <h4 className="text-[10px] font-black uppercase text-[#7B6F63] tracking-[0.4em] mb-8 ml-1">Personality Profile</h4>
                          <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-10 shadow-sm">
                             <p className="text-[#3A2F28] leading-relaxed text-sm font-medium">{selectedScenario.personality_traits || 'No detailed personality traits defined.'}</p>
                          </div>
                       </section>
                    </div>
                    <div className="md:col-span-5 space-y-16">
                       <section>
                          <h4 className="text-[10px] font-black uppercase text-[#7B6F63] tracking-[0.4em] mb-8 ml-1">Evaluation Focus</h4>
                          <div className="grid grid-cols-1 gap-4">
                             {(selectedScenario.evaluation_focus || (selectedScenario.coaching_focus_areas ? selectedScenario.coaching_focus_areas.join(', ') : 'discovery, closing')).split(',').map((f: string, idx: number) => (
                               <div key={idx} className="flex items-center gap-6 bg-[#EAE2D6] border border-[#D8CCBC] p-6 rounded-2xl">
                                  <div className="w-2 h-2 bg-[#7D8461] rounded-full shadow-sm"></div>
                                  <span className="text-[10px] font-black text-[#3A2F28] uppercase tracking-widest">{f.trim() || 'N/A'}</span>
                               </div>
                             ))}
                          </div>
                       </section>
                       <section>
                          <h4 className="text-[10px] font-black uppercase text-[#7B6F63] tracking-[0.4em] mb-8 ml-1">Objection Protocol</h4>
                          <div className="bg-[#A06A5B]/5 border border-[#A06A5B]/10 rounded-[2.5rem] p-10">
                             <p className="text-sm text-[#A06A5B] italic font-bold leading-relaxed">"{selectedScenario.objection_style || (selectedScenario.likely_objections ? selectedScenario.likely_objections.join(', ') : 'Standard Transactional Resistance')}"</p>
                          </div>
                       </section>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                     <div className="space-y-10">
                        <div className="space-y-4">
                           <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">Persona Name</label>
                           <input type="text" value={editForm.persona_name} onChange={(e) => setEditForm({...editForm, persona_name: e.target.value})} className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all" />
                        </div>
                        <div className="space-y-4">
                           <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">Persona Type</label>
                           <input type="text" value={editForm.persona_type} onChange={(e) => setEditForm({...editForm, persona_type: e.target.value})} className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all" />
                        </div>
                        <div className="space-y-4">
                           <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">Difficulty</label>
                           <select value={editForm.difficulty} onChange={(e) => setEditForm({...editForm, difficulty: e.target.value})} className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all appearance-none">
                              <option value="easy">Beginner</option>
                              <option value="intermediate">Intermediate</option>
                              <option value="hard">Advanced</option>
                           </select>
                        </div>
                        <div className="space-y-4">
                           <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">Target Skills</label>
                           <input type="text" value={editForm.target_skills} onChange={(e) => setEditForm({...editForm, target_skills: e.target.value})} className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all" placeholder="e.g. Discovery, Negotiation" />
                        </div>
                     </div>
                     <div className="space-y-10">
                        <div className="space-y-4">
                           <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">Context</label>
                           <textarea value={editForm.context_text} onChange={(e) => setEditForm({...editForm, context_text: e.target.value})} className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] h-32 focus:border-[#7D8461] outline-none transition-all resize-none" />
                        </div>
                        <div className="space-y-4">
                           <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">Personality Traits</label>
                           <textarea value={editForm.personality_traits} onChange={(e) => setEditForm({...editForm, personality_traits: e.target.value})} className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] h-32 focus:border-[#7D8461] outline-none transition-all resize-none" />
                        </div>
                        <div className="space-y-4">
                           <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">Evaluation Focus (comma separated)</label>
                           <input type="text" value={editForm.evaluation_focus} onChange={(e) => setEditForm({...editForm, evaluation_focus: e.target.value})} className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all" />
                        </div>
                        <div className="space-y-4">
                           <label className="text-[10px] font-black uppercase text-[#7B6F63] tracking-widest ml-1">Objection Protocol</label>
                           <input type="text" value={editForm.objection_style} onChange={(e) => setEditForm({...editForm, objection_style: e.target.value})} className="w-full bg-[#EFE7DC] border border-[#D8CCBC] rounded-2xl py-4 px-6 text-sm font-bold text-[#3A2F28] focus:border-[#7D8461] outline-none transition-all" />
                        </div>
                     </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-8 animate-in fade-in zoom-in-95">
             <div className="absolute inset-0 bg-[#3A2F28]/60 backdrop-blur-xl" onClick={() => setShowDeleteConfirm(false)}></div>
             <div className="relative bg-[#F6F1E8] border border-[#A06A5B]/30 rounded-[3rem] p-16 max-w-xl w-full shadow-2xl text-center">
                <h3 className="text-3xl font-extrabold text-[#3A2F28] mb-6 tracking-tight uppercase">Decommission Protocol</h3>
                <p className="text-[#7B6F63] text-base mb-12 leading-relaxed font-medium">Are you sure you want to permanently purge <span className="text-[#3A2F28] font-black">{selectedScenario.persona_name}</span> from the intelligence library?</p>
                <div className="flex gap-6">
                   <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-5 bg-[#EFE7DC] hover:bg-[#EAE2D6] text-[#3A2F28] text-[10px] font-black uppercase tracking-widest rounded-2xl border border-[#D8CCBC] transition-all">Abort</button>
                   <button onClick={handleDelete} disabled={deleting} className="flex-1 py-5 bg-[#A06A5B] hover:bg-[#8B5A4B] text-[#F6F1E8] text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-95">{deleting ? 'Purging...' : 'Confirm Purge'}</button>
                </div>
             </div>
          </div>
        )}
    </div>
  )
}
