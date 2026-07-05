'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV_ITEMS = [
  { name: 'Assignments', href: '/rep/train' },
  { name: 'My Stats', href: '/rep/my-stats' },
]

export default function RepSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`sticky top-0 h-screen bg-white border-r border-gray-100 transition-all duration-300 z-50 flex flex-col flex-shrink-0 ${collapsed ? 'w-[64px]' : 'w-[220px]'}`}
    >
      {/* Brand */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-100 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#2C5282] rounded-lg flex items-center justify-center text-white text-[14px] font-black">R</div>
            <span className="text-sm font-bold text-gray-900 tracking-tight">SalesCoach</span>
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
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.name : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium ${isActive
                  ? 'bg-[#EBF8FF] text-[#2C5282]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
            >
              {collapsed ? (
                <span className="text-xs font-bold">{item.name.charAt(0)}</span>
              ) : (
                <span>{item.name}</span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
