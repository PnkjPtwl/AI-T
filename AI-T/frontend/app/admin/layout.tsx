'use client'

import AdminSidebar from '@/components/admin/Sidebar'
import AdminTopbar from '@/components/admin/Topbar'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1A2A3A] font-sans flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-h-screen min-w-0 transition-all duration-300">
        <AdminTopbar />
        <main className="px-12 py-6 flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
