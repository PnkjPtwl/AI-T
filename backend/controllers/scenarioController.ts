import { supabase } from '../db/supabase'
import fs from 'fs'
import path from 'path'

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

    // Step 2: Auto-seed if empty (only if we have an orgId)
    let finalData = data || [];
    if (finalData.length === 0 && orgId) {
      console.log("No scenarios found. Attempting to seed default scenarios...");
      const defaultScenarios = [
        { 
          persona_name: "Skeptical CFO", 
          persona_type: "Analytical/Dismissive", 
          difficulty: "Hard", 
          context_text: "[SCENARIO: Pricing Negotiation] Focus on ROI and cost-benefit analysis.", 
          evaluation_focus: "roi_justification, pricing_defense, logic",
          objection_style: "Heavily pushes back on cost without clear proof of value.",
          target_skills: "Negotiation, Financial Acumen",
          org_id: orgId 
        },
        { 
          persona_name: "Angry Customer", 
          persona_type: "Emotional/Aggressive", 
          difficulty: "Medium", 
          context_text: "[SCENARIO: Angry Customer Resolution] Practice de-escalation and empathy.", 
          evaluation_focus: "deescalation, empathy, resolution_pacing",
          objection_style: "Emotional and prone to interrupting if they feel unheard.",
          target_skills: "Conflict Resolution, Empathy",
          org_id: orgId 
        },
        { 
          persona_name: "Busy Executive", 
          persona_type: "Direct/Fast-paced", 
          difficulty: "Hard", 
          context_text: "[SCENARIO: Executive Sales Pitch] Deliver a 5-minute value proposition.", 
          evaluation_focus: "brevity, value_proposition, confidence",
          objection_style: "Impatient; demands direct answers to 'What's the bottom line?'",
          target_skills: "Executive Presence, Pitching",
          org_id: orgId 
        },
        { 
          persona_name: "New Prospect", 
          persona_type: "Neutral/Interested", 
          difficulty: "Easy", 
          context_text: "[SCENARIO: Cold Outreach Call] Open the conversation and book a discovery meeting.", 
          evaluation_focus: "hook, qualifying_questions, closing",
          objection_style: "Uses common brush-offs like 'Just send me an email.'",
          target_skills: "Cold Calling, Appointment Setting",
          org_id: orgId 
        },
        { 
          persona_name: "Existing Client", 
          persona_type: "Collaborative/Concerned", 
          difficulty: "Medium", 
          context_text: "[SCENARIO: Renewal Retention Call] Address churn risks and highlight realized value.", 
          evaluation_focus: "retention_strategy, relationship_building, expansion",
          objection_style: "Concerned about recent service issues but open to solutions.",
          target_skills: "Account Management, Retention",
          org_id: orgId 
        }
      ];

      const { data: seededData, error: seedError } = await supabase
        .from('training_scenarios')
        .insert(defaultScenarios)
        .select();

      if (seedError) {
        console.error("SEEDING ERROR:", seedError);
        // Don't crash here, just return empty if seeding fails
      } else {
        console.log("Seeding successful.");
        finalData = seededData || [];
      }
    }

    // Step 3: Enhance data
    const enhanced = finalData.map(s => {
      const match = s.context_text?.match(/\[SCENARIO:\s*(.*?)\]/);
      const scenario_name = (match && match[1]) ? match[1] : s.persona_type || 'General Training';
      return { ...s, scenario_name };
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
    custom_prompt
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
    target_skills
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
      target_skills: updates.target_skills
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
