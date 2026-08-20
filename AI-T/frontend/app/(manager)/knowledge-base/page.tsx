'use client'

import { useState, useEffect, useCallback } from 'react'
import CreateKnowledgeBaseModal from '@/components/manager/CreateKnowledgeBaseModal'
import UploadDocumentsModal from '@/components/manager/UploadDocumentsModal'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface KnowledgeBase {
  id: string
  name: string
  slug: string
  description?: string
  status: 'active' | 'processing' | 'error'
  document_count: number
  chunk_count: number
  created_at: string
  updated_at: string
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string; dot: string }> = {
    active:     { label: 'Active',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',    dot: 'bg-emerald-500' },
    processing: { label: 'Processing', cls: 'bg-amber-50 text-amber-700 border-amber-200',          dot: 'bg-amber-500 animate-pulse' },
    error:      { label: 'Error',      cls: 'bg-red-50 text-red-700 border-red-200',               dot: 'bg-red-500' },
  }
  const s = cfg[status] || cfg.active
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-[700] border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function KnowledgeBasePage() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<KnowledgeBase | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<KnowledgeBase | null>(null)

  const fetchKbs = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return
    try {
      const res = await fetch(`${API}/api/knowledge-base`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setKbs(data.knowledge_bases || [])
      }
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchKbs() }, [fetchKbs])

  const handleDelete = async (kb: KnowledgeBase) => {
    setDeleting(kb.slug)
    setConfirmDelete(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/knowledge-base/${kb.slug}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        setKbs(prev => prev.filter(k => k.id !== kb.id))
      }
    } catch {}
    finally { setDeleting(null) }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-[900] text-[#1E293B] tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-[#64748B] font-[500] mt-1">
            Create and manage document repositories that ground your AI personas with real account knowledge.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#1E1B4B] text-white text-xs font-[700] rounded-xl hover:bg-[#2d2a6a] transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Create Knowledge Base
        </button>
      </div>

      {/* Knowledge Bases */}
      <div className="mb-4">
        <p className="text-[10px] font-[800] text-[#94A3B8] uppercase tracking-widest mb-3">
          Knowledge Bases <span className="ml-2 text-[#CBD5E1]">({kbs.length + 1})</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:border-[#1E1B4B]/10 transition-all duration-200">
            {/* KB Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] flex items-center justify-center text-lg flex-shrink-0">
                  🚗
                </div>
                <div className="min-w-0">
                  <h3 className="font-[800] text-[#1E293B] text-sm truncate" title="Phoenix Automotive">Phoenix Automotive</h3>
                  <p className="text-[10px] text-[#94A3B8] font-[600] font-mono">phoenix_automotive</p>
                </div>
              </div>
              <StatusBadge status="active" />
            </div>

            {/* Description */}
            <p className="text-xs text-[#64748B] font-[500] mb-3 line-clamp-2">Static knowledge base</p>

            {/* Stats */}
            <div className="flex gap-4 mb-4 py-3 border-y border-gray-50">
              <div className="text-center">
                <div className="text-lg font-[900] text-[#1E293B]">10+</div>
                <div className="text-[10px] text-[#94A3B8] font-[700] uppercase tracking-wide">Docs</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-[900] text-[#1E293B]">124</div>
                <div className="text-[10px] text-[#94A3B8] font-[700] uppercase tracking-wide">Chunks</div>
              </div>
              <div className="text-center ml-auto">
                <div className="text-xs font-[700] text-[#64748B]">System</div>
                <div className="text-[10px] text-[#94A3B8] font-[600] uppercase tracking-wide">Created</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F1F5F9] text-[#94A3B8] text-[11px] font-[700] rounded-lg cursor-not-allowed"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                System Defined
              </button>
            </div>
          </div>

          {/* Custom KBs */}
          {loading ? (
            [1,2].map(i => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ))
          ) : (
            kbs.map(kb => (
              <div
                key={kb.id}
                className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:border-[#1E1B4B]/10 transition-all duration-200"
              >
                {/* KB Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] flex items-center justify-center text-lg flex-shrink-0">
                      📄
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-[800] text-[#1E293B] text-sm truncate" title={kb.name}>{kb.name}</h3>
                      <p className="text-[10px] text-[#94A3B8] font-[600] font-mono">{kb.slug}</p>
                    </div>
                  </div>
                  <StatusBadge status={kb.status} />
                </div>

                {/* Description */}
                {kb.description && (
                  <p className="text-xs text-[#64748B] font-[500] mb-3 line-clamp-2">{kb.description}</p>
                )}

                {/* Stats */}
                <div className="flex gap-4 mb-4 py-3 border-y border-gray-50">
                  <div className="text-center">
                    <div className="text-lg font-[900] text-[#1E293B]">{kb.document_count}</div>
                    <div className="text-[10px] text-[#94A3B8] font-[700] uppercase tracking-wide">Docs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-[900] text-[#1E293B]">{kb.chunk_count}</div>
                    <div className="text-[10px] text-[#94A3B8] font-[700] uppercase tracking-wide">Chunks</div>
                  </div>
                  <div className="text-center ml-auto">
                    <div className="text-xs font-[700] text-[#64748B]">{formatDate(kb.created_at)}</div>
                    <div className="text-[10px] text-[#94A3B8] font-[600] uppercase tracking-wide">Created</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUploadTarget(kb)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F1F5F9] text-[#1E293B] text-[11px] font-[700] rounded-lg hover:bg-[#E2E8F0] transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload More
                  </button>
                  <button
                    onClick={() => setConfirmDelete(kb)}
                    disabled={deleting === kb.slug}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-50"
                    title="Delete knowledge base"
                  >
                    {deleting === kb.slug ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateKnowledgeBaseModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={() => { fetchKbs() }}
      />

      {uploadTarget && (
        <UploadDocumentsModal
          open={true}
          kb={uploadTarget}
          onClose={() => setUploadTarget(null)}
          onUploaded={() => { fetchKbs(); setUploadTarget(null) }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-center font-[800] text-[#1E293B] text-base mb-1">Delete Knowledge Base?</h3>
            <p className="text-center text-sm text-[#64748B] font-[500] mb-5">
              This will permanently delete <strong>"{confirmDelete.name}"</strong> and all {confirmDelete.chunk_count} embedded chunks. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-[700] text-[#64748B] hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 bg-red-500 rounded-xl text-sm font-[700] text-white hover:bg-red-600 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
