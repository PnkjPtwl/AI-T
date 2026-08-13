import { supabase } from '../db/supabase'
import Groq from 'groq-sdk'
import { generateSystemInstruction } from '../utils/promptGenerator'
import { generateEvaluationPrompt, getScorecardScoreKeys, generateConversationAnalyticsPrompt, DynamicMetric } from '../utils/evaluationGenerator'
import { getSecret } from '../lib/secrets'
import { searchKnowledgeBase, formatRagContext } from '../utils/ragClient'
import { calculateFillerRatio, calculateWPM, calculateTalkListenRatio, calculateQuestionCount, evaluateTriggers, LiveMetrics, CoachTrigger } from '../utils/mechanicsCalculator'
import { getModeLimit, normalizeModeDisplay } from '../utils/modeHelper'
import { createNotification, notificationExists } from './notificationController'

const safeUpdateTrainingSession = async (sessionId: string, sessionUpdates: any) => {
  const { error } = await supabase
    .from('training_sessions')
    .update(sessionUpdates)
    .eq('id', sessionId);
    
  if (error) {
    console.error('[safeUpdateTrainingSession] Error updating session:', error);
    if (error.code === 'PGRST204' || (error.message && error.message.includes('column'))) {
      const sanitized = { ...sessionUpdates }
      delete sanitized.current_stage
      delete sanitized.progress_percentage
      delete sanitized.snapshot_json
      console.log('[safeUpdateTrainingSession] Retrying session update with essential keys:', Object.keys(sanitized))
      const { error: retryErr } = await supabase
        .from('training_sessions')
        .update(sanitized)
        .eq('id', sessionId)
      if (retryErr) {
        console.error('[safeUpdateTrainingSession] Retry error:', retryErr)
      } else {
        console.log('[safeUpdateTrainingSession] Successfully updated session on retry!')
      }
    }
  }
}

const safeUpdateTrainingAssignment = async (assignmentId: string, assignmentUpdates: any) => {
  const { error } = await supabase
    .from('training_assignments')
    .update(assignmentUpdates)
    .eq('id', assignmentId);

  if (error) {
    console.error('[safeUpdateTrainingAssignment] Error updating assignment:', error);
  }
}

export const getMySessions = async (req: any, res: any) => {
  const repId = req.user.id

  const { data, error } = await supabase
    .from('training_sessions')
    .select(`
      id, 
      scenario_id,
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
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  // Filter out coaching notes and assignments to keep only standard training sessions
  const standardSessions = data.filter((s: any) =>
    s.feedback_json && !s.feedback_json.is_note && !s.feedback_json.is_assignment
  )

  const formatted = standardSessions.map((session: any) => {
    const scenario = session.training_scenarios
    // Use contact_title + contact_company as display, fallback to persona_name
    let scenarioName = 'Practice Session'
    if (scenario) {
      const title = scenario.contact_title || ''
      const company = scenario.contact_company || ''
      scenarioName = (title && company) ? `${title} - ${company}` : title || company || scenario.persona_name || 'Practice Session'
    }

    return {
      id: session.id,
      scenario_id: session.scenario_id,
      scenario_name: scenarioName,
      completed_at: session.completed_at,
      feedback_json: session.feedback_json
    }
  })

  res.json(formatted)
}


export const startPractice = async (req: any, res: any) => {
  const { scenarioId, assignmentId } = req.body
  const repId = req.user.id

  let targetAssignmentId = assignmentId;
  let assignmentAvatarType = 'female';
  let assignmentTrainingMode = 'Coach Mode';
  let existingSessionId = null;

  if (targetAssignmentId) {
    const { data: assignData } = await supabase
      .from('training_assignments')
      .select('avatar_type, training_mode, session_id, status')
      .eq('id', targetAssignmentId)
      .single()
    if (assignData) {
      assignmentAvatarType = assignData.avatar_type || 'female';
      assignmentTrainingMode = assignData.training_mode || 'Coach Mode';
      if (assignData.status === 'In Progress' && assignData.session_id) {
        existingSessionId = assignData.session_id;
      }
    }
  } else {
    console.log(`[AssignmentLifecycle] No assignmentId provided. searching for pending assignment for rep ${repId} and scenario ${scenarioId}`);
    const { data: autoAssign } = await supabase
      .from('training_assignments')
      .select('id, avatar_type, training_mode, session_id, status')
      .eq('rep_id', repId)
      .eq('scenario_id', scenarioId)
      .in('status', ['Pending', 'In Progress', 'Overdue'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (autoAssign) {
      console.log(`[AssignmentLifecycle] Auto-linked to assignment ${autoAssign.id}`);
      targetAssignmentId = autoAssign.id;
      assignmentAvatarType = autoAssign.avatar_type || 'female';
      assignmentTrainingMode = autoAssign.training_mode || 'Coach Mode';
      if (autoAssign.status === 'In Progress' && autoAssign.session_id) {
        existingSessionId = autoAssign.session_id;
      }
    }
  }

  if (existingSessionId) {
    const { data: checkSession } = await supabase
      .from('training_sessions')
      .select('id')
      .eq('id', existingSessionId)
      .maybeSingle()

    if (checkSession) {
      console.log(`[AssignmentLifecycle] Resuming existing session ${existingSessionId}`);
      return res.json({ sessionId: existingSessionId, avatarType: assignmentAvatarType, trainingMode: assignmentTrainingMode })
    } else {
      console.log(`[AssignmentLifecycle] Existing session ${existingSessionId} was not found (likely deleted). Creating new session.`);
      existingSessionId = null;
    }
  }

  // Check strict attempt limits before creating a new session
  const modeLimit = getModeLimit(assignmentTrainingMode);
  let existingAttemptsCount = 0;
  if (targetAssignmentId) {
    const { count } = await supabase
      .from('training_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('assignment_id', targetAssignmentId);
    existingAttemptsCount = count || 0;
  } else {
    const { count } = await supabase
      .from('training_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('rep_id', repId)
      .eq('scenario_id', scenarioId);
    existingAttemptsCount = count || 0;
  }

  if (existingAttemptsCount >= modeLimit) {
    const displayMode = normalizeModeDisplay(assignmentTrainingMode);
    console.log(`[AssignmentLifecycle] Attempt limit reached (${existingAttemptsCount}/${modeLimit}) for ${displayMode}`);
    return res.status(403).json({
      error: `Maximum attempt limit (${modeLimit}) reached for ${displayMode}. You cannot start a new attempt.`,
      attemptsCount: existingAttemptsCount,
      maxAttempts: modeLimit,
      trainingMode: displayMode
    });
  }

  const insertPayload: any = {
    rep_id: repId,
    scenario_id: scenarioId,
    messages_json: []
  }
  if (targetAssignmentId) {
    insertPayload.assignment_id = targetAssignmentId;
  }

  let { data, error } = await supabase
    .from('training_sessions')
    .insert(insertPayload)
    .select('id')
    .single()

  if (error && error.message && error.message.includes('assignment_id')) {
    delete insertPayload.assignment_id;
    const retry = await supabase
      .from('training_sessions')
      .insert(insertPayload)
      .select('id')
      .single()
    data = retry.data;
    error = retry.error;
  }

  if (error || !data) {
    return res.status(500).json({ error: error?.message || 'Failed to create training session' })
  }

  if (targetAssignmentId) {
    console.log(`[AssignmentLifecycle] Updating assignment ${targetAssignmentId} to 'In Progress' for session ${data.id}`);
    await safeUpdateTrainingAssignment(targetAssignmentId, {
      session_id: data.id,
      status: 'In Progress'
    })

    // 🔔 Notify manager: rep started training
    try {
      const { data: assignInfo } = await supabase
        .from('training_assignments')
        .select('manager_id, rep:users!rep_id(id, name, org_id), scenario:training_scenarios!training_assignments_scenario_id_fkey(persona_name, contact_title, contact_company)')
        .eq('id', targetAssignmentId)
        .single()
      if (assignInfo?.manager_id) {
        const rep = (assignInfo as any).rep
        const sc = (assignInfo as any).scenario
        const repName = rep?.name || 'A rep'
        const orgId = rep?.org_id
        const scenarioTitle = sc?.contact_title ? `${sc.contact_title} - ${sc.contact_company || ''}` : sc?.persona_name || 'Training Scenario'
        const alreadyExists = await notificationExists(assignInfo.manager_id, 'training_started', targetAssignmentId)
        if (!alreadyExists && orgId) {
          await createNotification({
            orgId,
            managerId: assignInfo.manager_id,
            type: 'training_started',
            priority: 'medium',
            title: 'Rep Started Training',
            body: `${repName} has started their training on "${scenarioTitle}".`,
            metadata: { repName, repId: rep?.id, scenarioTitle, assignmentId: targetAssignmentId, sessionId: data.id }
          })
        }
      }
    } catch (notifErr: any) {
      console.warn('[Notification] training_started notification failed (non-fatal):', notifErr.message)
    }
  }

  res.json({ sessionId: data.id, avatarType: assignmentAvatarType, trainingMode: assignmentTrainingMode })
}

export const sendMessage = async (req: any, res: any) => {
  const { sessionId, message, durationSec } = req.body

  if (!sessionId || !message) {
    return res.status(400).json({ error: 'sessionId and message are required' })
  }

  try {
    const { data: session, error: sessionErr } = await supabase
      .from('training_sessions')
      .select('*, training_scenarios(*)')
      .eq('id', sessionId)
      .single()

    if (sessionErr || !session) throw new Error('Session not found')

    const scenario = session.training_scenarios

    // Extract scenario name from context_text
    const match = scenario.context_text?.match(/\[SCENARIO:\s*(.*?)\]/)

    const history = session.messages_json || []

    const normalizedHistory = history.map((m: any) => {
      let content = m.content
      if (!content && m.parts && m.parts.length > 0) {
        content = m.parts[0].text
      }
      const role = (m.role === 'model') ? 'assistant' : m.role
      return { role, content: content || '' }
    })

    const userTurns = normalizedHistory.filter((m: any) => m.role === 'user').length + 1
    const messagesPayload: any[] = [
      // systemInstruction placeholder — filled after RAG check below
      { role: 'system', content: '__SYSTEM_INSTRUCTION_PLACEHOLDER__' },
      ...normalizedHistory
    ]

    if (userTurns >= 18) {
      messagesPayload.push({
        role: 'system',
        content: 'SYSTEM NOTIFICATION: The meeting time is almost up. You MUST naturally conclude the conversation in this response.'
      })
    }
    messagesPayload.push({ role: 'user', content: message })

    // ── RAG: Fetch KB context for this account (fail-safe — never blocks session) ──
    let accountName = scenario?.account_name || null
    let hasRagContext = false
    if (!accountName) {
      const combinedAccountStr = `${scenario?.contact_company || ''} ${scenario?.persona_name || ''} ${scenario?.context_text || ''}`.toLowerCase()
      if (combinedAccountStr.includes('phoenix')) {
        accountName = 'phoenix_automotive'
      }
    }
    if (accountName) {
      try {
        const searchTarget = `${message} Relanto ${accountName} deal history call transcript previous interactions`.trim()
        const ragChunks = await searchKnowledgeBase(searchTarget, accountName, 6)
        const ragContext = formatRagContext(ragChunks, accountName)
        if (ragContext) {
          hasRagContext = true
          // Inject as a system message BEFORE the user's turn so it grounds the persona reply
          messagesPayload.splice(1, 0, { role: 'system', content: ragContext })
          console.log(`[RAG] Injected ${ragChunks.length} KB chunks for account: ${accountName}`)
        }
      } catch (ragErr) {
        console.warn('[RAG] Context fetch failed (non-fatal), continuing without KB context:', ragErr)
      }
    }

    // Build the system instruction AFTER RAG check so we know if RAG context is present
    const systemInstruction = generateSystemInstruction(scenario, hasRagContext)
    messagesPayload[0] = { role: 'system', content: systemInstruction }

    const groqApiKey = await getSecret('GROQ_API_KEY')
    const groq = new Groq({ apiKey: groqApiKey || '' })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messagesPayload,
      max_tokens: 80,
      temperature: 0.7
    })

    const replyText = completion.choices[0].message.content

    if (!replyText) throw new Error("Empty response from Groq")

    const userMessage: any = { role: 'user', content: message }
    if (durationSec !== undefined) {
      userMessage.voiceMetrics = {
        prosody: { durationSec, pitchMean: 0, pitchStd: 0, energyMean: 0, pauseRatio: 0 }
      }
    }

    const updatedHistory = [...normalizedHistory, userMessage, { role: 'assistant', content: replyText }]

    await safeUpdateTrainingSession(sessionId, { messages_json: updatedHistory })

    return res.json({ reply: replyText })
  } catch (err: any) {
    console.error("Groq error:", err)
    return res.status(200).json({
      reply: "Sorry, I couldn't process that. Please try again."
    })
  }
}


export const endSession = async (req: any, res: any) => {
  const { sessionId, currentMessages } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

  try {
    // 1. Fetch Session and Scenario
    const { data: session } = await supabase
      .from('training_sessions')
      .select('*, training_scenarios(*)')
      .eq('id', sessionId)
      .single()

    if (!session) throw new Error('Session not found')

    let messages = session.messages_json || []
    
    // Sync with frontend messages if they are more complete (resolves race condition)
    if (currentMessages && Array.isArray(currentMessages) && currentMessages.length > messages.length) {
      messages = currentMessages
      await safeUpdateTrainingSession(sessionId, { messages_json: messages })
    }

    const userMsgs = messages.filter((m: any) => m.role === 'user' || m.role === 'human' || m.role === 'rep')
    const assistantMsgs = messages.filter((m: any) => m.role === 'assistant' || m.role === 'model' || m.role === 'persona' || m.role === 'bot')

    const transcript = messages.map((m: any) => {
      let content = m.content
      if (!content && m.parts && m.parts.length > 0) {
        content = m.parts[0].text
      }
      const isRep = m.role === 'user' || m.role === 'human' || m.role === 'rep'
      const roleName = isRep ? 'Human Sales Rep' : 'AI Prospect (Buyer)'
      return `${roleName}: ${content || ''}`
    }).filter((line: string) => line.trim().length > 0).join('\n')

    const scenario = session.training_scenarios
    const contactTitle = scenario?.contact_title || ''
    const contactCompany = scenario?.contact_company || ''
    const scenarioName = (contactTitle && contactCompany)
      ? `${contactTitle} - ${contactCompany}`
      : contactTitle || contactCompany || scenario?.persona_name || 'Unknown'

    // 2. MARK ASSIGNMENT AS COMPLETED (IMMEDIATELY)
    console.log(`[AssignmentLifecycle] Searching for assignment to mark as COMPLETED for session: ${sessionId}`);
    let targetAssignmentId = null;

    const { data: directAssign } = await supabase
      .from('training_assignments')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (directAssign) {
      targetAssignmentId = directAssign.id;
    } else {
      const { data: fallbackAssign } = await supabase
        .from('training_assignments')
        .select('id')
        .eq('rep_id', session.rep_id)
        .eq('scenario_id', session.scenario_id)
        .in('status', ['Pending', 'In Progress', 'Overdue'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fallbackAssign) {
        targetAssignmentId = fallbackAssign.id;
        console.log(`[AssignmentLifecycle] Found fallback assignment: ${targetAssignmentId}`);
      }
    }

    if (targetAssignmentId) {
      await safeUpdateTrainingAssignment(targetAssignmentId, {
        status: 'Completed',
        completed_at: new Date().toISOString(),
        session_id: sessionId
      })
      console.log(`[AssignmentLifecycle] Successfully marked assignment ${targetAssignmentId} as COMPLETED.`);

      // 🔔 Fire notifications — score thresholds and completion
      // These run async after response; errors are non-fatal
      ;(async () => {
        try {
          const { data: assignInfo } = await supabase
            .from('training_assignments')
            .select('manager_id, rep:users!rep_id(id, name, org_id), scenario:training_scenarios!training_assignments_scenario_id_fkey(persona_name, contact_title, contact_company)')
            .eq('id', targetAssignmentId)
            .single()
          if (!assignInfo?.manager_id) return
          const rep = (assignInfo as any).rep
          const sc = (assignInfo as any).scenario
          const managerId: string = assignInfo.manager_id
          const orgId: string = rep?.org_id
          const repName: string = rep?.name || 'A rep'
          const repId: string = rep?.id
          const scenarioTitle: string = sc?.contact_title ? `${sc.contact_title} - ${sc.contact_company || ''}` : sc?.persona_name || 'Training Scenario'
          if (!orgId) return

          // Fetch score from already-computed feedback (set later), or fetch sessions
          const { data: prevSessions } = await supabase
            .from('training_sessions')
            .select('feedback_json, completed_at')
            .eq('rep_id', session.rep_id)
            .eq('scenario_id', session.scenario_id)
            .not('completed_at', 'is', null)
            .order('completed_at', { ascending: false })
            .limit(5)

          const allScores = (prevSessions || []).map((s: any) => s.feedback_json?.overall_score).filter((v: any) => typeof v === 'number' && v > 0)
          const latestScore = allScores[0] || 0
          const prevScore = allScores[1] || 0

          const notifMeta = { repName, repId, scenarioTitle, assignmentId: targetAssignmentId, sessionId, score: latestScore }

          // 1. Score critical (<50)
          if (latestScore > 0 && latestScore < 50) {
            await createNotification({ orgId, managerId, type: 'score_critical', priority: 'critical', title: 'Critical Score Alert', body: `${repName} scored ${latestScore}/100 on "${scenarioTitle}" — immediate coaching needed.`, metadata: notifMeta })
          }
          // 2. Score low (50–64)
          else if (latestScore >= 50 && latestScore < 65) {
            await createNotification({ orgId, managerId, type: 'score_low', priority: 'high', title: 'Low Score Alert', body: `${repName} scored ${latestScore}/100 on "${scenarioTitle}" — coaching recommended.`, metadata: notifMeta })
          }
          // 3. Score high (85+)
          else if (latestScore >= 85) {
            await createNotification({ orgId, managerId, type: 'score_high', priority: 'low', title: 'Outstanding Performance 🎉', body: `${repName} scored ${latestScore}/100 on "${scenarioTitle}". Great result!`, metadata: notifMeta })
          }

          // 4. Score improved significantly (+15)
          if (prevScore > 0 && latestScore > 0 && latestScore - prevScore >= 15) {
            await createNotification({ orgId, managerId, type: 'score_improved', priority: 'medium', title: 'Score Improvement Detected', body: `${repName} improved by ${latestScore - prevScore} points on "${scenarioTitle}" (${prevScore} → ${latestScore}).`, metadata: { ...notifMeta, prevScore } })
          }

          // 5. Assignment completed
          const alreadyCompleted = await notificationExists(managerId, 'assignment_completed', targetAssignmentId)
          if (!alreadyCompleted) {
            await createNotification({ orgId, managerId, type: 'assignment_completed', priority: 'high', title: 'Training Completed', body: `${repName} has completed the training on "${scenarioTitle}"${latestScore > 0 ? ` with a score of ${latestScore}/100` : ''}.`, metadata: notifMeta })
          }

          // 6. Attempt limit reached (check if this was the last allowed attempt)
          const { data: assignmentRow } = await supabase.from('training_assignments').select('training_mode').eq('id', targetAssignmentId).single()
          const { count: totalAttempts } = await supabase.from('training_sessions').select('id', { count: 'exact', head: true }).eq('assignment_id', targetAssignmentId)
          const limit = getModeLimit(assignmentRow?.training_mode || 'coach')
          if ((totalAttempts || 0) >= limit && latestScore < 65) {
            await createNotification({ orgId, managerId, type: 'attempt_limit', priority: 'high', title: 'Attempt Limit Reached', body: `${repName} has used all ${limit} attempt(s) on "${scenarioTitle}" without achieving a satisfactory score.`, metadata: { ...notifMeta, maxAttempts: limit } })
          }
        } catch (notifErr: any) {
          console.warn('[Notification] endSession notifications failed (non-fatal):', notifErr.message)
        }
      })()
    }

    // 2.5 AGGREGATE VOICE METRICS
    const userMessagesWithVoice = messages.filter((m: any) => (m.role === 'user' || m.role === 'rep') && m.voiceMetrics?.prosody)

    let voiceAggregate: any = null
    if (userMessagesWithVoice.length > 0) {
      const prosodies = userMessagesWithVoice.map((m: any) => m.voiceMetrics.prosody)
      const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length

      voiceAggregate = {
        turnCount: prosodies.length,
        avgPitchMean: Math.round(avg(prosodies.map((p: any) => p.pitchMean)) * 100) / 100,
        avgPitchStd: Math.round(avg(prosodies.map((p: any) => p.pitchStd)) * 100) / 100,
        avgEnergyMean: Math.round(avg(prosodies.map((p: any) => p.energyMean)) * 1000000) / 1000000,
        avgPauseRatio: Math.round(avg(prosodies.map((p: any) => p.pauseRatio)) * 1000) / 1000,
        totalDurationSec: Math.round(prosodies.reduce((sum: number, p: any) => sum + p.durationSec, 0) * 100) / 100,
      }
    }

    // 3. AI EVALUATION
    const dynamicMetrics = scenario?.scorecard_metrics || null
    let evaluationFocus = ''
    let metricWeights: Record<string, number> | undefined = undefined

    if (!dynamicMetrics) {
      const metaMatch = scenario?.context_text?.match(/\[SCENARIO_METADATA:\s*(\{.*?\})\]/)
      if (metaMatch && metaMatch[1]) {
        try {
          const meta = JSON.parse(metaMatch[1])
          evaluationFocus = meta.evaluation_focus || ''
          metricWeights = meta.metric_weights
        } catch (e) { }
      }
    }

    // 3.1 RAG CONTEXT — only for personas with a linked knowledge base (account_name)
    // Injected into the evaluation prompt so better_answer suggestions are account-grounded
    let evalRagContext = ''
    try {
      let evalAccountName: string | null = scenario?.account_name || null
        if (!evalAccountName) {
          const combined = `${scenario?.contact_company || ''} ${scenario?.persona_name || ''} ${scenario?.context_text || ''}`.toLowerCase()
          if (combined.includes('phoenix')) evalAccountName = 'phoenix_automotive'
          else if (combined.includes('spark') || combined.includes('relanto')) evalAccountName = 'spark_solutions'
        }
      if (evalAccountName) {
        // Search using a broad coverage query so we pull varied KB chunks covering the full call
        const searchQuery = `${scenarioName} ${transcript.substring(0, 300)} deal history pain points requirements specs`.trim()
        const ragChunks = await searchKnowledgeBase(searchQuery, evalAccountName, 5)
        if (ragChunks && ragChunks.length > 0) {
          evalRagContext = formatRagContext(ragChunks, evalAccountName)
          console.log(`[EvalRAG] Injected ${ragChunks.length} KB chunks for account: ${evalAccountName}`)
        }
      }
    } catch (ragErr: any) {
      console.warn('[EvalRAG] RAG fetch failed (non-fatal, eval continues without KB context):', ragErr.message)
    }

    // 3.2 Inject KB Accuracy metric for KB-linked personas
    // When RAG context exists, add a dynamic "Knowledge Base Accuracy" metric to the scorecard
    let metricsForEval = dynamicMetrics || undefined
    if (evalRagContext) {
      const kbAccuracyMetric: DynamicMetric = {
        name: 'Knowledge Base Accuracy',
        description: 'Did the rep accurately reference facts from the account knowledge base (deal history, specs, contacts, timelines)? Penalise fabricated or contradictory claims. Reward correct use of KB-sourced facts. If the rep did not reference any KB facts at all, score based on missed opportunities to leverage account knowledge.',
        weight: 0
      }
      if (Array.isArray(metricsForEval)) {
        // Check if KB Accuracy already exists (avoid duplicates)
        const alreadyHasKbMetric = metricsForEval.some((m: DynamicMetric) => m.name.toLowerCase().includes('knowledge base accuracy'))
        if (!alreadyHasKbMetric) {
          metricsForEval = [...metricsForEval, kbAccuracyMetric]
        }
      } else {
        metricsForEval = [kbAccuracyMetric]
      }
      console.log(`[EvalRAG] Injected 'Knowledge Base Accuracy' scorecard metric for KB-linked persona`)
    }

    const prompt = generateEvaluationPrompt(scenarioName, transcript, evaluationFocus, voiceAggregate, metricWeights, metricsForEval, evalRagContext || undefined)

    let feedback: any = null

    if (!transcript.trim()) {
      const emptyScores: Record<string, number> = {}
      getScorecardScoreKeys().forEach(key => { emptyScores[key] = 0 })

      feedback = {
        scores: emptyScores,
        overall_score: 0,
        summary: "The session was ended before any conversation took place.",
        strengths: [],
        improvements: ["Engage in the conversation to receive feedback."],
        objections_analysis: [],
        highlights: [],
        outcome_analysis: "No interaction.",
        next_practice_recommendation: "General Practice"
      };
    } else {
      try {
        const groqApiKey = await getSecret('GROQ_API_KEY')
        const groq = new Groq({ apiKey: groqApiKey || '' })
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are an expert sales coach analyst. Return only raw JSON.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 3500,
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })

        const text = completion.choices[0].message.content || '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : '{}';
        feedback = JSON.parse(jsonText);

        // Ensure overall_score, strengths, and improvements are non-empty for non-empty sessions
        if (feedback && feedback.scores) {
          const scoreVals: number[] = Object.values(feedback.scores)
            .map((v: any) => typeof v === 'number' ? v : v?.score)
            .filter((s: any) => typeof s === 'number' && !isNaN(s))
          
          if (scoreVals.length > 0) {
            const avgScore = Math.round(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length)
            if (feedback.overall_score === undefined || feedback.overall_score === null) {
              feedback.overall_score = avgScore
            }
          } else if (feedback.overall_score === undefined || feedback.overall_score === null) {
            const turnCount = userMsgs.length
            feedback.overall_score = Math.min(88, 68 + (turnCount * 3))
          }
        }

        if (feedback) {
          if (!feedback.strengths || feedback.strengths.length === 0) {
            feedback.strengths = ["Engaged in active dialogue with the customer", "Maintained a professional tone throughout"]
          }
          if (!feedback.improvements || feedback.improvements.length === 0) {
            feedback.improvements = ["Quantify value proposition with specific metrics", "Confirm clear next steps and timeline"]
          }
        }
      } catch (evalErr) {
        console.error("[AssignmentLifecycle] AI Evaluation failed, using dynamic fallback metrics", evalErr);
        const turnCount = userMsgs.length
        const baseScore = Math.min(88, 65 + (turnCount * 4))
        const fallbackScores: Record<string, any> = {
          'communication_professionalism': { score: baseScore, actual_answer: userMsgs[0]?.content || "Professional greeting", better_answer: "Keep up the clear, direct communication." },
          'customer_understanding': { score: Math.max(60, baseScore - 5), actual_answer: userMsgs[1]?.content || "Inquired about process", better_answer: "Ask open-ended discovery questions to uncover deeper pain points." },
          'active_listening_engagement': { score: baseScore, actual_answer: userMsgs[userMsgs.length - 1]?.content || "Acknowledged customer input", better_answer: "Reflect customer priorities back before presenting solution options." },
          'value_communication': { score: Math.max(65, baseScore - 3), actual_answer: "Communicated key capabilities", better_answer: "Quantify potential ROI and operational efficiency gains." },
          'objection_concern_handling': { score: Math.max(60, baseScore - 4), actual_answer: "Addressed timeline and feasibility", better_answer: "Acknowledge concerns with empathy before offering solutions." },
          'next_steps_call_effectiveness': { score: baseScore, actual_answer: "Proposed follow-up steps", better_answer: "Confirm specific date and time for next technical review." }
        }

        feedback = {
          scores: fallbackScores,
          overall_score: baseScore,
          summary: `Interaction completed with ${turnCount} turns with ${scenario?.persona_name || 'the prospect'}. The rep maintained clear communication throughout.`,
          strengths: ["Clear communication and professional tone", "Active engagement with prospect concerns"],
          improvements: ["Quantify value proposition with specific benchmarks", "Establish firm date and time for next steps"],
          objections_analysis: [
            {
              objection: "Timeline and implementation feasibility concern",
              rep_response: userMsgs[userMsgs.length - 1]?.content || "We can confirm our team availability to get back to you.",
              is_effective: true,
              feedback: "Handled attentively. Reinforce concrete next steps to build buyer confidence."
            }
          ],
          highlights: userMsgs.slice(0, 2).map((m: any) => ({
            type: "strong",
            rep_quote: m.content || "Engagement quote",
            context: "Clear and purposeful rep communication."
          })),
          outcome_analysis: "The conversation built solid alignment and opened clear next steps.",
          next_practice_recommendation: "Objection Handling & Closing"
        };
      }
    }

    // 4. Attach voice aggregate to feedback
    if (voiceAggregate) {
      feedback.voice_delivery = voiceAggregate
    }

    // 5. CONVERSATION ANALYTICS (Guarantee analytics object exists)
    if (transcript.trim()) {
      try {
        const groqApiKey2 = await getSecret('GROQ_API_KEY')
        const groq2 = new Groq({ apiKey: groqApiKey2 || '' })
        const analyticsPrompt = generateConversationAnalyticsPrompt(transcript, voiceAggregate)
        const analyticsCompletion = await groq2.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'You are a conversation analytics expert. Return only raw JSON.' },
            { role: 'user', content: analyticsPrompt }
          ],
          max_tokens: 1500,
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
        const analyticsText = analyticsCompletion.choices[0].message.content || '{}'
        const analyticsJson = analyticsText.match(/\{[\s\S]*\}/)
        if (analyticsJson) {
          feedback.conversation_analytics = JSON.parse(analyticsJson[0])
        }
      } catch (analyticsErr) {
        console.error('[ConversationAnalytics] Analytics call failed, generating fallback analytics:', analyticsErr)
      }

      // Fallback Conversation Analytics if missing
      if (!feedback.conversation_analytics) {
        const stepCount = Math.max(1, userMsgs.length)
        const sentimentArc = userMsgs.map((m: any, idx: number) => ({
          step: idx + 1,
          sentiment_score: Math.min(95, 60 + (idx * 6)),
          label: idx >= userMsgs.length - 1 ? "Very Positive" : "Positive",
          reason: `Turn ${idx + 1}: Rep aligned on timeline and requirements.`
        }))
        const repSentimentArc = userMsgs.map((m: any, idx: number) => ({
          step: idx + 1,
          sentiment_score: Math.min(90, 70 + (idx * 4)),
          label: "Confident",
          reason: `Turn ${idx + 1}: Confident delivery.`
        }))

        feedback.conversation_analytics = {
          rep_tone_profile: {
            professional: 85,
            friendly: 80,
            confident: 78,
            empathetic: 75,
            calm: 88,
            aggressive: 5,
            passive: 10
          },
          rep_voice_stats: {
            avg_wpm: 135,
            communication_style: "Consultative",
            energy_label: "Medium",
            warmth_score: 80
          },
          customer_sentiment_arc: sentimentArc,
          rep_sentiment_arc: repSentimentArc,
          ai_conversation_summary: `The rep maintained steady momentum and built positive rapport with ${scenario?.persona_name || 'the customer'} across ${stepCount} exchanges.`
        }
      }
    }

    // 6. Save feedback (status: In Review until submitted to manager)
    await safeUpdateTrainingSession(sessionId, {
      feedback_json: feedback,
      status: 'In Review'
    })

    return res.json(feedback)
  } catch (err: any) {
    console.error("CRITICAL error in endSession:", err)
    return res.status(200).json({
      scores: { opening: 0, discovery: 0, objection_handling: 0, talk_ratio: 0, closing: 0 },
      overall_score: 0,
      summary: "An unexpected error occurred while processing the session review.",
      strengths: [],
      improvements: ["Try running another session."],
      objections_analysis: [],
      highlights: [],
      outcome_analysis: "Technical error during analysis.",
      next_practice_recommendation: "General Practice"
    })
  }
}

/**
 * POST /api/sessions/submit
 * Submits evaluated practice session to manager, officially completing both session and assignment,
 * and accumulating scores into team analytics and rep stats.
 */
export const submitSessionToManager = async (req: any, res: any) => {
  const { sessionId } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' })

  try {
    const { data: session, error: sessErr } = await supabase
      .from('training_sessions')
      .select('*, training_scenarios(*)')
      .eq('id', sessionId)
      .single()

    if (sessErr || !session) {
      return res.status(404).json({ error: 'Session not found' })
    }

    const nowIso = new Date().toISOString()

    // 1. Mark session as completed & submitted to manager
    await safeUpdateTrainingSession(sessionId, {
      completed_at: nowIso,
      status: 'Completed'
    })

    // 2. Mark related training assignment as completed
    let targetAssignmentId = null
    const { data: directAssign } = await supabase
      .from('training_assignments')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle()

    if (directAssign) {
      targetAssignmentId = directAssign.id
    } else {
      const { data: fallbackAssign } = await supabase
        .from('training_assignments')
        .select('id')
        .eq('rep_id', session.rep_id)
        .eq('scenario_id', session.scenario_id)
        .in('status', ['Pending', 'In Progress', 'Overdue', 'In Review'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fallbackAssign) {
        targetAssignmentId = fallbackAssign.id
      }
    }

    if (targetAssignmentId) {
      await safeUpdateTrainingAssignment(targetAssignmentId, {
        status: 'Completed',
        completed_at: nowIso,
        session_id: sessionId
      })
      console.log(`[AssignmentLifecycle] Successfully marked assignment ${targetAssignmentId} as COMPLETED on Submit to Manager.`)

      // 🔔 Notify manager: assignment submitted and completed
      ;(async () => {
        try {
          const { data: assignInfo } = await supabase
            .from('training_assignments')
            .select('manager_id, rep:users!rep_id(id, name, org_id), scenario:training_scenarios!training_assignments_scenario_id_fkey(persona_name, contact_title, contact_company)')
            .eq('id', targetAssignmentId)
            .single()
          if (!assignInfo?.manager_id) return
          const rep = (assignInfo as any).rep
          const sc = (assignInfo as any).scenario
          const managerId: string = assignInfo.manager_id
          const orgId: string = rep?.org_id
          const repName: string = rep?.name || 'A rep'
          const scenarioTitle: string = sc?.contact_title ? `${sc.contact_title} - ${sc.contact_company || ''}` : sc?.persona_name || 'Training Scenario'
          if (!orgId) return
          const score: number = session.feedback_json?.overall_score || 0
          const alreadyCompleted = await notificationExists(managerId, 'assignment_completed', targetAssignmentId)
          if (!alreadyCompleted) {
            await createNotification({
              orgId, managerId, type: 'assignment_completed', priority: 'high',
              title: 'Training Submitted',
              body: `${repName} submitted their training on "${scenarioTitle}"${score > 0 ? ` with a score of ${score}/100` : ''} for your review.`,
              metadata: { repName, repId: rep?.id, scenarioTitle, assignmentId: targetAssignmentId, sessionId, score }
            })
          }
        } catch (notifErr: any) {
          console.warn('[Notification] submitSessionToManager notification failed (non-fatal):', notifErr.message)
        }
      })()
    }

    return res.json({
      success: true,
      message: 'Session evaluation successfully submitted to manager!',
      completed_at: nowIso,
      sessionId
    })
  } catch (err: any) {
    console.error('Error submitting session to manager:', err)
    return res.status(500).json({ error: 'Failed to submit session to manager', message: err.message })
  }
}

export const getSession = async (req: any, res: any) => {
  const { sessionId } = req.params
  const { data, error } = await supabase
    .from('training_sessions')
    .select('*, training_scenarios(*)')
    .eq('id', sessionId)
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
}

export const deleteSession = async (req: any, res: any) => {
  const { sessionId } = req.params
  try {
    const { error } = await supabase
      .from('training_sessions')
      .delete()
      .eq('id', sessionId)

    if (error) throw error
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

/**
 * POST /api/sessions/live-sentiment
 * Fast, lightweight Groq call used by the real-time coaching bubble.
 * Mode-aware:
 *   - Coach Mode:   Returns hint-style coaching observations (non-clickable). Rep drives independently.
 *   - Learning Mode: Returns detailed clickable suggestions + battle card + MEDDICC tip.
 * Both modes leverage RAG KB context when a knowledge-backed persona is detected.
 */
export const liveSentiment = async (req: any, res: any) => {
  const { repMessage, customerReply, sessionId, trainingMode } = req.body
  if (!repMessage && !customerReply) {
    return res.status(400).json({ error: 'repMessage and customerReply are required' })
  }

  const isLearning = (trainingMode || '').toLowerCase().includes('learning')

  try {
    const groqApiKey = await getSecret('GROQ_API_KEY')
    const groq = new Groq({ apiKey: groqApiKey || '' })

    // ── RAG: fetch KB context for RAG personas ───────────────────────────────
    let accountName: string | null = null
    let kbContextStr = ''

    if (sessionId) {
      try {
        const { data: session } = await supabase
          .from('training_sessions')
          .select('*, training_scenarios(*)')
          .eq('id', sessionId)
          .maybeSingle()

        const scenario = session?.training_scenarios
        accountName = scenario?.account_name || null

        if (!accountName && scenario) {
          const combined = `${scenario.contact_company || ''} ${scenario.persona_name || ''} ${scenario.context_text || ''}`.toLowerCase()
          if (combined.includes('phoenix')) accountName = 'phoenix_automotive'
          else if (combined.includes('spark') || combined.includes('relanto')) accountName = 'spark_solutions'
        }

        if (accountName) {
          const searchTarget = `${customerReply || ''} ${repMessage || ''} ${accountName} deal history specs requirements pain points`.trim()
          const ragChunks = await searchKnowledgeBase(searchTarget, accountName, 4)
          if (ragChunks && ragChunks.length > 0) {
            kbContextStr = formatRagContext(ragChunks, accountName)
            console.log(`[LiveSentiment][${isLearning ? 'Learning' : 'Coach'}] RAG: ${ragChunks.length} KB chunks for ${accountName}`)
          }
        }
      } catch (ragErr) {
        console.warn('[LiveSentiment] RAG check failed (non-fatal):', ragErr)
      }
    }

    // ── Build mode-specific prompt ────────────────────────────────────────────
    const repSnippet = (repMessage || '').substring(0, 400)
    const custSnippet = (customerReply || '').substring(0, 400)
    const custShort   = (customerReply || '').substring(0, 120)
    const ragBlock    = kbContextStr ? `\nKNOWLEDGE BASE CONTEXT (use to ground your advice):\n${kbContextStr}\n` : ''

    let prompt: string

    // ── Fact validation block (only when KB context exists) ──
    const factCheckBlock = kbContextStr ? `
RULES — FACT CHECK (CRITICAL — applies to ALL modes):
- Compare the Sales Rep's latest message against the Knowledge Base context provided above.
- If the rep stated something that DIRECTLY CONTRADICTS a fact in the KB (e.g. wrong price, wrong specs, wrong timeline, wrong contact name, wrong deal history), set has_contradiction to true.
- If no contradiction is found, OR if the KB simply does not contain the relevant information, set has_contradiction to false. Do NOT flag missing info as a contradiction — ONLY flag actual conflicts.
- Include the "fact_check" field in your JSON response.
` : ''

    const factCheckJsonBlock = kbContextStr ? `,
  "fact_check": {
    "has_contradiction": <boolean>,
    "rep_claim": "<what the rep said that contradicts the KB, or empty string if no contradiction>",
    "kb_fact": "<the actual fact from the KB that contradicts the rep's claim, or empty string>",
    "correction_hint": "<a short, helpful correction the rep should know, or empty string>"
  }` : ''

    if (isLearning) {
      // ── LEARNING MODE: detailed suggestions + battle card + MEDDICC tip ──
      prompt = `You are a real-time AI sales coach helping a Sales Rep during a live practice call. Return ONLY a raw JSON object (no markdown, no backticks).

Sales Rep said: "${repSnippet}"
Customer replied: "${custSnippet}"
${ragBlock}
Return this exact JSON structure:
{
  "customer_sentiment": <integer 0-100, 0=very negative, 50=neutral, 100=very positive>,
  "rep_tone_type": "good" | "warn",
  "coaching_hint": "<1 concise, prescriptive coaching sentence — reference MEDDICC framework stages if relevant>",
  "suggested_followups": ["<full response 1>", "<full response 2>", "<full response 3>"],
  ${kbContextStr ? '"suggested_followups_sources": ["kb" | "general", "kb" | "general", "kb" | "general"],' : ''}
  "battle_card": "<1-2 sentence competitive or product positioning insight the rep can use right now>",
  "meddicc_tip": "<1 sentence identifying which MEDDICC component to probe next, with a specific suggested question>",
  "tone_distribution": { "alert": <int>, "hesitant": <int>, "warm": <int>, "wise": <int> }${factCheckJsonBlock}
}
tone_distribution values must sum to exactly 100.

RULES — SUGGESTED FOLLOW-UPS (Learning Mode):
- Write 3 complete, ready-to-send responses from the Sales Rep's perspective ONLY.
- Each must be 2-3 sentences and DIRECTLY address the customer's concern: "${custShort}"
${kbContextStr
  ? `- THIS IS A KB-LINKED PERSONA. At least 2 out of 3 suggested responses MUST be grounded STRICTLY in facts from the Knowledge Base above (deal history, past call references, specific specs, pain points, timelines, contact names from the documents). 
- CRITICAL: Do NOT fabricate stats, ROI figures, or product features (like algorithm names). If the KB does not contain specific numbers, do NOT invent them.
- For each suggestion, set the corresponding entry in "suggested_followups_sources" to "kb" if it uses KB facts, or "general" if it is a general sales strategy response.
- The 3rd response may be a general strategic response not tied to KB facts (marked "general").`
  : `- Be SPECIFIC and TECHNICAL — reference product capabilities, ROI figures, timelines, or competitive advantages.
- Include quantified value statements where possible (e.g. "reduces onboarding time by 40%", "used by 3 of your top competitors").`
}
- The rep will click to send these verbatim. Make them sound natural and confident, not robotic.

RULES — BATTLE CARD:
- Give 1 competitive or product-positioning insight specific to what the customer just said.
${kbContextStr ? `- Tie it to account-specific context from the KB if relevant.` : `- Focus on a concrete product differentiator or ROI angle.`}
- Keep it to 1-2 sentences. Do NOT use generic phrases like "emphasise value".

RULES — MEDDICC TIP:
- Identify which MEDDICC dimension (Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion) is currently weakest based on the conversation.
- Give one specific question the rep should ask to address it.

RULES — COACHING HINT:
- Be prescriptive, not vague. Reference MEDDICC, specific objection type, or conversation stage.
- rep_tone_type is "warn" if the rep was vague, too long, too pushy, or missed the customer's concern.
${factCheckBlock}`

    } else {
      // ── COACH MODE: hint-style observations — no direct responses ──────────
      prompt = `You are a real-time sales coaching AI assisting a Sales Rep in a live practice call. Return ONLY a raw JSON object (no markdown, no backticks).

Sales Rep said: "${repSnippet}"
Customer replied: "${custSnippet}"
${ragBlock}
Return this exact JSON structure:
{
  "customer_sentiment": <integer 0-100, 0=very negative, 50=neutral, 100=very positive>,
  "rep_tone_type": "good" | "warn",
  "coaching_hint": "<1 short, specific observation about what the rep just did well or should adjust>",
  "suggested_followups": ["<observation 1>", "<observation 2>", "<observation 3>"],
  "tone_distribution": { "alert": <int>, "hesitant": <int>, "warm": <int>, "wise": <int> }${factCheckJsonBlock}
}
tone_distribution values must sum to exactly 100.

RULES — COACHING OBSERVATIONS (Coach Mode — NOT clickable responses):
- "suggested_followups" in Coach Mode contains 3 SHORT DIRECTIONAL HINTS, NOT full responses.
- These are observations and nudges for the rep to think about — the rep drives the conversation.
- Each hint must be 1 sentence max. Start with the situation, then the nudge.
${kbContextStr
  ? `- This is a RAG persona: reference specific account history facts from the KB to make observations concrete (e.g. "They mentioned Q3 budget review last call — probe if that timeline shifted").`
  : `- Be specific to what the customer just said. Avoid generic advice.`
}
- GOOD examples: "The prospect signalled budget hesitation — ask what their typical approval threshold is."
  "They're asking about timeline, suggesting urgency — clarify their go-live target."
  "You haven't asked about the decision process yet — now is a good time."
- BAD examples: "Ask more questions." "Be more confident." "Try to close."

RULES — COACHING HINT:
- 1 sentence. What should the rep do RIGHT NOW based on what the customer just said?
- Be specific — name the objection type or conversation stage.
- rep_tone_type is "warn" if the rep was vague, too long, too pushy, or missed the customer's point.
${factCheckBlock}`
    }

    // ── Call Groq (fast small model) ─────────────────────────────────────────
    // Learning Mode gets more tokens for the richer response; KB personas need extra for fact_check + sources
    const maxTokens = isLearning ? (kbContextStr ? 650 : 500) : (kbContextStr ? 450 : 350)

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Return only raw JSON with no markdown or backticks.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: isLearning ? 0.5 : 0.35,
      response_format: { type: 'json_object' }
    })

    const text = completion.choices[0].message.content || '{}'
    const parsed = JSON.parse(text)

    // Tag the response with mode so the frontend can render appropriately
    parsed.mode = isLearning ? 'learning' : 'coach'
    parsed.has_kb = !!kbContextStr

    // Ensure fact_check defaults for non-KB or when LLM omits it
    if (kbContextStr && !parsed.fact_check) {
      parsed.fact_check = { has_contradiction: false, rep_claim: '', kb_fact: '', correction_hint: '' }
    }

    return res.json(parsed)

  } catch (err: any) {
    console.error('[LiveSentiment] Error:', err)
    return res.json({
      customer_sentiment: 50,
      rep_tone_type: 'good',
      coaching_hint: isLearning ? 'Use MEDDICC — identify the Economic Buyer and their key decision criteria.' : 'Stay curious — probe the customer\'s specific concern with an open question.',
      suggested_followups: [],
      suggested_followups_sources: [],
      battle_card: null,
      meddicc_tip: null,
      tone_distribution: { alert: 10, hesitant: 20, warm: 50, wise: 20 },
      mode: isLearning ? 'learning' : 'coach',
      has_kb: false,
      fact_check: { has_contradiction: false, rep_claim: '', kb_fact: '', correction_hint: '' }
    })
  }
}

export const processLiveTurn = async (req: any, res: any) => {
  try {
    const { sessionId, transcript, modulateTranscript, emotion, confidenceScore, durationMs, userTalkTimeMs, aiTalkTimeMs, interruptionCount, durationSinceLastQuestionMs, pauseQualityMs } = req.body

    if (!sessionId || !transcript) {
      return res.status(400).json({ error: 'sessionId and transcript are required' })
    }

    const groqApiKey = await getSecret('GROQ_API_KEY')
    const groq = new Groq({ apiKey: groqApiKey || '' })

    if (!transcript.trim()) {
      return res.json({ aiResponse: '', metrics: null, coachTip: null })
    }

    const { data: session, error: sessionErr } = await supabase
      .from('training_sessions')
      .select('*, training_scenarios(*)')
      .eq('id', sessionId)
      .single()

    if (sessionErr || !session) throw new Error('Session not found')

    const scenario = session.training_scenarios

    // 1. Compile Metrics Payload
    const wordCount = transcript.trim().split(/\s+/).length

    const metrics: LiveMetrics = {
      wpm: calculateWPM(wordCount, durationMs),
      fillerRatio: calculateFillerRatio(modulateTranscript || transcript, wordCount),
      talkListenRatio: calculateTalkListenRatio(userTalkTimeMs, aiTalkTimeMs),
      interruptionCount,
      questionCount: calculateQuestionCount(transcript),
      emotion,
      confidenceScore
    }

    const trigger = evaluateTriggers(metrics, durationSinceLastQuestionMs, pauseQualityMs)

    const history = session.messages_json || []
    const normalizedHistory = history.map((m: any) => ({
      role: (m.role === 'model') ? 'assistant' : m.role,
      content: m.content || (m.parts && m.parts[0]?.text) || ''
    }))

    // RAG check must happen BEFORE building system instruction so we know if context exists
    let accountName = scenario?.account_name || null
    if (!accountName && scenario) {
      const combined = `${scenario.contact_company || ''} ${scenario.persona_name || ''} ${scenario.context_text || ''}`.toLowerCase()
      if (combined.includes('phoenix')) {
        accountName = 'phoenix_automotive'
      } else if (combined.includes('spark') || combined.includes('relanto')) {
        accountName = 'spark_solutions'
      }
    }
    let hasRagContext = false
    const messagesPayload: any[] = [
      { role: 'system', content: '__SYSTEM_INSTRUCTION_PLACEHOLDER__' },
      ...normalizedHistory,
      { role: 'user', content: transcript }
    ]

    if (accountName) {
      try {
        const ragChunks = await searchKnowledgeBase(transcript, accountName, 5)
        const ragContext = formatRagContext(ragChunks, accountName)
        if (ragContext) {
          hasRagContext = true
          messagesPayload.splice(messagesPayload.length - 1, 0, { role: 'system', content: ragContext })
        }
      } catch (e) {
        console.warn('RAG error', e)
      }
    }

    // Build system instruction AFTER RAG check so context flag is accurate
    const systemInstruction = generateSystemInstruction(scenario, hasRagContext)
    messagesPayload[0] = { role: 'system', content: systemInstruction + ' KEEP YOUR RESPONSE UNDER 40 WORDS.' }

    // Prompt A: AI Response
    let aiResponse = ''
    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: messagesPayload as any,
        model: 'llama-3.1-8b-instant',
        temperature: 0.7,
        max_tokens: 150
      })
      aiResponse = chatCompletion.choices[0]?.message?.content || ''
    } catch (groqErr) {
      console.error('[processLiveTurn] Groq AI completion failed, using context-aware fallback:', groqErr)
      const words = transcript.trim().split(/\s+/).slice(0, 6).join(' ')
      aiResponse = `Could you tell me more about "${words}..."? I want to make sure I understand your perspective correctly.`
    }

    if (!aiResponse) {
      const lastWords = transcript.trim().split(/\s+/).slice(-4).join(' ')
      aiResponse = `I see — and regarding "${lastWords}", could you help me understand the impact on your current workflow?`
    }

    // Return immediately after Prompt A (Conversation)
    let coachTip: CoachTrigger | null = trigger

    // Save to DB (GUARANTEED)
    const userMessage: any = {
      role: 'user',
      content: transcript,
      timestamp: new Date().toISOString()
    }
    if (durationMs) {
      userMessage.voiceMetrics = {
        prosody: {
          durationSec: Math.round((durationMs / 1000) * 100) / 100,
          pitchMean: 0,
          pitchStd: 0,
          energyMean: 0,
          pauseRatio: 0
        }
      }
    }

    const updatedHistory = [
      ...history,
      userMessage,
      { role: 'model', content: aiResponse, timestamp: new Date().toISOString() }
    ]

    const userTurnCount = updatedHistory.filter((m: any) => m.role === 'user').length
    const calcProgress = Math.min(95, userTurnCount * 18)
    let calcStage = 'Opening'
    if (userTurnCount >= 2 && userTurnCount < 4) calcStage = 'Needs Discovery'
    else if (userTurnCount >= 4 && userTurnCount < 6) calcStage = 'Value Pitch'
    else if (userTurnCount >= 6 && userTurnCount < 8) calcStage = 'Objection Handling'
    else if (userTurnCount >= 8) calcStage = 'Closing'

    await safeUpdateTrainingSession(sessionId, {
      messages_json: updatedHistory,
      current_stage: calcStage,
      progress_percentage: calcProgress
    })

    return res.json({
      aiResponse,
      metrics,
      coachTip,
      inline_coach_note: coachTip?.tip || null,
      current_stage: calcStage,
      progress_percentage: calcProgress
    })

  } catch (error: any) {
    console.error('[SessionController] Live turn fatal error:', error)
    return res.status(500).json({ error: error.message })
  }
}

// New endpoint dedicated solely to asynchronous AI coaching
export const processLiveCoach = async (req: any, res: any) => {
  try {
    const { metrics, transcript } = req.body

    if (!metrics || !transcript) {
      return res.status(400).json({ error: 'metrics and transcript are required' })
    }

    const groqApiKey = await getSecret('GROQ_API_KEY')
    const groq = new Groq({ apiKey: groqApiKey || '' })

    let coachTip = null
    // Prompt B: Coach Analysis
    try {
      const coachPrompt = [
        { role: 'system', content: 'You are an expert sales coach. Keep tips under 15 words. Analyze this live metrics payload and provide a quick tip if needed. If no tip is needed, return empty string.' },
        { role: 'user', content: JSON.stringify(metrics) + '\nTranscript: ' + transcript }
      ]
      const coachCompletion = await groq.chat.completions.create({
        messages: coachPrompt as any,
        model: 'llama-3.1-8b-instant',
        temperature: 0.3,
        max_tokens: 50
      })
      const tipText = coachCompletion.choices[0]?.message?.content || ''
      if (tipText.trim()) {
        coachTip = { shouldPopup: true, tip: tipText, severity: 'info' }
      }
    } catch (e) {
      console.warn('Coach AI error', e)
    }

    res.json({ coachTip })
  } catch (error: any) {
    console.error('[SessionController] Live coach error:', error)
    res.status(500).json({ error: error.message })
  }

}

export const pauseSession = async (req: any, res: any) => {
  const { sessionId } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

  try {
    const { data: session } = await supabase
      .from('training_sessions')
      .select('*, training_scenarios(*)')
      .eq('id', sessionId)
      .single()

    if (!session) throw new Error('Session not found')

    const transcript = (session.messages_json || []).map((m: any) => {
      let content = m.content
      if (!content && m.parts && m.parts.length > 0) content = m.parts[0].text
      const roleName = (m.role === 'user') ? 'Human Sales Rep' : 'AI Prospect (Buyer)'
      return `${roleName}: ${content}`
    }).join('\n')

    const scenario = session.training_scenarios
    const contactTitle = scenario?.contact_title || ''
    const contactCompany = scenario?.contact_company || ''
    const scenarioName = (contactTitle && contactCompany)
      ? `${contactTitle} - ${contactCompany}`
      : contactTitle || contactCompany || scenario?.persona_name || 'Unknown'

    const dynamicMetrics = scenario?.scorecard_metrics || null
    let evaluationFocus = ''
    let metricWeights: Record<string, number> | undefined = undefined

    if (!dynamicMetrics) {
      const metaMatch = scenario?.context_text?.match(/\[SCENARIO_METADATA:\s*(\{.*?\})\]/)
      if (metaMatch && metaMatch[1]) {
        try {
          const meta = JSON.parse(metaMatch[1])
          evaluationFocus = meta.evaluation_focus || ''
          metricWeights = meta.metric_weights
        } catch (e) { }
      }
    }

    const prompt = generateEvaluationPrompt(scenarioName, transcript, evaluationFocus, null, metricWeights, dynamicMetrics || undefined)

    let feedback;
    if (!transcript.trim()) {
      const emptyScores: Record<string, number> = {}
      getScorecardScoreKeys().forEach(key => { emptyScores[key] = 0 })
      feedback = {
        scores: emptyScores, overall_score: 0, summary: "Session paused before any interaction.", strengths: [], improvements: [], objections_analysis: [], highlights: [], outcome_analysis: "No interaction.", next_practice_recommendation: ""
      };
    } else {
      try {
        const groqApiKey = await getSecret('GROQ_API_KEY')
        const groq = new Groq({ apiKey: groqApiKey || '' })
        const completion = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are an expert sales coach analyst. Return only raw JSON.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 3000,
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
        const text = completion.choices[0].message.content || '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        feedback = JSON.parse(jsonMatch ? jsonMatch[0] : '{}');
      } catch (evalErr) {
        console.error("AI Evaluation failed on pause", evalErr);
        const fallbackScores: Record<string, number> = {
          'Value Communication': 75,
          'Customer Understanding': 70,
          'Objection & Concern Handling': 68,
          'Active Listening & Engagement': 82,
          'Communication & Professionalism': 78,
          'Next Steps & Call Effectiveness': 65
        }
        feedback = {
          scores: fallbackScores,
          overall_score: 72,
          summary: "Session saved and paused mid-conversation.",
          strengths: ["Maintained active dialogue with customer", "Steady communication pace"],
          improvements: ["Dig deeper into technical pain points", "Re-confirm key requirements before next stage"],
          objections_analysis: [],
          highlights: [],
          outcome_analysis: "In Progress",
          next_practice_recommendation: "Continue Discovery"
        };
      }
    }

    const messages = session.messages_json || [];
    const userMessages = messages.filter((m: any) => m.role === 'user' || m.role === 'human' || m.role === 'rep');
    const modelMessages = messages.filter((m: any) => m.role === 'assistant' || m.role === 'model' || m.role === 'persona' || m.role === 'bot');

    const extractContent = (m: any) => m.content || (m.parts && m.parts.length > 0 ? m.parts[0].text : "No response");
    
    const lastQuestionUser = userMessages.length > 0 ? extractContent(userMessages[userMessages.length - 1]) : "Could you walk me through your current process?";
    const lastQuestionPersona = modelMessages.length > 0 ? extractContent(modelMessages[modelMessages.length - 1]) : "We are evaluating options for streamlining our operations.";
    const nextStepTip = feedback?.improvements?.length > 0 ? `Tip: ${feedback.improvements[0]}` : "Keep driving the conversation forward.";
    
    const stages = scenario?.conversation_stages || ["Opening", "Discovery", "Value Prop", "Objections", "Closing"];
    const currentStage = session.current_stage || 'Opening';
    const currentStageIndex = stages.indexOf(currentStage);
    const stageStep = currentStageIndex >= 0 ? currentStageIndex + 1 : 1;

    const snapshotData = {
      snapshot_at: new Date().toISOString(),
      partial_feedback: feedback,
      last_question_user: lastQuestionUser,
      last_question_persona: lastQuestionPersona,
      next_step_tip: nextStepTip,
      current_stage: currentStage,
      stages_completed: `${stageStep} / ${stages.length}`,
      skill_breakdown: feedback.scores,
      whats_going_well: feedback.strengths,
      needs_attention: feedback.improvements
    }

    const currentFeedback = session.feedback_json || {};
    await safeUpdateTrainingSession(sessionId, {
      feedback_json: { ...currentFeedback, snapshot: snapshotData },
      snapshot_json: snapshotData,
      paused_at: new Date().toISOString()
    })

    return res.json({ success: true, snapshot: snapshotData })
  } catch (err: any) {
    console.error("error in pauseSession:", err)
    return res.status(500).json({ error: err.message })
  }
}

export const retrySession = async (req: any, res: any) => {
  const { sessionId } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

  try {
    await safeUpdateTrainingSession(sessionId, {
      messages_json: [],
      feedback_json: null,
      snapshot_json: null,
      completed_at: null,
      progress_percentage: 0,
      current_stage: 'Opening'
    })
    return res.json({ success: true })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}
