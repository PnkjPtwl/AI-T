import { supabase } from '../db/supabase'
import fs from 'fs'
import path from 'path'
import { DynamicMetric } from '../utils/evaluationGenerator'
import Groq from 'groq-sdk'
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

export const generateScorecardMetrics = async (req: any, res: any) => {
  const { context_text, personality_traits, objection_style, target_skills, contact_title, contact_company } = req.body

  if (!context_text && !personality_traits && !target_skills) {
    return res.status(400).json({ error: 'Persona context is required to generate scorecard metrics.' })
  }

  try {
    const groqKey = await getSecret('GROQ_API_KEY')
    const groq = new Groq({ apiKey: groqKey })

    const prompt = `You are an expert sales training architect. Based on the following persona details, generate 5-7 SPECIFIC and RELEVANT scoring criteria for evaluating a sales rep's performance during a roleplay with this persona.

PERSONA DETAILS:
- Contact: ${contact_title || 'N/A'} at ${contact_company || 'N/A'}
- Scenario Context: ${context_text || ''}
- Personality & Traits: ${personality_traits || ''}
- Objection Style: ${objection_style || ''}
- Target Skills to Develop: ${target_skills || ''}

INSTRUCTIONS:
- Generate criteria that are SPECIFIC to this persona's context, industry, and behavior — not generic sales skills
- Each criterion should be directly testable from a conversation transcript
- Do NOT include weights (the manager will set those)
- Return ONLY a raw JSON array, no markdown, no explanation:

[
  {
    "name": "<Short criterion name, 2-5 words>",
    "description": "<1-2 sentence description of what to evaluate and what good/bad looks like for THIS specific persona>"
  }
]

Generate between 5 and 7 criteria. Make them precise and persona-specific.`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1200
    })

    let raw = completion.choices[0]?.message?.content || '[]'
    raw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

    // Extract the JSON array
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return res.status(500).json({ error: 'AI did not return valid JSON array' })

    const metrics: Array<{ name: string; description: string }> = JSON.parse(match[0])

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

    const { data, error } = await query.order('id', { ascending: true });

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

      return {
        ...s,
        contact_title,
        contact_company,
        display_label,
        target_skills,
        personality_traits,
        objection_style,
        scorecard_metrics
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
    scorecard_metrics
  } = req.body

  if (!persona_name || !context_text || !difficulty) {
    return res.status(400).json({ error: 'Persona name, context, and difficulty are required' })
  }

  const { data, error } = await supabase
    .from('training_scenarios')
    .insert({
      org_id: orgId,
      persona_name,
      persona_type: contact_title || persona_name, // kept for legacy compatibility
      context_text,
      difficulty,
      personality_traits,
      objection_style,
      conversation_expectations,
      target_skills,
      custom_prompt,
      contact_title,
      contact_company,
      scorecard_metrics: scorecard_metrics || null
    })
    .select()
    .single()

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

  // Clean context_text from metadata tags for display
  const clean_context = (data.context_text || '')
    .replace(/\n*\[SCENARIO_METADATA:\s*{[\s\S]*?}\]/g, '')
    .replace(/\n*\[MANDATORY EVALUATION RUBRIC[\s\S]*?(?=\n\[|$)/g, '')
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

    const { data, error } = await supabase
      .from('training_scenarios')
      .update({
        persona_name: updates.persona_name || existing.persona_name,
        persona_type: updates.contact_title || existing.contact_title || existing.persona_type,
        difficulty: updates.difficulty || existing.difficulty,
        context_text: baseContext,
        custom_prompt: updates.custom_prompt !== undefined ? updates.custom_prompt : existing.custom_prompt,
        personality_traits: updates.personality_traits !== undefined ? updates.personality_traits : existing.personality_traits,
        objection_style: updates.objection_style !== undefined ? updates.objection_style : existing.objection_style,
        conversation_expectations: updates.conversation_expectations !== undefined ? updates.conversation_expectations : existing.conversation_expectations,
        target_skills: updates.target_skills !== undefined ? updates.target_skills : existing.target_skills,
        contact_title: updates.contact_title !== undefined ? updates.contact_title : existing.contact_title,
        contact_company: updates.contact_company !== undefined ? updates.contact_company : existing.contact_company,
        // scorecard_metrics: manager can only update weights/delete/add custom — AI regen is NOT allowed in edit
        scorecard_metrics: updates.scorecard_metrics !== undefined ? updates.scorecard_metrics : existing.scorecard_metrics
      })
      .eq('id', scenarioId)
      .eq('org_id', orgId)
      .select()
      .single()

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
