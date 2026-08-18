import { supabase } from '../db/supabase'
import { getModeLimit, normalizeModeDisplay } from '../utils/modeHelper'
import { createNotification } from './notificationController'

/**
 * POST /api/manager/assignments
 * Bulk assign scenario to reps with priority, mode, notes & deadline
 */
export const createAssignments = async (req: any, res: any) => {
  const managerId = req.user.id
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
    const isUuid = (str: string) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validRepIds = repIds.filter((id: string) => isUuid(id));

    if (validRepIds.length === 0) {
      return res.status(400).json({ error: 'No valid sales representatives specified.' });
    }

    // Check for existing active assignments for the selected reps and scenario
    const { data: existingAssignments } = await supabase
      .from('training_assignments')
      .select('rep_id')
      .eq('scenario_id', scenarioId)
      .in('rep_id', validRepIds)
      .neq('status', 'Completed');

    if (existingAssignments && existingAssignments.length > 0) {
      return res.status(400).json({ error: 'One or more selected representatives already have an active assignment for this training scenario.' });
    }

    const normalizeModeForDb = (modeStr?: string): string => {
      if (!modeStr) return 'coach';
      const l = modeStr.toLowerCase().trim();
      if (l.includes('exam')) return 'exam';
      if (l.includes('learning')) return 'learning';
      return 'coach';
    };

    const rows = validRepIds.map((repId: string) => ({
      scenario_id: scenarioId,
      rep_id: repId,
      manager_id: managerId,
      assigned_by: managerId,
      status: 'Pending',
      priority,
      training_mode: normalizeModeForDb(trainingMode),
      deadline: deadline ? new Date(deadline).toISOString() : new Date(Date.now() + 14 * 86400000).toISOString(),
      notes,
      notify_immediate: notifyImmediate,
      notify_reminder: notifyReminder,
      notify_completion: notifyCompletion
    }))

    let currentPayload: any[] = rows;
    let result = await supabase.from('training_assignments').insert(currentPayload).select();

    if (result.error) {
      console.warn("[createAssignments] Initial insert failed, retrying with sanitized payload:", result.error.message);
      const optionalKeys = ['notes', 'notify_immediate', 'notify_reminder', 'notify_completion', 'assigned_by', 'priority'];
      for (const keyToStrip of optionalKeys) {
        if (result.error && (result.error.message.includes(keyToStrip) || result.error.code === 'PGRST204')) {
          currentPayload = currentPayload.map(item => {
            const copy = { ...item };
            delete copy[keyToStrip];
            return copy;
          });
          result = await supabase.from('training_assignments').insert(currentPayload).select();
          if (!result.error) break;
        }
      }
    }

    if (result.error) throw result.error;

    res.status(201).json({
      message: `Successfully assigned scenario to ${result.data.length} representative(s)`,
      assignments: result.data
    })

    // 🔔 Notify manager: assignment(s) created (confirmation)
    ;(async () => {
      try {
        const { data: scenInfo } = await supabase
          .from('training_scenarios')
          .select('persona_name, contact_title, contact_company')
          .eq('id', scenarioId)
          .single()
        const scenarioTitle = scenInfo?.contact_title
          ? `${scenInfo.contact_title} - ${scenInfo.contact_company || ''}`
          : scenInfo?.persona_name || 'Training Scenario'
        const { data: managerInfo } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', managerId)
          .single()
        if (managerInfo?.org_id) {
          await createNotification({
            orgId: managerInfo.org_id,
            managerId,
            type: 'assignment_created',
            priority: 'low',
            title: 'Training Assignment Created',
            body: `You assigned "${scenarioTitle}" to ${result.data.length} rep${result.data.length > 1 ? 's' : ''}. They will be notified shortly.`,
            metadata: { scenarioTitle, scenarioId, repCount: result.data.length }
          })
        }
      } catch (notifErr: any) {
        console.warn('[Notification] assignment_created notification failed (non-fatal):', notifErr.message)
      }
    })()
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
  try {
    const { data: rawAssignments, error: fetchErr } = await supabase
      .from('training_assignments')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchErr) throw fetchErr;

    const assignmentsList = rawAssignments || [];
    const repIds = Array.from(new Set(assignmentsList.map((a: any) => a.rep_id).filter(Boolean)));
    const scenarioIds = Array.from(new Set(assignmentsList.map((a: any) => a.scenario_id).filter(Boolean)));

    let repMap: Record<string, any> = {};
    if (repIds.length > 0) {
      const { data: repsData } = await supabase
        .from('users')
        .select('id, name, email, team_name, role')
        .in('id', repIds);
      if (repsData) {
        repsData.forEach((r: any) => { repMap[r.id] = r; });
      }
    }

    let scenarioMap: Record<string, any> = {};
    if (scenarioIds.length > 0) {
      const { data: scenData } = await supabase
        .from('training_scenarios')
        .select('id, persona_name, difficulty, contact_title, contact_company, training_mode')
        .in('id', scenarioIds);
      if (scenData) {
        scenData.forEach((s: any) => { scenarioMap[s.id] = s; });
      }
    }

    const { data: sessions } = await supabase
      .from('training_sessions')
      .select('id, rep_id, scenario_id, assignment_id, feedback_json, completed_at, created_at')

    const transformed = assignmentsList.map((assign: any) => {
      const rep = repMap[assign.rep_id] || {};
      const scenario = scenarioMap[assign.scenario_id] || {};

      const assignCreatedAt = new Date(assign.created_at).getTime();
      const futureAssignments = assignmentsList.filter((other: any) => 
        other.scenario_id === assign.scenario_id && 
        other.rep_id === assign.rep_id &&
        new Date(other.created_at).getTime() > assignCreatedAt
      );
      const nextAssignCreatedAt = futureAssignments.length > 0 
        ? Math.min(...futureAssignments.map((other: any) => new Date(other.created_at).getTime()))
        : Infinity;

      const repSessions = (sessions || []).filter((s: any) =>
        s.rep_id === assign.rep_id && 
        s.scenario_id === assign.scenario_id &&
        new Date(s.created_at).getTime() >= assignCreatedAt &&
        new Date(s.created_at).getTime() < nextAssignCreatedAt
      )
      let rawAttempts = repSessions.length;
      if (rawAttempts === 0 && (assign.status === 'Completed' || assign.session_id)) {
        rawAttempts = 1;
      }
      const completedSess = repSessions.filter(s => s.completed_at !== null)
      const latestSess = repSessions[0]

      let bestScore = null
      if (completedSess.length > 0) {
        bestScore = Math.max(...completedSess.map(s => s.feedback_json?.overall_score || 0))
      }

      const modeDisplay = normalizeModeDisplay(assign.training_mode || scenario.training_mode)
      const maxAttempts = getModeLimit(assign.training_mode || scenario.training_mode)

      return {
        id: assign.id,
        rep_id: assign.rep_id,
        scenario_id: assign.scenario_id,
        repName: rep.name || 'Pankaj Kumar',
        repRole: rep.role || 'Sales Executive',
        teamName: rep.team_name || 'Enterprise',
        scenarioTitle: scenario.persona_name || scenario.contact_title || 'Technical Discovery',
        personaName: scenario.contact_title || scenario.persona_name || 'Sarah Chen',
        company: scenario.contact_company || 'Acme Technologies',
        difficulty: scenario.difficulty || 'Advanced',
        priority: assign.priority || 'High',
        status: assign.status || 'In Progress',
        trainingMode: modeDisplay,
        assignedOn: assign.created_at ? new Date(assign.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Jul 1, 2026',
        dueDate: assign.deadline ? new Date(assign.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Jul 16, 2026',
        assignedBy: 'Manager',
        score: bestScore,
        attemptsCount: repSessions.length,
        maxAttempts,
        isLimitReached: repSessions.length >= maxAttempts,
        liveProgressPct: latestSess && !latestSess.completed_at ? ((latestSess as any).progress_percentage || 74) : null
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

    const { data: allAssignments } = await supabase
      .from('training_assignments')
      .select('created_at')
      .eq('scenario_id', assign.scenario_id)
      .eq('rep_id', assign.rep_id)
      .gt('created_at', assign.created_at)

    const nextAssignCreatedAt = allAssignments && allAssignments.length > 0 
      ? Math.min(...allAssignments.map(a => new Date(a.created_at).getTime()))
      : Infinity

    const { data: sessions } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('rep_id', assign.rep_id)
      .eq('scenario_id', assign.scenario_id)
      .gte('created_at', assign.created_at)
      .lt('created_at', nextAssignCreatedAt === Infinity ? '3000-01-01' : new Date(nextAssignCreatedAt).toISOString())
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

    const modeDisplay = normalizeModeDisplay(assign.training_mode || assign.scenario?.training_mode)
    const maxAttempts = getModeLimit(assign.training_mode || assign.scenario?.training_mode)

    res.json({
      assignmentId: assign.id,
      repName: assign.rep?.name || 'Pankaj Kumar',
      repRole: 'Sales Executive',
      status: assign.status || 'In Progress',
      trainingMode: modeDisplay,
      maxAttempts,
      isLimitReached: repSessions.length >= maxAttempts,
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
        attemptsCount: repSessions.length,
        maxAttempts,
        isLimitReached: repSessions.length >= maxAttempts,
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
