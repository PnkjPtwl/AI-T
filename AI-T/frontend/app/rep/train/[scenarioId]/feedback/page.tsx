'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function FeedbackPage({ params }: { params: { scenarioId: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`${API}/api/sessions/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setSession(data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    
    if (sessionId) {
      router.push(`/rep/train/${params.scenarioId}/review?sessionId=${sessionId}`)
    }
  }, [sessionId, params.scenarioId, router])

  if (loading || !session || !session.feedback_json) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        <p className="text-gray-400">Loading your feedback report...</p>
      </div>
    )
  }

  const feedback = session.feedback_json
  const scores = feedback.scores || {}
  
  const getScoreColor = (score: number) => {
    if (score <= 40) return 'text-red-500'
    if (score <= 70) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getBarColor = (score: number) => {
    if (score <= 40) return 'bg-red-500'
    if (score <= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-sans pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center pb-6 border-b border-gray-800">
          <h1 className="text-3xl font-bold text-white mb-2">Practice Session Feedback</h1>
          <p className="text-gray-400">Scenario: {session.training_scenarios?.persona_name}</p>
        </div>

        {/* Overall Score */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
          <p className="text-gray-400 font-medium mb-2 uppercase tracking-widest text-sm">Overall Score</p>
          <div className={`text-7xl font-bold tracking-tight ${getScoreColor(feedback.overall_score)}`}>
            {feedback.overall_score}<span className="text-3xl text-gray-500 ml-1">/100</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Component Scores */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
            <h3 className="text-lg font-semibold text-white mb-4">Detailed Metrics</h3>
            
            {[
              { label: 'Empathy', key: 'empathy' },
              { label: 'Objection Handling', key: 'objection_handling' },
              { label: 'Confidence', key: 'confidence' },
              { label: 'Listening', key: 'listening' },
              { label: 'Executive Communication', key: 'executive_communication' },
              { label: 'Questioning Ability', key: 'questioning_ability' },
            ].map((metric) => {
              const val = scores[metric.key] || 0
              
              return (
                <div key={metric.key}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-300">{metric.label}</span>
                    <span className="font-medium text-gray-100">{val}%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden border border-gray-700/50">
                    <div 
                      className={`h-2 rounded-full ${getBarColor(val)} transition-all duration-1000`} 
                      style={{ width: `${val}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Strengths & Improvements */}
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-green-500">✓</span> Strengths
              </h3>
              <ul className="space-y-3">
                {feedback.strengths?.map((str: string, i: number) => (
                  <li key={i} className="flex gap-3 text-gray-300 text-sm leading-relaxed">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"></div>
                    {str}
                  </li>
                ))}
                {(!feedback.strengths || feedback.strengths.length === 0) && (
                  <p className="text-gray-500 italic">No specific strengths identified.</p>
                )}
              </ul>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-orange-500">⚠</span> Areas to Improve
              </h3>
              <ul className="space-y-3">
                {feedback.improvements?.map((imp: string, i: number) => (
                  <li key={i} className="flex gap-3 text-gray-300 text-sm leading-relaxed">
                    <div className="mt-1 w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></div>
                    {imp}
                  </li>
                ))}
                {(!feedback.improvements || feedback.improvements.length === 0) && (
                  <p className="text-gray-500 italic">No specific improvements identified.</p>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8 border-t border-gray-800">
          <Link 
            href={`/rep/train`}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors text-center"
          >
            Back to Scenarios
          </Link>
          <button
            onClick={() => {
              // Note: the easiest way to practice again is to send them back to the /train page so they hit Start Practice
              // which creates a NEW session. We don't want to reuse the completed session.
              window.location.href = `/rep/train`
            }}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-indigo-500/20 transition-all text-center"
          >
            Practice Again
          </button>
        </div>

      </div>
    </div>
  )
}
