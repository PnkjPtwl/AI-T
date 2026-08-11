import fs from 'fs'
import path from 'path'
import { Client } from 'pg'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env') })
dotenv.config()

async function applyUserExperienceMigration() {
  console.log('🚀 Running User Experience Table Setup & Seeding...')

  const migrationPath = path.join(__dirname, 'migrations', '013_user_experience.sql')
  const sql = fs.readFileSync(migrationPath, 'utf-8')

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (dbUrl) {
    console.log('Connecting via PostgreSQL direct connection...')
    try {
      const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      await client.connect()
      await client.query(sql)
      await client.end()
      console.log('✅ Table user_experience created via Direct PG!')
    } catch (err: any) {
      console.warn('Direct PG failed, attempting Supabase client fallback:', err.message)
    }
  }

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
    return
  }

  const supabase = createClient(url, serviceKey)

  // Try RPC 'exec_sql'
  const { error: rpcErr } = await supabase.rpc('exec_sql', { sql })
  if (!rpcErr) {
    console.log('✅ Table user_experience created via exec_sql RPC!')
  } else {
    console.log('RPC exec_sql info/note:', rpcErr.message)
  }

  // Fetch all reps from users table
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, name, email, role')

  if (usersErr) {
    console.error('❌ Failed to fetch users:', usersErr.message)
    return
  }

  if (!users || users.length === 0) {
    console.log('No users found in database.')
    return
  }

  console.log(`Found ${users.length} total users. Seeding experience values...`)

  // Pre-defined varied experience levels (in years) for sample reps
  // 0 years (<1 year), 1-2 years, 3+ years (>2 years)
  const sampleExperienceMap: Record<string, number> = {
    'alice@acmecorp.com': 0, // <1 year
    'bob@acmecorp.com': 2,   // 1-2 years
    'carol@acmecorp.com': 5  // >2 years
  }

  const expRecords = users.map((u, index) => {
    let expYears = 1 // default 1-2 years range
    if (sampleExperienceMap[u.email] !== undefined) {
      expYears = sampleExperienceMap[u.email]
    } else {
      // Distribute evenly among 0, 1, 3 for any other existing reps
      const distributed = [0, 1, 3]
      expYears = distributed[index % distributed.length]
    }

    return {
      user_id: u.id,
      experience_years: expYears
    }
  })

  const { data: inserted, error: expInsertErr } = await supabase
    .from('user_experience')
    .upsert(expRecords, { onConflict: 'user_id' })
    .select()

  if (expInsertErr) {
    console.error('❌ Error seeding user_experience table:', expInsertErr.message)
    console.log('\n======================================================')
    console.log('📌 NOTE: Make sure table `user_experience` is created in Supabase SQL Editor:')
    console.log(sql)
    console.log('======================================================\n')
  } else {
    console.log(`✅ Successfully seeded experience records for ${inserted?.length || expRecords.length} users!`)
  }
}

applyUserExperienceMigration().catch(err => {
  console.error('Fatal script error:', err)
})
