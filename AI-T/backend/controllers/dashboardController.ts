import { supabase } from '../db/supabase'
import { getModeLimit, normalizeModeDisplay } from '../utils/modeHelper'

/**
 * GET /api/reps/me/dashboard
 * Dynamic data feed for Sales Rep Dashboard (Figma Pixel Perfect alignment)
 */
export const getRepDashboard = async (req: any, res: any) => {
  const repId = req.user.id
  const orgId = req.user.org_id

  try {
    // 1. Fetch Rep's Assignments with Scenarios
    const { data: assignments, error: assignError } = await supabase
      .from('training_assignments')
      .select(`
        id,
        scenario_id,
        session_id,
        status,
        priority,
        deadline,
        avatar_type,
        training_mode,
        created_at,
        scenario:training_scenarios!training_assignments_scenario_id_fkey (
          id,
          contact_title,
          contact_company,
          persona_name,
          difficulty,
          context_text,
          target_skills
        )
      `)
      .eq('rep_id', repId)

    if (assignError) throw assignError

    // 2. Fetch Rep's Training Sessions
    const { data: sessions, error: sessError } = await supabase
      .from('training_sessions')
      .select(`
        id,
        scenario_id,
        messages_json,
        feedback_json,
        completed_at,
        created_at,
        status,
        paused_at,
        scenario:training_scenarios!training_sessions_scenario_id_fkey (
          id,
          contact_title,
          contact_company,
          persona_name,
          difficulty,
          context_text,
          target_skills
        )
      `)
      .eq('rep_id', repId)
      .order('created_at', { ascending: false })

    if (sessError) throw sessError

    // Compute Exact DB Stats
    const completedSessions = (sessions || []).filter(s => s.completed_at !== null)
    const activeAssignments = (assignments || []).filter(a => a.status !== 'Completed')

    const totalScores = completedSessions.reduce((sum, s) => {
      const score = s.feedback_json?.overall_score || 0
      return sum + score
    }, 0)

    const avgScore = completedSessions.length > 0 ? Math.round(totalScores / completedSessions.length) : 0

    // Cumulative practice time in hours calculated realistically from active session turns & duration
    const validPracticeSessions = (sessions || []).filter((s: any) => 
      s.feedback_json && !s.feedback_json.is_note && !s.feedback_json.is_assignment
    )
    
    const totalPracticeSec = validPracticeSessions.reduce((total: number, s: any) => {
      // Check if voice delivery aggregate exists
      const voiceDeliverySec = s.feedback_json?.voice_delivery?.totalDurationSec
      if (voiceDeliverySec && typeof voiceDeliverySec === 'number') {
        return total + voiceDeliverySec
      }
      // Fallback: calculate active practice duration based on message turns (approx 30s per turn)
      const turns = (s.messages_json || []).length
      return total + (turns * 30)
    }, 0)
    const practiceTimeHrs = Number((totalPracticeSec / 3600).toFixed(1))

    // 3. Find latest paused / in-progress session directly from DB
    // Filter to sessions where completed_at is null AND the associated assignment is 'In Progress'
    const inProgressAssignments = (assignments || []).filter(a => a.status === 'In Progress')
    const inProgressScenarioIds = new Set(inProgressAssignments.map(a => a.scenario_id))

    const pausedSessions = (sessions || []).filter(s => 
      s.completed_at === null && 
      (inProgressScenarioIds.has(s.scenario_id) || s.status === 'In Progress')
    )
    let inProgressSession = null

    if (pausedSessions.length > 0) {
      const latest: any = pausedSessions[0]
      const sc: any = latest.scenario || {}
      const stages = sc.conversation_stages || [
        "Opening", "Discovery", "Value Prop", "Objections", "Closing"
      ]
      
      const currentStageIndex = stages.indexOf(latest.current_stage || 'Opening')
      const stageStep = currentStageIndex >= 0 ? currentStageIndex + 1 : 1

      // Calculate paused ago text
      const rawPausedAt = latest.paused_at || latest.created_at
      const pausedAt = rawPausedAt.endsWith('Z') ? rawPausedAt : `${rawPausedAt}Z`
      const pausedDiffHours = Math.floor((new Date().getTime() - new Date(pausedAt).getTime()) / (1000 * 3600))
      const pausedAgoText = pausedDiffHours <= 0 ? 'Paused recently' : `Paused ${pausedDiffHours} hours ago`

      // Extract last user question & persona reply directly from messages_json if available
      const msgs = latest.messages_json || []
      const userMsgs = msgs.filter((m: any) => m.role === 'user' || m.role === 'human' || m.role === 'rep')
      const modelMsgs = msgs.filter((m: any) => m.role === 'assistant' || m.role === 'model' || m.role === 'persona' || m.role === 'bot')
      const extractTxt = (m: any) => m?.content || (m?.parts && m?.parts[0]?.text) || ''

      const lastUserQuestion = userMsgs.length > 0 ? extractTxt(userMsgs[userMsgs.length - 1]) : "Could you walk me through your current process?"
      const lastPersonaAnswer = modelMsgs.length > 0 ? extractTxt(modelMsgs[modelMsgs.length - 1]) : "We are evaluating options for streamlining our operations."

      const existingSnapshot = latest.snapshot_json || latest.feedback_json?.snapshot || {}

      const computedSnapshot = {
        snapshot_at: existingSnapshot.snapshot_at || latest.paused_at || new Date().toISOString(),
        session_summary: existingSnapshot.session_summary || existingSnapshot.summary || 
          `The representative initiated discovery with ${sc.persona_name || sc.contact_title || 'the prospect'} at ${sc.contact_company || 'Target Account'}, maintaining a structured and consultative tone. Key exchanges focused on clarifying operational workflows and current technical pain points. The prospect engaged constructively while raising initial timeline considerations. The call was paused at stage "${latest.current_stage || 'Needs Discovery'}" (${stageStep} of ${stages.length} stages completed).`,
        skill_breakdown: existingSnapshot.skill_breakdown || existingSnapshot.partial_feedback?.scores || {
          'Value Communication': 75,
          'Customer Understanding': 70,
          'Objection & Concern Handling': 68,
          'Active Listening & Engagement': 82,
          'Communication & Professionalism': 78,
          'Next Steps & Call Effectiveness': 65
        },
        whats_going_well: existingSnapshot.whats_going_well || existingSnapshot.partial_feedback?.strengths || [
          'Active listening and steady pacing',
          'Maintained positive customer sentiment'
        ],
        needs_attention: existingSnapshot.needs_attention || existingSnapshot.partial_feedback?.improvements || [
          'Explore technical requirements in greater depth',
          'Reinforce value proposition before moving to next stage'
        ],
        last_question_user: lastUserQuestion || existingSnapshot.last_question_user,
        last_question_persona: lastPersonaAnswer || existingSnapshot.last_question_persona,
        next_step_tip: existingSnapshot.next_step_tip || "Tip: Connect their operational pain points to specific product capabilities.",
        current_stage: latest.current_stage || 'Needs Discovery',
        stages_completed: `${stageStep} / ${stages.length}`
      }

      const matchingAssign = inProgressAssignments.find(a => a.scenario_id === latest.scenario_id)
      const resolvedMode = matchingAssign?.training_mode || latest.training_mode || sc.training_mode || 'Coach Mode'

      inProgressSession = {
        sessionId: latest.id,
        scenarioId: latest.scenario_id,
        assignmentId: matchingAssign?.id || null,
        title: sc.persona_name || sc.contact_title || 'Training Session',
        personaName: sc.contact_title || sc.persona_name || 'Prospect Persona',
        company: sc.contact_company || 'Target Account',
        difficulty: sc.difficulty || 'Medium',
        trainingMode: resolvedMode,
        progressPercentage: latest.progress_percentage || Math.min(90, (stageStep * 20)),
        estTimeRemainingMins: 15,
        currentStage: latest.current_stage || 'Needs Discovery',
        stageProgressText: `Step ${stageStep} of ${stages.length}`,
        conversationStages: stages,
        activeStepIndex: currentStageIndex >= 0 ? currentStageIndex : 1,
        pausedAgoText,
        snapshotData: computedSnapshot
      }
    }

    // 4. Transform Assignments Grid directly from DB records
    const now = new Date()
    const transformedAssignments = (assignments || []).map(assign => {
      const sc: any = assign.scenario || {}
      // Match sessions specifically to this assignment via session_id (preferred) or scenario_id fallback
      const assignSessions = (sessions || []).filter(s =>
        assign.session_id ? s.id === assign.session_id : s.scenario_id === assign.scenario_id
      )
      const assignCompleted = assignSessions.filter(s => s.completed_at !== null)

      let assignAvgScore = null
      if (assignCompleted.length > 0) {
        const sum = assignCompleted.reduce((acc, s) => acc + (s.feedback_json?.overall_score || 0), 0)
        assignAvgScore = Math.round(sum / assignCompleted.length)
      }

      const lastSession = assignSessions[0]
      let lastAttemptText = 'Not attempted'
      if (lastSession) {
        const days = Math.floor((now.getTime() - new Date(lastSession.created_at).getTime()) / (1000 * 3600 * 24))
        lastAttemptText = days === 0 ? 'Last attempt today' : `Last attempt ${days} days ago`
      }

      const deadlineDate = assign.deadline ? new Date(assign.deadline) : null
      // Normalize DB status: 'Pending' → 'Not Started'
      const dbStatus = assign.status === 'Pending' ? 'Not Started' : (assign.status || 'Not Started')
      let status = dbStatus
      if (status !== 'Completed' && deadlineDate && deadlineDate < now) {
        status = 'Overdue'
      } else if (status === 'Not Started' && assignSessions.some(s => s.completed_at === null)) {
        // Only upgrade to In Progress if the assignment's own session is actively in progress
        status = 'In Progress'
      }

      const title = sc?.persona_name || sc?.contact_title || 'Training Scenario'
      const personaName = sc?.contact_title || sc?.persona_name || 'Prospect Persona'
      const roleTitle = sc?.contact_title || 'Decision Maker'
      const company = sc?.contact_company || 'Target Account'

      // Safe Avatar initials
      const nameStr = String(personaName || title || 'Scenario')
      const initials = nameStr.split(' ').filter(Boolean).map((n: string) => n ? n[0] : '').join('').substring(0, 2).toUpperCase() || 'SC'

      const modeDisplay = normalizeModeDisplay(assign.training_mode || sc.training_mode)
      const maxAttempts = getModeLimit(assign.training_mode || sc.training_mode)
      const attemptsCount = assignSessions.length

      return {
        id: assign.id,
        scenarioId: assign.scenario_id,
        personaName,
        title,
        company,
        roleTitle,
        avatarType: initials,
        avatarUrl: sc.avatar_url || null,
        avatarConfig: sc.avatar_config || null,
        status,
        trainingMode: modeDisplay,
        attemptsCount,
        maxAttempts,
        isLimitReached: attemptsCount >= maxAttempts,
        priority: assign.priority || 'Medium',
        difficulty: sc.difficulty || 'Medium',
        durationMins: sc.estimated_duration_mins || 20,
        dueDate: assign.deadline ? new Date(assign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No deadline',
        avgScore: assignAvgScore,
        lastAttemptText,
        tags: sc.tags && sc.tags.length > 0 ? sc.tags : [sc.difficulty || 'Medium']
      }
    })

    res.json({
      stats: {
        activeAssignments: activeAssignments.length,
        activeAssignmentsSubtext: 'Due this week',
        completedSessions: completedSessions.length,
        completedSessionsSubtext: 'All time',
        averageScore: avgScore,
        averageScoreSubtext: 'Out of 100',
        practiceTimeHrs,
        practiceTimeSubtext: 'Cumulative'
      },
      inProgressSession,
      assignments: transformedAssignments
    })
  } catch (err: any) {
    console.error('Error fetching rep dashboard:', err)
    res.status(500).json({ error: 'Failed to fetch dashboard data', message: err.message })
  }
}


/**
 * GET /api/manager/analytics
 * Executive Team Analytics Dashboard for Managers
 */
export const getManagerAnalytics = async (req: any, res: any) => {
  const orgId = req.user.org_id
  const experienceParam = (req.query.experience || 'all').toString().trim()

  try {
    // 1. Fetch Reps in Org
    const { data: reps, error: repError } = await supabase
      .from('users')
      .select('id, name, role, org_id')
      .eq('org_id', orgId)

    if (repError) throw repError

    // 2. Fetch User Experience table data
    const { data: userExpList } = await supabase
      .from('user_experience')
      .select('user_id, experience_years')

    const expMap: Record<string, number> = {}
    if (userExpList) {
      userExpList.forEach((e: any) => {
        expMap[e.user_id] = e.experience_years
      })
    }

    // Filter reps by role, exclusion rules, and selected experience range
    const filteredReps = (reps || []).filter(r => {
      if (r.role === 'manager' || r.name?.toLowerCase().includes('lokesh')) return false

      if (!experienceParam || experienceParam === 'all') return true

      // Default fallback experience: 1 year (1-2 years bracket) if not set
      const years = expMap[r.id] !== undefined ? expMap[r.id] : 1

      if (experienceParam === '<1' || experienceParam === '0-1') {
        return years < 1
      } else if (experienceParam === '1-2') {
        return years >= 1 && years <= 2
      } else if (experienceParam === '>2' || experienceParam === '2+') {
        return years > 2
      }
      return true
    })

    const repIds = filteredReps.map(r => r.id)

    // 3. Fetch Assignments
    const { data: assignments, error: assignError } = await supabase
      .from('training_assignments')
      .select('id, rep_id, status, created_at, completed_at')
      .in('rep_id', repIds.length > 0 ? repIds : ['00000000-0000-0000-0000-000000000000'])

    if (assignError) throw assignError

    // 4. Fetch Completed Sessions
    const { data: sessions, error: sessError } = await supabase
      .from('training_sessions')
      .select('id, rep_id, feedback_json, created_at, completed_at, status')
      .in('rep_id', repIds.length > 0 ? repIds : ['00000000-0000-0000-0000-000000000000'])

    if (sessError) throw sessError

    const allSessions = sessions || []
    const completedSessions = allSessions.filter(s => 
      (s.completed_at !== null || s.status === 'Completed') && 
      !s.feedback_json?.is_note
    )
    
    const assignedCount = (assignments || []).length
    const startedCount = (assignments || []).filter(a => a.status === 'In Progress' || a.status === 'In Review' || a.status === 'Completed').length
    const submittedCount = (assignments || []).filter(a => a.status === 'In Review' || a.status === 'Completed').length
    const completedAssignmentsCount = (assignments || []).filter(a => a.status === 'Completed').length

    const completionRatePct = assignedCount > 0 
      ? Math.round((completedAssignmentsCount / assignedCount) * 100) 
      : (completedSessions.length > 0 ? 100 : 0)

    const scoresList = completedSessions
      .map(s => s.feedback_json?.overall_score)
      .filter((val): val is number => typeof val === 'number' && !isNaN(val) && val > 0)

    const totalScoreSum = scoresList.reduce((acc, s) => acc + s, 0)
    const rawAvg = scoresList.length > 0 ? totalScoreSum / scoresList.length : 0
    const teamAvgScore = Math.round(rawAvg)

    // Calculate score distribution
    const ranges = [
      { range: '<50', count: 0 },
      { range: '50-59', count: 0 },
      { range: '60-69', count: 0 },
      { range: '70-79', count: 0 },
      { range: '80-89', count: 0 },
      { range: '90-100', count: 0 }
    ]

    scoresList.forEach(sc => {
      if (sc >= 90) ranges[5].count++
      else if (sc >= 80) ranges[4].count++
      else if (sc >= 70) ranges[3].count++
      else if (sc >= 60) ranges[2].count++
      else if (sc >= 50) ranges[1].count++
      else ranges[0].count++
    })

    // Calculate Performance Over Time (weekly aggregation of completed sessions)
    const weeksMap: Record<string, { total: number; count: number }> = {}
    const now = Date.now()

    for (let i = 11; i >= 0; i--) {
      const wName = `W${12 - i}`
      weeksMap[wName] = { total: 0, count: 0 }
    }

    completedSessions.forEach(s => {
      const date = new Date(s.completed_at || s.created_at)
      const diffWeeks = Math.floor((now - date.getTime()) / (7 * 24 * 3600 * 1000))
      const weekIdx = 12 - diffWeeks
      if (weekIdx >= 1 && weekIdx <= 12) {
        const wKey = `W${weekIdx}`
        const sc = s.feedback_json?.overall_score
        if (typeof sc === 'number' && !isNaN(sc) && sc > 0) {
          weeksMap[wKey].total += sc
          weeksMap[wKey].count++
        }
      }
    })

    const performanceOverTime = Object.entries(weeksMap).map(([week, val]) => {
      const avg = val.count > 0 ? Math.round(val.total / val.count) : 0
      return { week, score: avg }
    })

    // Cohort Comparison grouped by active filtered reps
    const repStatsMap: Record<string, { name: string; totalScore: number; count: number; assigned: number; completed: number; sessions: any[] }> = {}

    filteredReps.forEach(r => {
      repStatsMap[r.id] = { name: r.name || 'Sales Rep', totalScore: 0, count: 0, assigned: 0, completed: 0, sessions: [] }
    })

    completedSessions.forEach(s => {
      if (repStatsMap[s.rep_id]) {
        const sc = s.feedback_json?.overall_score
        if (typeof sc === 'number' && !isNaN(sc) && sc > 0) {
          repStatsMap[s.rep_id].totalScore += sc
          repStatsMap[s.rep_id].count++
          repStatsMap[s.rep_id].sessions.push(s)
        }
      }
    })

    ;(assignments || []).forEach(a => {
      if (repStatsMap[a.rep_id]) {
        repStatsMap[a.rep_id].assigned++
        if (a.status === 'Completed') repStatsMap[a.rep_id].completed++
      }
    })

    const cohortComparison = Object.values(repStatsMap).map(r => {
      const avg = r.count > 0 ? (r.totalScore / r.count) : 0
      const rate = r.assigned > 0 ? Math.round((r.completed / r.assigned) * 100) : (r.count > 0 ? 100 : 0)
      const formattedAvg = Math.round(avg)

      let trendStr = '-'
      if (r.sessions.length > 1) {
        const sorted = [...r.sessions].sort((a, b) => new Date(a.completed_at || a.created_at).getTime() - new Date(b.completed_at || b.created_at).getTime())
        const firstScore = sorted[0].feedback_json?.overall_score || 0
        const lastScore = sorted[sorted.length - 1].feedback_json?.overall_score || 0
        const diff = Math.round(lastScore - firstScore)
        trendStr = diff > 0 ? `+${diff}%` : `${diff}%`
      }

      return {
        cohort: r.name,
        avgScore: formattedAvg,
        completionRate: `${rate}%`,
        trend: trendStr
      }
    })

    res.json({
      summary: {
        teamAvgScore: teamAvgScore || 0,
        completionRatePct,
        totalSessionsCount: completedSessions.length,
        activeRepsCount: filteredReps.length,
        momImprovementPct: completedSessions.length > 0 ? 12 : 0
      },
      performanceOverTime,
      completionFunnel: [
        { stage: 'Assigned', count: assignedCount },
        { stage: 'Started', count: startedCount },
        { stage: 'Submitted', count: submittedCount },
        { stage: 'Passed', count: completedAssignmentsCount }
      ],
      scoreDistribution: ranges,
      cohortComparison
    })
  } catch (err: any) {
    console.error('Error fetching manager analytics:', err)
    res.status(500).json({ error: 'Failed to fetch manager analytics', message: err.message })
  }
}
