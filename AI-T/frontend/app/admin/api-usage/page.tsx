'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, DollarSign, Database, Hash, ArrowUpRight, ArrowDownRight, Save, RefreshCw, AlertCircle } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function ApiUsagePage() {
  const [config, setConfig] = useState<any>(null)
  const [usage, setUsage] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingBalance, setEditingBalance] = useState(false)
  const [balanceInput, setBalanceInput] = useState('')
  const [savingBalance, setSavingBalance] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const [configRes, usageRes] = await Promise.all([
        fetch(`${API}/api/admin/llm-config`, { headers }),
        fetch(`${API}/api/admin/llm-usage`, { headers })
      ])

      if (configRes.status === 401 || configRes.status === 403) {
        throw new Error('Unauthorized. Please log in with an Admin account.')
      }

      if (!configRes.ok) {
        const errJson = await configRes.json().catch(() => ({}))
        throw new Error(errJson.error || `Failed to fetch config (${configRes.status})`)
      }

      if (!usageRes.ok) {
        const errJson = await usageRes.json().catch(() => ({}))
        throw new Error(errJson.error || `Failed to fetch usage (${usageRes.status})`)
      }

      const configData = await configRes.json()
      const usageData = await usageRes.json()

      setConfig(configData)
      setUsage(usageData)
      const currentBal = configData.globalBalance ?? configData.balance ?? 4.43
      setBalanceInput(currentBal.toString())
    } catch (err: any) {
      console.error('[ApiUsagePage] fetch error:', err)
      setError(err.message || 'Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSaveBalance = async () => {
    try {
      setSavingBalance(true)
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
      const res = await fetch(`${API}/api/admin/llm-config`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          globalBalance: parseFloat(balanceInput),
          balance: parseFloat(balanceInput)
        })
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Failed to save balance')
      }
      
      const newBal = parseFloat(balanceInput)
      setConfig((prev: any) => ({ ...(prev || {}), globalBalance: newBal, balance: newBal }))
      setEditingBalance(false)
    } catch (err: any) {
      alert(err.message || 'Failed to update balance')
    } finally {
      setSavingBalance(false)
    }
  }

  if (loading) {
    return (
      <div className="p-12 flex flex-col justify-center items-center h-64 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500 font-medium">Loading Cerebras API usage analytics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4 text-red-700 shadow-sm">
          <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-base mb-1">Error Loading Analytics</h3>
            <p className="text-sm opacity-90">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const metrics = usage?.metrics || usage || {}
  const logs = usage?.logs || []
  const currentBalance = config?.globalBalance ?? config?.balance ?? 4.43

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Cerebras API Usage & Cost Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Real-time token consumption, LLM costs, and global balance tracker.</p>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Stats
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Global Balance Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <DollarSign className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">Remaining Balance</h3>
            </div>
          </div>
          
          {editingBalance ? (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xl font-bold text-slate-400">$</span>
              <input
                type="number"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                className="w-full text-xl font-bold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500"
                step="0.01"
                autoFocus
              />
              <button
                onClick={handleSaveBalance}
                disabled={savingBalance}
                className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {savingBalance ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <div className="flex items-baseline justify-between mt-2">
              <div className="text-3xl font-extrabold text-slate-900 font-mono">
                ${Number(currentBalance).toFixed(4)}
              </div>
              <button
                onClick={() => setEditingBalance(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline underline-offset-2"
              >
                Edit
              </button>
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-2">Auto-deducted per Cerebras call</p>
        </div>

        {/* Total Cost Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Total Spent</h3>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono mt-2">
            ${Number(metrics.totalCost || 0).toFixed(4)}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Across all training & analysis</p>
        </div>

        {/* Tokens Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Total Tokens</h3>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono mt-2">
            {(metrics.totalTokens || (metrics.totalInputTokens || 0) + (metrics.totalOutputTokens || 0)).toLocaleString()}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Combined In + Out tokens</p>
        </div>

        {/* Avg Cost Per Session Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Hash className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">Avg Cost / Session</h3>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono mt-2">
            ${Number(metrics.avgCostPerSession || 0).toFixed(5)}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Average price per completed session</p>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Average Input Tokens</h3>
            <p className="text-xs text-slate-400 mt-1">Prompt / context size per call</p>
          </div>
          <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
            <ArrowUpRight className="w-5 h-5" />
            <span className="text-xl font-bold font-mono">{Math.round(metrics.avgInputTokens || 0).toLocaleString()}</span>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Average Output Tokens</h3>
            <p className="text-xs text-slate-400 mt-1">Generated completion size per call</p>
          </div>
          <div className="flex items-center gap-2 text-fuchsia-600 bg-fuchsia-50 px-4 py-2 rounded-xl border border-fuchsia-100">
            <ArrowDownRight className="w-5 h-5" />
            <span className="text-xl font-bold font-mono">{Math.round(metrics.avgOutputTokens || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Recent Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Recent Cerebras LLM Calls</h3>
            <p className="text-[11px] text-slate-400">Chronological history of API calls, token counts, and cost</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Timestamp</th>
                <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Action / Endpoint</th>
                <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Model</th>
                <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider">Tokens (In / Out)</th>
                <th className="px-6 py-3 font-semibold text-xs uppercase tracking-wider text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Database className="w-8 h-8 text-slate-300" />
                      <p className="text-sm">No usage logs recorded yet.</p>
                      <p className="text-xs text-slate-400">Usage data will appear here automatically when reps practice or analyze scenarios.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log: any, idx: number) => {
                  const inTokens = log.prompt_tokens ?? log.input_tokens ?? 0
                  const outTokens = log.completion_tokens ?? log.output_tokens ?? 0
                  const cost = Number(log.cost ?? log.total_cost ?? 0)

                  return (
                    <tr key={log.id || idx} className="hover:bg-slate-50/80 transition">
                      <td className="px-6 py-3.5 text-slate-600 whitespace-nowrap text-xs">
                        {log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now'}
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-800 text-xs">
                          {log.endpoint_name || log.call_type || 'Inference'}
                        </div>
                        {log.session_id && (
                          <div className="text-[11px] font-mono text-slate-400">
                            Session: {log.session_id.substring(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-slate-500">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[11px] font-mono">
                          {log.model_name || log.model || 'cerebras'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-slate-600 font-mono text-xs">
                        <span className="text-indigo-600 font-medium">{inTokens.toLocaleString()}</span>
                        <span className="text-slate-300 mx-1.5">/</span>
                        <span className="text-fuchsia-600 font-medium">{outTokens.toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono font-semibold text-rose-600 text-xs">
                        ${cost.toFixed(6)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
