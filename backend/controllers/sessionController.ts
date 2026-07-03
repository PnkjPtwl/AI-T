import { supabase } from '../db/supabase'
import Groq from 'groq-sdk'
import { generateSystemInstruction } from '../utils/promptGenerator'
import { generateEvaluationPrompt, getScorecardScoreKeys, generateConversationAnalyticsPrompt } from '../utils/evaluationGenerator'
import { getSecret } from '../lib/secrets'

const safeUpdateTrainingSession = async (sessionId: string, sessionUpdates: any) => {
  const { data: session } = await supabase.from('training_sessions').select('*').eq('id', sessionId).single();
  if (!session) return;
  const { data: assignments } = await supabase.from('training_assignments').select('*').eq('session_id', sessionId);
  if (assignments && assignments.length > 0) {
    for (const a of assignments) await supabase.from('training_assignments').delete().eq('id', a.id);
  }
  await supabase.from('training_sessions').delete().eq('id', sessionId);
  const newSession = { ...session, ...sessionUpdates };
  await supabase.from('training_sessions').insert(newSession);
  if (assignments && assignments.length > 0) {
    for (const a of assignments) await supabase.from('training_assignments').insert(a);
  }
}

const safeUpdateTrainingAssignment = async (assignmentId: string, assignmentUpdates: any) => {
  const { data: assignment } = await supabase.from('training_assignments').select('*').eq('id', assignmentId).single();
  if (!assignment) return;
  await supabase.from('training_assignments').delete().eq('id', assignmentId);
  const newAssignment = { ...assignment, ...assignmentUpdates };
  await supabase.from('training_assignments').insert(newAssignment);
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
        persona_type
      )
    `)
    .eq('rep_id', repId)
    .not('completed_at', 'is', null) // Only fetch completed sessions
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
    const scenarioName = scenario 
      ? `${scenario.persona_name} (${scenario.persona_type})` 
      : 'Practice Session'

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

  // 1. Link to assignment (either provided or found automatically)
  let targetAssignmentId = assignmentId;
  
  if (!targetAssignmentId) {
    console.log(`[AssignmentLifecycle] No assignmentId provided. searching for pending assignment for rep ${repId} and scenario ${scenarioId}`);
    const { data: autoAssign } = await supabase
      .from('training_assignments')
      .select('id')
      .eq('rep_id', repId)
      .eq('scenario_id', scenarioId)
      .in('status', ['Pending', 'Overdue'])
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (autoAssign) {
      console.log(`[AssignmentLifecycle] Auto-linked session ${data.id} to assignment ${autoAssign.id}`);
      targetAssignmentId = autoAssign.id;
    }
  }

  if (targetAssignmentId) {
    console.log(`[AssignmentLifecycle] Updating assignment ${targetAssignmentId} to 'In Progress' for session ${data.id}`);
    await safeUpdateTrainingAssignment(targetAssignmentId, { 
      session_id: data.id,
      status: 'In Progress'
    })
    

  }

  res.json({ sessionId: data.id })
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
      
    const transcript = (session.messages_json || []).map((m: any) => {
      let content = m.content
      if (!content && m.parts && m.parts.length > 0) {
        content = m.parts[0].text
      }
      // Use explicit labels to prevent LLM confusion
      const roleName = (m.role === 'user') ? 'Human Sales Rep' : 'AI Prospect (Buyer)'
      return `${roleName}: ${content}`
    }).join('\n')
    
    const scenario = session.training_scenarios
    const match = scenario?.context_text?.match(/\[SCENARIO:\s*(.*?)\]/)
    const scenarioName = match ? match[1] : (scenario?.persona_type || 'Unknown')

    // 2. MARK ASSIGNMENT AS COMPLETED (IMMEDIATELY)
    // We do this first to ensure the status updates even if AI evaluation fails
    console.log(`[AssignmentLifecycle] Searching for assignment to mark as COMPLETED for session: ${sessionId}`);
    let targetAssignmentId = null;
    
    // Check direct link first
    const { data: directAssign } = await supabase
      .from('training_assignments')
      .select('id')
      .eq('session_id', sessionId)
      .maybeSingle();
      
    if (directAssign) {
      targetAssignmentId = directAssign.id;
    } else {
      // Fallback search: find most recent relevant assignment
      const { data: fallbackAssign } = await supabase
        .from('training_assignments')
        .select('id')
        .eq('rep_id', session.rep_id)
        .eq('scenario_id', session.scenario_id)
        .in('status', ['Pending', 'In Progress', 'Overdue'])
        .order('assigned_at', { ascending: false })
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

    // 2.5 AGGREGATE VOICE METRICS (if any user messages have voiceMetrics)
    const userMessagesWithVoice = (session.messages_json || [])
      .filter((m: any) => m.role === 'user' && m.voiceMetrics?.prosody)
    
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
    let evaluationFocus = ''
    const metaMatch = scenario?.context_text?.match(/\[SCENARIO_METADATA:\s*(\{.*?\})\]/)
    if (metaMatch && metaMatch[1]) {
      try {
        const meta = JSON.parse(metaMatch[1])
        evaluationFocus = meta.evaluation_focus || ''
      } catch (e) {}
    }
    const prompt = generateEvaluationPrompt(scenarioName, transcript, evaluationFocus, voiceAggregate)
    
    let feedback;
    
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
        max_tokens: 3000,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
      
      const text = completion.choices[0].message.content || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : '{}';
      feedback = JSON.parse(jsonText);
    } catch (evalErr) {
      console.error("[AssignmentLifecycle] AI Evaluation failed, using fallback metrics", evalErr);
      // Build fallback scores using canonical scorecard keys
      const fallbackScores: Record<string, number> = {}
      getScorecardScoreKeys().forEach(key => { fallbackScores[key] = 0 })
      feedback = {
        scores: fallbackScores,
        overall_score: 0,
        summary: "The session was completed successfully, but the automated performance review is temporarily unavailable.",
        strengths: ["Completed the interaction"],
        improvements: ["Ensure AI analysis connects next time"],
        objections_analysis: [],
        highlights: [],
        outcome_analysis: "System fallback triggered — scores set to 0 as no evaluation was possible.",
        next_practice_recommendation: "General Practice"
      };
    }
    }
    
    // 4. Attach voice aggregate to feedback (additive — null-safe)
    if (voiceAggregate) {
      feedback.voice_delivery = voiceAggregate
    }

    // 5. CONVERSATION ANALYTICS (second isolated Groq call — never affects scorecard)
    if (transcript.trim()) {
      try {
        const groqApiKey2 = await getSecret('GROQ_API_KEY')
        const groq2 = new Groq({ apiKey: groqApiKey2 || '' })
        const analyticsPrompt = generateConversationAnalyticsPrompt(transcript, voiceAggregate)
        const analyticsCompletion = await groq2.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are a conversation analytics expert. Return only raw JSON.' },
            { role: 'user', content: analyticsPrompt }
          ],
          max_tokens: 2000,
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
        const analyticsText = analyticsCompletion.choices[0].message.content || '{}'
        const analyticsJson = analyticsText.match(/\{[\s\S]*\}/)
        if (analyticsJson) {
          feedback.conversation_analytics = JSON.parse(analyticsJson[0])
        }
        console.log('[ConversationAnalytics] Successfully generated analytics.')
      } catch (analyticsErr) {
        // Non-fatal: analytics failure must never break the main session save
        console.error('[ConversationAnalytics] Analytics call failed (non-fatal):', analyticsErr)
      }
    }

    // 6. Final Session Update
    await safeUpdateTrainingSession(sessionId, { 
      feedback_json: feedback,
      completed_at: new Date().toISOString()
    })
      
    return res.json(feedback)
  } catch (err: any) {
    console.error("CRITICAL error in endSession:", err)
    return res.status(200).json({
      scores: { opening: 0, discovery: 0, objection_handling: 0, talk_ratio: 0, closing: 0 },
      overall_score: 0,
      evaluation_summary: "An error occurred, but your session was recorded."
    })
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

    const prompt = `You are a real-time sales coaching AI. Analyse this single exchange between a Sales Rep and a Customer, and return ONLY a JSON object (no markdown).

Sales Rep said: "${(repMessage || '').substring(0, 400)}"

Customer replied: "${(customerReply || '').substring(0, 400)}"

Return exactly this JSON:
{
  "customer_sentiment": <0-100, where 0=very negative, 50=neutral, 100=very positive>,
  "rep_tone_type": "good" | "warn",
  "coaching_hint": "<1 short actionable sentence for the rep right now>"
}

RULES:
- customer_sentiment must reflect the emotional tone of the customer's reply.
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
      coaching_hint: 'Keep going — stay curious and listen actively.'
    })
  }
}
