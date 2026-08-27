'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SessionSnapshotModal from '@/components/rep/SessionSnapshotModal'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function RepDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [isSnapshotOpen, setIsSnapshotOpen] = useState(false)
  const [snapshotData, setSnapshotData] = useState<any>(null)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) return

        const headers = { 'Authorization': `Bearer ${token}` }
        const res = await fetch(`${API}/api/reps/me/dashboard`, { headers })
        
        if (res.ok) {
          const data = await res.json()
          setDashboardData(data)
        }
      } catch (err) {
        console.error('Failed to load rep dashboard', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-[#1E1B4B]"></div>
      </div>
    )
  }

  // Use 100% Database Data returned from API
  const stats = dashboardData?.stats || {
    activeAssignments: 0,
    activeAssignmentsSubtext: 'Due this week',
    completedSessions: 0,
    completedSessionsSubtext: 'All time',
    averageScore: 0,
    averageScoreSubtext: 'Out of 100',
    practiceTimeHrs: 0,
    practiceTimeSubtext: 'Cumulative'
  }

  const inProgress = dashboardData?.inProgressSession || null
  const assignmentsList: any[] = dashboardData?.assignments || []

  const stages = inProgress?.conversationStages || ['Opening', 'Discovery', 'Value Prop', 'Objections', 'Closing']

  const openSnapshotModal = () => {
    if (!inProgress) return
    setSnapshotData(inProgress.snapshotData || null)
    setIsSnapshotOpen(true)
  }

  return (
    <div className="space-y-8 pb-12 font-['Inter'] max-w-[1360px] mx-auto text-[#0b1c30]">
      {/* Dashboard Content */}

      {/* IN PROGRESS: Continue Your Last Training Banner Card */}
      {inProgress && (
        <div className="bg-white rounded-lg border border-slate-200 p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#1E293B]"></div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Info Column */}
            <div className="lg:col-span-4 space-y-4">
              <span className="inline-block px-2.5 py-1 bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-md uppercase tracking-wider">
                IN PROGRESS
              </span>
              <div>
                <h2 className="text-2xl font-bold font-['Plus_Jakarta_Sans'] text-[#1E293B] tracking-tight">Continue Your Last Training</h2>
                <p className="text-[13px] text-slate-500 mt-1">Pick up exactly where you left off.</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 text-[13px]">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Training Scenario</span>
                  <span className="font-semibold text-[#1E293B]">{inProgress.title}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Persona</span>
                  <span className="font-semibold text-[#1E293B]">{inProgress.personaName}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Company</span>
                  <span className="font-semibold text-[#1E293B]">{inProgress.company}</span>
                </div>
                <div className="flex items-center justify-between text-slate-500 pt-1">
                  <span>Difficulty</span>
                  <span className="px-2 py-0.5 bg-slate-50 text-slate-700 font-semibold text-[11px] border border-slate-200 rounded-md">
                    {inProgress.difficulty}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Training Mode</span>
                  <span className="px-2 py-0.5 bg-slate-50 text-slate-700 font-semibold text-[11px] border border-slate-200 rounded-md">
                    {inProgress.trainingMode}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Progress & Stepper Column */}
            <div className="lg:col-span-8 bg-slate-50 border border-slate-200 rounded-lg p-6 space-y-6">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-bold text-slate-500 tracking-wider uppercase text-[11px]">SESSION PROGRESS</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#1E293B] text-[15px]">{inProgress.progressPercentage}%</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 bg-slate-200 rounded-md overflow-hidden">
                <div
                  className="h-full bg-[#4b41e1] transition-all duration-500"
                  style={{ width: `${inProgress.progressPercentage}%` }}
                ></div>
              </div>

              {/* Tiles Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-md border border-slate-200">
                  <p className="text-[11px] font-semibold text-slate-500">Est. Time Remaining</p>
                  <p className="text-[14px] font-semibold text-[#1E293B] mt-1">{inProgress.estTimeRemainingMins} min</p>
                </div>
                <div className="bg-white p-4 rounded-md border border-slate-200 col-span-2">
                  <p className="text-[11px] font-semibold text-slate-500">Current Stage</p>
                  <p className="text-[14px] font-semibold text-[#1E293B] mt-1">{inProgress.currentStage}</p>
                  <p className="text-[11px] text-slate-400 font-medium">{inProgress.stageProgressText}</p>
                </div>
              </div>

              {/* Conversation Stages Stepper Bar */}
              <div className="space-y-3 pt-2">
                <p className="text-[11px] font-bold text-slate-500 tracking-wider uppercase">Conversation Stages</p>
                <div className="flex items-center justify-between relative px-2">
                  <div className="absolute left-6 right-6 top-1.5 h-[1px] bg-slate-200 -z-0"></div>
                  {stages.map((stageName: string, idx: number) => {
                    const isActive = idx === (inProgress.activeStepIndex ?? 1)
                    const isPassed = idx < (inProgress.activeStepIndex ?? 1)

                    return (
                      <div key={stageName} className="flex flex-col items-center z-10 space-y-2">
                        <div
                          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                            isActive
                              ? 'bg-[#4b41e1] ring-4 ring-indigo-50'
                              : isPassed
                              ? 'bg-[#1E293B] text-white'
                              : 'bg-slate-200 border border-slate-300'
                          }`}
                        >
                          {isPassed && <span className="text-[8px]">✓</span>}
                        </div>
                        <span
                          className={`text-[11px] font-medium ${
                            isActive ? 'text-[#4b41e1] font-bold' : 'text-slate-500'
                          }`}
                        >
                          {stageName}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <span className="text-[12px] text-slate-500">{inProgress.pausedAgoText}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={openSnapshotModal}
                    className="px-4 py-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[13px] font-semibold text-[#0b1c30] transition-colors"
                  >
                    📊 View Snapshot
                  </button>
                  <button
                    onClick={() => {
                      const params = new URLSearchParams()
                      if (inProgress.assignmentId) params.append('assignmentId', inProgress.assignmentId)
                      if (inProgress.sessionId) params.append('sessionId', inProgress.sessionId)
                      if (inProgress.trainingMode) params.append('mode', inProgress.trainingMode)
                      router.push(`/rep/train/${inProgress.scenarioId}/briefing?${params.toString()}`)
                    }}
                    className="px-6 py-2 rounded-md bg-[#4b41e1] hover:bg-[#3b31cc] text-white text-[13px] font-semibold flex items-center gap-2 transition-colors"
                  >
                    <span>▷</span> Resume Training
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4 Aggregated Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Active Assignments</p>
            <h3 className="text-3xl font-semibold font-['Plus_Jakarta_Sans'] text-[#1E293B] mt-1">{stats.activeAssignments}</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">{stats.activeAssignmentsSubtext}</p>
          </div>
          <div className="w-10 h-10 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center">
            📋
          </div>
        </div>

        <div
          onClick={() => router.push('/rep/train')}
          className="bg-white p-6 rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer hover:border-slate-300 transition-colors"
        >
          <div>
            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Completed Sessions</p>
            <h3 className="text-3xl font-semibold font-['Plus_Jakarta_Sans'] text-[#1E293B] mt-1">{stats.completedSessions}</h3>
            <p className="text-[13px] text-[#4b41e1] font-medium mt-0.5">View in Assignments →</p>
          </div>
          <div className="w-10 h-10 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center">
            ✓
          </div>
        </div>

        <div
          onClick={() => router.push('/rep/my-stats')}
          className="bg-white p-6 rounded-lg border border-slate-200 flex items-center justify-between cursor-pointer hover:border-slate-300 transition-colors"
        >
          <div>
            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Average Score</p>
            <h3 className="text-3xl font-semibold font-['Plus_Jakarta_Sans'] text-[#1E293B] mt-1">{stats.averageScore}%</h3>
            <p className="text-[13px] text-[#4b41e1] font-medium mt-0.5">View My Stats →</p>
          </div>
          <div className="w-10 h-10 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center">
            📈
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider">Practice Time</p>
            <h3 className="text-3xl font-semibold font-['Plus_Jakarta_Sans'] text-[#1E293B] mt-1">{stats.practiceTimeHrs} hrs</h3>
            <p className="text-[13px] text-slate-500 mt-0.5">{stats.practiceTimeSubtext}</p>
          </div>
          <div className="w-10 h-10 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center">
            ⏱️
          </div>
        </div>
      </div>

      {/* Quick link to Training Queue */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 flex items-center justify-between">
        <div>
          <h3 className="font-semibold font-['Plus_Jakarta_Sans'] text-[#1E293B] text-lg">Your Training Queue</h3>
          <p className="text-[14px] text-slate-500 mt-0.5">
            {assignmentsList.filter((a: any) => a.status !== 'Completed').length} active assignments waiting
          </p>
        </div>
        <button
          onClick={() => router.push('/rep/training-queue')}
          className="px-5 py-2.5 bg-[#4b41e1] hover:bg-[#3b31cc] text-white text-[13px] font-semibold rounded-md transition-colors"
        >
          View Queue →
        </button>
      </div>

      {/* Session Snapshot Modal */}
      <SessionSnapshotModal
        isOpen={isSnapshotOpen}
        onClose={() => setIsSnapshotOpen(false)}
        snapshotData={snapshotData}
        scenarioId={inProgress?.scenarioId || ''}
        sessionId={inProgress?.sessionId || ''}
      />
    </div>
  )
}
