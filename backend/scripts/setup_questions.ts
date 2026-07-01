import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../.env') })

const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function setup() {
  console.log('🚀 Setting up question_bank table...')

  // Since we can't easily run arbitrary DDL via the JS client without a specific function,
  // we can use a workaround: execute raw SQL if rpc 'exec_sql' exists,
  // OR we can just assume the user has to run the SQL in Supabase Dashboard.
  // Wait, I can try to insert a dummy row. If the table doesn't exist, it fails.
  // We can provide the SQL here for reference.
  
  const sql = `
    CREATE TABLE IF NOT EXISTS question_bank (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      scenario_id UUID,
      category TEXT NOT NULL,
      question_text TEXT NOT NULL,
      average_rating NUMERIC DEFAULT 0,
      total_ratings INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
  
  console.log('--- PLEASE RUN THE FOLLOWING SQL IN YOUR SUPABASE SQL EDITOR ---')
  console.log(sql)
  console.log('--------------------------------------------------------------')
  
  // Create a wrapper function in Supabase if possible, or just let the user run it.
  try {
    const { error } = await supabase.from('question_bank').select('id').limit(1)
    if (error) {
       console.log('The table question_bank might not exist. Run the SQL above.')
    } else {
       console.log('✅ question_bank table exists.')
    }
  } catch (err) {
    console.error(err)
  }

  process.exit(0)
}

setup()
