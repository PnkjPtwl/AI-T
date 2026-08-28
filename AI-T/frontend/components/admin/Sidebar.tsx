'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Users } from 'lucide-react'

const NAV_ITEMS = [
  { name: 'User Management', href: '/admin/dashboard', icon: Users },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(true)

  return (
    <aside 
      onMouseEnter={() => setCollapsed(false)}
      onMouseLeave={() => setCollapsed(true)}
      className={`sticky top-0 h-screen bg-white border-r border-gray-100 transition-all duration-300 z-30 flex flex-col flex-shrink-0 overflow-hidden ${collapsed ? 'w-[72px]' : 'w-[230px]'}`}
    >
      {/* Brand */}
      <div className={`flex items-center px-5 py-5 border-b border-gray-100 h-[72px] transition-all duration-300 ${collapsed ? 'justify-center' : 'justify-start gap-3'}`}>
        <div className="flex items-center gap-0">
          <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain border-none outline-none flex-shrink-0" />
          <div className={`flex flex-col gap-0.5 ml-0 overflow-hidden transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-[130px] opacity-100'}`}>
            <div className="flex items-center gap-0 whitespace-nowrap">
              <img src="/dash.png" alt="-" className="w-3 h-3 object-contain border-none outline-none -ml-0.5 mr-0.5" />
              <span className="text-xl font-semibold text-gray-900 tracking-tight">SalesCoach</span>
            </div>

          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">

        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-4 px-4 py-3 transition-all font-['Plus_Jakarta_Sans'] text-[15px] font-medium ${isActive
                  ? 'bg-[#EEF2FF] text-[#4338CA] border-r-[4px] border-[#4338CA] rounded-xl'
                  : 'text-[#475569] hover:bg-gray-50 hover:text-gray-900 border-r-[4px] border-transparent rounded-xl'
                }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
              <span className={`whitespace-nowrap transition-all duration-300 ${collapsed ? 'w-0 opacity-0 overflow-hidden' : 'opacity-100'}`}>
                {item.name}
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
