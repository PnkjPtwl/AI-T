import { supabase } from '../db/supabase'
import fs from 'fs'
import path from 'path'
import { DynamicMetric } from '../utils/evaluationGenerator'
import OpenAI from 'openai'
import { getSecret } from '../lib/secrets'

/** Helper: derive a human-readable display label from scenario data */
export function getScenarioDisplayLabel(scenario: any): string {
  const title = scenario.contact_title || ''
  const company = scenario.contact_company || ''
  if (title && company) return `${title} - ${company}`
  if (title) return title
  if (company) return company
  return scenario.persona_name || 'Unnamed Persona'
}

import { searchKnowledgeBase, formatRagContext } from '../utils/ragClient'

export const generateScorecardMetrics = async (req: any, res: any) => {
  const { context_text, personality_traits, objection_style, target_skills, contact_title, contact_company, account_name } = req.body

  if (!context_text && !personality_traits && !target_skills && !account_name) {
    return res.status(400).json({ error: 'Persona context or account selection is required to generate scorecard metrics.' })
  }

  try {
    const cerebrasApiKey = await getSecret('CEREBRAS_API_KEY')
    const groqApiKey = await getSecret('GROQ_API_KEY')
    const isCerebras = Boolean(cerebrasApiKey)
    const openai = new OpenAI({
      apiKey: cerebrasApiKey || groqApiKey || '',
      baseURL: isCerebras ? 'https://api.cerebras.ai/v1' : 'https://api.groq.com/openai/v1'
    })
    const modelName = isCerebras ? 'gpt-oss-120b' : 'openai/gpt-oss-20b'

    // Infer account_name if not provided directly
    let targetAccount = account_name
    if (!targetAccount) {
      const combinedStr = `${contact_company || ''} ${context_text || ''}`.toLowerCase()
      if (combinedStr.includes('phoenix')) {
        targetAccount = 'phoenix_automotive'
      }
    }

    // Fetch Knowledge Base chunks from RAG if an account is provided or inferred
    let kbContextStr = ''
    if (targetAccount) {
      try {
        const searchTarget = `${targetAccount} ${contact_company || ''} ${context_text || ''} business goals pain points call history brake system`.trim()
        const kbChunks = await searchKnowledgeBase(searchTarget, targetAccount, 5)
        if (kbChunks && kbChunks.length > 0) {
          kbContextStr = formatRagContext(kbChunks, targetAccount)
          console.log(`[ScorecardRAG] Retrieved ${kbChunks.length} KB chunks for scorecard generation for ${targetAccount}.`)
        }
      } catch (ragErr) {
        console.warn('[ScorecardRAG] KB retrieval skipped/failed:', ragErr)
      }
    }

    const prompt = `You are an expert sales training architect. Based on the following persona details${kbContextStr ? ' and retrieved Knowledge Base documents' : ''}, generate 5-7 SPECIFIC and RELEVANT scoring criteria for evaluating a sales rep's performance during a roleplay with this persona.

PERSONA & ACCOUNT DETAILS:
- Contact: ${contact_title || 'N/A'} at ${contact_company || 'N/A'}
- Scenario Context: ${context_text || ''}
- Personality & Traits: ${personality_traits || ''}
- Objection Style: ${objection_style || ''}
- Target Skills to Develop: ${target_skills || ''}
${kbContextStr ? `\nKNOWLEDGE BASE CONTEXT:\n${kbContextStr}\n` : ''}

INSTRUCTIONS:
- Ground the criteria directly in the Persona Context above${kbContextStr ? ' and the Knowledge Base context' : ''}
- Generate criteria that are SPECIFIC to this persona's context, industry, and behavior — not generic sales skills
- Each criterion should be directly testable from a conversation transcript
- Do NOT include weights (the manager will set those)
- Return ONLY a raw JSON object with a "metrics" array, no markdown, no explanation:

{
  "metrics": [
    {
      "name": "<Short criterion name, 2-5 words>",
      "description": "<1-2 sentence description of what to evaluate and what good/bad looks like for THIS specific persona>"
    }
  ]
}

Generate between 5 and 7 criteria. Make them precise and grounded in the Knowledge Base.`

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 1200,
      response_format: { type: 'json_object' }
    })

    let raw = completion.choices[0]?.message?.content || '{"metrics":[]}'
    raw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    // Extract the JSON object
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return res.status(500).json({ error: 'AI did not return valid JSON object' })

    const parsed = JSON.parse(match[0])
    const metrics: Array<{ name: string; description: string }> = parsed.metrics || []

    // Add default weight of 0 (manager sets)
    const withWeights: DynamicMetric[] = metrics.map(m => ({ ...m, weight: 0 }))
    res.json(withWeights)
  } catch (err: any) {
    console.error('Error generating scorecard metrics:', err)
    res.status(500).json({ error: err.message || 'Failed to generate scorecard metrics' })
  }
}

export const getScenarios = async (req: any, res: any) => {
  console.log("--- GET SCENARIOS DEBUG START ---");
  console.log("User Context:", { id: req.user?.id, org_id: req.user?.org_id, role: req.user?.role });

  try {
    const orgId = req.user?.org_id;

    if (!orgId) {
      console.warn("WARNING: No orgId found for user. Fetching global scenarios.");
    }

    let query = supabase
      .from('training_scenarios')
      .select('*');

    if (orgId) {
      query = query.eq('org_id', orgId);
    }

    const [{ data, error }, { data: assignments }] = await Promise.all([
      query.order('created_at', { ascending: false }),
      supabase.from('training_assignments').select('scenario_id')
    ]);

    if (error) {
      console.error("SUPABASE QUERY ERROR:", error);
      return res.status(500).json({ 
        success: false, 
        message: "Supabase query failed", 
        error: error.message,
        details: error 
      });
    }

    console.log(`Successfully fetched ${data?.length || 0} scenarios.`);

    // Build per-scenario assignment counts
    const assignmentCountMap: Record<string, number> = {}
    for (const a of (assignments || [])) {
      if (a.scenario_id) {
        assignmentCountMap[a.scenario_id] = (assignmentCountMap[a.scenario_id] || 0) + 1
      }
    }

    // Helper: compute "X days ago" from a timestamp
    const relativeTime = (ts: string | null): string => {
      if (!ts) return 'Recently'
      const diffMs = Date.now() - new Date(ts).getTime()
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays} days ago`
      if (diffDays < 14) return '1 week ago'
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
      if (diffDays < 60) return '1 month ago'
      return `${Math.floor(diffDays / 30)} months ago`
    }

    // Helper: Build a clean persona summary from structured fields (not raw context_text)
    const buildPersonaSummary = (s: any, contact_title: string, contact_company: string): string => {
      const parts: string[] = []
      const name = s.persona_name || contact_title || 'This persona'
      const role = contact_title || ''
      const company = contact_company || ''
      const industry = s.industry || ''
      const difficulty = s.difficulty || ''

      // Opening sentence
      if (role && company) {
        parts.push(`${name} is a ${role} at ${company}${industry ? ` in the ${industry} industry` : ''}.`)
      } else {
        parts.push(`${name} is a ${difficulty || 'sales'} training persona.`)
      }

      // Personality/communication style
      if (s.communication_style && typeof s.communication_style === 'string') {
        parts.push(s.communication_style)
      } else if (s.personality_traits) {
        const traits = typeof s.personality_traits === 'string'
          ? s.personality_traits.split(',').slice(0, 3).join(', ')
          : Array.isArray(s.personality_traits) ? s.personality_traits.slice(0, 3).join(', ') : ''
        if (traits) parts.push(`Key traits: ${traits}.`)
      }

      // Objection style
      if (s.objection_style && typeof s.objection_style === 'string' && s.objection_style.length < 200) {
        parts.push(s.objection_style)
      }

      return parts.join(' ').substring(0, 400) || 'No persona profile available.'
    }

    let finalData = data || [];

    const enhanced = finalData.map(s => {
      // Parse metadata from context_text for legacy scenarios that used the embedded approach
      let target_skills = s.target_skills || ''
      let personality_traits = s.personality_traits || ''
      let objection_style = s.objection_style || ''
      let contact_title = s.contact_title || ''
      let contact_company = s.contact_company || ''
      let scorecard_metrics = s.scorecard_metrics || null

      const metaMatch = s.context_text?.match(/\[SCENARIO_METADATA:\s*(\{.*?\})\]/)
      if (metaMatch && metaMatch[1]) {
        try {
          const meta = JSON.parse(metaMatch[1])
          if (!target_skills) target_skills = meta.target_skills || ''
          if (!personality_traits) personality_traits = meta.personality_traits || ''
          if (!objection_style) objection_style = meta.objection_style || ''
          if (!contact_title) contact_title = meta.contact_title || ''
          if (!contact_company) contact_company = meta.contact_company || ''
          if (!scorecard_metrics && meta.metric_weights) {
            // Legacy: convert old metric_weights to partial dynamic format
            scorecard_metrics = Object.entries(meta.metric_weights).map(([name, weight]) => ({
              name, weight, description: ''
            }))
          }
        } catch (e) {}
      }

      const display_label = (contact_title && contact_company)
        ? `${contact_title} - ${contact_company}`
        : contact_title || contact_company || s.persona_name || 'Unnamed Persona'

      const metricsCount = Array.isArray(scorecard_metrics) ? scorecard_metrics.length : (s.scorecard_json?.length || 0)
      const assignedCount = assignmentCountMap[s.id] || 0
      const updatedAgo = relativeTime(s.updated_at || s.created_at)
      const aiSummary = buildPersonaSummary({ ...s, personality_traits, objection_style }, contact_title, contact_company)

      return {
        ...s,
        contact_title,
        contact_company,
        display_label,
        target_skills,
        personality_traits,
        objection_style,
        scorecard_metrics,
        metrics_count: metricsCount,
        assigned_count: assignedCount,
        updated_ago: updatedAgo,
        ai_behavior_profile: aiSummary
      };
    });

    console.log("Returning enhanced scenarios to frontend.");
    console.log("--- GET SCENARIOS DEBUG END ---");
    return res.json(enhanced);

  } catch (err: any) {
    console.error("CRITICAL API ERROR in getScenarios:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error in getScenarios", 
      error: err.message,
      stack: err.stack 
    });
  }

}

export const createScenario = async (req: any, res: any) => {
  const orgId = req.user.org_id
  const { 
    persona_name, 
    context_text, 
    difficulty,
    personality_traits,
    objection_style,
    conversation_expectations,
    target_skills,
    custom_prompt,
    assigned_reps,
    evaluation_questions,
    contact_title,
    contact_company,
    scorecard_metrics,
    account_name
  } = req.body

  if (!persona_name || !context_text || !difficulty) {
    return res.status(400).json({ error: 'Persona name, context, and difficulty are required' })
  }

  const payload: any = {
    org_id: orgId,
    persona_name,
    persona_type: contact_title || persona_name,
    context_text,
    difficulty: difficulty ? difficulty.toLowerCase() : 'advanced',
    personality_traits,
    objection_style,
    conversation_expectations,
    target_skills,
    custom_prompt,
    contact_title,
    contact_company,
    scorecard_metrics: scorecard_metrics || null,
    account_name: account_name || null
  }

  let { data, error } = await supabase
    .from('training_scenarios')
    .insert(payload)
    .select()
    .single()

  if (error && (error.message?.includes('account_name') || error.code === 'PGRST204')) {
    console.warn("[createScenario] account_name column not found in Supabase schema cache, retrying without account_name column...")
    delete payload.account_name
    const retry = await supabase
      .from('training_scenarios')
      .insert(payload)
      .select()
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    return res.status(500).json({ error: error.message })
  }
  
  const newScenarioId = data.id;

  // Handle evaluation questions if provided
  if (evaluation_questions && Array.isArray(evaluation_questions) && evaluation_questions.length > 0) {
    const questionsToInsert = evaluation_questions.map((q: any) => ({
      scenario_id: newScenarioId,
      category: q.category || 'General',
      question_text: q.question_text,
      question_type: q.question_type || 'boolean',
      confidence_score: q.confidence_score || null
    }));
    
    const { error: eqError } = await supabase
      .from('scenario_evaluation_questions')
      .insert(questionsToInsert);
      
    if (eqError) console.error("Error inserting evaluation questions:", eqError);
  }

  // Handle rep assignments if provided
  if (assigned_reps && Array.isArray(assigned_reps) && assigned_reps.length > 0) {
    const assignmentsToInsert = assigned_reps.map((repId: string) => ({
      rep_id: repId,
      manager_id: req.user.id,
      scenario_id: newScenarioId,
      status: 'Pending',
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }));
    
    const { error: assignError } = await supabase
      .from('training_assignments')
      .insert(assignmentsToInsert);
      
    if (assignError) console.error("Error inserting training assignments:", assignError);
  }

  res.json(data)
}

export const getScenario = async (req: any, res: any) => {
  const { scenarioId } = req.params
  
  const { data, error } = await supabase
    .from('training_scenarios')
    .select('*')
    .eq('id', scenarioId)
    .single()
    
  if (error || !data) {
    return res.status(500).json({ error: error?.message || 'Scenario not found' })
  }

  // Parse metadata from legacy context_text if present
  let contact_title = data.contact_title || ''
  let contact_company = data.contact_company || ''
  let scorecard_metrics = data.scorecard_metrics || null
  let personality_traits = data.personality_traits || ''
  let objection_style = data.objection_style || ''
  let target_skills = data.target_skills || ''
  let conversation_expectations = data.conversation_expectations || ''

  const jsonMatch = data.context_text?.match(/\[SCENARIO_METADATA:\s*({.*?})\]/s)
  if (jsonMatch) {
    try {
      const metadata = JSON.parse(jsonMatch[1])
      if (!contact_title) contact_title = metadata.contact_title || ''
      if (!contact_company) contact_company = metadata.contact_company || ''
      if (!scorecard_metrics && metadata.metric_weights) {
        scorecard_metrics = Object.entries(metadata.metric_weights).map(([name, weight]) => ({
          name, weight, description: ''
        }))
      }
      if (!personality_traits) personality_traits = metadata.personality_traits || ''
      if (!objection_style) objection_style = metadata.objection_style || ''
      if (!target_skills) target_skills = metadata.target_skills || ''
      if (!conversation_expectations) conversation_expectations = metadata.conversation_expectations || ''
    } catch (e) {
      console.error("Failed to parse scenario metadata JSON", e)
    }
  }

  const display_label = (contact_title && contact_company)
    ? `${contact_title} - ${contact_company}`
    : contact_title || contact_company || data.persona_name || 'Unnamed Persona'

  // Clean context_text from metadata tags and question dumps for display
  const clean_context = (data.context_text || '')
    .replace(/\n*\[SCENARIO_METADATA:\s*{[\s\S]*?}\]/g, '')
    .replace(/\n*\[MANDATORY EVALUATION RUBRIC[\s\S]*?(?=\n\[|$)/g, '')
    .replace(/-\s*\[(Opening|Closing|Discovery|Objection|Pitch|Technical|General)\][^\n]*/gi, '')
    .replace(/Questions the Rep should aim to ask:[^\n]*/gi, '')
    .replace(/\n{2,}/g, '\n')
    .trim()

  const hydratedData = {
    ...data,
    contact_title,
    contact_company,
    display_label,
    scorecard_metrics,
    personality_traits,
    objection_style,
    target_skills,
    conversation_expectations,
    context_text: clean_context,
    customer_info: {
      name: data.persona_name,
      role: contact_title || 'Decision Maker',
      company: contact_company || 'Prospect Corp',
      industry: 'Enterprise'
    },
    customer_goal: 'Understand the value proposition and potential ROI.',
    sales_rep_goal: 'Establish trust and move the prospect to the next stage.',
    likely_objections: ['Pricing', 'Timing', 'Competitor Features'],
    coaching_focus_areas: ['discovery', 'objection_handling', 'closing'],
    preparation_tips: [
      "Focus on identifying pain points early.",
      "Be prepared to defend value over price.",
      "Maintain a professional and consultative tone."
    ],
    suggested_discovery_questions: [
      "What is your primary goal for this quarter?",
      "How are you currently handling these challenges?",
      "Who else would be involved in this decision?"
    ]
  }

  res.json(hydratedData)
}


export const updateScenario = async (req: any, res: any) => {
  const { scenarioId } = req.params
  const orgId = req.user.org_id
  const updates = req.body

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('training_scenarios')
      .select('*')
      .eq('id', scenarioId)
      .eq('org_id', orgId)
      .single()

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Scenario not found or access denied' })
    }

    // Clean context_text from old embedded metadata
    let baseContext = updates.context_text || existing.context_text || ''
    baseContext = baseContext.replace(/\n*\[SCENARIO_METADATA:\s*{[\s\S]*?}\]/g, '').trim()

    const updatePayload: any = {
      persona_name: updates.persona_name || existing.persona_name,
      persona_type: updates.contact_title || existing.contact_title || existing.persona_type,
      difficulty: updates.difficulty ? updates.difficulty.toLowerCase() : existing.difficulty,
      context_text: baseContext,
      custom_prompt: updates.custom_prompt !== undefined ? updates.custom_prompt : existing.custom_prompt,
      personality_traits: updates.personality_traits !== undefined ? updates.personality_traits : existing.personality_traits,
      objection_style: updates.objection_style !== undefined ? updates.objection_style : existing.objection_style,
      conversation_expectations: updates.conversation_expectations !== undefined ? updates.conversation_expectations : existing.conversation_expectations,
      target_skills: updates.target_skills !== undefined ? updates.target_skills : existing.target_skills,
      contact_title: updates.contact_title !== undefined ? updates.contact_title : existing.contact_title,
      contact_company: updates.contact_company !== undefined ? updates.contact_company : existing.contact_company,
      scorecard_metrics: updates.scorecard_metrics !== undefined ? updates.scorecard_metrics : existing.scorecard_metrics,
      account_name: updates.account_name !== undefined ? updates.account_name : existing.account_name
    }

    let { data, error } = await supabase
      .from('training_scenarios')
      .update(updatePayload)
      .eq('id', scenarioId)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error && (error.message?.includes('account_name') || error.code === 'PGRST204')) {
      delete updatePayload.account_name
      const retry = await supabase
        .from('training_scenarios')
        .update(updatePayload)
        .eq('id', scenarioId)
        .eq('org_id', orgId)
        .select()
        .single()
      data = retry.data
      error = retry.error
    }

    if (error) throw error

    res.json(data)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const deleteScenario = async (req: any, res: any) => {
  const { scenarioId } = req.params
  const orgId = req.user.org_id

  try {
    // 1. Check for active assignments
    const { count: activeCount, error: countError } = await supabase
      .from('training_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('scenario_id', scenarioId)
      .eq('status', 'Pending')

    if (countError) throw countError

    if (activeCount && activeCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete scenario with active assignments.',
        details: `This scenario is currently assigned to ${activeCount} representatives. Please reassign or delete the assignments first.`
      })
    }

    // 2. Perform deletion
    const { error: deleteError } = await supabase
      .from('training_scenarios')
      .delete()
      .eq('id', scenarioId)
      .eq('org_id', orgId)

    if (deleteError) throw deleteError

    res.json({ message: 'Scenario deleted successfully' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
}

export const assignRepsToScenario = async (req: any, res: any) => {
  const { scenarioId } = req.params;
  const { repIds } = req.body;
  const managerId = req.user.id;

  if (!repIds || !Array.isArray(repIds)) {
    return res.status(400).json({ error: 'repIds must be an array' });
  }

  try {
    const { data: existing } = await supabase
      .from('training_assignments')
      .select('rep_id')
      .eq('scenario_id', scenarioId)
      .in('rep_id', repIds);

    const existingRepIds = new Set((existing || []).map((e: any) => e.rep_id));
    const newRepIds = repIds.filter((id: string) => !existingRepIds.has(id));

    if (newRepIds.length > 0) {
      const assignmentsToInsert = newRepIds.map((repId: string) => ({
        rep_id: repId,
        manager_id: managerId,
        scenario_id: scenarioId,
        status: 'Pending',
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }));

      const { error: assignError } = await supabase
        .from('training_assignments')
        .insert(assignmentsToInsert);

      if (assignError) throw assignError;
    }

    res.json({ message: 'Reps assigned successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export const getScenarioAssignments = async (req: any, res: any) => {
  const { scenarioId } = req.params;
  const orgId = req.user.org_id;

  try {
    const { data: reps, error: repsError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('org_id', orgId)
      .eq('role', 'rep');

    if (repsError) throw repsError;

    const { data: assignments, error: assignError } = await supabase
      .from('training_assignments')
      .select('rep_id, status')
      .eq('scenario_id', scenarioId);

    if (assignError) throw assignError;

    const assignedRepIds = new Set((assignments || []).map((a: any) => a.rep_id));

    const result = (reps || []).map((rep: any) => ({
      ...rep,
      isAssigned: assignedRepIds.has(rep.id),
      status: (assignments || []).find((a: any) => a.rep_id === rep.id)?.status || null
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/scenarios/:id
 * Rich V2 detail payload for Training Briefing page & Manager Slide-over
 */
export const getScenarioById = async (req: any, res: any) => {
  const id = req.params.scenarioId || req.params.id

  try {
    const { data: scenario, error } = await supabase
      .from('training_scenarios')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !scenario) {
      return res.status(404).json({ error: 'Scenario not found' })
    }

    const personaName = scenario.contact_title || scenario.persona_name || 'Sarah Chen'
    const company = scenario.contact_company || 'Acme Technologies'
    const roleTitle = scenario.contact_title || 'VP of Engineering'
    const cleanContextText = (scenario.context_text || '')
      .replace(/\n*\[SCENARIO_METADATA:\s*{[\s\S]*?}\]/g, '')
      .replace(/\n*\[MANDATORY EVALUATION RUBRIC[\s\S]*?(?=\n\[|$)/g, '')
      .replace(/-\s*\[(Opening|Closing|Discovery|Objection|Pitch|Technical|General)\][^\n]*/gi, '')
      .replace(/Questions the Rep should aim to ask:[^\n]*/gi, '')
      .trim()

    res.json({
      ...scenario,
      id: scenario.id,
      personaName,
      company,
      roleTitle,
      experienceYears: scenario.experience_years || null,
      industry: scenario.industry || 'Automotive & Industrial',
      buyingStyle: scenario.buying_style || 'Technical & Value-driven',
      communicationStyle: scenario.communication_style || 'Direct and concise. Prefers written proposals, detailed specs, and product demos.',
      personalityTraits: scenario.personality_traits && Array.isArray(scenario.personality_traits) 
        ? scenario.personality_traits 
        : (typeof scenario.personality_traits === 'string' && scenario.personality_traits ? scenario.personality_traits.split(',').map((s: string) => s.trim()) : []),
      priorityGoals: scenario.priority_goals && scenario.priority_goals.length > 0 
        ? scenario.priority_goals 
        : (scenario.business_goals || []),
      customerBackground: scenario.customer_background || cleanContextText || `${company} is evaluating supplier capabilities, performance specifications, and implementation requirements.`,
      businessGoals: scenario.business_goals && scenario.business_goals.length > 0
        ? scenario.business_goals
        : [],
      painPoints: scenario.pain_points && scenario.pain_points.length > 0
        ? scenario.pain_points
        : [],
      expectedObjections: scenario.expected_objections && scenario.expected_objections.length > 0
        ? scenario.expected_objections
        : [],
      meetingObjective: scenario.meeting_objective || `Qualify the opportunity with ${company} and establish technical & operational fit.`,
      buyingSignals: scenario.buying_signals && scenario.buying_signals.length > 0
        ? scenario.buying_signals
        : [],
      skillsEvaluated: scenario.skills_evaluated && scenario.skills_evaluated.length > 0
        ? scenario.skills_evaluated
        : (scenario.target_skills ? (typeof scenario.target_skills === 'string' ? scenario.target_skills.split(',').map((s: string) => s.trim()) : scenario.target_skills) : []),
      aiConfidencePct: scenario.ai_confidence_pct || 90,
      tags: scenario.tags && scenario.tags.length > 0 ? scenario.tags : [scenario.difficulty || 'Advanced', 'Technical Buyer'],
      difficulty: scenario.difficulty || 'Advanced',
      estimatedDurationMins: scenario.estimated_duration_mins || 20,
      conversationStages: scenario.conversation_stages || [
        "Opening", "Discovery", "Pitch & Presentation", "Objection Handling", "Closing"
      ]
    })
  } catch (err: any) {
    console.error('Error fetching scenario by id:', err)
    res.status(500).json({ error: 'Failed to fetch scenario details', message: err.message })
  }
}

/**
 * GET /api/manager/scenarios
 * Persona Library Grid & Slide-over for Manager
 */
export const getManagerScenarios = async (req: any, res: any) => {
  const orgId = req.user.org_id

  try {
    const { data: scenarios, error } = await supabase
      .from('training_scenarios')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    const { data: assignments } = await supabase
      .from('training_assignments')
      .select('id, scenario_id')

    const transformed = (scenarios || []).map(sc => {
      const usageCount = (assignments || []).filter(a => a.scenario_id === sc.id).length
      const cleanCtx = (sc.context_text || '')
        .replace(/\n*\[SCENARIO_METADATA:\s*{[\s\S]*?}\]/g, '')
        .replace(/-\s*\[(Opening|Closing|Discovery|Objection|Pitch|Technical|General)\][^\n]*/gi, '')
        .replace(/Questions the Rep should aim to ask:[^\n]*/gi, '')
        .trim()

      const pName = sc.persona_name || sc.contact_title || 'Training Persona'
      const rTitle = sc.contact_title || 'Decision Maker'
      const comp = sc.contact_company || 'Enterprise Account'

      const dynamicSummary = sc.ai_behavior_profile || sc.customer_background ||
        (cleanCtx.length > 10 ? cleanCtx.substring(0, 300) : `${pName} is a ${rTitle} at ${comp} evaluating supplier capabilities and technical specifications.`)

      return {
        ...sc,
        id: sc.id,
        personaName: pName,
        company: comp,
        title: rTitle,
        difficulty: sc.difficulty || 'Advanced',
        industry: sc.industry || 'General',
        tags: sc.tags && sc.tags.length > 0 ? sc.tags : [sc.difficulty || 'Advanced', 'Technical Buyer'],
        usageCount: usageCount || 0,
        metricsCount: sc.scorecard_metrics?.length || sc.scorecard_json?.length || 0,
        lastUpdatedText: sc.updated_at ? 'Recently updated' : 'Created recently',
        aiBehaviorProfile: dynamicSummary,
        communicationStyle: sc.communication_style || 'Direct and concise. Prefers written proposals, detailed specs, and product demos.',
        painPoints: sc.pain_points || [],
        businessGoals: sc.business_goals || [],
        decisionDrivers: sc.decision_drivers || [],
        targetSkills: sc.skills_evaluated || (sc.target_skills ? (typeof sc.target_skills === 'string' ? sc.target_skills.split(',').map((s: string) => s.trim()) : sc.target_skills) : []),
        evalScorecard: sc.scorecard_metrics || sc.scorecard_json || []
      }
    })

    res.json(transformed)
  } catch (err: any) {
    console.error('Error fetching manager persona library:', err)
    res.status(500).json({ error: 'Failed to fetch persona library', message: err.message })
  }
}

export const fetchHubspotData = async (req: any, res: any) => {
  const { account_name } = req.body;
  if (!account_name) {
    return res.status(400).json({ error: 'account_name is required' });
  }

  try {
    const ragApiUrl = process.env.RAG_API_URL || 'http://localhost:8001';
    // 1. Fetch raw documents from RAG API's new hubspot endpoint
    const response = await fetch(`${ragApiUrl}/hubspot/fetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_name })
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch from RAG API: ${response.statusText}`);
    }

    const result = (await response.json()) as any;
    if (!result.success || !result.documents) {
      throw new Error(result.error || 'Failed to fetch HubSpot documents');
    }

    // 2. Format documents into a single text block for LLM synthesis
    let rawContext = '';
    result.documents.forEach((doc: any) => {
      rawContext += `\n--- CRM Object: ${doc.metadata?.crm_object || 'unknown'} ---\n`;
      rawContext += doc.page_content + '\n';
    });

    if (!rawContext.trim()) {
      return res.status(404).json({ error: 'No data found in HubSpot for this account' });
    }

    // 3. Synthesize the raw data using LLM to match the frontend form schema
    const cerebrasApiKey = await getSecret('CEREBRAS_API_KEY');
    const groqApiKey = await getSecret('GROQ_API_KEY');
    const isCerebras = Boolean(cerebrasApiKey);
    const openai = new OpenAI({
      apiKey: cerebrasApiKey || groqApiKey || '',
      baseURL: isCerebras ? 'https://api.cerebras.ai/v1' : 'https://api.groq.com/openai/v1'
    });
    const modelName = isCerebras ? 'gpt-oss-120b' : 'openai/gpt-oss-20b';

    const prompt = `You are an expert sales enablement AI. Parse the following raw HubSpot CRM data for an account and synthesize a realistic roleplay training persona.
    
Raw CRM Data:
${rawContext}

Return ONLY a valid JSON object matching this structure:
{
  "persona_name": "string (the primary contact's name, or a realistic name if none found)",
  "contact_title": "string (the primary contact's job title)",
  "contact_company": "string (the company name)",
  "context_text": "string (a 3-5 sentence summary of the company, their pain points, goals, active deals, and recent engagement notes)",
  "target_skills": "string (comma separated list of 3-4 sales skills the rep should practice, e.g. Discovery, Objection Handling, ROI Justification)",
  "personality_traits": "string (a short sentence describing their traits based on notes/titles)",
  "objection_style": "string (a short sentence explaining how they might object based on their context)"
}`;

    const completion = await openai.chat.completions.create({
      model: modelName,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    let rawJson = completion.choices[0]?.message?.content || '{}';
    rawJson = rawJson.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    const match = rawJson.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('LLM did not return valid JSON');

    const parsedPersona = JSON.parse(match[0]);

    return res.json({ success: true, data: parsedPersona });
  } catch (err: any) {
    console.error('Error fetching/synthesizing HubSpot data:', err);
    return res.status(500).json({ error: err.message || 'Internal error while processing HubSpot data' });
  }
}


