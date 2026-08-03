import fs from 'fs'
import path from 'path'
import { Client } from 'pg'
import dotenv from 'dotenv'
dotenv.config()

async function applyMigration() {
  console.log('🚀 Applying V2 database migration...')
  
  const migrationPath = path.join(__dirname, 'migrations', '012_v2_schema_update.sql')
  const sql = fs.readFileSync(migrationPath, 'utf-8')
  
  // Method 1: Try via PostgreSQL direct connection if DATABASE_URL present
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (dbUrl) {
    console.log('Using pg client with DATABASE_URL...')
    const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    await client.connect()
    await client.query(sql)
    await client.end()
    console.log('✅ Migration applied successfully via PG direct connection!')
    return
  }

  // Method 2: Use Supabase JS Client with exec_sql RPC or statement execution
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    return
  }

  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(url, serviceKey)

  // Try RPC 'exec_sql'
  const { error } = await supabase.rpc('exec_sql', { sql })
  if (!error) {
    console.log('✅ Migration applied successfully via exec_sql RPC!')
    return
  }
  
  console.log('RPC result:', error.message)
  console.log('\n======================================================')
  console.log('📌 NOTE FOR USER / EXECUTION:')
  console.log('If RPC is disabled, execute `backend/db/migrations/012_v2_schema_update.sql` in Supabase SQL Editor.')
  console.log('======================================================\n')
}

applyMigration().catch(err => {
  console.error('Migration error:', err)
})
