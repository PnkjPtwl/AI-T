'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function Topbar() {
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [orgName, setOrgName] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    const orgId = localStorage.getItem('orgId')
    
    if (token) {
      fetch(`${API}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(user => setUserName(user.name))
    }

    if (orgId && token) {
      fetch(`${API}/api/users/org-details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(org => setOrgName(org.name))
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <header className="h-20 bg-[#F6F1E8]/80 backdrop-blur-md border-b border-[#D8CCBC] flex items-center justify-between px-12 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <h2 className="text-[10px] font-black text-[#7B6F63] uppercase tracking-[0.2em] hidden sm:block">Organization /</h2>
        <h2 className="text-xs font-extrabold text-[#7D8461] uppercase tracking-wider">{orgName || 'Intelligence Unit'}</h2>
      </div>

      <div className="flex items-center gap-8">


        {/* Profile */}
        <div className="relative group">
          <button className="flex items-center gap-4 pl-4 pr-5 py-2.5 hover:bg-[#EAE2D6] rounded-2xl transition-all border border-transparent hover:border-[#D8CCBC]">
            <div className="w-9 h-9 bg-[#7D8461] rounded-xl flex items-center justify-center text-xs font-black text-[#F6F1E8] shadow-sm">
              {userName ? userName.charAt(0).toUpperCase() : 'M'}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-black text-[#3A2F28] leading-tight uppercase tracking-tight">{userName || 'Manager'}</p>
              <p className="text-[9px] text-[#7B6F63] font-bold uppercase tracking-[0.2em] mt-0.5">Administrator</p>
            </div>
          </button>

          {/* Dropdown with invisible hover bridge */}
          <div className="absolute right-0 w-52 pt-3 opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-200 z-50">
            <div className="bg-[#EFE7DC] border border-[#D8CCBC] rounded-[2.5rem] shadow-2xl overflow-hidden p-2">
              <button 
                onClick={handleLogout}
                className="w-full text-left px-6 py-4 text-[10px] font-black text-[#A06A5B] uppercase tracking-widest hover:bg-[#A06A5B]/10 rounded-2xl transition-all flex items-center justify-center gap-3"
              >
                <span>🚪</span> End Session
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
