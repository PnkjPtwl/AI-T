'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { name: 'User Management', href: '/admin/dashboard', icon: '👥' },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-0 h-screen bg-white border-r border-gray-100 transition-all duration-300 z-30 flex flex-col flex-shrink-0 w-[230px]">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-0">
            <img src="/logo.png" alt="Logo" className="w-7 h-7 object-contain border-none outline-none" />
            <img src="/dash.png" alt="-" className="w-3 h-3 object-contain border-none outline-none -ml-0.5 mr-0.5" />
            <span className="text-xl font-semibold text-gray-900 tracking-tight">SalesCoach</span>
          </div>
          <span className="block text-[9px] font-[700] text-purple-600 uppercase tracking-widest leading-none ml-[34px]">System Admin</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <p className="px-3 text-[10px] font-[800] text-[#64748B] uppercase tracking-wider mb-2">
          ADMINISTRATION
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-xs font-[700] ${isActive
                  ? 'bg-[#1E1B4B] text-white shadow-sm'
                  : 'text-[#64748B] hover:text-[#1E293B] hover:bg-gray-50'
                }`}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
