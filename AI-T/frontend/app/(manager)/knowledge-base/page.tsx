'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, FileText, Database, Folder, Upload, Trash2, AlertTriangle, Loader2, ChevronDown } from 'lucide-react'
import CreateKnowledgeBaseModal from '@/components/manager/CreateKnowledgeBaseModal'
import UploadDocumentsModal from '@/components/manager/UploadDocumentsModal'
import HubSpotCRMPanel from '@/components/manager/HubSpotCRMPanel'

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
    active:     { label: 'Active',     cls: 'text-emerald-600 border-emerald-100',    dot: 'bg-emerald-500' },
    processing: { label: 'Processing', cls: 'text-amber-600 border-amber-100',          dot: 'bg-amber-500 animate-pulse' },
    error:      { label: 'Error',      cls: 'text-red-600 border-red-100',               dot: 'bg-red-500' },
  }
  const s = cfg[status] || cfg.active
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.cls}`}>
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
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false)
  const [isCrmPanelOpen, setIsCrmPanelOpen] = useState(false)
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
    <div className="min-h-screen font-['Plus_Jakarta_Sans'] text-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#1E293B] tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-[#64748B] font-medium mt-1">
            Create and manage document repositories that ground your AI personas with real account knowledge.
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1E1B4B] text-white text-sm font-medium rounded-xl hover:bg-[#2d2a6a] transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Create Knowledge Base
          </button>
          
          {isCreateMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-10 animate-fade-in">
              <button 
                onClick={() => { setIsCreateOpen(true); setIsCreateMenuOpen(false) }}
                className="w-full text-left px-4 py-3 text-sm font-semibold text-[#1E293B] hover:bg-gray-50 transition-colors border-b border-gray-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-gray-500" /> Upload Documents
              </button>
              <button 
                onClick={() => { setIsCrmPanelOpen(true); setIsCreateMenuOpen(false) }}
                className="w-full text-left px-4 py-3 text-sm font-semibold text-[#1E293B] hover:bg-[#FFF7ED] hover:text-[#EA580C] transition-colors flex items-center gap-2"
              >
                <Database className="w-4 h-4 text-orange-500" /> Fetch from CRM
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Knowledge Bases */}
      <div className="mb-4">
        <p className="text-xs font-bold text-[#94A3B8] uppercase tracking-widest mb-3">
          Knowledge Bases <span className="ml-2 text-[#CBD5E1]">({kbs.length + 1})</span>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          <div className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:border-[#1E1B4B]/10 transition-all duration-200 flex flex-col">
            {/* KB Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] flex items-center justify-center text-indigo-500 flex-shrink-0">
                  <Database className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[#1E293B] text-sm truncate" title="Phoenix Automotive">Phoenix Automotive</h3>
                  <p className="text-[11px] text-[#94A3B8] font-semibold font-mono">phoenix_automotive</p>
                </div>
              </div>
              <StatusBadge status="active" />
            </div>

            {/* Description */}
            <p className="text-sm text-[#64748B] font-medium mb-3 line-clamp-2 min-h-[32px]">Static knowledge base</p>

            {/* Stats */}
            <div className="flex gap-4 mb-4 py-3 border-y border-gray-50 mt-auto">
              <div className="text-center">
                <div className="text-lg font-bold text-[#1E293B]">10+</div>
                <div className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wide">Docs</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-[#1E293B]">124</div>
                <div className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wide">Chunks</div>
              </div>
              <div className="text-center ml-auto">
                <div className="text-sm font-semibold text-[#64748B]">System</div>
                <div className="text-[10px] text-[#94A3B8] font-semibold uppercase tracking-wide">Created</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F1F5F9] text-[#94A3B8] text-xs font-semibold rounded-lg cursor-not-allowed"
              >
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
                className="group bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:border-[#1E1B4B]/10 transition-all duration-200 flex flex-col"
              >
                {/* KB Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] flex items-center justify-center text-indigo-500 flex-shrink-0">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-[#1E293B] text-sm truncate" title={kb.name}>{kb.name}</h3>
                      <p className="text-[11px] text-[#94A3B8] font-semibold font-mono">{kb.slug}</p>
                    </div>
                  </div>
                  <StatusBadge status={kb.status} />
                </div>

                {/* Description */}
                <p className="text-sm text-[#64748B] font-medium mb-3 line-clamp-2 min-h-[32px]">
                  {kb.description || ''}
                </p>

                {/* Stats */}
                <div className="flex gap-4 mb-4 py-3 border-y border-gray-50 mt-auto">
                  <div className="text-center">
                    <div className="text-lg font-bold text-[#1E293B]">{kb.document_count}</div>
                    <div className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wide">Docs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-[#1E293B]">{kb.chunk_count}</div>
                    <div className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-wide">Chunks</div>
                  </div>
                  <div className="text-center ml-auto">
                    <div className="text-sm font-semibold text-[#64748B]">{formatDate(kb.created_at)}</div>
                    <div className="text-[10px] text-[#94A3B8] font-semibold uppercase tracking-wide">Created</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUploadTarget(kb)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F1F5F9] text-[#1E293B] text-xs font-semibold rounded-lg hover:bg-[#E2E8F0] transition-all"
                  >
                    <Upload className="w-4 h-4 text-gray-500" />
                    Upload More
                  </button>
                  <button
                    onClick={() => setConfirmDelete(kb)}
                    disabled={deleting === kb.slug}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition-all disabled:opacity-50"
                    title="Delete knowledge base"
                  >
                    {deleting === kb.slug ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <HubSpotCRMPanel
        open={isCrmPanelOpen}
        onClose={() => setIsCrmPanelOpen(false)}
        onIngested={() => { fetchKbs(); setIsCrmPanelOpen(false) }}
      />

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
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-center font-bold text-[#1E293B] text-base mb-1">Delete Knowledge Base?</h3>
            <p className="text-center text-sm text-[#64748B] font-medium mb-5">
              This will permanently delete <strong>"{confirmDelete.name}"</strong> and all {confirmDelete.chunk_count} embedded chunks. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-[#64748B] hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 bg-red-500 rounded-xl text-sm font-semibold text-white hover:bg-red-600 transition-all"
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
