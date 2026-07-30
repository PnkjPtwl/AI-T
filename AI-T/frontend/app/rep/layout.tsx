'use client'

import RepSidebar from '@/components/rep/Sidebar'
import RepTopbar from '@/components/rep/Topbar'

export default function RepLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A2A3A] font-sans flex">
      <RepSidebar />
      <div className="flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300">
        <RepTopbar />
        <main className="px-12 py-6 flex-1 flex flex-col">
          {children}
        </main>
      </div>
    </div>
  )
}
