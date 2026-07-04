import { supabase } from '../db/supabase'
import fs from 'fs'
import path from 'path'
import { getScorecardMetricNames, SCORECARD_CATEGORIES } from '../utils/evaluationGenerator'

export const getScorecardMetrics = async (_req: any, res: any) => {
  const metrics = getScorecardMetricNames().map(name => ({
    name,
    description: SCORECARD_CATEGORIES[name].description,
  }))
  res.json(metrics)
}

export const getScenarios = async (req: any, res: any) => {
  console.log("--- GET SCENARIOS DEBUG START ---");
  console.log("User Context:", { id: req.user?.id, org_id: req.user?.org_id, role: req.user?.role });

  try {
    const orgId = req.user?.org_id;

    if (!orgId) {
      console.warn("WARNING: No orgId found for user. Fetching global scenarios.");
    }

    // Step 1: Simplified query for debugging
    console.log(`Executing Supabase query for org_id: ${orgId}`);
    
    let query = supabase
      .from('training_scenarios')
      .select('*');

    // Only filter if orgId exists, otherwise fetch all for debug
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

    // Step 3: Enhance data
    const enhanced = finalData.map(s => {
      const match = s.context_text?.match(/\[SCENARIO:\s*(.*?)\]/);
      const scenario_name = (match && match[1]) ? match[1] : s.persona_type || 'General Training';
      
      let target_skills = '';
      let personality_traits = s.personality_traits || '';
      let objection_style = s.objection_style || '';
      let evaluation_focus = '';
      const metaMatch = s.context_text?.match(/\[SCENARIO_METADATA:\s*(\{.*?\})\]/);
      if (metaMatch && metaMatch[1]) {
        try {
          const meta = JSON.parse(metaMatch[1]);
          target_skills = meta.target_skills || '';
          if (!personality_traits) personality_traits = meta.personality_traits || '';
          if (!objection_style) objection_style = meta.objection_style || '';
          evaluation_focus = meta.evaluation_focus || '';
        } catch (e) {}
      }

      // We still fall back to legacy extraction if not in metadata for older formats
      if (!evaluation_focus && s.evaluation_focus) evaluation_focus = s.evaluation_focus;
      if (!evaluation_focus && s.context_text?.includes('roi_justification')) evaluation_focus = 'roi_justification, pricing_defense, logic'

      return { ...s, scenario_name, target_skills, personality_traits, objection_style, evaluation_focus };
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
    persona_type, 
    context_text, 
    difficulty,
    personality_traits,
    evaluation_focus,
    objection_style,
    conversation_expectations,
    target_skills,
    custom_prompt,
    assigned_reps,
    evaluation_questions
  } = req.body

  if (!persona_name || !persona_type || !context_text || !difficulty) {
    return res.status(400).json({ error: 'All fields are required' })
  }

  // Pack extra fields into a soft-schema JSON inside context_text
  const metadata = {
    personality_traits,
    evaluation_focus,
    objection_style,
    conversation_expectations,
    target_skills,
    contact_title: req.body.contact_title,
    contact_company: req.body.contact_company,
    metric_weights: req.body.metric_weights
  }
  

  const finalContextText = `${context_text}\n\n[SCENARIO_METADATA: ${JSON.stringify(metadata)}]`

  const { data, error } = await supabase
    .from('training_scenarios')
    .insert({
      org_id: orgId,
      persona_name,
      persona_type,
      context_text: finalContextText,
      difficulty,
      custom_prompt
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
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Default 7 days
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

  // Hydrate with rich JSON data
  const personasPath = path.join(__dirname, '../data/personas.json')
  const scenariosPath = path.join(__dirname, '../data/scenarios.json')
  
  let personas = []
  let scenarios = []
  
  try {
    personas = JSON.parse(fs.readFileSync(personasPath, 'utf8'))
    scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'))
  } catch (err) {
    console.error("Failed to read JSON config files", err)
  }

  const match = data.context_text?.match(/\[SCENARIO:\s*(.*?)\]/)
  const extractedScenarioName = (match && match[1]) ? match[1] : data.persona_type

  const personaConfig = personas.find((p: any) => p.persona_name === data.persona_name) || {}
  const scenarioConfig = scenarios.find((s: any) => s.scenario_name === extractedScenarioName) || {}

  const hydratedData = {
    ...data,
    scenario_name: extractedScenarioName || 'Sales Strategy Session',
    customer_info: personaConfig.customer_info || {
      name: data.persona_name,
      role: 'Decision Maker',
      company: 'Prospect Corp',
      industry: 'Enterprise'
    },
    personality_traits: data.personality_traits || personaConfig.personality_description || 'A professional looking to solve business challenges.',
    customer_goal: scenarioConfig.customer_goal || 'Understand the value proposition and potential ROI.',
    sales_rep_goal: scenarioConfig.sales_rep_goal || 'Establish trust and move the prospect to the next stage.',
    likely_objections: scenarioConfig.likely_objections || ['Pricing', 'Timing', 'Competitor Features'],
    coaching_focus_areas: scenarioConfig.coaching_focus_areas || ['discovery', 'objection_handling', 'closing'],
    preparation_tips: scenarioConfig.preparation_tips || [
      "Focus on identifying pain points early.",
      "Be prepared to defend value over price.",
      "Maintain a professional and consultative tone."
    ],
    suggested_discovery_questions: scenarioConfig.suggested_discovery_questions || [
      "What is your primary goal for this quarter?",
      "How are you currently handling these challenges?",
      "Who else would be involved in this decision?"
    ],
    persona_type: personaConfig.persona_type || data.persona_type || 'Professional Buyer',
    evaluation_focus: data.evaluation_focus || (scenarioConfig.coaching_focus_areas ? scenarioConfig.coaching_focus_areas.join(', ') : 'discovery, rapport, closing'),
    objection_style: data.objection_style || (scenarioConfig.likely_objections ? scenarioConfig.likely_objections.join(', ') : 'Standard transactional pushback.')
  }

  // Parse soft-schema from context_text if it exists (allows overrides)
  const jsonMatch = data.context_text?.match(/\[SCENARIO_METADATA:\s*({.*?})\]/s)
  if (jsonMatch) {
    try {
      const metadata = JSON.parse(jsonMatch[1])
      Object.assign(hydratedData, metadata)
    } catch (e) {
      console.error("Failed to parse scenario metadata JSON", e)
    }
  }

  res.json(hydratedData)
}


export const updateScenario = async (req: any, res: any) => {
  const { scenarioId } = req.params
  const orgId = req.user.org_id
  const updates = req.body

  try {
    // 1. Fetch current scenario to preserve org_id and context
    const { data: existing, error: fetchError } = await supabase
      .from('training_scenarios')
      .select('*')
      .eq('id', scenarioId)
      .eq('org_id', orgId)
      .single()

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Scenario not found or access denied' })
    }

    // Pack extra fields into a soft-schema JSON inside context_text
    const metadata = {
      personality_traits: updates.personality_traits,
      evaluation_focus: updates.evaluation_focus,
      objection_style: updates.objection_style,
      conversation_expectations: updates.conversation_expectations,
      target_skills: updates.target_skills,
      contact_title: updates.contact_title,
      contact_company: updates.contact_company,
      metric_weights: updates.metric_weights
    }
    
    // Ensure we don't append multiple metadata tags if updating
    let baseContext = updates.context_text || ''
    baseContext = baseContext.replace(/\\n*\\[SCENARIO_METADATA:.*?\\]/s, '')
    const finalContextText = `${baseContext}\n\n[SCENARIO_METADATA: ${JSON.stringify(metadata)}]`

    // 2. Update the DB with all columns
    const { data, error } = await supabase
      .from('training_scenarios')
      .update({
        persona_name: updates.persona_name,
        persona_type: updates.persona_type,
        difficulty: updates.difficulty,
        context_text: finalContextText,
        custom_prompt: updates.custom_prompt
      })
      .eq('id', scenarioId)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) throw error

    // 5. Return updated data
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
  const { repIds } = req.body; // array of UUIDs
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
    // get all reps in org
    const { data: reps, error: repsError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('org_id', orgId)
      .eq('role', 'rep');

    if (repsError) throw repsError;

    // get assignments for this scenario
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
