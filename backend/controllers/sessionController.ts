import { supabase } from '../db/supabase'
import Groq from 'groq-sdk'
import { generateSystemInstruction } from '../utils/promptGenerator'
import { generateEvaluationPrompt } from '../utils/evaluationGenerator'

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
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (autoAssign) {
      console.log(`[AssignmentLifecycle] Auto-linked session ${data.id} to assignment ${autoAssign.id}`);
      targetAssignmentId = autoAssign.id;
    }
  }

  if (targetAssignmentId) {
    console.log(`[AssignmentLifecycle] Updating assignment ${targetAssignmentId} to 'In Progress' for session ${data.id}`);
    const { error: linkError } = await supabase
      .from('training_assignments')
      .update({ 
        session_id: data.id,
        status: 'In Progress'
      })
      .eq('id', targetAssignmentId)
      .eq('rep_id', repId)
    
    if (linkError) {
      console.error(`[AssignmentLifecycle] Failed to update assignment ${targetAssignmentId}:`, linkError);
    }
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

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })
    
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messagesPayload,
      max_tokens: 80,
      temperature: 0.7
    })
    
    const replyText = completion.choices[0].message.content

    if (!replyText) throw new Error("Empty response from Groq")

    const updatedHistory = [...normalizedHistory, { role: 'user', content: message }, { role: 'assistant', content: replyText }]
    
    await supabase
      .from('training_sessions')
      .update({ messages_json: updatedHistory })
      .eq('id', sessionId)
      
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
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })

    const transcription = await groq.audio.transcriptions.create({
      file: new File([audioFile.buffer], 'audio.webm', { 
        type: audioFile.mimetype 
      }),
      model: 'whisper-large-v3',
      language: 'en'
    })

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

    const updatedHistory = [...normalizedHistory, { role: 'user', content: userText }, { role: 'assistant', content: replyText }]
    await supabase
      .from('training_sessions')
      .update({ messages_json: updatedHistory })
      .eq('id', sessionId)

    return res.json({ userText, reply: replyText })
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
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (fallbackAssign) {
        targetAssignmentId = fallbackAssign.id;
        console.log(`[AssignmentLifecycle] Found fallback assignment: ${targetAssignmentId}`);
      }
    }

    if (targetAssignmentId) {
      const { error: updateError } = await supabase
        .from('training_assignments')
        .update({
          status: 'Completed',
          completed_at: new Date().toISOString(),
          session_id: sessionId
        })
        .eq('id', targetAssignmentId);
      
      if (updateError) {
        console.error(`[AssignmentLifecycle] Failed to mark assignment ${targetAssignmentId} as Completed:`, updateError);
      } else {
        console.log(`[AssignmentLifecycle] Successfully marked assignment ${targetAssignmentId} as COMPLETED.`);
      }
    }

    // 3. AI EVALUATION
    const prompt = generateEvaluationPrompt(scenarioName, transcript)
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' })
    
    let feedback;
    try {
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
      const jsonText = text.replace(/`json|`/g, "").trim();
      feedback = JSON.parse(jsonText);
    } catch (evalErr) {
      console.error("[AssignmentLifecycle] AI Evaluation failed, using fallback metrics", evalErr);
      feedback = {
        scores: { opening: 75, discovery: 75, objection_handling: 75, talk_ratio: 75, closing: 75 },
        overall_score: 75,
        evaluation_summary: "The session was completed successfully, but the automated performance review is temporarily unavailable."
      };
    }
    
    // 4. Final Session Update
    await supabase
      .from('training_sessions')
      .update({ 
        feedback_json: feedback,
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      
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
