'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function RepSignupPage() {
  const router = useRouter()
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [orgName, setOrgName]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const res = await fetch(`${API}/api/auth/signup/rep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, orgName }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Signup failed')
        return
      }

      setSuccess('Account created! Redirecting to login…')
      setTimeout(() => router.push('/login'), 1500)
    } catch {
      setError('Cannot connect to server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC] p-8">
      <div className="w-full max-w-4xl bg-white border border-[#E2E8F0] rounded-[3rem] shadow-2xl overflow-hidden">
        
        {/* Branding Header */}
        <div className="p-12 pb-6 text-center border-b border-[#E2E8F0]/30">
          <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-[#2C5282] mb-6">r-salesCoach</h2>
          <h1 className="text-4xl font-extrabold text-[#1A2A3A] tracking-tight mb-3">Join your team</h1>
          <p className="text-[#64748B] text-base font-medium max-w-lg mx-auto">
            Sign up as a <strong className="text-[#2C5282]">Sales Rep</strong> and connect with your organization.
          </p>
        </div>

        <div className="p-16 pt-12">
          {error && (
            <div className="mb-10 p-5 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[12px] font-black uppercase tracking-widest text-center">
               {error}
            </div>
          )}
          
          {success && (
            <div className="mb-10 p-5 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-600 text-[12px] font-black uppercase tracking-widest text-center animate-pulse">
               {success}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Full Name */}
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase text-[#64748B] tracking-[0.3em] ml-1">Full Name</label>
                <input 
                  type="text" 
                  placeholder="Alex Johnson" 
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-3.5 px-6 text-base font-bold text-[#1A2A3A] focus:border-[#2C5282] outline-none transition-all placeholder:text-[#64748B]/30"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* Organization Name */}
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase text-[#64748B] tracking-[0.3em] ml-1">Organization Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Acme Corp" 
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-3.5 px-6 text-base font-bold text-[#1A2A3A] focus:border-[#2C5282] outline-none transition-all placeholder:text-[#64748B]/30"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  required
                />
              </div>

              {/* Work Email */}
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase text-[#64748B] tracking-[0.3em] ml-1">Work Email</label>
                <input 
                  type="email" 
                  placeholder="alex@company.com" 
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-3.5 px-6 text-base font-bold text-[#1A2A3A] focus:border-[#2C5282] outline-none transition-all placeholder:text-[#64748B]/30"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-3">
                <label className="text-[11px] font-black uppercase text-[#64748B] tracking-[0.3em] ml-1">Password</label>
                <input 
                  type="password" 
                  placeholder="Min. 6 characters" 
                  className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl py-3.5 px-6 text-base font-bold text-[#1A2A3A] focus:border-[#2C5282] outline-none transition-all placeholder:text-[#64748B]/30"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-8 pt-4">
              <button 
                type="submit" 
                disabled={loading} 
                className="px-16 py-5 bg-[#2C5282] hover:bg-[#1A365D] text-white font-black text-[12px] uppercase tracking-[0.25em] rounded-2xl shadow-xl shadow-[#2C5282]/20 transition-all active:scale-[0.98]"
              >
                {loading ? 'Joining Team...' : 'Join Team'}
              </button>

              <div className="flex flex-col md:flex-row items-center gap-4 text-[12px] font-black uppercase tracking-widest text-[#64748B]">
                <span>Already have an account? <Link href="/login" className="text-[#2C5282] hover:underline ml-1">Sign In</Link></span>
                <span className="hidden md:inline opacity-30">•</span>
                <span>Creating an org? <Link href="/signup" className="text-[#2C5282] hover:underline ml-1">Manager Signup</Link></span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
