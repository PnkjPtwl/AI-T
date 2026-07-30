import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

const scenariosPath = path.join(__dirname, '../data/scenarios.json')
const scenarios = JSON.parse(fs.readFileSync(scenariosPath, 'utf8'))

const personasPath = path.join(__dirname, '../data/personas.json')
const personas = JSON.parse(fs.readFileSync(personasPath, 'utf8'))

async function seedScenarios() {
  console.log('Seeding scenarios...')

  // Fetch the first organization to attach these scenarios to
  const { data: orgs, error: orgErr } = await supabase.from('organisations').select('id').limit(1)
  if (orgErr || !orgs || orgs.length === 0) {
    console.error('No organisation found. Please create an organisation first.')
    return
  }
  const orgId = orgs[0].id

  // Clear existing scenarios to avoid duplicates
  console.log('Clearing existing scenarios...')
  await supabase.from('training_scenarios').delete().eq('org_id', orgId)

  // We will iterate over the scenarios and seed them into the DB
  for (const scenario of scenarios) {
    // Determine the persona to use
    // If the scenario has recommended_persona_types, we will pick the first one
    const personaName = scenario.recommended_persona_types[0] || personas[0].persona_name
    const persona = personas.find((p: any) => p.persona_name === personaName) || personas[0]

    // Create the context_text based on the scenario config
    const contextText = `[SCENARIO: ${scenario.scenario_name}] ${scenario.business_context} The goal is to ${scenario.sales_rep_goal}.`

    const rawDiff = scenario.difficulty_level.toLowerCase()
    let dbDiff = 'intermediate'
    if (rawDiff === 'easy') dbDiff = 'beginner'
    if (rawDiff === 'hard') dbDiff = 'advanced'

    const { error } = await supabase
      .from('training_scenarios')
      .insert({
        org_id: orgId,
        persona_name: persona.persona_name,
        persona_type: persona.persona_type,
        context_text: contextText,
        difficulty: dbDiff
      })
    
    if (error) {
      console.error(`Failed to insert scenario ${scenario.scenario_name}:`, error.message)
    } else {
      console.log(`Inserted scenario: ${scenario.scenario_name}`)
    }
  }

  console.log('Seeding complete!')
}

seedScenarios()
