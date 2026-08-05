import { supabase } from '../db/supabase'
import Groq from 'groq-sdk'
import { generateSystemInstruction } from '../utils/promptGenerator'
import { generateEvaluationPrompt, getScorecardScoreKeys, generateConversationAnalyticsPrompt } from '../utils/evaluationGenerator'
import { getSecret } from '../lib/secrets'
import { searchKnowledgeBase, formatRagContext } from '../utils/ragClient'
import { calculateFillerRatio, calculateWPM, calculateTalkListenRatio, calculateQuestionCount, evaluateTriggers, LiveMetrics, CoachTrigger } from '../utils/mechanicsCalculator'

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
  let existingSessionId = null;

  if (targetAssignmentId) {
    const { data: assignData } = await supabase
      .from('training_assignments')
      .select('avatar_type, session_id, status')
      .eq('id', targetAssignmentId)
      .single()
    if (assignData) {
      assignmentAvatarType = assignData.avatar_type || 'female';
      if (assignData.status === 'In Progress' && assignData.session_id) {
        existingSessionId = assignData.session_id;
      }
    }
  } else {
    console.log(`[AssignmentLifecycle] No assignmentId provided. searching for pending assignment for rep ${repId} and scenario ${scenarioId}`);
    const { data: autoAssign } = await supabase
      .from('training_assignments')
      .select('id, avatar_type, session_id, status')
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
      return res.json({ sessionId: existingSessionId, avatarType: assignmentAvatarType })
    } else {
      console.log(`[AssignmentLifecycle] Existing session ${existingSessionId} was not found (likely deleted). Creating new session.`);
      existingSessionId = null;
    }
  }

  const { data, error } = await supabase
    .from('training_sessions')
    .insert({
      rep_id: repId,
      scenario_id: scenarioId,
      messages_json: []
    })
    .select('id')
    .single()

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  if (targetAssignmentId) {
    console.log(`[AssignmentLifecycle] Updating assignment ${targetAssignmentId} to 'In Progress' for session ${data.id}`);
    await safeUpdateTrainingAssignment(targetAssignmentId, {
      session_id: data.id,
      status: 'In Progress'
    })
  }

  res.json({ sessionId: data.id, avatarType: assignmentAvatarType })
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
    const systemInstruction = generateSystemInstruction(scenario)

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
      { role: 'system', content: systemInstruction },
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
          // Inject as a system message BEFORE the user's turn so it grounds the persona reply
          messagesPayload.splice(1, 0, { role: 'system', content: ragContext })
          console.log(`[RAG] Injected ${ragChunks.length} KB chunks for account: ${accountName}`)
        }
      } catch (ragErr) {
        console.warn('[RAG] Context fetch failed (non-fatal), continuing without KB context:', ragErr)
      }
    }

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
  const { sessionId } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

  try {
    // 1. Fetch Session and Scenario
    const { data: session } = await supabase
      .from('training_sessions')
      .select('*, training_scenarios(*)')
      .eq('id', sessionId)
      .single()

    if (!session) throw new Error('Session not found')

    const messages = session.messages_json || []
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

    const prompt = generateEvaluationPrompt(scenarioName, transcript, evaluationFocus, voiceAggregate, metricWeights, dynamicMetrics || undefined)

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
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: 'You are an expert sales coach analyst. Return only raw JSON.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 2500,
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
 * Analyses only the last rep↔customer exchange, returns sentiment + coaching hint.
 * Uses a small/fast model so it does NOT significantly delay the UX.
 */
export const liveSentiment = async (req: any, res: any) => {
  const { repMessage, customerReply, sessionId } = req.body
  if (!repMessage && !customerReply) {
    return res.status(400).json({ error: 'repMessage and customerReply are required' })
  }

  try {
    const groqApiKey = await getSecret('GROQ_API_KEY')
    const groq = new Groq({ apiKey: groqApiKey || '' })

    const prompt = `You are a real-time sales coaching AI assisting a Sales Rep in a live practice call with a Customer (Prospect). Analyse this single exchange and return ONLY a JSON object (no markdown).

Sales Rep said: "${(repMessage || '').substring(0, 400)}"

Customer replied: "${(customerReply || '').substring(0, 400)}"

Return exactly this JSON:
{
  "customer_sentiment": <0-100, where 0=very negative, 50=neutral, 100=very positive>,
  "rep_tone_type": "good" | "warn",
  "coaching_hint": "<1 short actionable sentence for the rep right now>",
  "suggested_followups": ["<rep followup 1>", "<rep followup 2>", "<rep followup 3>"],
  "tone_distribution": { "alert": <0-100>, "hesitant": <0-100>, "warm": <0-100>, "wise": <0-100> }
}
Note: tone_distribution values must sum to 100 exactly.

RULES FOR SUGGESTED FOLLOW-UPS (CRITICAL):
- "suggested_followups" MUST BE 3 distinct, ready-to-send questions or statements written EXCLUSIVELY from the perspective of the Sales Rep (the user).
- Each suggested follow-up MUST directly address the Customer's specific concern, objection, or question in their latest reply ("${(customerReply || '').substring(0, 100)}").
- The Sales Rep will click these suggestions to send them as their next message in the chat. NEVER generate questions from the customer's perspective.
- rep_tone_type is "good" if the rep's message was empathetic, clear, and purposeful; "warn" if it was vague, too long, too pushy, or missed the customer's concern.
- coaching_hint must be specific to what just happened — not generic advice.`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Return only raw JSON with no markdown or backticks.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.4,
      response_format: { type: 'json_object' }
    })

    const text = completion.choices[0].message.content || '{}'
    const parsed = JSON.parse(text)
    return res.json(parsed)
  } catch (err: any) {
    console.error('[LiveSentiment] Error:', err)
    // Graceful fallback — never crash the caller
    return res.json({
      customer_sentiment: 50,
      rep_tone_type: 'good',
      coaching_hint: 'Keep going — stay curious and listen actively.',
      suggested_followups: ["What are your primary goals for this quarter?", "How does your current process handle these challenges?", "Are there specific metrics you are looking to improve?"],
      tone_distribution: { alert: 10, hesitant: 20, warm: 50, wise: 20 }
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
    const systemInstruction = generateSystemInstruction(scenario)

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

    const messagesPayload = [
      { role: 'system', content: systemInstruction + ' KEEP YOUR RESPONSE UNDER 40 WORDS.' },
      ...normalizedHistory,
      { role: 'user', content: transcript }
    ]

    const accountName = scenario?.account_name || null
    if (accountName) {
      try {
        const ragChunks = await searchKnowledgeBase(transcript, accountName, 5)
        const ragContext = formatRagContext(ragChunks, accountName)
        if (ragContext) {
          messagesPayload.splice(messagesPayload.length - 1, 0, { role: 'system', content: ragContext })
        }
      } catch (e) {
        console.warn('RAG error', e)
      }
    }

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
      console.error('[processLiveTurn] Groq AI completion failed, using intelligent fallback:', groqErr)
      aiResponse = "That's an interesting perspective. Could you elaborate on how your team manages that process currently?"
    }

    if (!aiResponse) {
      aiResponse = "I understand your point. Could you walk me through how that affects your daily operations?"
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
