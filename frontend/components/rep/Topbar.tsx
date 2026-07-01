'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function RepTopbar() {
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
      .catch(() => {})
    }

    if (orgId && token) {
      fetch(`${API}/api/users/org-details`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(org => setOrgName(org.name))
      .catch(() => {})
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center justify-between px-8 sticky top-0 z-40">
      <div className="flex items-center gap-2 text-sm text-[#64748B]">
        <span>{orgName || 'Organization'}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group">
          <button className="flex items-center gap-3 px-3 py-2 hover:bg-[#F8FAFC] rounded-xl transition-all">
            <div className="w-8 h-8 bg-[#2C5282] rounded-full flex items-center justify-center text-xs font-bold text-white">
              {userName ? userName.charAt(0).toUpperCase() : 'R'}
            </div>
            <span className="text-sm font-medium text-[#1A2A3A] hidden md:block">{userName || 'Sales Rep'}</span>
            <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
          </button>

          <div className="absolute right-0 w-44 pt-2 opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-150 z-50">
            <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-lg overflow-hidden">
              <button 
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
