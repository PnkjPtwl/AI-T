'use client'

import Sidebar from '@/components/manager/Sidebar'
import Topbar from '@/components/manager/Topbar'

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A2A3A] font-sans flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300">
        <Topbar />
        <main className="px-12 py-6 flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
