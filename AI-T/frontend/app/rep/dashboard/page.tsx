'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SessionSnapshotModal from '@/components/rep/SessionSnapshotModal'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export default function RepDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [dashboardData, setDashboardData] = useState<any>(null)
  const [filterTab, setFilterTab] = useState<'All' | 'Not Started' | 'In Progress' | 'Completed' | 'Overdue'>('Not Started')
  const [quickFilter, setQuickFilter] = useState<string | null>(null)
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

  // Filter assignments based on tabs & quick filter
  const filteredAssignments = assignmentsList.filter((item: any) => {
    if (filterTab !== 'All' && item.status !== filterTab) return false
    if (quickFilter === 'Today' && !item.lastAttemptText?.includes('today')) return false
    if (quickFilter === 'Overdue' && item.status !== 'Overdue') return false
    if (quickFilter === 'High Priority' && item.priority !== 'High') return false
    if (quickFilter === 'Advanced' && item.difficulty !== 'Advanced') return false
    if (quickFilter === 'Exam Mode' && item.trainingMode !== 'Exam Mode') return false
    if (quickFilter === 'Coach Mode' && item.trainingMode !== 'Coach Mode') return false
    if (quickFilter === 'Learning Mode' && item.trainingMode !== 'Learning Mode') return false
    return true
  })

  const stages = inProgress?.conversationStages || ['Opening', 'Discovery', 'Value Prop', 'Objections', 'Closing']

  const openSnapshotModal = () => {
    if (!inProgress) return
    setSnapshotData(inProgress.snapshotData || null)
    setIsSnapshotOpen(true)
  }

  return (
    <div className="space-y-8 pb-12 font-sans max-w-[1360px] mx-auto">
      {/* Dashboard Content */}

      {/* IN PROGRESS: Continue Your Last Training Banner Card (Figma media__1785582272981.png) */}
      {inProgress && (
        <div className="bg-white rounded-[24px] border border-gray-200/80 p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-500"></div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Info Column */}
            <div className="lg:col-span-4 space-y-4">
              <span className="inline-block px-3 py-1 bg-red-50 text-red-600 text-[11px] font-[800] rounded-full uppercase tracking-wider">
                IN PROGRESS
              </span>
              <div>
                <h2 className="text-2xl font-[800] text-[#1E293B] tracking-tight">Continue Your Last Training</h2>
                <p className="text-xs text-[#64748B] font-[500] mt-1">Pick up exactly where you left off.</p>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100 text-xs">
                <div className="flex items-center justify-between text-[#64748B]">
                  <span>Training Scenario</span>
                  <span className="font-[700] text-[#1E293B]">{inProgress.title}</span>
                </div>
                <div className="flex items-center justify-between text-[#64748B]">
                  <span>Persona</span>
                  <span className="font-[700] text-[#1E293B]">{inProgress.personaName}</span>
                </div>
                <div className="flex items-center justify-between text-[#64748B]">
                  <span>Company</span>
                  <span className="font-[700] text-[#1E293B]">{inProgress.company}</span>
                </div>
                <div className="flex items-center justify-between text-[#64748B] pt-1">
                  <span>Difficulty</span>
                  <span className="px-2.5 py-0.5 bg-red-50 text-red-600 font-[700] text-[10px] rounded-md">
                    {inProgress.difficulty}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#64748B]">
                  <span>Training Mode</span>
                  <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 font-[700] text-[10px] rounded-md">
                    {inProgress.trainingMode}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Progress & Stepper Column */}
            <div className="lg:col-span-8 bg-gray-50/60 border border-gray-100 rounded-[20px] p-6 space-y-6">
              <div className="flex items-center justify-between text-xs">
                <span className="font-[800] text-[#64748B] tracking-wider uppercase">SESSION PROGRESS</span>
                <div className="flex items-center gap-2">
                  <span className="font-[800] text-[#1E293B] text-base">{inProgress.progressPercentage}%</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1E1B4B] rounded-full transition-all duration-500"
                  style={{ width: `${inProgress.progressPercentage}%` }}
                ></div>
              </div>

              {/* Tiles Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-3.5 rounded-xl border border-gray-200/60 shadow-sm">
                  <p className="text-[10px] font-[600] text-[#64748B]">Est. Time Remaining</p>
                  <p className="text-sm font-[800] text-[#1E293B] mt-0.5">{inProgress.estTimeRemainingMins} min</p>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-gray-200/60 shadow-sm col-span-2">
                  <p className="text-[10px] font-[600] text-[#64748B]">Current Stage</p>
                  <p className="text-sm font-[800] text-[#1E293B] mt-0.5">{inProgress.currentStage}</p>
                  <p className="text-[10px] text-[#64748B] font-[500]">{inProgress.stageProgressText}</p>
                </div>
              </div>

              {/* Conversation Stages Stepper Bar */}
              <div className="space-y-2 pt-2">
                <p className="text-[10px] font-[800] text-[#64748B] tracking-wider uppercase">Conversation Stages</p>
                <div className="flex items-center justify-between relative px-2">
                  <div className="absolute left-6 right-6 top-2 h-0.5 bg-gray-200 -z-0"></div>
                  {stages.map((stageName: string, idx: number) => {
                    const isActive = idx === (inProgress.activeStepIndex ?? 1)
                    const isPassed = idx < (inProgress.activeStepIndex ?? 1)

                    return (
                      <div key={stageName} className="flex flex-col items-center z-10 space-y-1">
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${
                            isActive
                              ? 'bg-[#7C3AED] ring-4 ring-purple-100 scale-110'
                              : isPassed
                              ? 'bg-[#1E1B4B] text-white'
                              : 'bg-gray-300'
                          }`}
                        >
                          {isPassed && <span className="text-[8px]">✓</span>}
                        </div>
                        <span
                          className={`text-[10px] font-[600] ${
                            isActive ? 'text-[#7C3AED] font-[800]' : 'text-[#64748B]'
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
              <div className="flex items-center justify-between pt-4 border-t border-gray-200/60">
                <span className="text-xs text-[#64748B] font-[500]">{inProgress.pausedAgoText}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={openSnapshotModal}
                    className="px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-xs font-[700] text-[#334155] shadow-sm transition-colors"
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
                    className="px-6 py-2.5 rounded-xl bg-[#1E1B4B] hover:bg-[#2E2A72] text-white text-xs font-[700] flex items-center gap-2 shadow-md transition-colors"
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
        <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-[700] text-[#64748B]">Active Assignments</p>
            <h3 className="text-3xl font-[800] text-[#1E293B] mt-2">{stats.activeAssignments}</h3>
            <p className="text-xs text-[#64748B] mt-1">{stats.activeAssignmentsSubtext}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-[700]">
            📋
          </div>
        </div>

        <div
          onClick={() => router.push('/rep/train')}
          className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between cursor-pointer hover:border-green-300 transition-colors"
        >
          <div>
            <p className="text-xs font-[700] text-[#64748B]">Completed Sessions</p>
            <h3 className="text-3xl font-[800] text-[#1E293B] mt-2">{stats.completedSessions}</h3>
            <p className="text-xs text-green-600 font-[600] mt-1">View in Assignments →</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center font-[700]">
            ✓
          </div>
        </div>

        <div
          onClick={() => router.push('/rep/my-stats')}
          className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-300 transition-colors"
        >
          <div>
            <p className="text-xs font-[700] text-[#64748B]">Average Score</p>
            <h3 className="text-3xl font-[800] text-[#1E293B] mt-2">{stats.averageScore}%</h3>
            <p className="text-xs text-blue-600 font-[600] mt-1">View My Stats →</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-[700]">
            📈
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-[700] text-[#64748B]">Practice Time</p>
            <h3 className="text-3xl font-[800] text-[#1E293B] mt-2">{stats.practiceTimeHrs} hrs</h3>
            <p className="text-xs text-[#64748B] mt-1">{stats.practiceTimeSubtext}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-[700]">
            ⏱️
          </div>
        </div>
      </div>

      {/* Your Assignments Grid Section */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-[800] text-[#1E293B] tracking-tight">Your Assignments</h2>
            <p className="text-xs text-[#64748B] font-[500] mt-0.5">
              {filteredAssignments.length} of {assignmentsList.length} shown
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-[700] text-[#334155] hover:bg-gray-50 flex items-center gap-1.5 shadow-sm">
              <span>🔍</span> Filters
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200 pb-3 overflow-x-auto">
          {(['All', 'Not Started', 'In Progress', 'Completed', 'Overdue'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-[700] whitespace-nowrap transition-colors ${
                filterTab === tab
                  ? 'bg-[#1E1B4B] text-white shadow-sm'
                  : 'bg-white text-[#64748B] border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
          <span className="font-[700] text-[#64748B] mr-1">Quick:</span>
          {['Today', 'Overdue', 'High Priority', 'Advanced', 'Due This Week'].map((pill) => (
            <button
              key={pill}
              onClick={() => setQuickFilter(quickFilter === pill ? null : pill)}
              className={`px-3 py-1 rounded-full border text-[11px] font-[600] transition-colors ${
                quickFilter === pill
                  ? 'bg-purple-100 text-purple-800 border-purple-300'
                  : 'bg-white text-[#64748B] border-gray-200 hover:bg-gray-50'
              }`}
            >
              {pill}
            </button>
          ))}
        </div>

        {/* Assignments 3-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssignments.map((assign: any) => {
            let statusBadge = (
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-[800] rounded-full border border-blue-100 uppercase">
                {assign.status}
              </span>
            )
            if (assign.status === 'Overdue') {
              statusBadge = (
                <span className="px-2.5 py-1 bg-red-50 text-red-700 text-[10px] font-[800] rounded-full border border-red-100 uppercase">
                  Overdue
                </span>
              )
            } else if (assign.status === 'Completed') {
              statusBadge = (
                <span className="px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-[800] rounded-full border border-green-100 uppercase">
                  Completed
                </span>
              )
            }

            return (
              <div
                key={assign.id}
                onClick={() => {
                  if (assign.isLimitReached && assign.status !== 'In Progress') {
                    alert(`Maximum attempt limit (${assign.maxAttempts}) reached for ${assign.trainingMode || 'Exam Mode'}. You cannot take this session again.`)
                    return
                  }
                  router.push(`/rep/train/${assign.scenarioId}/briefing?${assign.id ? `assignmentId=${assign.id}&` : ''}mode=${encodeURIComponent(assign.trainingMode || 'Coach Mode')}`)
                }}
                className={`bg-white rounded-[20px] border border-gray-200/80 p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-5 group ${assign.isLimitReached && assign.status !== 'In Progress' ? 'opacity-85 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="space-y-4">
                  {/* Top Avatar & Status Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1E1B4B] text-white font-[800] text-sm flex items-center justify-center shadow-sm">
                        {assign.avatarType || 'SC'}
                      </div>
                      <div>
                        <h3 className="font-[800] text-[#1E293B] text-base group-hover:text-purple-700 transition-colors">
                          {assign.personaName}
                        </h3>
                        <p className="text-xs text-[#64748B]">{assign.roleTitle}</p>
                        <p className="text-[11px] font-[600] text-purple-600">{assign.company}</p>
                      </div>
                    </div>
                    {statusBadge}
                  </div>

                  {/* Title & Tags */}
                  <div>
                    <h4 className="font-[700] text-[#1E293B] text-sm">{assign.title}</h4>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(assign.tags || ['Technical Discovery', 'High', 'SaaS']).map((tag: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-gray-100 text-[#475569] text-[10px] font-[600] rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Difficulty & Duration */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
                    <div>
                      <p className="text-[10px] font-[600] text-[#64748B]">DIFFICULTY</p>
                      <p className="font-[700] text-red-600 mt-0.5">{assign.difficulty}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-[600] text-[#64748B]">DURATION</p>
                      <p className="font-[700] text-[#1E293B] mt-0.5">⏱️ {assign.durationMins} min</p>
                    </div>
                  </div>

                  {/* Due Date & Avg Score */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] font-[600] text-[#64748B]">DUE DATE</p>
                      <p className="font-[600] text-[#334155] mt-0.5">📅 {assign.dueDate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-[600] text-[#64748B]">AVG SCORE</p>
                      <p className="font-[800] text-[#1E1B4B] mt-0.5">
                        {assign.avgScore ? `${assign.avgScore} /100` : 'Not attempted'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-[#64748B]">
                  <span>{assign.lastAttemptText}</span>
                  <span className="text-purple-600 font-[700] group-hover:translate-x-1 transition-transform">
                    {assign.isLimitReached && assign.status !== 'In Progress' ? (
                      <span className="text-gray-400 font-[600]">Limit Reached ({assign.attemptsCount ?? 1}/{assign.maxAttempts ?? 1})</span>
                    ) : assign.status === 'Completed' ? (
                      `Retake (${assign.attemptsCount ?? 0}/${assign.maxAttempts ?? 5}) →`
                    ) : assign.status === 'In Progress' ? (
                      assign.hasPausedSession ? 'Resume →' : `Try Again (${assign.attemptsCount ?? 0}/${assign.maxAttempts ?? 5}) →`
                    ) : (
                      `Start (${assign.attemptsCount ?? 0}/${assign.maxAttempts ?? 5}) →`
                    )}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
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
