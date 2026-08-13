'use client'

import { useState, useRef, useCallback } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface KnowledgeBase {
  id: string
  name: string
  slug: string
  document_count: number
  chunk_count: number
}

interface Props {
  open: boolean
  kb: KnowledgeBase
  onClose: () => void
  onUploaded: () => void
}

interface UploadFile {
  file: File
  id: string
}

interface FileBatch {
  id: string
  category: string
  files: UploadFile[]
  isDragging: boolean
}

const ALLOWED_EXTS = ['.md', '.docx', '.txt']
const MAX_FILE_SIZE_MB = 20

const DOC_CATEGORIES = [
  {
    value: 'customer',
    label: 'Customer',
    icon: '🏢',
    base: 'border-blue-200 bg-blue-50/60 text-blue-800',
    active: 'border-blue-600 bg-blue-100 text-blue-900 ring-2 ring-blue-400',
    desc: 'Company profile, org chart, pain points',
  },
  {
    value: 'deal_history',
    label: 'Deal History',
    icon: '📞',
    base: 'border-purple-200 bg-purple-50/60 text-purple-800',
    active: 'border-purple-600 bg-purple-100 text-purple-900 ring-2 ring-purple-400',
    desc: 'Past calls, emails, notes, proposals',
  },
  {
    value: 'seller',
    label: 'Seller',
    icon: '🏷️',
    base: 'border-emerald-200 bg-emerald-50/60 text-emerald-800',
    active: 'border-emerald-600 bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400',
    desc: 'Product docs, pricing, battle cards',
  },
]

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'md') return '📝'
  if (ext === 'docx') return '📄'
  if (ext === 'txt') return '📃'
  return '📎'
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function makeBatch(): FileBatch {
  return { id: Math.random().toString(36).slice(2), category: '', files: [], isDragging: false }
}

export default function UploadDocumentsModal({ open, kb, onClose, onUploaded }: Props) {
  const [batches, setBatches] = useState<FileBatch[]>([makeBatch()])
  const [uploading, setUploading] = useState(false)
  const [uploadingBatch, setUploadingBatch] = useState<number | null>(null)
  const [result, setResult] = useState<{ categories: string[]; total_chunks: number } | null>(null)
  const [error, setError] = useState('')
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const reset = useCallback(() => {
    setBatches([makeBatch()])
    setResult(null)
    setError('')
    setUploading(false)
    setUploadingBatch(null)
  }, [])

  const setBatchCategory = (batchId: string, cat: string) => {
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, category: cat } : b))
    setError('')
  }

  const addFilesToBatch = useCallback((batchId: string, incoming: File[]) => {
    setBatches(prev => prev.map(b => {
      if (b.id !== batchId) return b
      const existingNames = new Set(b.files.map(f => f.file.name))
      const valid = incoming.filter(f => {
        const ext = '.' + (f.name.split('.').pop() || '').toLowerCase()
        return ALLOWED_EXTS.includes(ext) && f.size <= MAX_FILE_SIZE_MB * 1024 * 1024 && !existingNames.has(f.name)
      })
      return { ...b, files: [...b.files, ...valid.map(f => ({ file: f, id: Math.random().toString(36).slice(2) }))] }
    }))
  }, [])

  const removeFileFromBatch = (batchId: string, fileId: string) => {
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, files: b.files.filter(f => f.id !== fileId) } : b))
  }

  const removeBatch = (batchId: string) => {
    setBatches(prev => prev.filter(b => b.id !== batchId))
  }

  const addBatch = () => {
    setBatches(prev => [...prev, makeBatch()])
  }

  const setDragging = (batchId: string, val: boolean) => {
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, isDragging: val } : b))
  }

  const canUpload = batches.length > 0 && batches.every(b => b.category && b.files.length > 0)

  const handleUpload = async () => {
    if (!canUpload) {
      setError('Each category section must have at least one file selected.')
      return
    }
    setUploading(true)
    setError('')
    const token = localStorage.getItem('token')
    let totalChunks = 0
    const uploadedCategories: string[] = []

    try {
      for (let i = 0; i < batches.length; i++) {
        setUploadingBatch(i)
        const batch = batches[i]
        const formData = new FormData()
        for (const uf of batch.files) formData.append('files', uf.file)
        formData.append('document_category', batch.category)

        const res = await fetch(`${API}/api/knowledge-base/${kb.slug}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        })

        const data = await res.json()
        if (!res.ok) throw new Error(`[${batch.category}] ${data.error || 'Upload failed.'}`)
        totalChunks += (data.new_chunk_count || 0)
        uploadedCategories.push(batch.category)
      }
      setResult({ categories: uploadedCategories, total_chunks: totalChunks })
      onUploaded()
    } catch (e: any) {
      setError(e.message || 'Network error.')
    } finally {
      setUploading(false)
      setUploadingBatch(null)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E1B4B] to-[#312E81] px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-[800] text-base">Upload Documents</h2>
            <p className="text-white/50 text-xs font-[500] mt-0.5">Adding to <strong className="text-white/80">{kb.name}</strong></p>
          </div>
          {!uploading && (
            <button onClick={() => { reset(); onClose() }} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* Success */}
          {result ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">✅</div>
              <h3 className="font-[800] text-[#1E293B] text-base mb-2">Documents Added!</h3>
              <div className="flex flex-wrap justify-center gap-2 mb-3">
                {result.categories.map(cat => {
                  const c = DOC_CATEGORIES.find(d => d.value === cat)
                  return (
                    <span key={cat} className={`text-[11px] font-[700] px-3 py-1 rounded-full border ${c?.base || ''}`}>
                      {c?.icon} {c?.label}
                    </span>
                  )
                })}
              </div>
              <p className="text-xs text-[#94A3B8] mb-5">{result.total_chunks} chunks indexed into the knowledge base.</p>
              <button onClick={() => { reset(); onClose() }} className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-[700] hover:bg-emerald-600 transition-all">
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Batch list */}
              {batches.map((batch, idx) => {
                const selectedCat = DOC_CATEGORIES.find(c => c.value === batch.category)
                const isCurrentlyUploading = uploading && uploadingBatch === idx
                return (
                  <div key={batch.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Batch header */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-[#F8F9FC] border-b border-gray-100">
                      <span className="text-[10px] font-[800] text-[#94A3B8] uppercase tracking-wider">
                        {isCurrentlyUploading ? '⏳ Uploading…' : `Category ${idx + 1}`}
                      </span>
                      {batches.length > 1 && !uploading && (
                        <button onClick={() => removeBatch(batch.id)} className="text-[#94A3B8] hover:text-red-500 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Category pills */}
                      <div className="flex gap-2">
                        {DOC_CATEGORIES.map(cat => (
                          <button
                            key={cat.value}
                            disabled={uploading}
                            onClick={() => setBatchCategory(batch.id, cat.value)}
                            className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-center transition-all disabled:opacity-60 ${
                              batch.category === cat.value ? cat.active : cat.base + ' hover:brightness-95'
                            }`}
                          >
                            <span className="text-lg">{cat.icon}</span>
                            <span className="text-[10px] font-[800]">{cat.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Drop zone */}
                      <div
                        onDrop={e => { e.preventDefault(); setDragging(batch.id, false); addFilesToBatch(batch.id, Array.from(e.dataTransfer.files)) }}
                        onDragOver={e => { e.preventDefault(); setDragging(batch.id, true) }}
                        onDragLeave={() => setDragging(batch.id, false)}
                        onClick={() => !uploading && fileInputRefs.current[batch.id]?.click()}
                        className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${uploading ? 'cursor-default opacity-60' : 'cursor-pointer'} ${
                          batch.isDragging ? 'border-[#1E1B4B] bg-[#EEF2FF]' : 'border-gray-200 hover:border-[#1E1B4B]/40 hover:bg-[#F8F9FF]'
                        }`}
                      >
                        <input
                          ref={el => { fileInputRefs.current[batch.id] = el }}
                          type="file" multiple accept=".md,.docx,.txt" className="hidden"
                          onChange={e => e.target.files && addFilesToBatch(batch.id, Array.from(e.target.files))}
                        />
                        <div className="text-xl mb-1">{batch.isDragging ? '📥' : '📂'}</div>
                        <p className="text-xs font-[700] text-[#1E293B]">
                          {batch.files.length > 0 ? `${batch.files.length} file(s) — click to add more` : 'Drop files or click to browse'}
                        </p>
                        <p className="text-[10px] text-[#94A3B8] mt-0.5">.md · .docx · .txt · max {MAX_FILE_SIZE_MB}MB</p>
                      </div>

                      {/* File list */}
                      {batch.files.length > 0 && (
                        <div className="space-y-1 max-h-28 overflow-y-auto">
                          {batch.files.map(uf => (
                            <div key={uf.id} className="flex items-center gap-2 bg-[#F8F9FC] rounded-lg px-3 py-1.5">
                              <span className="text-sm">{getFileIcon(uf.file.name)}</span>
                              {selectedCat && (
                                <span className="text-[8px] font-[700] px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-[#64748B] flex-shrink-0">
                                  {selectedCat.icon} {selectedCat.label}
                                </span>
                              )}
                              <p className="text-xs font-[700] text-[#1E293B] truncate flex-1">{uf.file.name}</p>
                              <span className="text-[10px] text-[#94A3B8] flex-shrink-0">{formatBytes(uf.file.size)}</span>
                              {!uploading && (
                                <button onClick={() => removeFileFromBatch(batch.id, uf.id)} className="text-[#94A3B8] hover:text-red-500 transition-all flex-shrink-0">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Add another category */}
              {!uploading && (
                <button
                  onClick={addBatch}
                  className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs font-[700] text-[#94A3B8] hover:border-[#1E1B4B]/30 hover:text-[#1E1B4B] hover:bg-[#F8F9FF] transition-all flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add another category
                </button>
              )}

              {error && <p className="text-xs text-red-500 font-[600] bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { reset(); onClose() }}
                  disabled={uploading}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-[700] text-[#64748B] hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!canUpload || uploading}
                  className="flex-1 py-2.5 bg-[#1E1B4B] text-white rounded-xl text-sm font-[700] hover:bg-[#2d2a6a] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      {uploadingBatch !== null ? `Uploading batch ${uploadingBatch + 1}/${batches.length}…` : 'Processing…'}
                    </>
                  ) : `Upload${batches.length > 1 ? ` ${batches.length} categories` : ''}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
