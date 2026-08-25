/**
 * seedAdmin.ts — Seeds the admin user and migrates existing data.
 * 
 * Run: npx ts-node backend/db/seedAdmin.ts
 * 
 * SAFE: Does NOT delete any existing users or scenarios.
 * 
 * Steps:
 * 1. Creates admin user in Supabase Auth (admin@relanto.com / password)
 * 2. Creates admin user row in `users` table with role='admin'
 * 3. Finds the existing manager and assigns ALL existing reps to them
 * 4. Sets `created_by` on ALL existing scenarios to the existing manager
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function seedAdmin() {
  console.log('🔧 Starting admin seed + data migration...\n')

  // ─── Step 0: Run the migration SQL ───
  console.log('📋 Step 0: Running migration SQL...')
  
  // Create manager_rep_assignments table
  const mraResult = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS manager_rep_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(rep_id)
      );
      CREATE INDEX IF NOT EXISTS idx_mra_manager_id ON manager_rep_assignments(manager_id);
      CREATE INDEX IF NOT EXISTS idx_mra_rep_id ON manager_rep_assignments(rep_id);
    `
  })

  // Try direct SQL via a raw approach if exec_sql doesn't exist
  // We'll use the REST API to check if table exists and create if not
  const { data: tableCheck } = await supabase
    .from('manager_rep_assignments')
    .select('id')
    .limit(0)

  if (tableCheck === null) {
    console.log('  ⚠️  manager_rep_assignments table may not exist yet.')
    console.log('  📌 Please run this SQL in Supabase SQL Editor first:')
    console.log(`
      CREATE TABLE IF NOT EXISTS manager_rep_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        manager_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rep_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(rep_id)
      );
      CREATE INDEX IF NOT EXISTS idx_mra_manager_id ON manager_rep_assignments(manager_id);
      CREATE INDEX IF NOT EXISTS idx_mra_rep_id ON manager_rep_assignments(rep_id);
      ALTER TABLE manager_rep_assignments ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "service_role_all_mra" ON manager_rep_assignments
        FOR ALL TO service_role USING (true) WITH CHECK (true);
      ALTER TABLE training_scenarios ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_training_scenarios_created_by ON training_scenarios(created_by);
    `)
    console.log('  Then re-run this script.\n')
  } else {
    console.log('  ✅ manager_rep_assignments table exists')
  }

  // ─── Step 1: Create admin in Supabase Auth ───
  console.log('\n👤 Step 1: Creating admin user in Supabase Auth...')
  
  const adminEmail = 'admin@relanto.com'
  const adminPassword = 'password'

  // Check if admin already exists in users table
  const { data: existingAdmin } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', adminEmail)
    .single()

  let adminId: string

  if (existingAdmin) {
    console.log(`  ✅ Admin user already exists: ${existingAdmin.id}`)
    adminId = existingAdmin.id

    // Ensure role is admin
    if (existingAdmin.role !== 'admin') {
      await supabase
        .from('users')
        .update({ role: 'admin' })
        .eq('id', existingAdmin.id)
      console.log('  🔄 Updated role to admin')
    }
  } else {
    // Find an org to associate admin with (use first available org)
    const { data: orgs } = await supabase
      .from('organisations')
      .select('id')
      .limit(1)
    
    const orgId = orgs?.[0]?.id
    if (!orgId) {
      console.error('  ❌ No organisation found. Cannot create admin without an org.')
      process.exit(1)
    }

    // Create in Supabase Auth — pass org_id in metadata so the DB trigger can create the users row
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        name: 'Admin',
        role: 'admin',
        org_id: orgId
      }
    })

    if (authError) {
      // If user already exists in auth but not in users table
      if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
        console.log('  ⚠️  Auth user exists but not in users table. Listing auth users to find ID...')
        const { data: authUsers } = await supabase.auth.admin.listUsers()
        const authAdmin = (authUsers?.users as any[])?.find((u: any) => u.email === adminEmail)
        if (authAdmin) {
          adminId = authAdmin.id
        } else {
          console.error('  ❌ Could not find admin in auth users')
          process.exit(1)
        }
      } else {
        console.error('  ❌ Failed to create admin auth user:', authError.message)
        process.exit(1)
      }
    } else {
      adminId = authData.user.id
    }

    // The DB trigger should have created the users row via handle_new_user().
    // Upsert as fallback to ensure the user row exists with correct role.
    const { error: userError } = await supabase
      .from('users')
      .upsert({
        id: adminId!,
        name: 'Admin',
        email: adminEmail,
        role: 'admin',
        org_id: orgId
      }, { onConflict: 'id' })

    if (userError) {
      console.error('  ❌ Failed to create admin user row:', userError.message)
      // Try without org_id
      const { error: retryError } = await supabase
        .from('users')
        .upsert({
          id: adminId!,
          name: 'Admin',
          email: adminEmail,
          role: 'admin'
        }, { onConflict: 'id' })
      
      if (retryError) {
        console.error('  ❌ Retry failed:', retryError.message)
        process.exit(1)
      }
    }

    console.log(`  ✅ Admin created: ${adminId!}`)
  }

  // ─── Step 2: Migrate existing reps to existing manager ───
  console.log('\n🔗 Step 2: Migrating existing reps to existing manager...')

  const { data: managers } = await supabase
    .from('users')
    .select('id, name, email')
    .eq('role', 'manager')
    .order('created_at', { ascending: true })

  if (!managers || managers.length === 0) {
    console.log('  ⚠️  No managers found. Skipping rep assignment.')
  } else {
    // Use the first (oldest) manager
    const primaryManager = managers[0]
    console.log(`  📌 Primary manager: ${primaryManager.name} (${primaryManager.email})`)

    const { data: reps } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('role', 'rep')

    if (!reps || reps.length === 0) {
      console.log('  ⚠️  No reps found.')
    } else {
      console.log(`  📌 Found ${reps.length} reps to assign`)

      const assignments = reps.map(rep => ({
        manager_id: primaryManager.id,
        rep_id: rep.id,
        assigned_by: adminId!
      }))

      const { error: assignError } = await supabase
        .from('manager_rep_assignments')
        .upsert(assignments, { onConflict: 'rep_id' })

      if (assignError) {
        console.error('  ❌ Failed to assign reps:', assignError.message)
      } else {
        console.log(`  ✅ Assigned ${reps.length} reps to ${primaryManager.name}`)
        reps.forEach(rep => {
          console.log(`     → ${rep.name} (${rep.email})`)
        })
      }
    }

    // ─── Step 3: Set created_by on existing scenarios ───
    console.log('\n🎯 Step 3: Setting created_by on existing scenarios...')

    const { data: scenarios, error: scenarioFetchError } = await supabase
      .from('training_scenarios')
      .select('id, persona_name, created_by')
      .is('created_by', null)

    if (scenarioFetchError) {
      console.error('  ❌ Failed to fetch scenarios:', scenarioFetchError.message)
      console.log('  ℹ️  This may mean the created_by column does not exist yet.')
      console.log('  📌 Run this SQL in Supabase SQL Editor:')
      console.log('     ALTER TABLE training_scenarios ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;')
    } else if (!scenarios || scenarios.length === 0) {
      console.log('  ✅ All scenarios already have created_by set (or no scenarios exist)')
    } else {
      const scenarioIds = scenarios.map(s => s.id)

      const { error: updateError } = await supabase
        .from('training_scenarios')
        .update({ created_by: primaryManager.id })
        .in('id', scenarioIds)

      if (updateError) {
        console.error('  ❌ Failed to update scenarios:', updateError.message)
      } else {
        console.log(`  ✅ Updated ${scenarios.length} scenarios with created_by = ${primaryManager.name}`)
        scenarios.forEach(s => {
          console.log(`     → ${s.persona_name}`)
        })
      }
    }
  }

  console.log('\n✨ Admin seed + migration completed!\n')
  console.log('📋 Summary:')
  console.log(`   Admin: ${adminEmail} / ${adminPassword}`)
  console.log('   Login at the app and you will be redirected to /admin/dashboard')
  
  process.exit(0)
}

seedAdmin().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
