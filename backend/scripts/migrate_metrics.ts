import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

// Canonical Metrics
const CANONICAL_METRICS = [
  'Communication & Professionalism',
  'Customer Understanding',
  'Active Listening & Engagement',
  'Value Communication',
  'Objection & Concern Handling',
  'Next Steps & Call Effectiveness',
]

// Mapping old skill keys to new canonical score keys
const SCORE_KEY_MAPPING: Record<string, string> = {
  'opening': 'communication___professionalism',
  'discovery': 'customer_understanding',
  'talk_ratio': 'active_listening___engagement',
  'objection_handling': 'objection___concern_handling',
  'closing': 'next_steps___call_effectiveness'
}

async function migrate() {
  console.log("🚀 Starting Metrics Migration...")

  // 1. MIGRATE SCENARIOS (evaluation_focus inside context_text metadata)
  console.log("\n--- Migrating Scenarios ---")
  const { data: scenarios, error: scenariosErr } = await supabase.from('training_scenarios').select('id, context_text')
  if (scenariosErr) throw scenariosErr

  let updatedScenarios = 0
  for (const scenario of scenarios) {
    if (!scenario.context_text) continue

    const metaMatch = scenario.context_text.match(/\[SCENARIO_METADATA:\s*(\{.*?\})\]/s)
    let metadata: any = {}
    if (metaMatch && metaMatch[1]) {
      try {
        metadata = JSON.parse(metaMatch[1])
      } catch (e) {}
    }

    const currentFocus = metadata.evaluation_focus || ''
    
    // Check if it already has canonical metrics
    const hasCanonical = CANONICAL_METRICS.some(m => currentFocus.includes(m))
    
    if (!currentFocus || !hasCanonical) {
      // Empty or has old free-text metrics -> replace with all canonical metrics
      metadata.evaluation_focus = CANONICAL_METRICS.join(', ')
      
      let newContextText = scenario.context_text
      if (metaMatch) {
        newContextText = newContextText.replace(/\[SCENARIO_METADATA:\s*(\{.*?\})\]/s, `[SCENARIO_METADATA: ${JSON.stringify(metadata)}]`)
      } else {
        newContextText = `${newContextText}\n\n[SCENARIO_METADATA: ${JSON.stringify(metadata)}]`
      }

      const { error: updateErr } = await supabase.from('training_scenarios').update({ context_text: newContextText }).eq('id', scenario.id)
      if (updateErr) {
        console.error(`Failed to update scenario ${scenario.id}:`, updateErr)
      } else {
        updatedScenarios++
      }
    }
  }
  console.log(`✅ Updated ${updatedScenarios} scenarios to use canonical metrics.`)

  // 2. MIGRATE TRAINING SESSIONS (feedback_json.scores)
  console.log("\n--- Migrating Training Sessions ---")
  const { data: sessions, error: sessionsErr } = await supabase.from('training_sessions').select('id, feedback_json').not('feedback_json', 'is', null)
  if (sessionsErr) throw sessionsErr

  let updatedSessions = 0
  for (const session of sessions) {
    if (!session.feedback_json || !session.feedback_json.scores) continue

    const oldScores = session.feedback_json.scores
    const newScores: Record<string, any> = {}
    let needsUpdate = false

    for (const [key, value] of Object.entries(oldScores)) {
      if (SCORE_KEY_MAPPING[key]) {
        newScores[SCORE_KEY_MAPPING[key]] = value
        needsUpdate = true
      } else {
        newScores[key] = value // Keep it if it's already a new key or unknown
      }
    }

    if (needsUpdate) {
      const updatedFeedback = { ...session.feedback_json, scores: newScores }
      await supabase.from('training_sessions').update({ feedback_json: updatedFeedback }).eq('id', session.id)
      updatedSessions++
    }
  }
  console.log(`✅ Migrated scores for ${updatedSessions} legacy training sessions.`)

  console.log("\n🎉 Migration Complete!")
}

migrate().catch(console.error)
