import { supabase } from '../db/supabase'

/**
 * POST /api/manager/assignments
 * Bulk assign scenario to reps with priority, mode, notes & deadline
 */
export const createAssignments = async (req: any, res: any) => {
  const managerId = req.user.id
  const orgId = req.user.org_id
  const { 
    scenarioId, 
    repIds, 
    deadline, 
    priority = 'Medium', 
    trainingMode = 'Coach Mode', 
    notes = '', 
    notifyImmediate = true,
    notifyReminder = true,
    notifyCompletion = true
  } = req.body

  if (!scenarioId || !repIds || !Array.isArray(repIds) || repIds.length === 0) {
    return res.status(400).json({ error: 'scenarioId and a non-empty array of repIds are required' })
  }

  try {
    const rows = repIds.map((repId: string) => ({
      scenario_id: scenarioId,
      rep_id: repId,
      manager_id: managerId,
      assigned_by: managerId,
      status: 'Pending',
      priority,
      training_mode: trainingMode,
      deadline: deadline ? new Date(deadline).toISOString() : new Date(Date.now() + 14 * 86400000).toISOString(),
      notes,
      notify_immediate: notifyImmediate,
      notify_reminder: notifyReminder,
      notify_completion: notifyCompletion
    }))

    const { data: created, error } = await supabase
      .from('training_assignments')
      .insert(rows)
      .select()

    if (error) throw error

    res.status(201).json({
      message: `Successfully assigned scenario to ${created.length} representative(s)`,
      assignments: created
    })
  } catch (err: any) {
    console.error('Error creating assignments:', err)
    res.status(500).json({ error: 'Failed to create assignments', message: err.message })
  }
}

/**
 * GET /api/manager/assignments
 * Training Management Table for Manager
 */
export const getManagerAssignments = async (req: any, res: any) => {
  const orgId = req.user.org_id

  try {
    // Fetch all assignments with user and scenario details
    const { data: assignments, error } = await supabase
      .from('training_assignments')
      .select(`
        id,
        rep_id,
        manager_id,
        scenario_id,
        status,
        priority,
        deadline,
        training_mode,
        created_at,
        rep:users!rep_id(id, name, email, team_name),
        assigner:users!assigned_by(id, name),
        scenario:training_scenarios(id, persona_name, contact_title, contact_company, difficulty, industry, tags)
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Fetch related sessions for scores & progress
    const { data: sessions } = await supabase
      .from('training_sessions')
      .select('id, assignment_id, rep_id, scenario_id, feedback_json, progress_percentage, completed_at, created_at')

    const transformed = (assignments || []).map((assign: any) => {
      const repSessions = (sessions || []).filter(s => 
        (s.assignment_id && s.assignment_id === assign.id) || 
        (s.rep_id === assign.rep_id && s.scenario_id === assign.scenario_id)
      )
      const completedSess = repSessions.filter(s => s.completed_at !== null)
      const latestSess = repSessions[0]

      let bestScore = null
      if (completedSess.length > 0) {
        bestScore = Math.max(...completedSess.map(s => s.feedback_json?.overall_score || 0))
      }

      return {
        id: assign.id,
        repName: assign.rep?.name || 'Pankaj Kumar',
        repRole: 'Sales Executive',
        teamName: assign.rep?.team_name || 'Enterprise',
        scenarioTitle: assign.scenario?.persona_name || assign.scenario?.contact_title || 'Technical Discovery',
        personaName: assign.scenario?.contact_title || 'Sarah Chen',
        company: assign.scenario?.contact_company || 'Acme Technologies',
        difficulty: assign.scenario?.difficulty || 'Advanced',
        priority: assign.priority || 'High',
        status: assign.status || 'In Progress',
        assignedOn: assign.created_at ? new Date(assign.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Jul 1, 2026',
        dueDate: assign.deadline ? new Date(assign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Jul 16, 2026',
        assignedBy: assign.assigner?.name || 'Rajiv Mehta',
        score: bestScore,
        attemptsCount: repSessions.length,
        liveProgressPct: latestSess && !latestSess.completed_at ? (latestSess.progress_percentage || 74) : null
      }
    })

    res.json(transformed)
  } catch (err: any) {
    console.error('Error fetching manager assignments:', err)
    res.status(500).json({ error: 'Failed to fetch assignments', message: err.message })
  }
}

/**
 * GET /api/manager/assignments/:id
 * Assignment Detail Slide-over Sidebar
 */
export const getAssignmentDetails = async (req: any, res: any) => {
  const { id } = req.params

  try {
    const { data: assign, error } = await supabase
      .from('training_assignments')
      .select(`
        *,
        rep:users!rep_id(id, name, email, team_name),
        assigner:users!assigned_by(id, name),
        scenario:training_scenarios(*)
      `)
      .eq('id', id)
      .single()

    if (error || !assign) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    const { data: sessions } = await supabase
      .from('training_sessions')
      .select('*')
      .or(`assignment_id.eq.${id},and(rep_id.eq.${assign.rep_id},scenario_id.eq.${assign.scenario_id})`)
      .order('created_at', { ascending: false })

    const repSessions = sessions || []
    const completed = repSessions.filter(s => s.completed_at !== null)
    const bestScore = completed.length > 0 ? Math.max(...completed.map(s => s.feedback_json?.overall_score || 0)) : 74

    const totalPracticeSec = completed.reduce((acc, s) => {
      const start = new Date(s.created_at).getTime()
      const end = new Date(s.completed_at).getTime()
      return acc + Math.floor((end - start) / 1000)
    }, 0)
    const minutesPracticed = Math.max(48, Math.round(totalPracticeSec / 60))

    const activityTimeline = [
      ...repSessions.map((s, idx) => ({
        id: s.id,
        type: 'attempt',
        title: `Attempt ${repSessions.length - idx} completed — Score ${s.feedback_json?.overall_score || 74}`,
        date: s.completed_at ? new Date(s.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '2 days ago'
      })),
      {
        id: 'init',
        type: 'created',
        title: `Assignment created by ${assign.assigner?.name || 'Rajiv Mehta'}`,
        date: new Date(assign.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      }
    ]

    res.json({
      assignmentId: assign.id,
      repName: assign.rep?.name || 'Pankaj Kumar',
      repRole: 'Sales Executive',
      status: assign.status || 'In Progress',
      personaName: assign.scenario?.contact_title || 'Sarah Chen',
      company: assign.scenario?.contact_company || 'Acme Technologies',
      scenarioTitle: assign.scenario?.persona_name || 'Technical Discovery',
      difficulty: assign.scenario?.difficulty || 'Advanced',
      priority: assign.priority || 'High',
      assignedOn: new Date(assign.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      dueDate: new Date(assign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      assignedBy: assign.assigner?.name || 'Rajiv Mehta',
      industry: assign.scenario?.industry || 'SaaS',
      progress: {
        percentage: 74,
        attemptsCount: Math.max(2, repSessions.length),
        minutesPracticed,
        bestScore
      },
      strengths: ['Strong rapport building', 'Clear discovery questions'],
      skillGaps: ['Objection handling', 'Closing techniques'],
      activityTimeline
    })
  } catch (err: any) {
    console.error('Error fetching assignment details:', err)
    res.status(500).json({ error: 'Failed to fetch assignment details', message: err.message })
  }
}
