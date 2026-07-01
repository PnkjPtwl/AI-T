'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV_ITEMS = [
  { name: 'Assignments', href: '/rep/train' },
  { name: 'Reports', href: '/rep/reports' },
  { name: 'My Stats', href: '/rep/my-stats' },
]

export default function RepSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside 
      className={`sticky top-0 h-screen bg-[#FFFFFF] border-r border-[#E2E8F0] transition-all duration-300 z-50 flex flex-col flex-shrink-0 ${collapsed ? 'w-[100px]' : 'w-[320px]'}`}
    >
      {/* Brand */}
      <div className={`p-10 mb-8 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#2C5282] rounded-xl flex items-center justify-center text-[#FFFFFF] text-base font-black shadow-sm">AI</div>
            <span className="text-xl font-extrabold text-[#1A2A3A] tracking-tight">AI Trainer</span>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className={`w-10 h-10 flex items-center justify-center text-[#64748B] hover:text-[#1A2A3A] hover:bg-[#F1F5F9] rounded-xl transition-all ${collapsed ? 'absolute' : ''}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {collapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-6 space-y-3">
        {!collapsed ? NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-6 py-4 rounded-2xl transition-all text-sm font-bold uppercase tracking-widest ${
                isActive 
                  ? 'bg-[#EBF8FF] text-[#2C5282] shadow-sm' 
                  : 'text-[#64748B] hover:text-[#1A2A3A] hover:bg-[#F1F5F9]'
              }`}
            >
              {item.name}
            </Link>
          )
        }) : (
          <div className="flex flex-col items-center gap-6 mt-16">
             {NAV_ITEMS.map((item, idx) => {
               const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
               return (
                 <Link key={item.href} href={item.href} className="group relative">
                   <div className={`w-3 h-3 rounded-full transition-all ${isActive ? 'bg-[#2C5282] scale-125' : 'bg-[#CBD5E1] group-hover:bg-[#64748B]'}`}></div>
                 </Link>
               )
             })}
          </div>
        )}
      </nav>

      {/* Profile Mini */}
      <div className="p-8 border-t border-[#E2E8F0]">
        {!collapsed ? (
          <div className="flex items-center gap-4 p-4 rounded-3xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="w-12 h-12 bg-[#EDF2F7] rounded-xl flex items-center justify-center text-sm font-black text-[#1A2A3A] shadow-sm">R</div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-[#1A2A3A] truncate">Rep Portal</p>
              <p className="text-[11px] text-[#64748B] font-bold tracking-widest uppercase mt-1">Field Team</p>
            </div>
          </div>
        ) : (
          <div className="w-12 h-12 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl flex items-center justify-center text-sm font-black text-[#1A2A3A] mx-auto">R</div>
        )}
      </div>
    </aside>
  )
}
