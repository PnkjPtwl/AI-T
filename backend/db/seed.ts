import { randomUUID } from 'crypto'
import { supabase } from './supabase'

async function seed() {
  console.log('🌱 Starting database seed...')

  try {
    // 1. Create organizations
    console.log('📋 Creating organizations...')
    const orgNames = ['Acme Corp', 'Tech Innovations Inc', 'Global Sales Ltd']

    const { data: existingOrgs, error: orgFetchError } = await supabase
      .from('organisations')
      .select('id, name')
      .in('name', orgNames)

    if (orgFetchError) throw orgFetchError

    const existingOrgNames = new Set((existingOrgs || []).map(o => o.name))
    const orgsToCreate = orgNames
      .filter(name => !existingOrgNames.has(name))
      .map(name => ({ name }))

    let orgs = existingOrgs || []
    if (orgsToCreate.length > 0) {
      const { data: createdOrgs, error: orgCreateError } = await supabase
        .from('organisations')
        .insert(orgsToCreate)
        .select('id, name')

      if (orgCreateError) throw orgCreateError
      orgs = [...orgs, ...(createdOrgs || [])]
    }

    console.log(`✅ Ensured ${orgs.length} organizations`)

    const org = orgs.find(o => o.name === 'Acme Corp')
    if (!org) throw new Error('No organization created')

    // 2. Create test users (manager + reps)
    console.log('👥 Creating test users...')

    const usersPayload = [
      {
        id: randomUUID(),
        name: 'John Manager',
        email: 'manager@acmecorp.com',
        role: 'manager',
        org_id: org.id
      },
      {
        id: randomUUID(),
        name: 'Alice Sales Rep',
        email: 'alice@acmecorp.com',
        role: 'rep',
        org_id: org.id
      },
      {
        id: randomUUID(),
        name: 'Bob Sales Rep',
        email: 'bob@acmecorp.com',
        role: 'rep',
        org_id: org.id
      },
      {
        id: randomUUID(),
        name: 'Carol Sales Rep',
        email: 'carol@acmecorp.com',
        role: 'rep',
        org_id: org.id
      }
    ]

    const { data: users, error: userError } = await supabase
      .from('users')
      .upsert(usersPayload, { onConflict: 'email' })
      .select('id, email, role')

    if (userError) throw userError
    console.log(`✅ Ensured ${users?.length || 0} users`)

    const manager = users?.find(u => u.role === 'manager')
    const reps = users?.filter(u => u.role === 'rep') || []
    if (!manager || reps.length === 0) {
      throw new Error('Expected manager and rep users to exist after seeding')
    }

    // 3. Create training scenarios
    console.log('🎯 Creating training scenarios...')
    const scenarios = [
      {
        org_id: org.id,
        persona_name: 'Skeptical CFO',
        persona_type: 'Analytical/Dismissive',
        difficulty: 'Hard',
        context_text: '[SCENARIO: Pricing Negotiation] Focus on ROI and cost-benefit analysis.',
        evaluation_focus: 'roi_justification, pricing_defense, logic',
        objection_style: 'Heavily pushes back on cost without clear proof of value.',
        target_skills: 'Negotiation, Financial Acumen'
      },
      {
        org_id: org.id,
        persona_name: 'Angry Customer',
        persona_type: 'Emotional/Aggressive',
        difficulty: 'Medium',
        context_text: '[SCENARIO: Angry Customer Resolution] Practice de-escalation and empathy.',
        evaluation_focus: 'deescalation, empathy, resolution_pacing',
        objection_style: 'Emotional and prone to interrupting if they feel unheard.',
        target_skills: 'Conflict Resolution, Empathy'
      },
      {
        org_id: org.id,
        persona_name: 'Busy Executive',
        persona_type: 'Direct/Fast-paced',
        difficulty: 'Hard',
        context_text: '[SCENARIO: Executive Sales Pitch] Deliver a 5-minute value proposition.',
        evaluation_focus: 'brevity, value_proposition, confidence',
        objection_style: 'Impatient; demands direct answers to "What\'s the bottom line?"',
        target_skills: 'Executive Presence, Pitching'
      },
      {
        org_id: org.id,
        persona_name: 'New Prospect',
        persona_type: 'Neutral/Interested',
        difficulty: 'Easy',
        context_text: '[SCENARIO: Cold Outreach Call] Open the conversation and book a discovery meeting.',
        evaluation_focus: 'hook, qualifying_questions, closing',
        objection_style: 'Uses common brush-offs like "Just send me an email."',
        target_skills: 'Cold Calling, Appointment Setting'
      },
      {
        org_id: org.id,
        persona_name: 'Existing Client',
        persona_type: 'Collaborative/Concerned',
        difficulty: 'Medium',
        context_text: '[SCENARIO: Renewal Retention Call] Address churn risks and highlight realized value.',
        evaluation_focus: 'retention_strategy, relationship_building, expansion',
        objection_style: 'Concerned about recent service issues but open to solutions.',
        target_skills: 'Account Management, Retention'
      }
    ]

    const scenarioNames = scenarios.map(s => s.persona_name)
    const { data: existingScenarios, error: scenarioFetchError } = await supabase
      .from('training_scenarios')
      .select('id, persona_name')
      .eq('org_id', org.id)
      .in('persona_name', scenarioNames)

    if (scenarioFetchError) throw scenarioFetchError

    const existingScenarioNames = new Set((existingScenarios || []).map(s => s.persona_name))
    const scenariosToCreate = scenarios.filter(s => !existingScenarioNames.has(s.persona_name))

    let scenariosCreated = existingScenarios || []
    if (scenariosToCreate.length > 0) {
      const { data: createdScenarios, error: scenarioCreateError } = await supabase
        .from('training_scenarios')
        .insert(scenariosToCreate)
        .select('id, persona_name')

      if (scenarioCreateError) throw scenarioCreateError
      scenariosCreated = [...scenariosCreated, ...(createdScenarios || [])]
    }

    console.log(`✅ Ensured ${scenariosCreated.length} training scenarios`)

    // 4. Create some sample training assignments
    if (manager && reps.length > 0 && scenariosCreated.length >= 5) {
      console.log('📌 Creating training assignments...')
      
      const today = new Date()
      const assignments = [
        {
          manager_id: manager.id,
          rep_id: reps[0].id,
          scenario_id: scenariosCreated[0].id,
          status: 'Pending',
          priority: 'High',
          deadline: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          manager_id: manager.id,
          rep_id: reps[1].id,
          scenario_id: scenariosCreated[2].id,
          status: 'Pending',
          priority: 'Medium',
          deadline: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          manager_id: manager.id,
          rep_id: reps[2].id,
          scenario_id: scenariosCreated[4].id,
          status: 'In Progress',
          priority: 'Low',
          deadline: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]

      const { data: existingAssignments, error: existingAssignmentsError } = await supabase
        .from('training_assignments')
        .select('id, rep_id, manager_id, scenario_id')
        .eq('manager_id', manager.id)
        .in('rep_id', reps.map(r => r.id))
        .in('scenario_id', assignments.map(a => a.scenario_id))

      if (existingAssignmentsError) throw existingAssignmentsError

      const assignmentKeys = new Set(
        (existingAssignments || []).map(a => `${a.manager_id}:${a.rep_id}:${a.scenario_id}`)
      )

      const assignmentsToInsert = assignments.filter(a => !assignmentKeys.has(`${a.manager_id}:${a.rep_id}:${a.scenario_id}`))

      if (assignmentsToInsert.length > 0) {
        const { data: assignmentsCreated, error: assignmentError } = await supabase
          .from('training_assignments')
          .insert(assignmentsToInsert)
          .select('id')

        if (assignmentError) throw assignmentError
        console.log(`✅ Created ${assignmentsCreated?.length || 0} training assignments`)
      } else {
        console.log('✅ Sample training assignments already exist; skipping insert.')
      }
    }

    console.log('✨ Seed completed successfully!')
    process.exit(0)
  } catch (err: any) {
    console.error('❌ Seed failed:', err.message)
    console.error(err)
    process.exit(1)
  }
}

seed()
