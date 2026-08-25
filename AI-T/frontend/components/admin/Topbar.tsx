'use client'

import { useRouter } from 'next/navigation'

export default function AdminTopbar() {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('orgId')
    router.push('/login')
  }

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <div className="flex items-center justify-between h-14 px-8">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-[800] text-[#1E293B] tracking-tight">
            System Administration
          </h1>
          <span className="px-2 py-0.5 bg-indigo-100 text-[#1E1B4B] text-[10px] font-[800] uppercase tracking-wider rounded-full">
            Admin
          </span>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-1.5 text-xs font-[700] text-[#64748B] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </header>
  )
}
