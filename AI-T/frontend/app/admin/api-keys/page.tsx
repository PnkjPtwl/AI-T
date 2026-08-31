'use client'

import { useState, useEffect, useCallback } from 'react'
import { KeyRound, RefreshCw, Trash2, Save, Eye, EyeOff, CheckCircle, AlertTriangle, Info } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const KEY_META: Record<string, { label: string; description: string; docsUrl: string; color: string; gradient: string; icon: string }> = {
  CEREBRAS_API_KEY: {
    label: 'Cerebras',
    description: 'Used for ultra-fast LLM inference — live coaching feedback, scenario generation, sentiment analysis.',
    docsUrl: 'https://cloud.cerebras.ai',
    color: '#6366f1',
    gradient: 'from-indigo-500/10 to-violet-500/10',
    icon: '⚡',
  },
  ELEVENLABS_API_KEY: {
    label: 'ElevenLabs',
    description: 'Used for AI voice synthesis (TTS) — persona voices during role-play sessions.',
    docsUrl: 'https://elevenlabs.io',
    color: '#0ea5e9',
    gradient: 'from-sky-500/10 to-cyan-500/10',
    icon: '🎙️',
  },
}

interface ApiKeyEntry {
  key_name: string
  source: 'supabase' | 'env' | 'none'
  masked_value: string | null
  updated_at: string | null
}

function SourceBadge({ source }: { source: 'supabase' | 'env' | 'none' }) {
  if (source === 'supabase') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Supabase (active)
      </span>
    )
  }
  if (source === 'env') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        .env fallback
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      Not configured
    </span>
  )
}

function ApiKeyCard({
  entry,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  entry: ApiKeyEntry
  onSave: (keyName: string, value: string) => Promise<void>
  onDelete: (keyName: string) => Promise<void>
  saving: boolean
  deleting: boolean
}) {
  const [inputValue, setInputValue] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [showValue, setShowValue] = useState(false)
  const meta = KEY_META[entry.key_name]

  const handleSave = async () => {
    if (!inputValue.trim()) return
    await onSave(entry.key_name, inputValue)
    setInputValue('')
    setShowInput(false)
  }

  const updatedAt = entry.updated_at
    ? new Date(entry.updated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <div className={`relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200`}>
      {/* Top gradient strip */}
      <div className={`h-1 w-full bg-gradient-to-r ${meta.gradient.replace('/10', '')}`} style={{ background: `linear-gradient(to right, ${meta.color}44, ${meta.color}88)` }} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shadow-sm border"
              style={{ background: `${meta.color}15`, borderColor: `${meta.color}30` }}
            >
              {meta.icon}
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#1E293B] font-['Plus_Jakarta_Sans']">{meta.label}</h3>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">{entry.key_name}</p>
            </div>
          </div>
          <SourceBadge source={entry.source} />
        </div>

        {/* Description */}
        <p className="text-[13px] text-slate-500 mb-4 leading-relaxed">{meta.description}</p>

        {/* Current masked value */}
        {entry.masked_value && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <KeyRound className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-[13px] font-mono text-slate-600 flex-1 truncate">
              {showValue ? entry.masked_value : entry.masked_value}
            </span>
            {updatedAt && (
              <span className="text-[11px] text-slate-400 whitespace-nowrap">Updated {updatedAt}</span>
            )}
          </div>
        )}

        {/* Input area */}
        {showInput ? (
          <div className="space-y-2">
            <div className="relative">
              <input
                type={showValue ? 'text' : 'password'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                placeholder={`Paste your ${meta.label} API key...`}
                className="w-full px-3 py-2.5 pr-10 text-[13px] font-mono bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:border-transparent text-slate-800 placeholder:text-slate-300 transition-all"
                style={{ '--tw-ring-color': meta.color } as any}
                autoFocus
              />
              <button
                onClick={() => setShowValue(!showValue)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSave}
                disabled={!inputValue.trim() || saving}
                className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: saving ? '#94a3b8' : meta.color }}
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? 'Saving...' : 'Save Key'}
              </button>
              <button
                onClick={() => { setShowInput(false); setInputValue('') }}
                className="px-4 py-2 text-[12px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setShowInput(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold rounded-lg border transition-all hover:opacity-90"
              style={{
                background: `${meta.color}10`,
                borderColor: `${meta.color}30`,
                color: meta.color,
              }}
            >
              <KeyRound className="w-3.5 h-3.5" />
              {entry.source === 'supabase' ? 'Update Key' : 'Set Key'}
            </button>

            {entry.source === 'supabase' && (
              <button
                onClick={() => onDelete(entry.key_name)}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-all disabled:opacity-50"
              >
                {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleting ? 'Removing...' : 'Remove'}
              </button>
            )}

            <a
              href={meta.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-[11px] text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
            >
              Get API key →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchKeys = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/admin/api-keys`, { headers })
      if (res.ok) {
        const data = await res.json()
        setKeys(data)
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { fetchKeys() }, [fetchKeys])

  const handleSave = async (keyName: string, keyValue: string) => {
    setSaving(keyName)
    try {
      const res = await fetch(`${API}/api/admin/api-keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key_name: keyName, key_value: keyValue }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || 'Key saved successfully', 'success')
        fetchKeys()
      } else {
        showToast(data.error || 'Failed to save key', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setSaving(null)
    }
  }

  const handleDelete = async (keyName: string) => {
    if (!confirm(`Remove ${keyName} from Supabase? The app will fall back to the .env value.`)) return
    setDeleting(keyName)
    try {
      const res = await fetch(`${API}/api/admin/api-keys/${keyName}`, {
        method: 'DELETE',
        headers,
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || 'Key removed', 'success')
        fetchKeys()
      } else {
        showToast(data.error || 'Failed to remove key', 'error')
      }
    } catch {
      showToast('Network error', 'error')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-8 pb-12 font-['Inter'] max-w-[860px] mx-auto text-[#0b1c30]">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-[13px] font-semibold transition-all animate-in slide-in-from-right ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-[#ba1a1a] text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B] tracking-tight flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-indigo-500" />
            API Key Management
          </h1>
          <p className="text-[14px] text-slate-500 mt-1">
            Manage ElevenLabs and Cerebras keys from here — no redeploy needed.
          </p>
        </div>
        <button
          onClick={fetchKeys}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 px-5 py-4 bg-indigo-50 border border-indigo-200 rounded-xl text-[13px] text-indigo-800">
        <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-500" />
        <div>
          <strong>How it works:</strong> Keys stored here take priority over your <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-[12px] font-mono">.env</code> file.
          They are cached in memory for <strong>5 minutes</strong> — so changes take effect almost immediately, no restart needed.
          If a key is removed from Supabase, the backend falls back to <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-[12px] font-mono">.env</code> automatically.
        </div>
      </div>

      {/* Key Cards */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-[#1E1B4B] rounded-full animate-spin" />
            <p className="text-sm font-semibold text-[#64748B] uppercase tracking-widest">Loading...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {keys.map((entry) => (
            <ApiKeyCard
              key={entry.key_name}
              entry={entry}
              onSave={handleSave}
              onDelete={handleDelete}
              saving={saving === entry.key_name}
              deleting={deleting === entry.key_name}
            />
          ))}
        </div>
      )}

      {/* Priority legend */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="text-[13px] font-bold text-slate-700 mb-3 font-['Plus_Jakarta_Sans']">Key Priority Order</h3>
        <div className="flex items-center gap-0 text-[12px]">
          {[
            { label: '1. Supabase (highest)', color: 'bg-emerald-500', textColor: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            { label: '→', color: '', textColor: 'text-slate-400 mx-2' },
            { label: '2. .env / deployment', color: 'bg-amber-500', textColor: 'text-amber-700 bg-amber-50 border-amber-200' },
            { label: '→', color: '', textColor: 'text-slate-400 mx-2' },
            { label: '3. Not set (error)', color: 'bg-red-500', textColor: 'text-red-600 bg-red-50 border-red-200' },
          ].map((item, i) => (
            item.label === '→' ? (
              <span key={i} className={item.textColor}>{item.label}</span>
            ) : (
              <span key={i} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-semibold ${item.textColor}`}>
                {item.color && <span className={`w-1.5 h-1.5 rounded-full ${item.color}`} />}
                {item.label}
              </span>
            )
          ))}
        </div>
        <p className="text-[12px] text-slate-400 mt-3">
          Cache TTL: 5 minutes. After updating a key, it takes effect within seconds (cache is invalidated immediately on save).
        </p>
      </div>
    </div>
  )
}
