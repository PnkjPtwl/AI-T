'use client'

import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function CoachingNotesPage() {
  const [notes, setNotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API}/api/users/my-notes`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) setNotes(await res.json())
      } catch (err) {
        console.error('Failed to fetch coaching notes', err)
      } finally {
        setLoading(false)
      }
    }
    fetchNotes()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#7D8461]"></div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-24 text-left">
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold text-[#3A2F28] tracking-tight">Coaching Archive</h1>
        <p className="text-[#7B6F63] font-medium text-base">Historical feedback and tactical performance directives.</p>
      </div>

      <div className="space-y-10">
        {notes.length === 0 ? (
          <div className="bg-[#EAE2D6]/40 border border-dashed border-[#D8CCBC] rounded-[2.5rem] p-24 text-center">
             <p className="text-[#7B6F63] font-black uppercase tracking-[0.2em] text-[10px]">No historical coaching notes found.</p>
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] p-10 hover:shadow-lg transition-all relative overflow-hidden group shadow-sm">
               <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest ${
                 note.priority === 'High' ? 'bg-[#A06A5B] text-[#F6F1E8]' : 'bg-[#7D8461] text-[#F6F1E8]'
               }`}>
                  {note.priority} Priority
               </div>

               <div className="flex flex-col lg:flex-row gap-12">
                  <div className="flex-1 space-y-8">
                     <p className="text-xl font-medium text-[#3A2F28] italic leading-relaxed tracking-tight">
                        “{note.note_text}”
                     </p>
                     <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-[#7D8461] rounded-xl flex items-center justify-center text-xs font-black text-[#F6F1E8] shadow-md">
                           {note.manager_name.charAt(0)}
                        </div>
                        <div>
                           <p className="text-[10px] font-black text-[#3A2F28] uppercase tracking-tight">{note.manager_name}</p>
                           <p className="text-[9px] text-[#7B6F63] font-black uppercase tracking-widest mt-1">{note.manager_role}</p>
                        </div>
                     </div>
                  </div>
                  <div className="lg:w-56 pt-8 lg:pt-0 border-t lg:border-t-0 lg:border-l border-[#D8CCBC]/50 lg:pl-12 space-y-8">
                     <div className="space-y-1">
                        <p className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest">Received</p>
                        <p className="text-sm font-bold text-[#3A2F28] uppercase tracking-tight">{new Date(note.created_at).toLocaleDateString()}</p>
                     </div>
                     <div className="space-y-1">
                        <p className="text-[9px] font-black text-[#7B6F63] uppercase tracking-widest">Status</p>
                        <div className="flex items-center gap-2">
                           <div className="w-2 h-2 bg-[#7D8461] rounded-full"></div>
                           <p className="text-[9px] font-black text-[#7D8461] uppercase tracking-widest">Acknowledged</p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
