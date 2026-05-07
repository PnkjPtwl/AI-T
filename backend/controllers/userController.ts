import { supabase } from '../db/supabase'

export const getMe = async (req: any, res: any) => {
  // req.user is attached by the authenticate middleware
  // It contains { id, name, email, role, org_id }
  res.json(req.user)
}

export const getReps = async (req: any, res: any) => {
  const orgId = req.user.org_id

  try {
    const { data: reps, error: repsError } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('org_id', orgId)
      .eq('role', 'rep')
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

      // Skills calculation
      const skillTotals: any = { opening: 0, discovery: 0, objection_handling: 0, talk_ratio: 0, closing: 0 }
      repSessions.forEach(s => {
        const scores = s.feedback_json?.scores || {}
        Object.keys(skillTotals).forEach(k => skillTotals[k] += scores[k] || 0)
      })
      const skillAvgs = Object.keys(skillTotals).map(k => ({ name: k.replace('_', ' ').toUpperCase(), avg: skillTotals[k] / count }))
      const strongest = skillAvgs.sort((a, b) => b.avg - a.avg)[0].name
      const weakest = skillAvgs.sort((a, b) => a.avg - b.avg)[skillAvgs.length - 1].name // Fix: lowest score is at index 0 after sort

      // Re-sort correctly
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
  const orgId = req.user.org_id
  const { repId } = req.params

  // Verify the rep belongs to the manager's organization
  const { data: rep, error: repError } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', repId)
    .eq('org_id', orgId)
    .single()

  if (repError || !rep) {
    return res.status(404).json({ error: 'Rep not found in your organization' })
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
        context_text
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
    const match = scenario?.context_text?.match(/\[SCENARIO:\s*(.*?)\]/)
    const scenarioName = match ? match[1] : (scenario?.persona_type || 'Unknown')

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

  // 2. Skill Radar
  const skills = {
    empathy: 0,
    objection_handling: 0,
    confidence: 0,
    listening: 0,
    executive_communication: 0,
    questioning_ability: 0
  }
  practiceSessions.forEach((s: any) => {
    const scores = s.feedback_json?.scores || {}
    Object.keys(skills).forEach(k => {
      // Use new metric if exists, otherwise map from old if possible, or 0
      if (scores[k] !== undefined) {
        (skills as any)[k] += scores[k]
      } else {
        // Simple mapping for old data consistency
        if (k === 'questioning_ability') (skills as any)[k] += (scores.discovery || 0) * 5
        if (k === 'listening') (skills as any)[k] += (scores.talk_ratio || 0) * 5
        if (k === 'objection_handling') (skills as any)[k] += (scores.objection_handling || 0) * 5
        if (k === 'executive_communication') (skills as any)[k] += (scores.closing || 0) * 5
        if (k === 'confidence' || k === 'empathy') (skills as any)[k] += (scores.opening || 0) * 5
      }
    })
  })
  const radarData = Object.keys(skills).map(k => ({
    subject: k.replace('_', ' ').toUpperCase(),
    A: practiceSessions.length ? Math.round((skills as any)[k] / practiceSessions.length) : 0,
    fullMark: 100
  }))

  // 3. Persona Success Rates (Enriched)
  const personaMap: any = {}
  practiceSessions.forEach((s: any) => {
    const type = s.training_scenarios?.persona_type || 'Unknown'
    const name = s.training_scenarios?.persona_name || 'Prospect'
    const scores = s.feedback_json?.scores || {}

    if (!personaMap[type]) {
      personaMap[type] = {
        type,
        name,
        totalScore: 0,
        count: 0,
        skillTotals: { empathy: 0, objection_handling: 0, confidence: 0, listening: 0, executive_communication: 0, questioning_ability: 0 }
      }
    }

    personaMap[type].totalScore += s.feedback_json?.overall_score || 0
    personaMap[type].count += 1

    Object.keys(personaMap[type].skillTotals).forEach(skill => {
      if (scores[skill] !== undefined) {
        personaMap[type].skillTotals[skill] += scores[skill]
      }
    })
  })

  const personaPerformanceData = Object.values(personaMap).map((v: any) => {
    const avgScore = Math.round(v.totalScore / v.count)
    const skills = Object.entries(v.skillTotals).map(([name, total]) => ({
      name: name.replace('_', ' ').toUpperCase(),
      avg: Math.round((total as number) / v.count)
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

  try {
    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select(`
        id, 
        completed_at, 
        feedback_json,
        training_scenarios (
          persona_name,
          persona_type
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

    // 2. Skill Radar
    const skills = { opening: 0, discovery: 0, objection_handling: 0, talk_ratio: 0, closing: 0 }
    practiceSessions.forEach((s: any) => {
      const scores = s.feedback_json?.scores || {}
      Object.keys(skills).forEach(k => (skills as any)[k] += scores[k] || 0)
    })
    const radarData = Object.keys(skills).map(k => ({
      subject: k.replace('_', ' ').toUpperCase(),
      A: practiceSessions.length ? Math.round((skills as any)[k] / practiceSessions.length) : 0,
      fullMark: 100
    }))

    // 3. Persona Success Rates (Enriched)
    const personaMap: any = {}
    practiceSessions.forEach((s: any) => {
      const type = (s.training_scenarios as any)?.persona_type || 'Unknown'
      const name = (s.training_scenarios as any)?.persona_name || 'Prospect'
      const scores = s.feedback_json?.scores || {}

      if (!personaMap[type]) {
        personaMap[type] = {
          type,
          name,
          totalScore: 0,
          count: 0,
          skillTotals: { opening: 0, discovery: 0, objection_handling: 0, talk_ratio: 0, closing: 0 }
        }
      }

      personaMap[type].totalScore += s.feedback_json?.overall_score || 0
      personaMap[type].count += 1

      Object.keys(personaMap[type].skillTotals).forEach(skill => {
        personaMap[type].skillTotals[skill] += scores[skill] || 0
      })
    })

    const personaPerformanceData = Object.values(personaMap).map((v: any) => {
      const avgScore = Math.round(v.totalScore / v.count)
      const skills = Object.entries(v.skillTotals).map(([name, total]) => ({
        name: name.replace('_', ' ').toUpperCase(),
        avg: Math.round((total as number) / v.count)
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
  const orgId = req.user.org_id
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  try {
    // 1. Total Sales Reps
    const { count: totalReps } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('role', 'rep')

    // 2. Active Training Sessions (started but not completed in last 2 hours)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
    const { data: activeSessionsData } = await supabase
      .from('training_sessions')
      .select('id, created_at, users!inner(name, org_id), training_scenarios(persona_name)')
      .eq('users.org_id', orgId)
      .is('completed_at', null)
      .gt('created_at', twoHoursAgo)

    const activeSessionsList = (activeSessionsData || []).map((s: any) => ({
      id: s.id,
      rep_name: s.users?.name,
      scenario_name: s.training_scenarios?.persona_name,
      started_at: s.created_at
    }))

    // 3. Performance Metrics
    const { data: allSessions } = await supabase
      .from('training_sessions')
      .select(`
        id, 
        completed_at, 
        feedback_json, 
        rep_id,
        users!inner(org_id)
      `)
      .eq('users.org_id', orgId)
      .not('feedback_json', 'is', null)

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
    const { count: totalAttempts } = await supabase
      .from('training_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('users.org_id', orgId)
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
  const orgId = req.user.org_id

  try {
    const { data: reps, error: repsError } = await supabase
      .from('users')
      .select('id, name')
      .eq('org_id', orgId)
      .eq('role', 'rep')

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
      const lowObjCount = recentSessions.filter(s => (s.feedback_json?.scores?.objection_handling || 0) < 10).length
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
      const avgEngagement = recentSessions.reduce((acc, s) => acc + ((s.feedback_json?.scores?.discovery || 0) + (s.feedback_json?.scores?.closing || 0)) / 2, 0) / recentSessions.length
      if (avgEngagement < 10) {
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
      .eq('manager_id', req.user.id)
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
  const orgId = req.user.org_id

  try {
    const { data: sessions, error: sessionsError } = await supabase
      .from('training_sessions')
      .select(`
        id, 
        completed_at, 
        feedback_json, 
        training_scenarios (
          context_text,
          persona_type
        ),
        users!inner(name, org_id)
      `)
      .eq('users.org_id', orgId)
      .not('feedback_json', 'is', null)
      .order('completed_at', { ascending: true })

    if (sessionsError) throw sessionsError

    // STRICT FILTERING: Only include real training interactions
    const practiceSessions = (sessions || []).filter((s: any) =>
      !s.feedback_json?.is_note && !s.feedback_json?.is_assignment
    )

    if (practiceSessions.length === 0) {
      return res.json({
        trendData: [], radarData: [], scenarioData: [], heatmapData: [], personaPerformanceData: [],
        insights: [{ type: 'Info', text: 'No completed training data available yet.', icon: 'ℹ️' }],
        recommendations: []
      })
    }

    // 1. Time-series Trend (Last 14 days)
    const trendMap: any = {}
    practiceSessions.forEach(s => {
      const date = new Date(s.completed_at).toLocaleDateString()
      if (!trendMap[date]) trendMap[date] = { date, total: 0, count: 0 }
      trendMap[date].total += s.feedback_json?.overall_score || 0
      trendMap[date].count += 1
    })
    const trendData = Object.values(trendMap).map((v: any) => ({
      date: v.date,
      score: Math.round(v.total / v.count)
    })).slice(-14)

    // 2. Skill Radar (Aggregate)
    const skills = { empathy: 0, objection_handling: 0, confidence: 0, listening: 0, executive_communication: 0, questioning_ability: 0 }
    practiceSessions.forEach(s => {
      const scores = s.feedback_json?.scores || {}
      Object.keys(skills).forEach(k => {
        if (scores[k] !== undefined) (skills as any)[k] += scores[k]
        else {
          if (k === 'questioning_ability') (skills as any)[k] += (scores.discovery || 0) * 5
          if (k === 'listening') (skills as any)[k] += (scores.talk_ratio || 0) * 5
          if (k === 'objection_handling') (skills as any)[k] += (scores.objection_handling || 0) * 5
          if (k === 'executive_communication') (skills as any)[k] += (scores.closing || 0) * 5
          if (k === 'confidence' || k === 'empathy') (skills as any)[k] += (scores.opening || 0) * 5
        }
      })
    })
    const radarData = Object.keys(skills).map(k => ({
      subject: k.replace('_', ' ').toUpperCase(),
      A: practiceSessions.length ? Math.round((skills as any)[k] / practiceSessions.length) : 0,
      fullMark: 100
    }))

    // 3. Scenario Success Rates
    const scenarioMap: any = {}
    practiceSessions.forEach(s => {
      const scenario = s.training_scenarios as any
      const match = scenario?.context_text?.match(/\[SCENARIO:\s*(.*?)\]/)
      const name = match ? match[1] : (scenario?.persona_type || 'Unknown')

      if (!scenarioMap[name]) scenarioMap[name] = { name, total: 0, count: 0 }
      scenarioMap[name].total += s.feedback_json?.overall_score || 0
      scenarioMap[name].count += 1
    })
    const scenarioData = Object.values(scenarioMap).map((v: any) => ({
      name: v.name,
      score: Math.round(v.total / v.count)
    })).sort((a, b) => b.score - a.score)

    // 4. Heatmap Data (Rep vs Skill)
    const repMap: any = {}
    practiceSessions.forEach(s => {
      const repName = (s.users as any)?.name || 'Unknown'
      if (!repMap[repName]) {
        repMap[repName] = {
          name: repName,
          empathy: 0, objection_handling: 0, confidence: 0, listening: 0, executive_communication: 0, questioning_ability: 0,
          count: 0
        }
      }
      const scores = s.feedback_json?.scores || {}
      Object.keys(repMap[repName]).forEach(k => {
        if (k === 'name' || k === 'count') return
        if (scores[k] !== undefined) repMap[repName][k] += scores[k]
        else {
          if (k === 'questioning_ability') repMap[repName][k] += (scores.discovery || 0) * 5
          if (k === 'listening') repMap[repName][k] += (scores.talk_ratio || 0) * 5
          if (k === 'objection_handling') repMap[repName][k] += (scores.objection_handling || 0) * 5
          if (k === 'executive_communication') repMap[repName][k] += (scores.closing || 0) * 5
          if (k === 'confidence' || k === 'empathy') repMap[repName][k] += (scores.opening || 0) * 5
        }
      })
      repMap[repName].count += 1
    })
    const heatmapData = Object.values(repMap).map((v: any) => ({
      name: v.name,
      empathy: Math.round(v.empathy / v.count),
      objection_handling: Math.round(v.objection_handling / v.count),
      confidence: Math.round(v.confidence / v.count),
      listening: Math.round(v.listening / v.count),
      executive_communication: Math.round(v.executive_communication / v.count),
      questioning_ability: Math.round(v.questioning_ability / v.count)
    }))

    // 5. Persona Performance Analytics
    const personaMap: any = {}
    practiceSessions.forEach(s => {
      const type = (s.training_scenarios as any)?.persona_type || 'General Prospect'
      if (!personaMap[type]) personaMap[type] = { type, total: 0, count: 0 }
      personaMap[type].total += s.feedback_json?.overall_score || 0
      personaMap[type].count += 1
    })
    const personaPerformanceData = Object.values(personaMap).map((v: any) => ({
      type: v.type,
      avgScore: Math.round(v.total / v.count)
    })).sort((a, b) => a.avgScore - b.avgScore) // Show difficult ones first

    // Phase 9 & 10: AI Insights & Recommendation Engine
    const insights: any[] = []
    const recommendations: any[] = []

    // Skill-based insights
    const sortedSkills = [...radarData].sort((a, b) => a.A - b.A)
    const weakestSkill = sortedSkills[0]
    const strongestSkill = sortedSkills[sortedSkills.length - 1]

    if (weakestSkill && weakestSkill.A < 70) {
      insights.push({
        type: 'Skill Gap',
        text: `Team-wide proficiency in ${weakestSkill.subject} is currently at ${weakestSkill.A}%, which is below the enterprise benchmark.`,
        icon: '📉'
      })
      recommendations.push({
        action: 'Assign Practice',
        text: `Assign 2 targeted scenarios focusing on ${weakestSkill.subject.toLowerCase()} to all reps scoring below 70%.`,
        priority: 'High'
      })
    }

    if (strongestSkill && strongestSkill.A > 85) {
      insights.push({
        type: 'Team Strength',
        text: `The team is demonstrating exceptional competence in ${strongestSkill.subject} (${strongestSkill.A}%).`,
        icon: '🏆'
      })
    }

    // Trend-based insights
    const recentTrend = trendData.slice(-3)
    if (recentTrend.length >= 2) {
      const isDeclining = recentTrend[recentTrend.length - 1].score < recentTrend[0].score - 5
      if (isDeclining) {
        insights.push({
          type: 'Alert',
          text: 'Overall team proficiency has declined by over 5% in the last 72 hours.',
          icon: '⚠️'
        })
        recommendations.push({
          action: 'Team Review',
          text: 'Schedule a group coaching session to address recent performance regression.',
          priority: 'Critical'
        })
      }
    }

    // Persona-based insights
    const difficultPersona = personaPerformanceData[0]
    if (difficultPersona && difficultPersona.avgScore < 65) {
      insights.push({
        type: 'Complexity Alert',
        text: `Reps are consistently underperforming when engaging with "${difficultPersona.type}" personas.`,
        icon: '👤'
      })
      recommendations.push({
        action: 'Persona Deep-Dive',
        text: `Require all reps to retry scenarios involving ${difficultPersona.type} characters.`,
        priority: 'Medium'
      })
    }

    res.json({
      trendData,
      radarData,
      scenarioData,
      heatmapData,
      personaPerformanceData,
      insights,
      recommendations
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const assignTraining = async (req: any, res: any) => {
  const { repIds, scenarioId, deadline, priority } = req.body
  const managerId = req.user.id

  console.log("--- ASSIGN TRAINING DEBUG START ---");
  console.log("Payload:", { repIds, scenarioId, deadline, priority });
  console.log("Manager Context:", { managerId, org_id: req.user.org_id });

  try {
    // 1. Verify scenario exists
    const { data: scenario, error: scenarioError } = await supabase
      .from('training_scenarios')
      .select('id, persona_name')
      .eq('id', scenarioId)
      .single();

    if (scenarioError || !scenario) {
      console.error("Scenario Validation Failed:", scenarioError);
      return res.status(404).json({ error: 'Selected scenario not found.' });
    }

    const assignments = repIds.map((repId: string) => ({
      rep_id: repId,
      scenario_id: scenarioId,
      manager_id: managerId,
      status: 'Pending',
      priority: priority || 'Medium',
      deadline: deadline,
      assigned_at: new Date().toISOString()
    }))

    console.log(`Attempting to insert ${assignments.length} assignments...`);

    const { data: insertedData, error } = await supabase
      .from('training_assignments')
      .insert(assignments)
      .select();

    if (error) {
      console.error("Supabase Insertion Error:", error);
      throw error;
    }

    console.log("Successfully inserted assignments:", insertedData);
    console.log("--- ASSIGN TRAINING DEBUG END ---");

    res.json({
      success: true,
      message: `Successfully assigned "${scenario.persona_name}" to ${repIds.length} representatives.`,
      count: repIds.length
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
    let assignmentsData: any[] = [];
    let assignmentsError: any = null;

    // Try with session_id first (resilient approach)
    const firstTry = await supabase
      .from('training_assignments')
      .select(`
        id, 
        scenario_id, 
        status, 
        priority, 
        deadline, 
        assigned_at, 
        completed_at, 
        session_id,
        manager:users!manager_id (name),
        scenario:training_scenarios (
          id,
          persona_name,
          persona_type,
          difficulty
        )
      `)
      .eq('rep_id', repId)
      .order('created_at', { ascending: false })

    if (firstTry.error && firstTry.error.message.includes('column "session_id" does not exist')) {
      console.warn(`[getMyAssignments] session_id column missing, falling back to basic fetch`);
      const secondTry = await supabase
        .from('training_assignments')
        .select(`
          id, 
          scenario_id, 
          status, 
          priority, 
          deadline, 
          assigned_at, 
          completed_at,
          manager:users!manager_id (name),
          scenario:training_scenarios (
            id,
            persona_name,
            persona_type,
            difficulty
          )
        `)
        .eq('rep_id', repId)
        .order('created_at', { ascending: false })
      assignmentsData = secondTry.data || [];
      assignmentsError = secondTry.error;
    } else {
      assignmentsData = firstTry.data || [];
      assignmentsError = firstTry.error;
    }

    if (assignmentsError) throw assignmentsError

    // Fetch related sessions for scores if we have session_ids
    const sessionIds = (assignmentsData || []).filter(a => a.session_id).map(a => a.session_id)
    let sessionMap: Record<string, any> = {}
    
    if (sessionIds.length > 0) {
      const { data: sessionsData } = await supabase
        .from('training_sessions')
        .select('id, feedback_json')
        .in('id', sessionIds)
      
      if (sessionsData) {
        sessionsData.forEach(s => {
          sessionMap[s.id] = s.feedback_json
        })
      }
    }

    console.log(`[getMyAssignments] Fetched ${assignmentsData?.length || 0} assignments for rep ${repId}`);
    
    // Enrich and check overdue
    const assignments = (assignmentsData || []).map((a: any) => {
      const deadlineDate = new Date(a.deadline);
      const now = new Date();
      let status = a.status || 'Pending';
      
      const feedback = a.session_id ? sessionMap[a.session_id] : null;
      const score = feedback?.overall_score || 0;

      if (status !== 'Completed' && now > deadlineDate) {
        status = 'Overdue';
      }

      return {
        ...a,
        status,
        score,
        assigned_by: a.manager?.name || 'Manager',
        scenario_name: a.scenario?.persona_name || 'Training Scenario',
        scenario: a.scenario
      };
    });

    console.log(`[getMyAssignments] Transformed ${assignments.length} assignments for frontend`);
    res.json(assignments)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const getTeamAssignments = async (req: any, res: any) => {
  const managerId = req.user.id
  console.log(`[getTeamAssignments] Fetching for manager_id: ${managerId}`);

  try {
    let assignmentsData: any[] = [];
    let assignmentsError: any = null;

    // Try with session_id first
    const firstTry = await supabase
      .from('training_assignments')
      .select(`
        id, 
        rep_id,
        scenario_id, 
        status, 
        priority,
        deadline,
        assigned_at,
        completed_at,
        session_id,
        rep:users!rep_id (name),
        scenario:training_scenarios (
          id,
          persona_name,
          difficulty
        )
      `)
      .eq('manager_id', managerId)
      .order('created_at', { ascending: false })

    if (firstTry.error && firstTry.error.message.includes('column "session_id" does not exist')) {
      console.warn(`[getTeamAssignments] session_id column missing, falling back to basic fetch`);
      const secondTry = await supabase
        .from('training_assignments')
        .select(`
          id, 
          rep_id,
          scenario_id, 
          status, 
          priority,
          deadline,
          assigned_at,
          completed_at,
          rep:users!rep_id (name),
          scenario:training_scenarios (
            id,
            persona_name,
            difficulty
          )
        `)
        .eq('manager_id', managerId)
        .order('created_at', { ascending: false })
      assignmentsData = secondTry.data || [];
      assignmentsError = secondTry.error;
    } else {
      assignmentsData = firstTry.data || [];
      assignmentsError = firstTry.error;
    }

    if (assignmentsError) {
      console.error("Supabase Query Error (getTeamAssignments):", assignmentsError);
      throw assignmentsError;
    }

    // Fetch related sessions for scores manually
    const sessionIds = (assignmentsData || []).filter(a => a.session_id).map(a => a.session_id)
    let sessionMap: Record<string, any> = {}

    if (sessionIds.length > 0) {
      const { data: sessionsData } = await supabase
        .from('training_sessions')
        .select('id, feedback_json')
        .in('id', sessionIds)

      if (sessionsData) {
        sessionsData.forEach(s => {
          sessionMap[s.id] = s.feedback_json
        })
      }
    }

    const assignments = (assignmentsData || []).map((a: any) => {
      const deadlineDate = new Date(a.deadline);
      const now = new Date();
      let status = a.status || 'Pending';

      const feedback = a.session_id ? sessionMap[a.session_id] : null;
      const score = feedback?.overall_score || 0;

      if (status !== 'Completed' && now > deadlineDate) {
        status = 'Overdue';
      }

      return {
        ...a,
        status,
        score,
        rep_name: a.rep?.name || 'Unknown Rep',
        scenario_name: a.scenario?.persona_name || 'Unknown Scenario',
        difficulty: a.scenario?.difficulty || 'N/A'
      };
    });

    console.log(`[getTeamAssignments] Transformed ${assignments.length} assignments for frontend`);
    console.log("--- GET TEAM ASSIGNMENTS DEBUG END ---");
    res.json(assignments)
  } catch (err: any) {
    console.error("Critical Error in getTeamAssignments:", err);
    res.status(500).json({ error: err.message })
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
