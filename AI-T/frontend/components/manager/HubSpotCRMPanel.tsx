import { useState, useEffect } from 'react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

interface Account {
  id: string
  name: string
}

interface HubSpotCRMPanelProps {
  open: boolean
  onClose: () => void
  onIngested: () => void
}

export default function HubSpotCRMPanel({ open, onClose, onIngested }: HubSpotCRMPanelProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [fetchingCRM, setFetchingCRM] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [crmData, setCrmData] = useState<any>(null)
  
  useEffect(() => {
    if (open) {
      fetchAccounts()
    } else {
      // Reset state on close
      setSelectedAccount(null)
      setCrmData(null)
    }
  }, [open])
  
  const fetchAccounts = async () => {
    setLoadingAccounts(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/hubspot/accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.accounts || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingAccounts(false)
    }
  }

  const handleFetchData = async () => {
    if (!selectedAccount) return
    setFetchingCRM(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/hubspot/fetch`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ account_name: selectedAccount.name })
      })
      if (res.ok) {
        const data = await res.json()
        setCrmData(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setFetchingCRM(false)
    }
  }

  const handleIngest = async () => {
    if (!selectedAccount) return
    setIngesting(true)
    
    // Create a slug for the account
    const slug = selectedAccount.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API}/api/hubspot/ingest`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          account_name: selectedAccount.name,
          account_slug: slug
        })
      })
      if (res.ok) {
        onIngested() // Calls fetchKbs and closes modal in parent
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIngesting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="w-[600px] h-full bg-white shadow-2xl flex flex-col animate-slide-left overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-[800] text-[#1E293B]">Fetch from HubSpot CRM</h2>
            <p className="text-xs text-[#64748B] font-[500] mt-0.5">Select a CRM account to ingest its data.</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Select Account */}
          <div className="space-y-3">
            <label className="text-sm font-[700] text-[#1E293B]">1. Select Company</label>
            <div className="flex gap-2">
              <select 
                className="flex-1 h-10 border border-gray-200 rounded-xl px-3 text-sm font-[500] outline-none focus:ring-2 focus:ring-[#1E1B4B]/20 transition-all"
                value={selectedAccount?.id || ''}
                onChange={(e) => {
                  const acct = accounts.find(a => a.id === e.target.value)
                  setSelectedAccount(acct || null)
                  setCrmData(null)
                }}
                disabled={loadingAccounts}
              >
                <option value="">{loadingAccounts ? 'Loading...' : '-- Choose a HubSpot Company --'}</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button 
                onClick={handleFetchData}
                disabled={!selectedAccount || fetchingCRM}
                className="h-10 px-4 bg-[#F8FAFC] text-[#1E293B] border border-gray-200 text-sm font-[700] rounded-xl hover:bg-[#F1F5F9] transition-all disabled:opacity-50"
              >
                {fetchingCRM ? 'Fetching...' : 'Preview Data'}
              </button>
            </div>
          </div>

          {/* Step 2: Preview CRM Data */}
          {crmData && crmData.success && (
            <div className="space-y-4 pt-4 border-t border-gray-100 animate-fade-in">
              <label className="text-sm font-[700] text-[#1E293B]">2. Preview Data</label>
              
              {/* Company */}
              {crmData.company && (
                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-gray-100">
                  <h3 className="text-xs font-[800] text-[#64748B] uppercase tracking-wider mb-2">🏢 Company</h3>
                  <div className="text-sm font-[500] text-[#334155] whitespace-pre-wrap font-mono text-[11px] max-h-32 overflow-y-auto">
                    {crmData.company.content}
                  </div>
                </div>
              )}

              {/* Contacts */}
              {crmData.contacts?.length > 0 && (
                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-gray-100">
                  <h3 className="text-xs font-[800] text-[#64748B] uppercase tracking-wider mb-2">👤 Contacts ({crmData.contacts.length})</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                    {crmData.contacts.map((c: any, i: number) => (
                      <div key={i} className="text-[11px] font-mono text-[#334155] p-2 bg-white rounded border border-gray-100 whitespace-pre-wrap">
                        {c.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deals */}
              {crmData.deals?.length > 0 && (
                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-gray-100">
                  <h3 className="text-xs font-[800] text-[#64748B] uppercase tracking-wider mb-2">💼 Deals ({crmData.deals.length})</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                    {crmData.deals.map((c: any, i: number) => (
                      <div key={i} className="text-[11px] font-mono text-[#334155] p-2 bg-white rounded border border-gray-100 whitespace-pre-wrap">
                        {c.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {crmData.notes?.length > 0 && (
                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-gray-100">
                  <h3 className="text-xs font-[800] text-[#64748B] uppercase tracking-wider mb-2">📝 Notes ({crmData.notes.length})</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                    {crmData.notes.map((c: any, i: number) => (
                      <div key={i} className="text-[11px] font-mono text-[#334155] p-2 bg-white rounded border border-gray-100 whitespace-pre-wrap">
                        {c.content}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
          <button
            onClick={handleIngest}
            disabled={!crmData || ingesting}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#F97316] text-white text-sm font-[700] rounded-xl hover:bg-[#EA580C] transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {ingesting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Ingesting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Add to Knowledge Base
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
