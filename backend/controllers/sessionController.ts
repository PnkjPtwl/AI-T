import { supabase } from '../db/supabase'
import Groq from 'groq-sdk'
import { generateSystemInstruction } from '../utils/promptGenerator'
import { generateEvaluationPrompt } from '../utils/evaluationGenerator'
import { getSecret } from '../lib/secrets'
import { analyzeVoice, VoiceMetrics } from '../services/voiceAiClient'

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
  const { sessionId, message } = req.body
  
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

    const updatedHistory = [...normalizedHistory, { role: 'user', content: message }, { role: 'assistant', content: replyText }]
    
    await safeUpdateTrainingSession(sessionId, { messages_json: updatedHistory })
      
    return res.json({ reply: replyText })
  } catch (err: any) {
    console.error("Groq error:", err)
    return res.status(200).json({
      reply: "Sorry, I couldn't process that. Please try again."
    })
  }
}

export const sendVoiceMessage = async (req: any, res: any) => {
  const { sessionId } = req.body
  const audioFile = req.file

  if (!sessionId || !audioFile) {
    return res.status(400).json({ error: 'sessionId and audio file are required' })
  }

  try {
    const groqApiKey = await getSecret('GROQ_API_KEY')
    const groq = new Groq({ apiKey: groqApiKey || '' })

    // Fan out: Whisper STT + voice prosody analysis in parallel
    // analyzeVoice returns null if disabled/failed — never blocks the flow
    const [transcription, voiceMetrics] = await Promise.all([
      groq.audio.transcriptions.create({
        file: new File([audioFile.buffer], 'audio.webm', { 
          type: audioFile.mimetype 
        }),
        model: 'whisper-large-v3',
        language: 'en'
      }),
      analyzeVoice(audioFile.buffer, 'turn.webm'),
    ])

    const userText = transcription.text
    if (!userText) throw new Error("Transcription failed")

    const { data: session, error: sessionErr } = await supabase
      .from('training_sessions')
      .select('*, training_scenarios(*)')
      .eq('id', sessionId)
      .single()

    if (sessionErr || !session) throw new Error('Session not found')
    
    const scenario = session.training_scenarios
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
        content: 'SYSTEM NOTIFICATION: The meeting time is almost up.'
      })
    }
    messagesPayload.push({ role: 'user', content: userText })

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messagesPayload,
      max_tokens: 80,
      temperature: 0.7
    })

    const replyText = completion.choices[0].message.content
    if (!replyText) throw new Error("Empty response from Groq")

    // Attach voiceMetrics to the user message (null-safe — old messages won't have it)
    const userMsg: any = { role: 'user', content: userText }
    if (voiceMetrics && voiceMetrics.status === 'ok' && voiceMetrics.prosody) {
      userMsg.voiceMetrics = voiceMetrics
    }
    const updatedHistory = [...normalizedHistory, userMsg, { role: 'assistant', content: replyText }]
    await safeUpdateTrainingSession(sessionId, { messages_json: updatedHistory })

    return res.json({ userText, reply: replyText, voiceMetrics: voiceMetrics || undefined })
  } catch (err: any) {
    console.error("Voice message error:", err)
    return res.status(500).json({ error: err.message })
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
      const role = (m.role === 'model') ? 'assistant' : m.role
      return `${role}: ${content}`
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
    const evaluationFocus = scenario?.evaluation_focus || ''
    const prompt = generateEvaluationPrompt(scenarioName, transcript, evaluationFocus, voiceAggregate)
    
    let feedback;
    
    if (!transcript.trim()) {
      feedback = {
        scores: { opening: 0, discovery: 0, objection_handling: 0, talk_ratio: 0, closing: 0 },
        overall_score: 0,
        summary: "The session ended before any interaction took place.",
        strengths: [],
        improvements: ["Ensure you interact with the AI before ending the session."],
        objections_analysis: [],
        highlights: [],
        outcome_analysis: "No data available due to empty session.",
        next_practice_recommendation: "Please try the scenario again and speak with the Persona."
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
        max_tokens: 1000,
        temperature: 0.3
      })
      
      const text = completion.choices[0].message.content || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : '{}';
      feedback = JSON.parse(jsonText);
    } catch (evalErr) {
      console.error("[AssignmentLifecycle] AI Evaluation failed, using fallback metrics", evalErr);
      feedback = {
        scores: { opening: 75, discovery: 75, objection_handling: 75, talk_ratio: 75, closing: 75 },
        overall_score: 75,
        summary: "The session was completed successfully, but the automated performance review is temporarily unavailable.",
        strengths: ["Completed the interaction"],
        improvements: ["Ensure AI analysis connects next time"],
        objections_analysis: [],
        highlights: [],
        outcome_analysis: "System fallback triggered.",
        next_practice_recommendation: "General Practice"
      };
    }
    }
    
    // 4. Attach voice aggregate to feedback (additive — null-safe)
    if (voiceAggregate) {
      feedback.voice_delivery = voiceAggregate
    }

    // 5. Final Session Update
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
