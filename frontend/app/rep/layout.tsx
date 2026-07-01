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
        <main className="p-10 flex-1 flex flex-col">
          {children}
        </main>
        
        <footer className="p-10 border-t border-[#E2E8F0] bg-[#FFFFFF]">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="space-y-1 text-center md:text-left">
              <p className="text-base font-bold text-[#1A2A3A] tracking-tight italic uppercase">SalesCoach Intelligence</p>
              <p className="text-xs text-[#64748B] font-bold uppercase tracking-widest">Enterprise Performance Management Engine</p>
            </div>
            <div className="flex gap-8 text-xs font-bold uppercase tracking-widest text-[#64748B]">
              <span className="hover:text-[#2C5282] cursor-pointer transition-colors">Performance Handbook</span>
              <span className="hover:text-[#2C5282] cursor-pointer transition-colors">Growth Roadmap</span>
              <span className="hover:text-[#2C5282] cursor-pointer transition-colors">Technical Support</span>
            </div>
            <div className="text-xs font-bold text-[#64748B] uppercase tracking-widest">
              &copy; 2026 SalesCoach AI. v2.0.4-PRO
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
