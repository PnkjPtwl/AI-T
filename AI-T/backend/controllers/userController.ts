import { supabase } from '../db/supabase'
import { getModeLimit } from '../utils/modeHelper'
import { getManagerRepIds } from '../utils/getManagerRepIds'

export const getMe = async (req: any, res: any) => {
  // req.user is attached by the authenticate middleware
  // It contains { id, name, email, role, org_id }
  res.json(req.user)
}

export const getReps = async (req: any, res: any) => {
  const managerId = req.user.id

  try {
    // Only return reps assigned to this manager
    const managerRepIds = await getManagerRepIds(managerId)
    if (managerRepIds.length === 0) return res.json([])

    const { data: reps, error: repsError } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', managerRepIds)
      .order('name', { ascending: true })

    if (repsError) throw repsError
    if (reps.length === 0) return res.json([])

    // Fetch all completed sessions for these reps to calculate metrics
    const { data: allSessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('id, rep_id, completed_at, feedback_json')
      .in('rep_id', reps.map(r => r.id))
      .not('feedback_json', 'is', null)

    if (sessionsError) throw sessionsError

    const repsWithStats = reps.map(rep => {
      const repSessions = allSessions.filter(s => s.rep_id === rep.id)
        .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())

      const count = repSessions.length
      if (count === 0) {
        return {
          ...rep,
          overall_score: 0,
          trend: 'stable',
          weakest_skill: 'N/A',
          strongest_skill: 'N/A',
          last_session: null,
          session_count: 0,
          status: 'New'
        }
      }

      const avgScore = Math.round(repSessions.reduce((acc, s) => acc + (s.feedback_json?.overall_score || 0), 0) / count)

      // Trend calculation (last 3 vs previous 3)
      const recentAvg = repSessions.slice(0, 3).reduce((acc, s) => acc + (s.feedback_json?.overall_score || 0), 0) / Math.min(count, 3)
      const olderAvg = count > 3
        ? repSessions.slice(3, 6).reduce((acc, s) => acc + (s.feedback_json?.overall_score || 0), 0) / Math.min(count - 3, 3)
        : recentAvg
      const trend = recentAvg > olderAvg ? 'up' : recentAvg < olderAvg ? 'down' : 'stable'

      // Skills calculation — dynamically extract score keys from feedback
      const skillStats: any = {}
      repSessions.forEach(s => {
        const scores = s.feedback_json?.scores || {}
        Object.keys(scores).forEach(k => {
          const val = scores[k]
          const numVal = typeof val === 'object' ? (val.score || 0) : (val || 0)
          if (!skillStats[k]) skillStats[k] = { sum: 0, count: 0 }
          skillStats[k].sum += numVal
          skillStats[k].count += 1
        })
      })
      const skillAvgs = Object.keys(skillStats).map(k => ({ name: k.replace(/_/g, ' ').toUpperCase(), avg: Math.round(skillStats[k].sum / skillStats[k].count) }))
      if (skillAvgs.length === 0) skillAvgs.push({ name: 'N/A', avg: 0 })
      
      const sortedSkills = [...skillAvgs].sort((a, b) => a.avg - b.avg)
      const finalWeakest = sortedSkills[0].name
      const finalStrongest = sortedSkills[sortedSkills.length - 1].name

      // Coaching Status
      let status = 'Improving'
      if (avgScore >= 85) status = 'Excellent'
      else if (avgScore < 60) status = 'High Risk'
      else if (trend === 'down') status = 'Needs Coaching'
      else if (trend === 'up') status = 'Improving'

      return {
        ...rep,
        overall_score: avgScore,
        trend,
        weakest_skill: finalWeakest,
        strongest_skill: finalStrongest,
        last_session: repSessions[0].completed_at,
        session_count: count,
        status
      }
    })

    res.json(repsWithStats)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const getOrganizationDetails = async (req: any, res: any) => {
  const orgId = req.user.org_id

  const { data, error } = await supabase
    .from('organisations')
    .select('id, name, created_at')
    .eq('id', orgId)
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  res.json(data)
}

export const getRepSessions = async (req: any, res: any) => {
  const managerId = req.user.id
  const { repId } = req.params

  // Verify the rep belongs to this manager
  const managerRepIds = await getManagerRepIds(managerId)
  if (!managerRepIds.includes(repId)) {
    return res.status(403).json({ error: 'This rep is not assigned to you' })
  }

  const { data: rep, error: repError } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', repId)
    .single()

  if (repError || !rep) {
    return res.status(404).json({ error: 'Rep not found' })
  }

  // Fetch the sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('training_sessions')
    .select(`
      id, 
      completed_at, 
      feedback_json, 
      messages_json,
      training_scenarios (
        persona_name,
        persona_type,
        difficulty,
        context_text,
        contact_title,
        contact_company
      )
    `)
    .eq('rep_id', repId)
    .not('feedback_json', 'is', null)
    .order('completed_at', { ascending: false })

  if (sessionsError) {
    return res.status(500).json({ error: sessionsError.message })
  }

  // Filter out coaching notes and assignments from analytics
  const practiceSessions = (sessions || []).filter((s: any) =>
    !s.feedback_json?.is_note && !s.feedback_json?.is_assignment
  )

  const formatted = practiceSessions.map((session: any) => {
    const scenario = session.training_scenarios
    const scenarioName = (scenario?.contact_title && scenario?.contact_company)
      ? `${scenario.contact_title} - ${scenario.contact_company}`
      : scenario?.contact_title || scenario?.contact_company || scenario?.persona_name || 'Unknown Scenario'

    return {
      id: session.id,
      scenario_name: scenarioName,
      persona_name: scenario?.persona_name,
      persona_type: scenario?.persona_type,
      difficulty: scenario?.difficulty,
      context_text: scenario?.context_text,
      completed_at: session.completed_at,
      feedback_json: session.feedback_json,
      messages_json: session.messages_json
    }
  })

  // 1. Time-series Trend
  const trendData = practiceSessions.map((s: any) => ({
    date: new Date(s.completed_at).toLocaleDateString(),
    score: s.feedback_json?.overall_score || 0
  })).reverse().slice(-10)

  // 2. Skill Radar — dynamically extract score keys from actual feedback
  const skillStats: Record<string, { sum: number, count: number }> = {}
  practiceSessions.forEach((s: any) => {
    const scores = s.feedback_json?.scores || {}
    Object.keys(scores).forEach(k => {
      const val = scores[k];
      const numVal = typeof val === 'object' ? (val.score || 0) : (val || 0);
      if (!skillStats[k]) skillStats[k] = { sum: 0, count: 0 };
      skillStats[k].sum += numVal;
      skillStats[k].count += 1;
    })
  })
  const radarData = Object.keys(skillStats)
    .sort((a, b) => skillStats[b].count - skillStats[a].count)
    .slice(0, 6)
    .map(k => ({
      subject: k.replace(/_/g, ' ').toUpperCase(),
      A: Math.round(skillStats[k].sum / skillStats[k].count),
      fullMark: 100
    }))

  // 3. Persona Success Rates (Enriched)
  const personaMap: any = {}
  practiceSessions.forEach((s: any) => {
    const type = s.training_scenarios?.persona_type || 'Unknown'
    const name = (s.training_scenarios?.contact_title && s.training_scenarios?.contact_company)
      ? `${s.training_scenarios.contact_title} - ${s.training_scenarios.contact_company}`
      : s.training_scenarios?.contact_title || s.training_scenarios?.contact_company || s.training_scenarios?.persona_name || 'Prospect'
    const scores = s.feedback_json?.scores || {}

    if (!personaMap[type]) {
      personaMap[type] = {
        type,
        name,
        totalScore: 0,
        count: 0,
        skillStats: {} as Record<string, { sum: number, count: number }>
      }
    }

    personaMap[type].totalScore += s.feedback_json?.overall_score || 0
    personaMap[type].count += 1

    Object.keys(scores).forEach(skill => {
      const val = scores[skill];
      const numVal = typeof val === 'object' ? (val.score || 0) : (val || 0);
      if (!personaMap[type].skillStats[skill]) personaMap[type].skillStats[skill] = { sum: 0, count: 0 };
      personaMap[type].skillStats[skill].sum += numVal;
      personaMap[type].skillStats[skill].count += 1;
    })
  })

  const personaPerformanceData = Object.values(personaMap).map((v: any) => {
    const avgScore = Math.round(v.totalScore / v.count)
    const skillsList = Object.entries(v.skillStats).map(([name, stats]: any) => ({
      name: name.replace(/_/g, ' ').toUpperCase(),
      avg: Math.round(stats.sum / stats.count)
    })).sort((a, b) => b.avg - a.avg)

    return {
      type: v.type,
      persona_name: v.name,
      avgScore,
      sessionsCompleted: v.count,
      strongestSkill: skillsList[0]?.name || 'N/A',
      weakestSkill: skillsList[skillsList.length - 1]?.name || 'N/A'
    }
  })

  const avgScore = practiceSessions.length
    ? Math.round(practiceSessions.reduce((acc, s) => acc + (s.feedback_json?.overall_score || 0), 0) / practiceSessions.length)
    : 0;

  res.json({
    rep,
    sessions: formatted,
    analytics: {
      avgScore,
      sessionsCount: practiceSessions.length,
      trendData,
      radarData,
      personaPerformanceData
    }
  })
}

export const getMyAnalytics = async (req: any, res: any) => {
  const repId = req.query.repId || req.user.id
  const isManager = req.user.role === 'manager'

  // Basic security: Reps can only see their own analytics
  if (!isManager && repId !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' })
  }

  // Managers can only see analytics for their own reps
  if (isManager && repId !== req.user.id) {
    const managerRepIds = await getManagerRepIds(req.user.id)
    if (!managerRepIds.includes(repId as string)) {
      return res.status(403).json({ error: 'This rep is not assigned to you' })
    }
  }

  try {
    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select(`
        id, 
        completed_at, 
        feedback_json,
        training_scenarios (
          persona_name,
          persona_type,
          contact_title,
          contact_company
        )
      `)
      .eq('rep_id', repId)
      .not('feedback_json', 'is', null)
      .order('completed_at', { ascending: false })

    if (sessionsError) throw sessionsError

    const practiceSessions = (sessions || []).filter((s: any) =>
      !s.feedback_json?.is_note && !s.feedback_json?.is_assignment
    )

    // 1. Time-series Trend
    const trendData = practiceSessions.map((s: any) => ({
      date: new Date(s.completed_at).toLocaleDateString(),
      score: s.feedback_json?.overall_score || 0
    })).reverse().slice(-10)

    // 2. Skill Radar — dynamically extract score keys from actual feedback
    const skillStats: Record<string, { sum: number, count: number }> = {}
    practiceSessions.forEach((s: any) => {
      const scores = s.feedback_json?.scores || {}
      Object.keys(scores).forEach(k => {
        const val = scores[k];
        const numVal = typeof val === 'object' ? (val.score || 0) : (val || 0);
        if (!skillStats[k]) skillStats[k] = { sum: 0, count: 0 };
        skillStats[k].sum += numVal;
        skillStats[k].count += 1;
      })
    })
    const radarData = Object.keys(skillStats)
      .sort((a, b) => skillStats[b].count - skillStats[a].count)
      .slice(0, 6)
      .map(k => ({
        subject: k.replace(/_/g, ' ').toUpperCase(),
        A: Math.round(skillStats[k].sum / skillStats[k].count),
        fullMark: 100
      }))

    // 3. Persona Success Rates (Enriched)
    const personaMap: any = {}
    practiceSessions.forEach((s: any) => {
      const type = (s.training_scenarios as any)?.persona_type || 'Unknown'
      const name = ((s.training_scenarios as any)?.contact_title && (s.training_scenarios as any)?.contact_company)
        ? `${(s.training_scenarios as any).contact_title} - ${(s.training_scenarios as any).contact_company}`
        : (s.training_scenarios as any)?.contact_title || (s.training_scenarios as any)?.contact_company || (s.training_scenarios as any)?.persona_name || 'Prospect'
      const scores = s.feedback_json?.scores || {}

      if (!personaMap[type]) {
        personaMap[type] = {
          type,
          name,
          totalScore: 0,
          count: 0,
          skillStats: {} as Record<string, { sum: number, count: number }>
        }
      }

      personaMap[type].totalScore += s.feedback_json?.overall_score || 0
      personaMap[type].count += 1

      Object.keys(scores).forEach(skill => {
        const val = scores[skill];
        const numVal = typeof val === 'object' ? (val.score || 0) : (val || 0);
        if (!personaMap[type].skillStats[skill]) personaMap[type].skillStats[skill] = { sum: 0, count: 0 };
        personaMap[type].skillStats[skill].sum += numVal;
        personaMap[type].skillStats[skill].count += 1;
      })
    })

    const personaPerformanceData = Object.values(personaMap).map((v: any) => {
      const avgScore = Math.round(v.totalScore / v.count)
      const skills = Object.entries(v.skillStats).map(([name, stats]: any) => ({
        name: name.replace(/_/g, ' ').toUpperCase(),
        avg: Math.round(stats.sum / stats.count)
      })).sort((a, b) => b.avg - a.avg)

      return {
        type: v.type,
        persona_name: v.name,
        avgScore,
        sessionsCompleted: v.count,
        strongestSkill: skills[0]?.name || 'N/A',
        weakestSkill: skills[skills.length - 1]?.name || 'N/A'
      }
    })

    const avgScore = practiceSessions.length
      ? Math.round(practiceSessions.reduce((acc, s) => acc + (s.feedback_json?.overall_score || 0), 0) / practiceSessions.length)
      : 0;

    const bestScore = practiceSessions.length > 0
      ? Math.max(...practiceSessions.map((s: any) => s.feedback_json?.overall_score || 0))
      : 0;

    const totalPracticeSec = practiceSessions.reduce((total: number, s: any) => {
      const voiceDeliverySec = s.feedback_json?.voice_delivery?.totalDurationSec
      if (voiceDeliverySec && typeof voiceDeliverySec === 'number') return total + voiceDeliverySec
      const turns = (s.messages_json || []).length
      return total + (turns * 30)
    }, 0)
    const totalPracticeTimeHrs = Number((totalPracticeSec / 3600).toFixed(1))

    const sortedSkills = [...radarData].sort((a, b) => b.A - a.A);
    const strongestSkill = sortedSkills[0]?.subject || 'N/A';
    const weakestSkill = sortedSkills[sortedSkills.length - 1]?.subject || 'N/A';

    // Simple trend calculation (last vs second last)
    let trendValue = 0;
    if (trendData.length >= 2) {
      trendValue = trendData[trendData.length - 1].score - trendData[trendData.length - 2].score;
    }

    res.json({
      avgScore,
      bestScore,
      totalPracticeTimeHrs,
      strongestSkill,
      weakestSkill,
      trendValue,
      trendData,
      radarData,
      personaPerformanceData,
      sessionsCount: practiceSessions.length
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const getDashboardStats = async (req: any, res: any) => {
  const managerId = req.user.id
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  try {
    // 1. Total Sales Reps (only this manager's reps)
    const managerRepIds = await getManagerRepIds(managerId)
    const totalReps = managerRepIds.length

    // 2. Active Training Sessions (started but not completed in last 2 hours)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
    let activeSessionsList: any[] = []
    if (managerRepIds.length > 0) {
      const { data: activeSessionsData } = await supabase
        .from('training_sessions')
        .select('id, created_at, rep_id, users!inner(name), training_scenarios(persona_name)')
        .in('rep_id', managerRepIds)
        .is('completed_at', null)
        .gt('created_at', twoHoursAgo)

      activeSessionsList = (activeSessionsData || []).map((s: any) => ({
        id: s.id,
        rep_name: s.users?.name,
        scenario_name: s.training_scenarios?.persona_name,
        started_at: s.created_at
      }))
    }

    // 3. Performance Metrics (only for this manager's reps)
    let allSessions: any[] = []
    if (managerRepIds.length > 0) {
      const { data: sessData } = await supabase
        .from('training_sessions')
        .select('id, completed_at, feedback_json, rep_id')
        .in('rep_id', managerRepIds)
        .not('feedback_json', 'is', null)
      allSessions = sessData || []
    }

    const sessions = allSessions || []
    const thisWeekSessions = sessions.filter(s => new Date(s.completed_at) >= oneWeekAgo)
    const lastWeekSessions = sessions.filter(s => new Date(s.completed_at) >= twoWeeksAgo && new Date(s.completed_at) < oneWeekAgo)

    const calcAvg = (arr: any[]) => arr.length ? Math.round(arr.reduce((acc, s) => acc + (s.feedback_json?.overall_score || 0), 0) / arr.length) : 0
    const avgScore = calcAvg(sessions)
    const thisWeekAvg = calcAvg(thisWeekSessions)
    const lastWeekAvg = calcAvg(lastWeekSessions)

    const weeklyImprovement = lastWeekAvg > 0 ? Math.round(((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100) : 0

    // Reps needing attention (score < 60)
    const repScores: any = {}
    sessions.forEach(s => {
      if (!repScores[s.rep_id]) repScores[s.rep_id] = { total: 0, count: 0 }
      repScores[s.rep_id].total += s.feedback_json?.overall_score || 0
      repScores[s.rep_id].count += 1
    })
    const repsNeedingAttention = Object.keys(repScores).filter(rid => (repScores[rid].total / repScores[rid].count) < 60).length

    // Avg Objection Handling Score
    const objScores = sessions.map(s => s.feedback_json?.scores?.objection_handling || 0)
    const avgObjectionScore = objScores.length ? Math.round(objScores.reduce((a, b) => a + b, 0) / objScores.length) : 0

    // Avg Customer Engagement (Discovery + Closing blend)
    const engScores = sessions.map(s => ((s.feedback_json?.scores?.discovery || 0) + (s.feedback_json?.scores?.closing || 0)) / 2)
    const avgEngagementScore = engScores.length ? Math.round(engScores.reduce((a, b) => a + b, 0) / engScores.length) : 0

    // Completion Rate (Total completed vs total attempts)
    let totalAttempts = 0
    if (managerRepIds.length > 0) {
      const { count } = await supabase
        .from('training_sessions')
        .select('id', { count: 'exact', head: true })
        .in('rep_id', managerRepIds)
      totalAttempts = count || 0
    }
    const completionRate = totalAttempts ? Math.round((sessions.length / totalAttempts) * 100) : 0

    res.json({
      totalReps: totalReps || 0,
      activeSessions: activeSessionsList.length,
      activeSessionsList,
      avgTeamScore: avgScore,
      repsNeedingAttention,
      completionRate,
      avgObjectionScore,
      avgEngagementScore,
      weeklyImprovement,
      trends: {
        avgScore: thisWeekAvg >= lastWeekAvg ? 'up' : 'down',
        weeklyImprovement: weeklyImprovement >= 0 ? 'up' : 'down'
      }
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const getCoachingAlerts = async (req: any, res: any) => {
  const managerId = req.user.id

  try {
    // Only get alerts for this manager's reps
    const managerRepIds = await getManagerRepIds(managerId)
    if (managerRepIds.length === 0) return res.json([])

    const { data: reps, error: repsError } = await supabase
      .from('users')
      .select('id, name')
      .in('id', managerRepIds)

    if (repsError) throw repsError
    if (!reps || reps.length === 0) return res.json([])

    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select('rep_id, completed_at, feedback_json')
      .in('rep_id', reps.map(r => r.id))
      .not('feedback_json', 'is', null)
      .order('completed_at', { ascending: false })

    if (sessionsError) throw sessionsError

    const alerts: any[] = []

    reps.forEach(rep => {
      const repSessions = sessions.filter(s => s.rep_id === rep.id)
      if (repSessions.length === 0) return

      const recentSessions = repSessions.slice(0, 3)
      const avgScore = recentSessions.reduce((acc, s) => acc + (s.feedback_json?.overall_score || 0), 0) / recentSessions.length

      // 1. Critical: Overall low performance
      if (avgScore < 50) {
        alerts.push({
          rep_name: rep.name,
          severity: 'Critical',
          issue: 'Severe Performance Risk',
          details: `Rep is averaging ${Math.round(avgScore)}% in recent sessions.`,
          recommendation: 'Immediate intervention required. Schedule a 1-on-1 review.'
        })
      }

      // 2. High: Declining Trend
      if (repSessions.length >= 6) {
        const olderSessions = repSessions.slice(3, 6)
        const olderAvg = olderSessions.reduce((acc, s) => acc + (s.feedback_json?.overall_score || 0), 0) / 3
        if (avgScore < olderAvg - 10) {
          alerts.push({
            rep_name: rep.name,
            severity: 'High',
            issue: 'Declining Performance Trend',
            details: `Average proficiency has dropped from ${Math.round(olderAvg)}% to ${Math.round(avgScore)}%.`,
            recommendation: 'Identify if recent changes in workflow are impacting results.'
          })
        }
      }

      // 3. Medium: Weak Objection Handling
      const lowObjCount = recentSessions.filter(s => {
        const scores = s.feedback_json?.scores || {}
        const val = scores.objection___concern_handling ?? scores.objection_handling ?? 100
        const numVal = typeof val === 'object' ? (val.score || 0) : (val || 0)
        return numVal < 50 // Changed from 10 since it's a 0-100 scale usually
      }).length
      if (lowObjCount >= 2) {
        alerts.push({
          rep_name: rep.name,
          severity: 'Medium',
          issue: 'Weak Objection Handling',
          details: 'Struggling with pushback in multiple recent sessions.',
          recommendation: 'Assign "High Objection" practice modules.'
        })
      }

      // 4. Medium: Low Customer Engagement
      const avgEngagement = recentSessions.reduce((acc, s) => {
        const scores = s.feedback_json?.scores || {}
        const disc = scores.customer_understanding ?? scores.discovery ?? 100
        const discVal = typeof disc === 'object' ? (disc.score || 0) : (disc || 0)
        const close = scores.next_steps___call_effectiveness ?? scores.closing ?? 100
        const closeVal = typeof close === 'object' ? (close.score || 0) : (close || 0)
        return acc + (discVal + closeVal) / 2
      }, 0) / recentSessions.length
      if (avgEngagement < 50) {
        alerts.push({
          rep_name: rep.name,
          severity: 'Medium',
          issue: 'Low Customer Engagement',
          details: 'Weak discovery phase and soft closing attempts.',
          recommendation: 'Coaching on asking open-ended discovery questions.'
        })
      }
    })

    // 5. Assignment Intelligence
    const { data: assignments } = await supabase
      .from('training_assignments')
      .select(`
        *,
        rep:users!training_assignments_rep_id_fkey (name),
        scenario:training_scenarios!training_assignments_scenario_id_fkey (persona_name)
      `)
      .eq('manager_id', managerId)
      .eq('status', 'Completed')
      .order('completed_at', { ascending: false })
      .limit(10)

    assignments?.forEach(a => {
      const repName = a.rep?.name || 'Rep'
      const scenarioName = a.scenario?.persona_name || 'Scenario'
      const completedDate = new Date(a.completed_at)
      const deadlineDate = new Date(a.deadline)
      const isEarly = completedDate < deadlineDate

      // Since completed_score was removed from DB, we might need to skip score-based alerts
      // or derive them from elsewhere. For now, we just skip the High-Performance alert.

      if (isEarly) {
        const daysEarly = Math.ceil((deadlineDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24))
        alerts.push({
          rep_name: repName,
          severity: 'Low',
          issue: 'Early Mission Completion',
          details: `Completed "${scenarioName}" ${daysEarly} day(s) before the deadline.`,
          recommendation: 'Great initiative. Keep assigning challenging content.'
        })
      }
    })

    const severityOrder: any = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 }
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    res.json(alerts)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const getTeamAnalytics = async (req: any, res: any) => {
  const managerId = req.user.id

  try {
    // Only get data for this manager's reps
    const managerRepIds = await getManagerRepIds(managerId)

    let sessions: any[] = []
    if (managerRepIds.length > 0) {
      const { data: sessData, error: sessionsError } = await supabase
        .from('training_sessions')
        .select(`
          id, 
          rep_id,
          completed_at, 
          feedback_json, 
          training_scenarios (
            persona_name,
            persona_type,
            difficulty
          ),
          rep:users!rep_id(name, org_id)
        `)
        .in('rep_id', managerRepIds)
        .order('completed_at', { ascending: true })

      if (sessionsError) throw sessionsError
      sessions = sessData || []
    }

    // Pull assignments for this manager
    const { data: assignments } = await supabase
      .from('training_assignments')
      .select(`
        id, rep_id, status, completed_at, session_id,
        rep:users!rep_id(name, org_id),
        scenario:training_scenarios(persona_name, persona_type, difficulty)
      `)
      .eq('manager_id', managerId)

    // Get only this manager's reps
    let allReps: any[] = []
    if (managerRepIds.length > 0) {
      const { data: repsData } = await supabase
        .from('users')
        .select('id, name, org_id')
        .in('id', managerRepIds)
      allReps = repsData || []
    }

    // All sessions are already manager-scoped from the query above
    const orgSessions = (sessions || []).filter((s: any) =>
      !s.feedback_json?.is_note
    )

    // Build rep assignment stats (works even without feedback_json)
    const repStatsMap: Record<string, any> = {}

      // Initialize with all known reps
      ; (allReps || []).forEach((rep: any) => {
        repStatsMap[rep.id] = {
          name: rep.name,
          id: rep.id,
          totalAssignments: 0,
          completedAssignments: 0,
          totalScore: 0,
          scoredSessions: 0,
          latestFeedback: ''
        }
      })

      // Count assignments per rep
      ; (assignments || []).forEach((a: any) => {
        const repId = a.rep_id
        if (!repStatsMap[repId]) {
          repStatsMap[repId] = {
            name: (a.rep as any)?.name || 'Unknown',
            id: repId,
            totalAssignments: 0,
            completedAssignments: 0,
            totalScore: 0,
            scoredSessions: 0,
            latestFeedback: ''
          }
        }
        repStatsMap[repId].totalAssignments++
        if (a.status === 'Completed') repStatsMap[repId].completedAssignments++
      })

    // Add session feedback data
    orgSessions.forEach((s: any) => {
      const repId = s.rep_id
      const score = s.feedback_json?.overall_score
      const summary = s.feedback_json?.summary || s.feedback_json?.coaching_notes || ''

      if (!repStatsMap[repId]) {
        repStatsMap[repId] = {
          name: (s.rep as any)?.name || 'Unknown',
          id: repId,
          totalAssignments: 0,
          completedAssignments: 0,
          totalScore: 0,
          scoredSessions: 0,
          latestFeedback: ''
        }
      }

      if (score && score > 0) {
        repStatsMap[repId].totalScore += score
        repStatsMap[repId].scoredSessions++
      }
      if (summary) repStatsMap[repId].latestFeedback = summary
    })

    // Build persona comparison from sessions (or assignments if sessions are empty)
    const personaMap: Record<string, any> = {}

    // Use sessions with scores if available
    const scoredSessions = orgSessions.filter((s: any) => s.feedback_json?.overall_score > 0)

    if (scoredSessions.length > 0) {
      scoredSessions.forEach((s: any) => {
        const scenario = s.training_scenarios as any
        const type = scenario?.persona_type || scenario?.persona_name || 'General Prospect'
        const repName = (s.rep as any)?.name || 'Unknown'
        const score = s.feedback_json?.overall_score || 0

        if (!personaMap[type]) personaMap[type] = { type, total: 0, count: 0, reps: {} }
        personaMap[type].total += score
        personaMap[type].count++
        if (!personaMap[type].reps[repName]) personaMap[type].reps[repName] = { total: 0, count: 0 }
        personaMap[type].reps[repName].total += score
        personaMap[type].reps[repName].count++
      })
    } else {
      // Fall back to assignment-based persona data (show completion rate as score)
      ; (assignments || []).forEach((a: any) => {
        const scenario = a.scenario as any
        const type = scenario?.persona_type || scenario?.persona_name || 'General Prospect'
        const repName = (a.rep as any)?.name || 'Unknown'
        const score = a.status === 'Completed' ? 100 : 0

        if (!personaMap[type]) personaMap[type] = { type, total: 0, count: 0, reps: {} }
        personaMap[type].total += score
        personaMap[type].count++
        if (!personaMap[type].reps[repName]) personaMap[type].reps[repName] = { total: 0, count: 0 }
        personaMap[type].reps[repName].total += score
        personaMap[type].reps[repName].count++
      })
    }

    const personaComparisonData = Object.values(personaMap).map((v: any) => {
      const avgScore = Math.round(v.total / v.count)
      const repAverages = Object.entries(v.reps).map(([name, rd]: any) => ({
        name,
        score: Math.round(rd.total / rd.count)
      })).sort((a, b) => b.score - a.score)

      return {
        type: v.type,
        avgScore,
        bestRep: repAverages[0] || null,
        worstRep: repAverages[repAverages.length - 1] || null,
        sessionCount: v.count
      }
    }).sort((a, b) => b.avgScore - a.avgScore)

    const personaPerformanceData = personaComparisonData.map(c => ({ type: c.type, avgScore: c.avgScore }))

    // Rep Percentile Ranking — uses avg score from sessions if available, else completion rate from assignments
    const repList = Object.values(repStatsMap)
      .filter((r: any) => r.totalAssignments > 0 || r.scoredSessions > 0)
      .map((r: any) => {
        const avgScore = r.scoredSessions > 0
          ? Math.round(r.totalScore / r.scoredSessions)
          : Math.round((r.completedAssignments / Math.max(r.totalAssignments, 1)) * 100)
        return {
          name: r.name,
          avgScore,
          completionRate: r.totalAssignments > 0 ? Math.round((r.completedAssignments / r.totalAssignments) * 100) : 0,
          totalSessions: r.scoredSessions + r.completedAssignments,
          aiRating: r.latestFeedback || `${r.completedAssignments}/${r.totalAssignments} assignments completed`
        }
      })
      .sort((a: any, b: any) => b.avgScore - a.avgScore)

    const totalReps = repList.length
    const repPercentileData = repList.map((rep: any, index: number) => {
      const percentile = totalReps > 1 ? Math.round(((totalReps - index - 1) / (totalReps - 1)) * 100) : 100
      return { ...rep, percentile }
    })

    // Generate summary stats  
    const totalAssignments = (assignments || []).length
    const completedAssignments = (assignments || []).filter((a: any) => a.status === 'Completed').length
    const overdueAssignments = (assignments || []).filter((a: any) => a.status === 'Overdue').length

    // AI-generated insights from available data
    const insights: any[] = []
    const recommendations: any[] = []

    if (completedAssignments > 0 && totalAssignments > 0) {
      const rate = Math.round((completedAssignments / totalAssignments) * 100)
      if (rate === 100) {
        insights.push({ type: 'Team Strength', text: `All ${totalAssignments} assigned training sessions have been completed. Team is on track.`, icon: '🏆' })
      } else if (rate >= 70) {
        insights.push({ type: 'Progress', text: `${rate}% assignment completion rate. ${totalAssignments - completedAssignments} session(s) still pending.`, icon: '📊' })
      } else {
        insights.push({ type: 'Alert', text: `Only ${rate}% of assignments are completed. Consider following up with reps.`, icon: '⚠️' })
        recommendations.push({ action: 'Follow Up', text: 'Send reminders to reps with incomplete assignments.', priority: 'High' })
      }
    }

    if (overdueAssignments > 0) {
      insights.push({ type: 'Alert', text: `${overdueAssignments} assignment(s) are overdue and need immediate attention.`, icon: '🚨' })
      recommendations.push({ action: 'Escalate', text: 'Review overdue assignments and adjust deadlines or reassign as needed.', priority: 'Critical' })
    }

    if (repPercentileData.length > 1) {
      const top = repPercentileData[0]
      const bottom = repPercentileData[repPercentileData.length - 1]
      if (top.avgScore - bottom.avgScore > 30) {
        insights.push({
          type: 'Skill Gap',
          text: `There is a ${top.avgScore - bottom.avgScore}% performance gap between ${top.name} and ${bottom.name}. Consider targeted coaching.`,
          icon: '📉'
        })
        recommendations.push({ action: 'Coaching Session', text: `Pair ${bottom.name} with ${top.name} for peer coaching on key scenarios.`, priority: 'Medium' })
      }
    }

    if (personaComparisonData.length > 0) {
      const hardest = [...personaComparisonData].sort((a, b) => a.avgScore - b.avgScore)[0]
      if (hardest && hardest.avgScore < 75) {
        insights.push({ type: 'Complexity Alert', text: `"${hardest.type}" is the most challenging persona with ${hardest.avgScore}% avg score. Additional practice may be needed.`, icon: '👤' })
        recommendations.push({ action: 'Assign Practice', text: `Assign additional "${hardest.type}" scenarios to reps scoring below 75%.`, priority: 'Medium' })
      }
    }

    if (insights.length === 0) {
      insights.push({ type: 'Info', text: 'Complete training sessions with AI feedback to unlock performance insights.', icon: 'ℹ️' })
    }

    // Trend data from sessions (if any have scores)
    const trendMap: any = {}
    orgSessions.forEach(s => {
      const date = new Date(s.completed_at).toLocaleDateString()
      if (!trendMap[date]) trendMap[date] = { date, total: 0, count: 0 }
      trendMap[date].total += s.feedback_json?.overall_score || 0
      trendMap[date].count += 1
    })
    const trendData = Object.values(trendMap).map((v: any) => ({
      date: v.date,
      score: Math.round(v.total / v.count)
    })).slice(-14)

    res.json({
      trendData,
      radarData: [],
      scenarioData: [],
      heatmapData: [],
      personaPerformanceData,
      personaComparisonData,
      repPercentileData,
      summaryStats: { totalAssignments, completedAssignments, overdueAssignments, totalReps: repList.length },
      insights,
      recommendations
    })

  } catch (err: any) {
    console.error('[getTeamAnalytics] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

const normalizeModeForDb = (modeStr?: string): string => {
  if (!modeStr) return 'coach';
  const l = modeStr.toLowerCase().trim();
  if (l.includes('exam')) return 'exam';
  if (l.includes('learning')) return 'learning';
  return 'coach';
};

const normalizeModeForDisplay = (modeStr?: string): string => {
  if (!modeStr) return 'Coach Mode';
  const l = modeStr.toLowerCase().trim();
  if (l === 'exam' || l.includes('exam')) return 'Exam Mode';
  if (l === 'learning' || l.includes('learning')) return 'Learning Mode';
  return 'Coach Mode';
};

export const assignTraining = async (req: any, res: any) => {
  const { repIds, scenarioId, deadline, priority, avatarType, trainingMode, notes } = req.body
  const managerId = req.user.id

  console.log("--- ASSIGN TRAINING DEBUG START ---");
  console.log("Payload:", { repIds, scenarioId, deadline, priority, avatarType, trainingMode, notes });
  console.log("Manager Context:", { managerId, org_id: req.user.org_id });

  try {
    const isUuid = (str: string) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    let targetScenarioId = scenarioId;
    if (!isUuid(targetScenarioId)) {
      const { data: latestScenario } = await supabase
        .from('training_scenarios')
        .select('id, persona_name')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestScenario) {
        targetScenarioId = latestScenario.id;
      }
    }

    // 1. Verify scenario exists
    const { data: scenario, error: scenarioError } = await supabase
      .from('training_scenarios')
      .select('id, persona_name')
      .eq('id', targetScenarioId)
      .single();

    if (scenarioError || !scenario) {
      console.error("Scenario Validation Failed:", scenarioError);
      return res.status(404).json({ error: 'Selected scenario not found.' });
    }

    // 2. Filter / resolve valid rep UUIDs
    let validRepIds: string[] = Array.isArray(repIds) ? repIds.filter((id: string) => isUuid(id)) : [];

    // Validate that all rep IDs belong to this manager
    const managerRepIds = await getManagerRepIds(managerId);
    validRepIds = validRepIds.filter(id => managerRepIds.includes(id));

    if (validRepIds.length === 0) {
      return res.status(400).json({ error: 'No valid sales representatives found. Ensure reps are assigned to you by the admin.' });
    }

    if (validRepIds.length === 0) {
      return res.status(400).json({ error: 'No valid sales representatives found to assign.' });
    }

    const { data: existingAssignments } = await supabase
      .from('training_assignments')
      .select('rep_id')
      .eq('scenario_id', targetScenarioId)
      .in('rep_id', validRepIds)
      .neq('status', 'Completed');

    if (existingAssignments && existingAssignments.length > 0) {
      return res.status(400).json({ error: 'One or more selected representatives already have an active assignment for this training scenario.' });
    }

    const assignments = validRepIds.map((repId: string) => ({
      rep_id: repId,
      scenario_id: targetScenarioId,
      manager_id: managerId,
      status: 'Pending',
      priority: priority || 'Medium',
      deadline: deadline ? new Date(deadline).toISOString() : new Date(Date.now() + 14 * 86400000).toISOString(),
      avatar_type: avatarType || 'female',
      training_mode: normalizeModeForDb(trainingMode),
      notes: notes || ''
    }))

    console.log(`Attempting to insert ${assignments.length} assignments...`);

    // Resilient insertion retries: strip missing optional schema columns automatically if PostgREST errors occur
    let insertedData;
    let currentPayload: any[] = assignments;
    let result = await supabase.from('training_assignments').insert(currentPayload).select();

    if (result.error) {
      console.warn("[assignTraining] Initial insert failed:", result.error.message);
      const optionalKeys = ['notes', 'avatar_type', 'priority'];
      for (const keyToStrip of optionalKeys) {
        if (result.error && (result.error.message.includes(keyToStrip) || result.error.code === 'PGRST204')) {
          currentPayload = currentPayload.map(item => {
            const copy = { ...item };
            delete copy[keyToStrip];
            return copy;
          });
          console.warn(`[assignTraining] Retrying insert without column '${keyToStrip}'...`);
          result = await supabase.from('training_assignments').insert(currentPayload).select();
          if (!result.error) break;
        }
      }
    }

    if (result.error) {
      console.error("Supabase Insertion Error:", result.error);
      throw result.error;
    }

    insertedData = result.data;
    console.log("Successfully inserted assignments:", insertedData);
    console.log("--- ASSIGN TRAINING DEBUG END ---");

    res.json({
      success: true,
      message: `Successfully assigned "${scenario.persona_name}" to ${validRepIds.length} representative(s).`,
      count: validRepIds.length
    })
  } catch (err: any) {
    console.error("CRITICAL ERROR in assignTraining:", err);
    res.status(500).json({ error: err.message })
  }
}

export const getMyAssignments = async (req: any, res: any) => {
  const repId = req.user.id
  console.log(`[getMyAssignments] Fetching for rep_id: ${repId}`);

  try {
    const { data: rawAssignments, error: assignErr } = await supabase
      .from('training_assignments')
      .select('*')
      .eq('rep_id', repId)
      .order('created_at', { ascending: false });

    if (assignErr) throw assignErr;

    const assignmentsList = rawAssignments || [];
    const scenarioIds = Array.from(new Set(assignmentsList.map((a: any) => a.scenario_id).filter(Boolean)));
    const sessionIds = assignmentsList.map((a: any) => a.session_id).filter(Boolean);

    let scenarioMap: Record<string, any> = {};
    if (scenarioIds.length > 0) {
      const { data: scenData } = await supabase
        .from('training_scenarios')
        .select('id, persona_name, difficulty, contact_title, contact_company')
        .in('id', scenarioIds);
      if (scenData) {
        scenData.forEach((s: any) => { scenarioMap[s.id] = s; });
      }
    }

    let sessionMap: Record<string, any> = {};
    if (sessionIds.length > 0) {
      const { data: sessionsData } = await supabase
        .from('training_sessions')
        .select('id, feedback_json')
        .in('id', sessionIds);
      if (sessionsData) {
        sessionsData.forEach((s: any) => { sessionMap[s.id] = s.feedback_json; });
      }
    }

    const { data: repSessionsData } = await supabase
      .from('training_sessions')
      .select('id, rep_id, scenario_id, created_at, completed_at, status, feedback_json')
      .eq('rep_id', repId);

    const now = new Date();
    const assignments = assignmentsList.map((a: any) => {
      const deadlineDate = a.deadline ? new Date(a.deadline) : null;
      let status = a.status || 'Pending';
      const assignCreatedAt = new Date(a.created_at).getTime();
      
      // Find the created_at of the NEXT assignment for this scenario, to define a strict time window
      const futureAssignments = assignmentsList.filter((other: any) => 
        other.scenario_id === a.scenario_id && 
        new Date(other.created_at).getTime() > assignCreatedAt
      );
      const nextAssignCreatedAt = futureAssignments.length > 0 
        ? Math.min(...futureAssignments.map((other: any) => new Date(other.created_at).getTime()))
        : Infinity;

      // Find all completed sessions that belong to THIS assignment's time window
      const matchedSessions = (repSessionsData || [])
        .filter((s: any) =>
          s.scenario_id === a.scenario_id &&
          s.feedback_json !== null &&
          new Date(s.created_at).getTime() >= assignCreatedAt &&
          new Date(s.created_at).getTime() < nextAssignCreatedAt
        )
        .sort((x: any, y: any) => new Date(y.completed_at || y.created_at).getTime() - new Date(x.completed_at || x.created_at).getTime());

      // Always use the LATEST session for the score and report button within this assignment's window
      const latestSession = matchedSessions.length > 0 ? matchedSessions[0] : null;
      const feedback = latestSession ? latestSession.feedback_json : (a.session_id ? sessionMap[a.session_id] : null);
      const score = feedback?.overall_score || 0;
      
      // Override the session_id so the 'Report' button opens the latest attempt
      if (latestSession) {
        a.session_id = latestSession.id;
      }

      if (a.status === 'Completed' || (latestSession && latestSession.status === 'Completed')) {
        status = 'Completed';
      } else if (deadlineDate && deadlineDate < now) {
        status = 'Overdue';
      }

      const scenario = scenarioMap[a.scenario_id] || {};
      const personaName = scenario.persona_name || scenario.contact_title || 'Prospect';
      const company = scenario.contact_company || 'Company';

      let rawAttemptsCount = matchedSessions.length;
      if (rawAttemptsCount === 0 && a.status === 'Completed' && a.session_id) {
        rawAttemptsCount = 1;
      }
      const maxAttempts = getModeLimit(a.training_mode);
      const attemptsCount = Math.min(rawAttemptsCount, maxAttempts);
      const isLimitReached = a.status === 'Completed' || attemptsCount >= maxAttempts;

      // Best score across all matched sessions
      const bestScore = matchedSessions.reduce((best: number, s: any) => {
        const sc = s.feedback_json?.overall_score
        return typeof sc === 'number' && sc > best ? sc : best
      }, 0)
      const displayScore = bestScore || score  // fall back to linked session score


      return {
        ...a,
        status,
        score: displayScore,
        attempts_count: attemptsCount,
        attemptsCount,
        max_attempts: maxAttempts,
        maxAttempts,
        is_limit_reached: isLimitReached,
        isLimitReached,
        training_mode: normalizeModeForDisplay(a.training_mode),
        assigned_by: 'Manager',
        persona_name: personaName,
        company,
        scenario_name: scenario.persona_name || scenario.contact_title || 'Training Scenario',
        scenario
      };
    });

    console.log(`[getMyAssignments] Transformed ${assignments.length} assignments for rep ${repId}`);
    res.json(assignments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export const getTeamAssignments = async (req: any, res: any) => {
  const managerId = req.user.id
  console.log(`[getTeamAssignments] Fetching for manager_id: ${managerId}`);

  try {
    // CRITICAL FIX: Only fetch assignments created by THIS manager
    const { data: rawAssignments, error: fetchErr } = await supabase
      .from('training_assignments')
      .select('*')
      .eq('manager_id', managerId)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      console.error("[getTeamAssignments] Query error:", fetchErr);
      throw fetchErr;
    }

    const assignmentsList = rawAssignments || [];
    const repIds = Array.from(new Set(assignmentsList.map((a: any) => a.rep_id).filter(Boolean)));
    const scenarioIds = Array.from(new Set(assignmentsList.map((a: any) => a.scenario_id).filter(Boolean)));

    let repMap: Record<string, any> = {};
    if (repIds.length > 0) {
      const { data: repsData } = await supabase
        .from('users')
        .select('id, name, email, role')
        .in('id', repIds);
      if (repsData) {
        repsData.forEach((r: any) => { repMap[r.id] = r; });
      }
    }

    let scenarioMap: Record<string, any> = {};
    if (scenarioIds.length > 0) {
      const { data: scenData } = await supabase
        .from('training_scenarios')
        .select('id, persona_name, difficulty, contact_title, contact_company')
        .in('id', scenarioIds);
      if (scenData) {
        scenData.forEach((s: any) => { scenarioMap[s.id] = s; });
      }
    }

    const sessionIds = assignmentsList.map((a: any) => a.session_id).filter(Boolean);
    let sessionMap: Record<string, any> = {};
    if (sessionIds.length > 0) {
      const { data: sessionsData } = await supabase
        .from('training_sessions')
        .select('id, feedback_json')
        .in('id', sessionIds);
      if (sessionsData) {
        sessionsData.forEach((s: any) => { sessionMap[s.id] = s.feedback_json; });
      }
    }

    const { data: teamSessionsData } = await supabase
      .from('training_sessions')
      .select('id, rep_id, scenario_id, feedback_json, created_at, completed_at');

    const now = new Date();
    const transformed = assignmentsList.map((a: any) => {
      const rep = repMap[a.rep_id] || {};
      const scenario = scenarioMap[a.scenario_id] || {};

      const deadlineDate = a.deadline ? new Date(a.deadline) : null;
      let status = a.status || 'Pending';
      if (status !== 'Completed' && deadlineDate && deadlineDate < now) {
        status = 'Overdue';
      }

      const personaName = scenario.contact_title || scenario.persona_name || 'Prospect';
      const company = scenario.contact_company || 'Company';
      const scenarioName = scenario.persona_name || scenario.contact_title || 'Training Scenario';

      const assignCreatedAt = new Date(a.created_at).getTime();
      
      const futureAssignments = assignmentsList.filter((other: any) => 
        other.scenario_id === a.scenario_id && 
        other.rep_id === a.rep_id &&
        new Date(other.created_at).getTime() > assignCreatedAt
      );
      const nextAssignCreatedAt = futureAssignments.length > 0 
        ? Math.min(...futureAssignments.map((other: any) => new Date(other.created_at).getTime()))
        : Infinity;

      const matchedSessions = (teamSessionsData || []).filter((s: any) =>
        s.rep_id === a.rep_id && 
        s.scenario_id === a.scenario_id &&
        new Date(s.created_at).getTime() >= assignCreatedAt &&
        new Date(s.created_at).getTime() < nextAssignCreatedAt
      );
      
      const completedSessions = matchedSessions.filter((s: any) => s.completed_at !== null);
      
      let bestScore: number | null = null;
      let latestFeedback: any = null;
      let timePracticedMins = 0;
      
      // Only count completed sessions for time. Cap each at 180 min to avoid stale sessions skewing data.
      completedSessions.forEach((s: any) => {
        if (s.created_at && s.completed_at) {
          const mins = Math.round((new Date(s.completed_at).getTime() - new Date(s.created_at).getTime()) / 60000);
          timePracticedMins += Math.min(mins, 180);
        }
      });

      if (completedSessions.length > 0) {
        completedSessions.sort((x: any, y: any) => new Date(y.completed_at).getTime() - new Date(x.completed_at).getTime());
        latestFeedback = completedSessions[0].feedback_json;
        bestScore = Math.max(...completedSessions.map((s: any) => s.feedback_json?.overall_score || 0));
      }

      const attemptsCount = matchedSessions.length;
      const maxAttempts = getModeLimit(a.training_mode);

      return {
        id: a.id,
        rep_id: a.rep_id,
        scenario_id: a.scenario_id,
        session_id: a.session_id,
        status,
        priority: a.priority || 'Medium',
        deadline: a.deadline,
        created_at: a.created_at,
        training_mode: normalizeModeForDisplay(a.training_mode),
        score: bestScore,
        best_score: bestScore,
        completed_at: completedSessions.length > 0 ? completedSessions[0].completed_at : null,
        time_practiced_mins: timePracticedMins,
        feedback: latestFeedback,
        strengths: latestFeedback?.strengths || [],
        skill_gaps: latestFeedback?.improvements || latestFeedback?.areas_for_improvement || [],
        recent_activity: [
          ...completedSessions.slice(0, 5).map((s: any) => ({
            text: `Session completed — Score: ${s.feedback_json?.overall_score ?? 'N/A'}%`,
            time: new Date(s.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            color: 'bg-green-500'
          })),
          {
            text: 'Assignment created',
            time: a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A',
            color: 'bg-purple-500'
          }
        ],
        attempts_count: attemptsCount,
        attemptsCount,
        max_attempts: maxAttempts,
        maxAttempts,
        is_limit_reached: attemptsCount >= maxAttempts,
        isLimitReached: attemptsCount >= maxAttempts,
        rep_name: rep.name || 'Sales Rep',
        rep_role: rep.role || 'Sales Representative',
        persona_name: personaName,
        company,
        scenario_title: scenarioName,
        scenario_name: scenarioName,
        scenario,
        difficulty: scenario.difficulty || 'Medium'
      };
    });

    console.log(`[getTeamAssignments] Successfully returned ${transformed.length} assignments.`);
    res.json(transformed);
  } catch (err: any) {
    console.error("Critical Error in getTeamAssignments:", err);
    res.status(500).json({ error: err.message });
  }
}

export const updateAssignment = async (req: any, res: any) => {
  const { assignmentId } = req.params
  const { deadline, priority, status, rep_id, scenario_id } = req.body
  const managerId = req.user.id

  try {
    let finalStatus = status;

    // Auto-reset status from Overdue if deadline is extended
    if (status === 'Overdue') {
      const newDeadlineDate = new Date(deadline);
      const now = new Date();
      if (newDeadlineDate > now) {
        finalStatus = 'Pending';
      }
    }

    const { data, error } = await supabase
      .from('training_assignments')
      .update({
        deadline,
        priority,
        status: finalStatus,
        rep_id,
        scenario_id
      })
      .eq('id', assignmentId)
      .eq('manager_id', managerId)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const deleteAssignment = async (req: any, res: any) => {
  const { assignmentId } = req.params
  const managerId = req.user.id

  try {
    const { error } = await supabase
      .from('training_assignments')
      .delete()
      .eq('id', assignmentId)
      .eq('manager_id', managerId)

    if (error) throw error
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const addNote = async (req: any, res: any) => {
  const { repId } = req.params
  const { content, priority } = req.body
  const managerId = req.user.id

  try {
    // Verify rep belongs to this manager
    const managerRepIds = await getManagerRepIds(managerId)
    if (!managerRepIds.includes(repId)) {
      return res.status(403).json({ error: 'This rep is not assigned to you' })
    }

    // Fetch a placeholder scenario ID to satisfy DB constraints
    const { data: scenarios } = await supabase.from('training_scenarios').select('id').limit(1)
    const placeholderScenarioId = scenarios?.[0]?.id

    const { error } = await supabase
      .from('training_sessions')
      .insert([{
        rep_id: repId,
        scenario_id: placeholderScenarioId,
        feedback_json: {
          content,
          priority: priority || 'Medium',
          assigned_by: managerId,
          is_note: true
        }
      }])

    if (error) throw error

    res.json({ message: '✅ Note sent successfully' })
  } catch (err: any) {
    console.error('ADD_NOTE_ERROR:', err)
    res.status(500).json({ error: 'Failed to send note. Please try again.' })
  }
}

export const getRepNotes = async (req: any, res: any) => {
  const { repId } = req.params
  const managerId = req.user.id

  // Verify rep belongs to this manager
  const managerRepIds = await getManagerRepIds(managerId)
  if (!managerRepIds.includes(repId)) {
    return res.status(403).json({ error: 'This rep is not assigned to you' })
  }

  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .select(`
        id, 
        feedback_json, 
        created_at
      `)
      .eq('rep_id', repId)
      .not('feedback_json', 'is', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    const notes = data.filter((n: any) => n.feedback_json?.is_note === true)

    const managerIds = [...new Set(notes.map(n => n.feedback_json?.assigned_by))].filter(Boolean)
    const { data: managers } = await supabase.from('users').select('id, name, role').in('id', managerIds)
    const managerMap = Object.fromEntries(managers?.map(m => [m.id, { name: m.name, role: m.role }]) || [])

    const formatted = notes.map(n => ({
      id: n.id,
      note_text: n.feedback_json?.content,
      priority: n.feedback_json?.priority || 'Medium',
      created_at: n.created_at,
      manager_name: managerMap[n.feedback_json?.assigned_by]?.name || 'Manager',
      manager_role: managerMap[n.feedback_json?.assigned_by]?.role || 'Sales Manager'
    }))

    res.json(formatted)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const getSentNotes = async (req: any, res: any) => {
  const managerId = req.user.id

  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .select(`
        id, 
        feedback_json, 
        created_at,
        rep_id,
        users!training_sessions_rep_id_fkey (
          name,
          role
        )
      `)
      .not('feedback_json', 'is', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Filter for notes assigned by THIS manager
    const notes = data
      .filter((s: any) => s.feedback_json?.is_note === true && s.feedback_json?.assigned_by === managerId)
      .map((s: any) => ({
        id: s.id,
        rep_id: s.rep_id,
        rep_name: (s.users as any)?.name || 'Unknown Rep',
        rep_role: (s.users as any)?.role || 'Sales Representative',
        content: s.feedback_json.content,
        priority: s.feedback_json.priority || 'Medium',
        created_at: s.created_at
      }))

    res.json(notes)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const getMyNotes = async (req: any, res: any) => {
  const repId = req.user.id

  try {
    const { data, error } = await supabase
      .from('training_sessions')
      .select(`
        id, 
        feedback_json, 
        created_at
      `)
      .eq('rep_id', repId)
      .not('feedback_json', 'is', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    const notes = data.filter((n: any) => n.feedback_json?.is_note === true)

    const managerIds = [...new Set(notes.map(n => n.feedback_json?.assigned_by))].filter(Boolean)
    const { data: managers } = await supabase.from('users').select('id, name, role').in('id', managerIds)
    const managerMap = Object.fromEntries(managers?.map(m => [m.id, { name: m.name, role: m.role }]) || [])

    const formatted = notes.map(n => ({
      id: n.id,
      note_text: n.feedback_json?.content,
      priority: n.feedback_json?.priority || 'Medium',
      created_at: n.created_at,
      manager_name: managerMap[n.feedback_json?.assigned_by]?.name || 'Manager',
      manager_role: managerMap[n.feedback_json?.assigned_by]?.role || 'Sales Manager'
    }))

    res.json(formatted)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}
export const completeAssignment = async (req: any, res: any) => {
  const { assignmentId } = req.body
  const repId = req.user.id

  if (!assignmentId) {
    return res.status(400).json({ error: 'assignmentId is required' })
  }

  try {
    console.log(`[completeAssignment] Marking assignment ${assignmentId} as Completed for rep ${repId}`);

    const { data, error } = await supabase
      .from('training_assignments')
      .update({
        status: 'Completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', assignmentId)
      .eq('rep_id', repId)
      .select()
      .single()

    if (error) {
      console.error(`[completeAssignment] DB Error:`, error.message);
      throw error
    }

    res.json({
      success: true,
      message: 'Mission marked as completed.',
      assignment: data
    })
  } catch (err: any) {
    console.error('[completeAssignment] CRITICAL Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
