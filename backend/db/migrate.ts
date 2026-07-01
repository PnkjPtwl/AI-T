import { supabase } from './supabase'
import fs from 'fs'
import path from 'path'

async function runMigrations() {
  console.log('🚀 Running database migrations...')

  try {
    const migrationsDir = path.join(__dirname, 'migrations')
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const filePath = path.join(migrationsDir, file)
      const sql = fs.readFileSync(filePath, 'utf-8')

      console.log(`▶️  Running migration: ${file}`)
      
      // Split by semicolon and filter out empty statements
      const statements = sql.split(';').filter(s => s.trim())
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            // Use rpc to execute raw SQL
            const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() })
            
            if (error && !error.message.includes('already exists')) {
              console.error(`Error in ${file}:`, error.message)
            }
          } catch (e: any) {
            // Supabase doesn't support exec_sql RPC by default
            // We need to use a different approach
            console.log(`⚠️  Skipping RPC execution. Use Supabase SQL Editor to run: ${file}`)
          }
        }
      }
    }

    console.log('✅ Migration setup complete!')
    console.log('📝 Next step: Run the migrations in Supabase SQL Editor')
    console.log('   Go to: Supabase Dashboard → SQL Editor → run each migration file')
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message)
    throw err
  }
}

async function setup() {
  try {
    await runMigrations()
  } catch (err) {
    console.error('Setup failed:', err)
    process.exit(1)
  }
}

setup()
