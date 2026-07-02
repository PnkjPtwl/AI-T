'use client'

import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function CoachingPage() {
  const [reps, setReps] = useState<any[]>([])
  const [sentNotes, setSentNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Note Form
  const [noteRepId, setNoteRepId] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [notePriority, setNotePriority] = useState('Medium')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState('')

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const headers = { 'Authorization': `Bearer ${token}` }
      const [repsRes, notesRes] = await Promise.all([
        fetch(`${API}/api/users/reps`, { headers }),
        fetch(`${API}/api/users/sent-notes`, { headers })
      ])

      if (repsRes.ok) setReps(await repsRes.json())
      if (notesRes.ok) setSentNotes(await notesRes.json())
    } catch (err) {
      console.error('Failed to fetch coaching data', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSendNote = async () => {
    if (!noteRepId || !noteContent.trim()) return
    setSending(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/users/reps/${noteRepId}/notes`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ content: noteContent, priority: notePriority })
      })

      if (res.ok) {
        setNoteContent('')
        setNoteRepId('')
        setSuccess('Coaching directive synchronized.')
        fetchData()
        setTimeout(() => setSuccess(''), 4000)
      }
    } catch (err) {
      console.error('Failed to send note', err)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-4xl font-extrabold text-[#1A2A3A] tracking-tight">Coaching Intelligence</h1>
        <p className="text-[#64748B] font-medium text-base mt-2">Intervention & Representative Mentorship Portal</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        {/* Left: Compose Note */}
        <div className="xl:col-span-4 space-y-10">
           <div className="bg-white border border-[#E2E8F0] rounded-[2.5rem] p-10 shadow-sm">
              <h3 className="text-[10px] font-black text-[#1A2A3A] uppercase tracking-[0.3em] mb-10">Direct Guidance</h3>

              <div className="space-y-8">
                <div className="space-y-4">
                   <label className="text-[10px] font-black uppercase text-[#64748B] tracking-widest ml-1">Select Representative</label>
                   <select 
                     value={noteRepId}
                     onChange={(e) => setNoteRepId(e.target.value)}
                     className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-4 px-6 text-sm font-bold text-[#1A2A3A] focus:border-green-600 outline-none transition-all appearance-none"
                   >
                     <option value="">Target Agent...</option>
                     {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                   </select>
                </div>

                <div className="space-y-4">
                   <label className="text-[10px] font-black uppercase text-[#64748B] tracking-widest ml-1">Priority Protocol</label>
                   <div className="grid grid-cols-3 gap-3">
                     {['Low', 'Medium', 'High'].map(p => (
                       <button 
                         key={p}
                         onClick={() => setNotePriority(p)}
                         className={`py-3 text-[10px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                           notePriority === p ? 'bg-[#2C5282] border-green-600 text-white shadow-md' : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#64748B] hover:border-green-600'
                         }`}
                       >
                         {p}
                       </button>
                     ))}
                   </div>
                </div>

                <div className="space-y-4">
                   <label className="text-[10px] font-black uppercase text-[#64748B] tracking-widest ml-1">Intelligence Directive</label>
                   <textarea 
                     value={noteContent}
                     onChange={(e) => setNoteContent(e.target.value)}
                     placeholder="Type coaching feedback..."
                     className="w-full h-56 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-8 text-sm font-medium text-[#1A2A3A] focus:border-green-600 outline-none resize-none transition-all placeholder:text-[#64748B]/40"
                   />
                </div>

                {success && <p className="text-[10px] font-black text-green-600 uppercase tracking-widest text-center animate-bounce">{success}</p>}

                <button 
                   onClick={handleSendNote}
                   disabled={sending || !noteRepId || !noteContent.trim()}
                   className="w-full py-5 bg-[#2C5282] hover:bg-[#1A365D] text-white font-black text-xs uppercase tracking-[0.3em] rounded-2xl shadow-lg shadow-[#7D8461]/20 transition-all disabled:opacity-50 active:scale-95"
                >
                  {sending ? 'Synchronizing...' : 'Dispatch Coaching Note'}
                </button>
              </div>
           </div>
        </div>

        {/* Right: History Feed */}
        <div className="xl:col-span-8 bg-white border border-[#E2E8F0] rounded-[2.5rem] p-10 shadow-sm">
           <div className="flex justify-between items-center mb-10">
              <h3 className="text-[10px] font-black text-[#1A2A3A] uppercase tracking-[0.3em]">Coaching Log History</h3>
              <span className="text-[10px] text-[#64748B] font-black uppercase tracking-widest">{sentNotes.length} Logged Entries</span>
           </div>

           <div className="space-y-8 max-h-[1000px] overflow-y-auto pr-4 scrollbar-thin">
              {sentNotes.map((note) => (
                <div key={note.id} className="bg-[#F1F5F9]/50 border border-[#E2E8F0] p-10 rounded-[2rem] hover:border-green-600 transition-all group">
                   <div className="flex justify-between items-start mb-8">
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl flex items-center justify-center text-lg font-black text-green-600 shadow-sm">{note.rep_name.charAt(0)}</div>
                        <div>
                          <p className="text-base font-bold text-[#1A2A3A] uppercase tracking-tight">{note.rep_name}</p>
                          <p className="text-[10px] text-[#64748B] font-black uppercase tracking-widest mt-1">{new Date(note.created_at).toLocaleDateString()} @ {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full border ${
                        note.priority === 'High' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-yellow-400/20 text-[#1A2A3A] border-[#E2E8F0]'
                      }`}>
                        {note.priority} Priority
                      </span>
                   </div>
                   <div className="bg-[#F8FAFC] rounded-2xl p-8 border border-[#E2E8F0] italic text-sm text-[#1A2A3A] leading-relaxed group-hover:bg-white transition-all">
                      "{note.content}"
                   </div>
                </div>
              ))}
              {sentNotes.length === 0 && (
                <div className="py-48 text-center">
                  <p className="text-[10px] font-black text-[#64748B] uppercase tracking-[0.3em]">Coaching Log Empty</p>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  )
}
