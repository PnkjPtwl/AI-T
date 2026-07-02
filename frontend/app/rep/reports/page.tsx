'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

type Filter = 'recent' | 'highest' | 'lowest' | 'discovery' | 'negotiation'

export default function IntelligenceReportsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('recent')

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API}/api/sessions/my-sessions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setSessions(data.filter((s: any) => s.feedback_json && s.feedback_json.overall_score))
        }
      } catch (err) {
        console.error('Failed to fetch reports', err)
      } finally {
        setLoading(false)
      }
    }
    fetchSessions()
  }, [])

  const getFiltered = () => {
    let result = [...sessions]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.scenario_name?.toLowerCase().includes(q) ||
        s.feedback_json?.summary?.toLowerCase().includes(q)
      )
    }
    if (filter === 'discovery') result = result.filter(s => s.scenario_name?.toLowerCase().includes('discovery'))
    else if (filter === 'negotiation') result = result.filter(s => s.scenario_name?.toLowerCase().includes('negotiation') || s.scenario_name?.toLowerCase().includes('skeptical'))

    if (filter === 'highest') result.sort((a, b) => b.feedback_json.overall_score - a.feedback_json.overall_score)
    else if (filter === 'lowest') result.sort((a, b) => a.feedback_json.overall_score - b.feedback_json.overall_score)
    else result.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())

    return result
  }

  const filtered = getFiltered()

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#2C5282]"></div>
    </div>
  )

  const TABS: { id: Filter; label: string }[] = [
    { id: 'recent', label: 'Recent' },
    { id: 'highest', label: 'Top Score' },
    { id: 'lowest', label: 'Needs Work' },
    { id: 'discovery', label: 'Discovery' },
    { id: 'negotiation', label: 'Negotiation' },
  ]

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-600' : 'text-red-500'

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-base text-gray-500 mt-1">View your past training sessions and performance scores.</p>
        </div>
        {/* Search */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm w-full md:w-64">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
          </svg>
          <input
            type="text"
            placeholder="Search reports..."
            className="text-sm text-gray-700 outline-none bg-transparent w-full placeholder:text-gray-400"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
              filter === t.id
                ? 'bg-white text-[#2C5282] shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-gray-400 text-sm">
            No reports match this filter.
            {sessions.length > 0 && (
              <button onClick={() => { setSearch(''); setFilter('recent') }} className="block mx-auto mt-3 text-[#2C5282] text-sm hover:underline">
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Scenario</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Objections</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Closing</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Discovery</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Overall</th>
                <th className="text-center px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((session) => {
                const f = session.feedback_json
                const scores = f.scores || {}
                const objection = scores.objection_handling || 0
                const closing = scores.closing || 0
                const discovery = scores.discovery || scores.questioning_ability || 0
                const overall = f.overall_score

                return (
                  <tr
                    key={session.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/rep/train/${session.scenario_id}/review?sessionId=${session.id}`)}
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{session.scenario_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{f.summary?.substring(0, 80)}…</p>
                    </td>
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">
                      {new Date(session.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className={`px-6 py-4 text-right font-semibold ${scoreColor(objection)}`}>{objection}%</td>
                    <td className={`px-6 py-4 text-right font-semibold ${scoreColor(closing)}`}>{closing}%</td>
                    <td className={`px-6 py-4 text-right font-semibold ${scoreColor(discovery)}`}>{discovery}%</td>
                    <td className={`px-6 py-4 text-right text-base font-bold ${scoreColor(overall)}`}>{overall}%</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={e => { e.stopPropagation(); router.push(`/rep/train/${session.scenario_id}/review?sessionId=${session.id}`) }}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#2C5282] hover:bg-[#EBF8FF] transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
