'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

type Step = 'details' | 'upload' | 'processing' | 'complete' | 'error'

interface UploadFile {
  file: File
  id: string
  progress: 'pending' | 'done' | 'error'
}

interface FileBatch {
  id: string
  category: string
  files: UploadFile[]
  isDragging: boolean
}

function makeBatch(): FileBatch {
  return { id: Math.random().toString(36).slice(2), category: '', files: [], isDragging: false }
}

const ALLOWED_EXTS = ['.md', '.docx', '.txt']
const MAX_FILE_SIZE_MB = 20

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

const PROCESSING_STEPS = [
  { label: 'Uploading files',     icon: '📤' },
  { label: 'Extracting text',     icon: '🔍' },
  { label: 'Splitting into chunks', icon: '✂️' },
  { label: 'Generating embeddings', icon: '🧠' },
  { label: 'Storing in Supabase', icon: '💾' },
]

const DOC_CATEGORIES = [
  {
    value: 'customer',
    label: 'Customer',
    icon: '🏢',
    base: 'border-blue-200 bg-blue-50/60 text-blue-800',
    active: 'border-blue-600 bg-blue-100 text-blue-900 ring-2 ring-blue-400',
    desc: 'Company profile, org chart, pain points, business context',
  },
  {
    value: 'deal_history',
    label: 'Deal History',
    icon: '📞',
    base: 'border-purple-200 bg-purple-50/60 text-purple-800',
    active: 'border-purple-600 bg-purple-100 text-purple-900 ring-2 ring-purple-400',
    desc: 'Past calls, emails, notes, proposals, summaries',
  },
  {
    value: 'seller',
    label: 'Seller',
    icon: '🏷️',
    base: 'border-emerald-200 bg-emerald-50/60 text-emerald-800',
    active: 'border-emerald-600 bg-emerald-100 text-emerald-900 ring-2 ring-emerald-400',
    desc: 'Product docs, pricing, battle cards, case studies',
  },
]

export default function CreateKnowledgeBaseModal({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>('details')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [batches, setBatches] = useState<FileBatch[]>([makeBatch()])
  const [processingStepIdx, setProcessingStepIdx] = useState(0)
  const [uploadingBatchIdx, setUploadingBatchIdx] = useState<number | null>(null)
  const [result, setResult] = useState<{ doc_count: number; chunk_count: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [nameError, setNameError] = useState('')
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('details')
        setName('')
        setDescription('')
        setBatches([makeBatch()])
        setProcessingStepIdx(0)
        setUploadingBatchIdx(null)
        setResult(null)
        setErrorMsg('')
        setNameError('')
      }, 300)
    }
  }, [open])

  const setBatchCategory = (batchId: string, cat: string) => {
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, category: cat } : b))
  }

  const addFilesToBatch = useCallback((batchId: string, incoming: File[]) => {
    setBatches(prev => prev.map(b => {
      if (b.id !== batchId) return b
      const existingNames = new Set(b.files.map(f => f.file.name))
      const valid = incoming
        .filter(f => {
          const ext = '.' + (f.name.split('.').pop() || '').toLowerCase()
          return ALLOWED_EXTS.includes(ext) && f.size <= MAX_FILE_SIZE_MB * 1024 * 1024 && !existingNames.has(f.name)
        })
        .map(f => ({ file: f, id: Math.random().toString(36).slice(2), progress: 'pending' as const }))
      return { ...b, files: [...b.files, ...valid] }
    }))
  }, [])

  const removeFileFromBatch = (batchId: string, fileId: string) => {
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, files: b.files.filter(f => f.id !== fileId) } : b))
  }

  const removeBatch = (batchId: string) => setBatches(prev => prev.filter(b => b.id !== batchId))

  const addBatch = () => setBatches(prev => [...prev, makeBatch()])

  const setDragging = (batchId: string, val: boolean) => {
    setBatches(prev => prev.map(b => b.id === batchId ? { ...b, isDragging: val } : b))
  }

  const canSubmit = batches.length > 0 && batches.every(b => b.category && b.files.length > 0)

  const validateStep1 = () => {
    if (!name.trim()) { setNameError('Please enter a name for the knowledge base.'); return false }
    setNameError('')
    return true
  }

  const handleSubmit = async () => {
    if (!validateStep1()) return
    if (!canSubmit) return

    setStep('processing')
    setProcessingStepIdx(0)

    // Animate processing steps
    let idx = 0
    intervalRef.current = setInterval(() => {
      idx++
      if (idx < PROCESSING_STEPS.length - 1) setProcessingStepIdx(idx)
      else if (intervalRef.current) clearInterval(intervalRef.current)
    }, 1800)

    try {
      const token = localStorage.getItem('token')

      // ── Batch 0: Create KB with first batch's files ──
      setUploadingBatchIdx(0)
      const firstBatch = batches[0]
      const firstForm = new FormData()
      firstForm.append('name', name.trim())
      firstForm.append('description', description.trim())
      firstForm.append('document_category', firstBatch.category)
      for (const uf of firstBatch.files) firstForm.append('files', uf.file)

      const res = await fetch(`${API}/api/knowledge-base`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: firstForm
      })

      if (intervalRef.current) clearInterval(intervalRef.current)
      setProcessingStepIdx(PROCESSING_STEPS.length - 1)

      if (!res.ok) {
        const err = await res.json()
        setErrorMsg(err.error || 'Something went wrong. Please try again.')
        setStep('error')
        return
      }

      const data = await res.json()
      const kbSlug = data.knowledge_base?.slug || data.slug
      let totalDocs = data.doc_count || 0
      let totalChunks = data.chunk_count || 0

      // ── Remaining batches: upload to the new KB ──
      for (let i = 1; i < batches.length; i++) {
        setUploadingBatchIdx(i)
        const batch = batches[i]
        const batchForm = new FormData()
        batchForm.append('document_category', batch.category)
        for (const uf of batch.files) batchForm.append('files', uf.file)

        const bRes = await fetch(`${API}/api/knowledge-base/${kbSlug}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: batchForm
        })

        if (bRes.ok) {
          const bData = await bRes.json()
          totalDocs += (bData.new_doc_count || 0)
          totalChunks += (bData.new_chunk_count || 0)
        }
      }

      setResult({ doc_count: totalDocs, chunk_count: totalChunks })
      setStep('complete')
      onCreated()
    } catch (e: any) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setErrorMsg(e.message || 'Network error.')
      setStep('error')
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1E1B4B] to-[#312E81] px-6 py-5 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-[800] text-base tracking-tight">Create Knowledge Base</h2>
            <p className="text-white/50 text-xs font-[500] mt-0.5">Upload documents to power your AI personas</p>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Step indicator */}
        {(step === 'details' || step === 'upload') && (
          <div className="flex px-6 pt-4 gap-2 flex-shrink-0">
            {['details', 'upload'].map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-[800] transition-all ${
                  step === s ? 'bg-[#1E1B4B] text-white' :
                  (step === 'upload' && i === 0) ? 'bg-emerald-500 text-white' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {(step === 'upload' && i === 0) ? '✓' : i + 1}
                </div>
                <span className={`text-[11px] font-[700] ${step === s ? 'text-[#1E293B]' : 'text-[#94A3B8]'}`}>
                  {s === 'details' ? 'KB Details' : 'Upload Docs'}
                </span>
                {i === 0 && <div className="flex-1 h-px bg-gray-100 ml-1" />}
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Details ─────────────────────── */}
          {step === 'details' && (
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-[700] text-[#1E293B] mb-1.5">Knowledge Base Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setNameError('') }}
                  placeholder="e.g. Acme Corp, TechStart Inc."
                  className={`w-full h-11 bg-[#F8F9FC] border rounded-xl px-3.5 text-sm text-[#1E293B] font-[500] focus:outline-none focus:ring-2 focus:ring-[#1E1B4B]/20 transition-all ${nameError ? 'border-red-300' : 'border-gray-200'}`}
                />
                {nameError && <p className="text-red-500 text-[11px] font-[600] mt-1">{nameError}</p>}
              </div>

              <div>
                <label className="block text-xs font-[700] text-[#1E293B] mb-1.5">Description <span className="text-[#94A3B8] font-[500]">(optional)</span></label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Brief description of what this knowledge base covers…"
                  rows={3}
                  className="w-full bg-[#F8F9FC] border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-[#1E293B] font-[500] focus:outline-none focus:ring-2 focus:ring-[#1E1B4B]/20 resize-none transition-all"
                />
              </div>

              <div className="bg-[#F1F5F9] rounded-xl p-3.5">
                <p className="text-[11px] font-[700] text-[#475569] mb-1">💡 How it works</p>
                <p className="text-[11px] text-[#64748B] font-[500] leading-relaxed">
                  Uploaded documents are processed into vector embeddings stored in Supabase. Original files are deleted after processing. The KB is then available as an account context when creating personas.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Upload ───────────────────────── */}
          {step === 'upload' && (
            <div className="px-5 py-4 space-y-4">
              {batches.map((batch, idx) => {
                const selectedCat = DOC_CATEGORIES.find(c => c.value === batch.category)
                return (
                  <div key={batch.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2 bg-[#F8F9FC] border-b border-gray-100">
                      <span className="text-[10px] font-[800] text-[#94A3B8] uppercase tracking-wider">Category {idx + 1}</span>
                      {batches.length > 1 && (
                        <button onClick={() => removeBatch(batch.id)} className="text-[#94A3B8] hover:text-red-500 transition-all">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="p-3 space-y-3">
                      {/* Category pills */}
                      <div className="flex gap-2">
                        {DOC_CATEGORIES.map(cat => (
                          <button
                            key={cat.value}
                            onClick={() => setBatchCategory(batch.id, cat.value)}
                            className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-center transition-all ${
                              batch.category === cat.value ? cat.active : cat.base + ' hover:brightness-95'
                            }`}
                          >
                            <span className="text-base">{cat.icon}</span>
                            <span className="text-[10px] font-[800]">{cat.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Drop zone */}
                      <div
                        onDrop={e => { e.preventDefault(); setDragging(batch.id, false); addFilesToBatch(batch.id, Array.from(e.dataTransfer.files)) }}
                        onDragOver={e => { e.preventDefault(); setDragging(batch.id, true) }}
                        onDragLeave={() => setDragging(batch.id, false)}
                        onClick={() => fileInputRefs.current[batch.id]?.click()}
                        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
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
                        <div className="space-y-1 max-h-24 overflow-y-auto">
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
                              <button
                                onClick={e => { e.stopPropagation(); removeFileFromBatch(batch.id, uf.id) }}
                                className="text-[#94A3B8] hover:text-red-500 transition-all flex-shrink-0"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Add another category */}
              <button
                onClick={addBatch}
                className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-xs font-[700] text-[#94A3B8] hover:border-[#1E1B4B]/30 hover:text-[#1E1B4B] hover:bg-[#F8F9FF] transition-all flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add another category
              </button>
            </div>
          )}

          {/* ── Step 3: Processing ───────────────────── */}
          {step === 'processing' && (
            <div className="px-6 py-10 flex flex-col items-center">
              <div className="w-16 h-16 bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] rounded-2xl flex items-center justify-center mb-5 text-3xl">
                {PROCESSING_STEPS[processingStepIdx]?.icon}
              </div>
              <h3 className="font-[800] text-[#1E293B] text-base mb-1">{PROCESSING_STEPS[processingStepIdx]?.label}</h3>
              <p className="text-sm text-[#64748B] font-[500] text-center mb-8">Processing your documents…</p>

              <div className="w-full space-y-2.5">
                {PROCESSING_STEPS.map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] flex-shrink-0 transition-all duration-500 ${
                      i < processingStepIdx ? 'bg-emerald-500 text-white' :
                      i === processingStepIdx ? 'bg-[#1E1B4B] text-white' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {i < processingStepIdx ? '✓' : i === processingStepIdx ? (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      ) : i + 1}
                    </div>
                    <span className={`text-xs font-[700] transition-all ${
                      i < processingStepIdx ? 'text-emerald-600' :
                      i === processingStepIdx ? 'text-[#1E293B]' : 'text-[#94A3B8]'
                    }`}>{s.label}</span>
                    {i < processingStepIdx && (
                      <span className="ml-auto text-emerald-500 text-[10px] font-[700]">Done</span>
                    )}
                    {i === processingStepIdx && (
                      <span className="ml-auto text-[#1E293B] text-[10px] font-[700]">In progress…</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 4: Complete ─────────────────────── */}
          {step === 'complete' && result && (
            <div className="px-6 py-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-5 text-4xl">✅</div>
              <h3 className="font-[900] text-[#1E293B] text-lg mb-1">Knowledge Base Created!</h3>
              <p className="text-sm text-[#64748B] font-[500] mb-6">
                <strong>"{name}"</strong> is ready to use as an account context in personas.
              </p>
              <div className="flex gap-6 mb-6">
                <div className="bg-[#F8F9FC] rounded-xl px-6 py-3 text-center">
                  <div className="text-2xl font-[900] text-[#1E293B]">{result.doc_count}</div>
                  <div className="text-[10px] text-[#94A3B8] font-[700] uppercase tracking-wide">Documents</div>
                </div>
                <div className="bg-[#F8F9FC] rounded-xl px-6 py-3 text-center">
                  <div className="text-2xl font-[900] text-[#1E293B]">{result.chunk_count}</div>
                  <div className="text-[10px] text-[#94A3B8] font-[700] uppercase tracking-wide">Chunks</div>
                </div>
              </div>
              <p className="text-[11px] text-[#64748B] font-[500]">
                Original files have been deleted. Only embeddings are stored.
              </p>
            </div>
          )}

          {/* ── Error ────────────────────────────────── */}
          {step === 'error' && (
            <div className="px-6 py-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-5 text-4xl">❌</div>
              <h3 className="font-[900] text-[#1E293B] text-lg mb-1">Processing Failed</h3>
              <p className="text-sm text-[#64748B] font-[500] mb-2">Something went wrong while processing your documents.</p>
              <p className="text-xs text-red-500 font-[600] bg-red-50 rounded-lg px-4 py-2 mb-6 max-w-xs break-words">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          {step === 'details' && (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-[700] text-[#64748B] hover:bg-gray-50 transition-all">
                Cancel
              </button>
              <button
                onClick={() => { if (validateStep1()) setStep('upload') }}
                className="flex-1 py-2.5 bg-[#1E1B4B] text-white rounded-xl text-sm font-[700] hover:bg-[#2d2a6a] transition-all"
              >
                Next: Upload Docs →
              </button>
            </>
          )}

          {step === 'upload' && (
            <>
              <button onClick={() => setStep('details')} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-[700] text-[#64748B] hover:bg-gray-50 transition-all">
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 py-2.5 bg-[#1E1B4B] text-white rounded-xl text-sm font-[700] hover:bg-[#2d2a6a] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {`Create${batches.length > 1 ? ` (${batches.length} categories)` : ''}`}
              </button>
            </>
          )}

          {step === 'complete' && (
            <button onClick={onClose} className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-[700] hover:bg-emerald-600 transition-all">
              Done
            </button>
          )}

          {step === 'error' && (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-[700] text-[#64748B] hover:bg-gray-50 transition-all">
                Close
              </button>
              <button onClick={() => setStep('upload')} className="flex-1 py-2.5 bg-[#1E1B4B] text-white rounded-xl text-sm font-[700] hover:bg-[#2d2a6a] transition-all">
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
