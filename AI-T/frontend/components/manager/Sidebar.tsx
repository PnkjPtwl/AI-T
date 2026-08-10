'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Training Management', href: '/training', icon: '📋' },
  { name: 'Persona Library', href: '/scenarios', icon: '👤' },
  { name: 'Team Analytics', href: '/team-analytics', icon: '📈' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetch(`${API}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(user => setUserName(user.name))
      .catch(() => {})
    }
  }, [])

  return (
    <aside
      className={`sticky top-0 h-screen bg-white border-r border-gray-100 transition-all duration-300 z-30 flex flex-col flex-shrink-0 ${collapsed ? 'w-[64px]' : 'w-[230px]'}`}
    >
      {/* Brand */}
      <div className={`flex items-center gap-3 px-5 py-5 border-b border-gray-100 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#1E1B4B] text-white flex items-center justify-center font-[800] text-sm shadow-sm">
              R
            </div>
            <div>
              <span className="text-base font-[800] text-[#1E293B] tracking-tight">R-SalesCoach</span>
              <span className="block text-[9px] font-[700] text-purple-600 uppercase tracking-widest leading-none mt-0.5">{userName ? `${userName} (Manager)` : 'Manager View'}</span>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {collapsed
              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            }
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className={`px-3 text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-2 ${collapsed ? 'hidden' : 'block'}`}>
          MANAGEMENT
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-[700] ${isActive
                  ? 'bg-[#1E1B4B] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#1E293B] hover:bg-gray-50'
                }`}
            >
              <span className="text-base">{item.icon}</span>
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>


    </aside>
  )
}
