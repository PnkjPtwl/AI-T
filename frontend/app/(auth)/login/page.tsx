'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'manager' | 'rep'>('manager')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return

    console.log(`--- [AUTH] Initiating login attempt for: ${email} ---`)
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      })

      const data = await res.json()

      if (res.ok) {
        localStorage.setItem('token', data.token)
        localStorage.setItem('role', data.role)
        localStorage.setItem('orgId', data.orgId)
        
        console.log(`--- [AUTH] Login successful. Redirecting as ${data.role}... ---`)
        if (data.role === 'manager') {
          router.push('/dashboard')
        } else {
          router.push('/rep/train')
        }
      } else {
        console.error(`--- [AUTH] Login failed: ${data.error} ---`)
        setError(data.error || 'Invalid credentials')
      }
    } catch (err) {
      console.error('--- [AUTH] Network/Connection error ---', err)
      setError('Connection failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="auth-page flex items-center justify-center min-h-screen bg-[#F8FAFC]">
      <div className="auth-card w-full max-w-4xl bg-white border border-[#E2E8F0] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Branding */}
        <div className="flex-1 bg-white p-12 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2" />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 bg-[#2C5282] rounded-2xl flex items-center justify-center text-white text-[28px] font-black">R</div>
            <h1 className="text-5xl font-extrabold text-[#1A2A3A] tracking-tighter leading-none">salesCoach</h1>
          </div>
          <div className="w-12 h-1 bg-[#2C5282] rounded-full mb-8" />
        </div>

        {/* Right Side: Authentication */}
        <div className="md:w-1/2 p-16 flex flex-col justify-center bg-white backdrop-blur-sm">
          {error && (
            <div className="alert p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[12px] font-black uppercase tracking-widest mb-10 text-center">
               {error}
            </div>
          )}

          <div className="role-tabs flex gap-2 mb-10 bg-white p-1.5 rounded-2xl border border-[#E2E8F0]">
             <button 
               onClick={() => setRole('manager')}
               className={`flex-1 py-3 text-[11px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${role === 'manager' ? 'bg-[#2C5282] text-white shadow-md' : 'text-[#64748B] hover:text-[#1A2A3A]'}`}
             >
               Manager
             </button>
             <button 
               onClick={() => setRole('rep')}
               className={`flex-1 py-3 text-[11px] font-black uppercase tracking-[0.2em] rounded-xl transition-all ${role === 'rep' ? 'bg-[#2C5282] text-white shadow-md' : 'text-[#64748B] hover:text-[#1A2A3A]'}`}
             >
               Representative
             </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase text-[#64748B] tracking-[0.3em] ml-1">Email Identity</label>
              <input 
                type="email" 
                placeholder="name@organization.com" 
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-3.5 px-6 text-base font-bold text-[#1A2A3A] focus:border-[#2C5282] outline-none transition-all placeholder:text-[#64748B]/30"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-3">
              <label className="text-[11px] font-black uppercase text-[#64748B] tracking-[0.3em] ml-1">Secret Access</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-3.5 px-6 text-base font-bold text-[#1A2A3A] focus:border-[#2C5282] outline-none transition-all placeholder:text-[#64748B]/30"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" disabled={loading} className="w-full py-5 bg-[#2C5282] hover:bg-[#1A365D] text-white font-black text-[12px] uppercase tracking-[0.25em] rounded-2xl shadow-xl shadow-[#2C5282]/20 transition-all active:scale-[0.98] mt-4">
              {loading ? 'Verifying...' : 'Authorize Access'}
            </button>
          </form>

          <div className="mt-12 text-center text-[12px] font-black uppercase tracking-widest text-[#64748B]">
            New Client? <Link href="/signup" className="text-[#2C5282] hover:underline ml-2">Initialize Account</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
