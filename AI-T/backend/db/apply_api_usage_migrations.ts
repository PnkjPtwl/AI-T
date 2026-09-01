import fs from 'fs'
import path from 'path'
import { Client } from 'pg'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: path.join(__dirname, '../.env') })
dotenv.config()

async function applyApiUsageMigrations() {
  console.log('🚀 Applying API Usage and Costs Migrations...')

  const sql19 = fs.readFileSync(path.join(__dirname, 'migrations', '019_api_costs.sql'), 'utf-8')
  const sql20 = fs.readFileSync(path.join(__dirname, 'migrations', '020_api_usage_logs.sql'), 'utf-8')
  const fullSql = `${sql19}\n\n${sql20}`

  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (dbUrl) {
    console.log('Connecting via PostgreSQL direct connection...')
    try {
      const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
      await client.connect()
      await client.query(fullSql)
      await client.end()
      console.log('✅ Migrations applied successfully via Direct PG!')
      return
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
  const { error: rpcErr1 } = await supabase.rpc('exec_sql', { sql: sql19 })
  if (!rpcErr1) {
    console.log('✅ 019_api_costs.sql applied via exec_sql RPC!')
  } else {
    console.log('RPC exec_sql 019 result:', rpcErr1.message)
  }

  const { error: rpcErr2 } = await supabase.rpc('exec_sql', { sql: sql20 })
  if (!rpcErr2) {
    console.log('✅ 020_api_usage_logs.sql applied via exec_sql RPC!')
  } else {
    console.log('RPC exec_sql 020 result:', rpcErr2.message)
  }
}

applyApiUsageMigrations().catch(err => {
  console.error('Migration error:', err)
})
